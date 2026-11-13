

"use client";

import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, FormEvent, CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

type Institution = {
  id: string;
  name: string;
  kind: string;
};

type Membership = {
  institution_id: string;
  start_year: number;
  end_year: number | null;
  status: string;
};

type SelectedPhoto = {
  id: string;
  file: File;
  previewUrl: string;
};

const MAX_SIZE = 5 * 1024 * 1024;
const MAX_PHOTOS = 10;

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export default function CreateMemoryPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photosRef = useRef<SelectedPhoto[]>([]);
  const savingRef = useRef(false);

  const [lang, setLang] = useState<"en" | "ar">("en");
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");

  const [institutionId, setInstitutionId] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [memoryYear, setMemoryYear] = useState("");
  const [photos, setPhotos] = useState<SelectedPhoto[]>([]);

  const ar = lang === "ar";

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const { data: authData, error: authError } =
          await supabase.auth.getUser();

        if (!active) return;

        if (authError || !authData.user) {
          router.replace("/login");
          return;
        }

        const userId = authData.user.id;

        const { data: profile } = await supabase
          .from("profiles")
          .select("locale")
          .eq("id", userId)
          .single();

        if (!active) return;

        if (profile?.locale === "ar") {
          setLang("ar");
        }

        const { data: memberships, error: membershipError } =
          await supabase
            .from("memberships")
            .select("institution_id, start_year, end_year, status")
            .eq("user_id", userId)
            .eq("status", "approved");

        if (!active) return;

        if (membershipError) {
          throw membershipError;
        }

        const approved = (memberships ?? []) as Membership[];
        const ids = [
          ...new Set(approved.map((item) => item.institution_id)),
        ];

        if (ids.length === 0) {
          setInstitutions([]);
          return;
        }

        const { data: schools, error: schoolsError } =
          await supabase
            .from("institutions")
            .select("id, name, kind")
            .in("id", ids)
            .order("name");

        if (!active) return;

        if (schoolsError) {
          throw schoolsError;
        }

        setInstitutions((schools ?? []) as Institution[]);
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Could not load institutions."
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [router]);

  // Track preview URLs and release them when leaving the page.
  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  useEffect(() => {
    return () => {
      for (const photo of photosRef.current) {
        URL.revokeObjectURL(photo.previewUrl);
      }
    };
  }, []);

  function handlePhotoSelection(
    event: ChangeEvent<HTMLInputElement>
  ) {
    if (savingRef.current) return;

    setError("");

    const selectedFiles = Array.from(event.target.files ?? []);

    if (selectedFiles.length === 0) return;

    if (photos.length + selectedFiles.length > MAX_PHOTOS) {
      setError(
        ar
          ? `يمكنك اختيار ${MAX_PHOTOS} صور كحد أقصى.`
          : `You can select up to ${MAX_PHOTOS} photos.`
      );
      event.target.value = "";
      return;
    }

    for (const file of selectedFiles) {
      if (!EXTENSIONS[file.type]) {
        setError(
          ar
            ? "يُسمح فقط بصور JPG وPNG وWebP."
            : "Only JPG, PNG, and WebP photos are allowed."
        );
        event.target.value = "";
        return;
      }

      if (file.size === 0 || file.size > MAX_SIZE) {
        setError(
          ar
            ? "يجب ألا يتجاوز حجم كل صورة 5 ميجابايت وألا تكون فارغة."
            : "Each photo must be nonempty and no larger than 5 MB."
        );
        event.target.value = "";
        return;
      }
    }

    const newPhotos = selectedFiles.map((file) => ({
      id: crypto.randomUUID(),
      file,
      previewUrl: URL.createObjectURL(file),
    }));

    setPhotos((current) => [...current, ...newPhotos]);
    event.target.value = "";
  }

  function removeSelectedPhoto(photoId: string) {
    if (savingRef.current) return;

    setPhotos((current) => {
      const removed = current.find((item) => item.id === photoId);

      if (removed) {
        URL.revokeObjectURL(removed.previewUrl);
      }

      return current.filter((item) => item.id !== photoId);
    });
  }

  async function saveMemory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (savingRef.current) return;

    setError("");
    setProgress("");

    const cleanTitle = title.trim();
    const cleanBody = body.trim();
    const year = Number(memoryYear);

    if (!institutionId) {
      setError(ar ? "اختر المؤسسة التعليمية." : "Select an institution.");
      return;
    }

    if (cleanTitle.length < 3 || cleanTitle.length > 150) {
      setError(
        ar
          ? "يجب أن يكون العنوان بين 3 و150 حرفاً."
          : "Title must be between 3 and 150 characters."
      );
      return;
    }

    if (cleanBody.length < 10 || cleanBody.length > 5000) {
      setError(
        ar
          ? "يجب أن تكون القصة بين 10 و5000 حرف."
          : "Story must be between 10 and 5000 characters."
      );
      return;
    }

    if (
      !memoryYear.trim() ||
      !Number.isInteger(year) ||
      year < 1900 ||
      year > new Date().getFullYear()
    ) {
      setError(
        ar ? "أدخل سنة صحيحة." : "Enter a valid memory year."
      );
      return;
    }

    savingRef.current = true;
    setSaving(true);

    let createdMemoryId: string | null = null;

    try {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError || !authData.user) {
        throw new Error(
          ar ? "يرجى تسجيل الدخول." : "Please sign in."
        );
      }

      const userId = authData.user.id;

      // Confirm that this institution membership is approved.
      const { data: membership, error: membershipError } =
        await supabase
          .from("memberships")
          .select("id")
          .eq("user_id", userId)
          .eq("institution_id", institutionId)
          .eq("status", "approved")
          .limit(1);

      if (membershipError || !membership?.length) {
        throw new Error(
          ar
            ? "يجب أن تكون عضويتك في المؤسسة معتمدة."
            : "An approved membership is required."
        );
      }

      setProgress(
        ar ? "جارٍ إنشاء الذكرى..." : "Creating memory..."
      );

      // Create the memory first to obtain its ID.
      const { data: memory, error: insertError } =
        await supabase
          .from("memories")
          .insert({
            author_id: userId,
            institution_id: institutionId,
            title: cleanTitle,
            body: cleanBody,
            memory_year: year,
            visibility: "private",
          })
          .select("id")
          .single();

      if (insertError || !memory) {
        throw new Error(
          insertError?.message ?? "Could not create memory."
        );
      }

      createdMemoryId = memory.id;

      // Upload selected photos automatically after creation.
      for (let index = 0; index < photos.length; index++) {
        const photo = photos[index];

        setProgress(
          ar
            ? `جارٍ رفع الصورة ${index + 1} من ${photos.length}...`
            : `Uploading photo ${index + 1} of ${photos.length}...`
        );

        const extension = EXTENSIONS[photo.file.type];

        const storagePath =
          `${userId}/${memory.id}/` +
          `${crypto.randomUUID()}.${extension}`;

        const { error: uploadError } =
          await supabase.storage
            .from("memory-photos")
            .upload(storagePath, photo.file, {
              contentType: photo.file.type,
              upsert: false,
            });

        if (uploadError) {
          throw new Error(
            `Photo ${index + 1}: ${uploadError.message}`
          );
        }

        const { error: metadataError } =
          await supabase
            .from("memory_media")
            .insert({
              memory_id: memory.id,
              storage_path: storagePath,
            });

        if (metadataError) {
          // Clean up this file if its metadata could not be saved.
          const { error: cleanupError } =
            await supabase.storage
              .from("memory-photos")
              .remove([storagePath]);

          if (cleanupError) {
            throw new Error(
              `${metadataError.message}. ` +
              `File cleanup failed: ${cleanupError.message}`
            );
          }

          throw metadataError;
        }
      }

      setProgress(
        ar
          ? "تم حفظ الذكرى والصور بنجاح."
          : "Memory and photos saved successfully."
      );

      router.push("/dashboard/memories");
      router.refresh();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : ar
            ? "حدث خطأ أثناء حفظ الذكرى."
            : "An error occurred while saving the memory.";

      if (createdMemoryId) {
        // The memory may already exist, and some photos may
        // already have uploaded. Keep it rather than deleting
        // partially completed user content.
        setError(
          ar
            ? `تم إنشاء الذكرى، لكن لم يكتمل رفع جميع الصور: ${message}. يمكنك إكمال الصور من صفحة تعديل الذكرى.`
            : `Memory was created, but not all photos uploaded: ${message}. You can finish uploading from the Edit Memory page.`
        );

        setProgress("");

        // Keep the created memory's ID available for recovery.
        setCreatedMemoryLink(createdMemoryId);
      } else {
        setError(message);
        setProgress("");
      }
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  const [createdMemoryLink, setCreatedMemoryLink] =
    useState<string | null>(null);

  const fieldStyle: CSSProperties = {
    width: "100%",
    padding: "13px 14px",
    border: "1px solid #dfd2d6",
    borderRadius: 9,
    background: "#fff",
    color: "#29232a",
    fontSize: 15,
    boxSizing: "border-box",
  };

  const labelStyle: CSSProperties = {
    display: "block",
    fontWeight: 600,
    marginBottom: 8,
  };

  return (
    <main
      dir={ar ? "rtl" : "ltr"}
      style={{
        minHeight: "100vh",
        background: "#f8f5f0",
        padding: "40px 16px",
        fontFamily: "Arial, sans-serif",
        color: "#29232a",
      }}
    >
      <div
        style={{
          maxWidth: 750,
          margin: "0 auto",
          background: "#fff",
          borderRadius: 18,
          padding: 28,
          boxShadow: "0 8px 28px rgba(0,0,0,0.05)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "center",
          }}
        >
          <h1 style={{ color: "#873b50" }}>
            {ar ? "أضف ذكرى جديدة" : "Create a Memory"}
          </h1>

          <button
            type="button"
            onClick={() => setLang(ar ? "en" : "ar")}
            disabled={saving}
            style={{
              ...fieldStyle,
              width: "auto",
              cursor: "pointer",
              color: "#873b50",
            }}
          >
            {ar ? "English" : "العربية"}
          </button>
        </div>

        <p style={{ color: "#756c70", lineHeight: 1.7 }}>
          {ar
            ? "دوّن لحظة من أيام الدراسة وأضف صورها."
            : "Capture a moment from your school or university days, including photos."}
        </p>

        {loading ? (
          <p>{ar ? "جارٍ التحميل..." : "Loading..."}</p>
        ) : institutions.length === 0 && !error ? (
          <div style={{ padding: 20, background: "#f8f5f0" }}>
            <p>
              {ar
                ? "تحتاج إلى عضوية تعليمية معتمدة لإنشاء ذكرى."
                : "You need an approved educational membership to create a memory."}
            </p>
            <Link href="/dashboard/education">
              {ar ? "رحلتي التعليمية" : "Educational Journey"}
            </Link>
          </div>
        ) : (
          <form onSubmit={(event) => void saveMemory(event)}>
            <div style={{ marginBottom: 20 }}>
              <label htmlFor="institution" style={labelStyle}>
                {ar ? "المؤسسة التعليمية" : "Institution"}
              </label>
              <select
                id="institution"
                value={institutionId}
                onChange={(event) =>
                  setInstitutionId(event.target.value)
                }
                disabled={saving || !!createdMemoryLink}
                required
                style={fieldStyle}
              >
                <option value="">
                  {ar ? "اختر المؤسسة" : "Select institution"}
                </option>
                {institutions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label htmlFor="memory-title" style={labelStyle}>
                {ar ? "عنوان الذكرى" : "Memory title"}
              </label>
              <input
                id="memory-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={150}
                disabled={saving || !!createdMemoryLink}
                required
                style={fieldStyle}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label htmlFor="memory-body" style={labelStyle}>
                {ar ? "قصتك" : "Your story"}
              </label>
              <textarea
                id="memory-body"
                value={body}
                onChange={(event) => setBody(event.target.value)}
                rows={7}
                maxLength={5000}
                disabled={saving || !!createdMemoryLink}
                required
                style={{
                  ...fieldStyle,
                  resize: "vertical",
                }}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label htmlFor="memory-year" style={labelStyle}>
                {ar ? "سنة الذكرى" : "Memory year"}
              </label>
              <input
                id="memory-year"
                type="number"
                min={1900}
                max={new Date().getFullYear()}
                value={memoryYear}
                onChange={(event) =>
                  setMemoryYear(event.target.value)
                }
                disabled={saving || !!createdMemoryLink}
                required
                style={fieldStyle}
              />
            </div>

            {/* Photo selection */}
            <section
              style={{
                background: "#f8f5f0",
                padding: 18,
                borderRadius: 12,
                border: "1px solid #eadfe2",
                marginBottom: 24,
              }}
            >
              <h3 style={{ color: "#873b50", marginTop: 0 }}>
                {ar ? "صور الذكرى" : "Memory Photos"}
              </h3>

              <p style={{ color: "#756c70", fontSize: 14 }}>
                {ar
                  ? "اختر حتى 10 صور. سيتم رفعها تلقائياً عند حفظ الذكرى."
                  : "Select up to 10 photos. They will upload automatically when you save the memory."}
              </p>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                disabled={saving || !!createdMemoryLink}
                onChange={handlePhotoSelection}
                aria-label={ar ? "اختيار الصور" : "Choose photos"}
              />

              {photos.length > 0 && (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fill, minmax(120px, 1fr))",
                    gap: 12,
                    marginTop: 18,
                  }}
                >
                  {photos.map((photo) => (
                    <div key={photo.id}>
                      <img
                        src={photo.previewUrl}
                        alt={photo.file.name}
                        style={{
                          width: "100%",
                          height: 110,
                          objectFit: "cover",
                          borderRadius: 9,
                        }}
                      />

                      <button
                        type="button"
                        onClick={() =>
                          removeSelectedPhoto(photo.id)
                        }
                        disabled={saving || !!createdMemoryLink}
                        style={{
                          marginTop: 6,
                          background: "transparent",
                          border: "none",
                          color: "#b42318",
                          cursor: "pointer",
                          padding: 4,
                        }}
                      >
                        {ar ? "إزالة" : "Remove"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <div
              style={{
                background: "#f8f5f0",
                padding: 14,
                borderRadius: 9,
                marginBottom: 24,
                fontSize: 14,
                color: "#756c70",
              }}
            >
              🔒{" "}
              {ar
                ? "ستُحفظ هذه الذكرى بشكل خاص، ولن يتمكن الآخرون من رؤيتها."
                : "This memory will be saved privately. Other members cannot view it."}
            </div>

            {progress && (
              <p role="status" style={{ color: "#873b50" }}>
                {progress}
              </p>
            )}

            {error && (
              <p role="alert" style={{ color: "#b42318" }}>
                {error}
              </p>
            )}

            {createdMemoryLink && (
              <p>
                <Link
                  href={`/dashboard/memories/${createdMemoryLink}/edit`}
                  style={{ color: "#873b50", fontWeight: 600 }}
                >
                  {ar
                    ? "افتح الذكرى لإكمال رفع الصور"
                    : "Open the memory to finish uploading photos"}
                </Link>
              </p>
            )}

            <button
              type="submit"
              disabled={saving || !!createdMemoryLink}
              style={{
                width: "100%",
                padding: 15,
                background: "#873b50",
                color: "#fff",
                border: "none",
                borderRadius: 9,
                cursor: saving ? "wait" : "pointer",
                fontSize: 16,
                fontWeight: "bold",
                opacity: saving || createdMemoryLink ? 0.6 : 1,
              }}
            >
              {saving
                ? ar
                  ? "جارٍ الحفظ ورفع الصور..."
                  : "Saving and uploading photos..."
                : ar
                  ? "حفظ الذكرى"
                  : "Save Memory"}
            </button>
          </form>
        )}

        <p style={{ marginTop: 28 }}>
          <Link
            href="/dashboard/memories"
            style={{ color: "#873b50" }}
          >
            {ar ? "العودة إلى ذكرياتي" : "Back to My Memories"}
          </Link>
        </p>
      </div>
    </main>
  );
}
