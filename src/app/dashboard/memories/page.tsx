
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import MemoryCardPhotos from "@/components/MemoryCardPhotos";
import MemorySharingControl from "@/components/MemorySharingControl";

const supabase = createClient();


type Memory = {
  id: string;
  title: string;
  body: string;
  memory_year: number | null;
  visibility: "private" | "classmates";
  institution_id: string;
  created_at: string;
};


type Institution = {
  id: string;
  name: string;
};

export default function MyMemoriesPage() {
  const [lang, setLang] = useState<"en" | "ar">("en");
  const [memories, setMemories] = useState<Memory[]>([]);
  const [institutionNames, setInstitutionNames] = useState<
    Record<string, string>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const ar = lang === "ar";

  // Delete a memory and its associated photographs.
  async function deleteMemory(memoryId: string) {
    if (deletingId !== null) return;

    const confirmed = window.confirm(
      ar
        ? "هل أنت متأكد من حذف هذه الذكرى وجميع صورها نهائياً؟"
        : "Are you sure you want to permanently delete this memory and all its photos?"
    );

    if (!confirmed) return;

    setDeletingId(memoryId);
    setError("");

    try {
      // Verify the signed-in user.
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError || !authData.user) {
        throw new Error(
          ar
            ? "يرجى تسجيل الدخول مجدداً."
            : "Please sign in again."
        );
      }

      const userId = authData.user.id;

      // Verify that the user owns the private memory.
      const { data: memory, error: memoryError } =
        await supabase
          .from("memories")
          .select("id")
          .eq("id", memoryId)
          .eq("author_id", userId)
          .eq("visibility", "private")
          .single();

      if (memoryError || !memory) {
        throw new Error(
          ar
            ? "لم يتم العثور على الذكرى أو لا تملك صلاحية حذفها."
            : "Memory not found or permission denied."
        );
      }

      // Retrieve associated photo records.
      const { data: media, error: mediaError } =
        await supabase
          .from("memory_media")
          .select("id, storage_path")
          .eq("memory_id", memoryId);

      if (mediaError) {
        throw mediaError;
      }

      const expectedPrefix = `${userId}/${memoryId}/`;

      const paths = (media ?? []).map(
        (item) => item.storage_path
      );

      // Ensure that all paths belong to this memory.
      if (
        paths.some(
          (path) =>
            !path.startsWith(expectedPrefix) ||
            path.length <= expectedPrefix.length
        )
      ) {
        throw new Error(
          ar
            ? "تم اكتشاف مسار صورة غير صالح. تم إيقاف الحذف."
            : "Invalid photo path detected. Deletion stopped."
        );
      }

      // Remove the actual photo files from Supabase Storage.
      // Process files in batches of 100.
      for (let i = 0; i < paths.length; i += 100) {
        const batch = paths.slice(i, i + 100);

        const { error: storageError } =
          await supabase.storage
            .from("memory-photos")
            .remove(batch);

        if (storageError) {
          throw new Error(
            ar
              ? `تعذر حذف بعض الصور: ${storageError.message}`
              : `Could not delete some photos: ${storageError.message}`
          );
        }
      }

      // Delete the memory record.
      // ON DELETE CASCADE also removes its memory_media rows.
      const { data: deleted, error: deleteError } =
        await supabase
          .from("memories")
          .delete()
          .eq("id", memoryId)
          .eq("author_id", userId)
          .eq("visibility", "private")
          .select("id");

      if (deleteError || !deleted?.length) {
        throw new Error(
          deleteError?.message ??
            (ar
              ? "تعذر حذف الذكرى."
              : "Could not delete the memory.")
        );
      }

      // Remove the deleted memory from the interface.
      setMemories((current) =>
        current.filter((item) => item.id !== memoryId)
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : ar
            ? "حدث خطأ أثناء حذف الذكرى."
            : "An error occurred while deleting the memory."
      );
    } finally {
      setDeletingId(null);
    }
  }

  // Load memories and institution names.
  useEffect(() => {
    let active = true;

    async function loadMemories() {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (!active) return;

      if (authError || !authData.user) {
        setError("Please sign in first.");
        setLoading(false);
        return;
      }

      const userId = authData.user.id;

      // Load the user's preferred language.
      const { data: profile } = await supabase
        .from("profiles")
        .select("locale")
        .eq("id", userId)
        .single();

      if (!active) return;

      if (profile?.locale === "ar") {
        setLang("ar");
      }

      // Load the user's saved memories.
      const { data, error: memoriesError } =
        await supabase
          .from("memories")
          .select(
            "id, title, body, memory_year, visibility, institution_id, created_at"
          )
          .eq("author_id", userId)
          .order("created_at", { ascending: false });

      if (!active) return;

      if (memoriesError) {
        setError(memoriesError.message);
        setLoading(false);
        return;
      }

      const savedMemories = (data ?? []) as Memory[];
      setMemories(savedMemories);

      // Collect unique institution IDs.
      const ids = [
        ...new Set(
          savedMemories.map((item) => item.institution_id)
        ),
      ];

      // Load institution names.
      if (ids.length > 0) {
        const {
          data: institutions,
          error: institutionsError,
        } = await supabase
          .from("institutions")
          .select("id, name")
          .in("id", ids);

        if (!active) return;

        if (institutionsError) {
          setError(institutionsError.message);
        } else {
          const names: Record<string, string> = {};

          for (const institution of
            (institutions ?? []) as Institution[]) {
            names[institution.id] = institution.name;
          }

          setInstitutionNames(names);
        }
      }

      if (active) {
        setLoading(false);
      }
    }

    void loadMemories();

    return () => {
      active = false;
    };
  }, []);

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
          maxWidth: 900,
          margin: "0 auto",
        }}
      >
        {/* Page header */}
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 16,
            marginBottom: 28,
          }}
        >
          <div>
            <h1
              style={{
                color: "#873b50",
                marginBottom: 8,
              }}
            >
              {ar ? "ذكرياتي" : "My Memories"}
            </h1>

            <p
              style={{
                color: "#756c70",
                margin: 0,
              }}
            >
              {ar
                ? "احتفظ بقصصك ولحظاتك التي لا تُنسى."
                : "Your stories and unforgettable moments, all in one place."}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setLang(ar ? "en" : "ar")}
            style={{
              background: "#fff",
              border: "1px solid #e3d6da",
              color: "#873b50",
              borderRadius: 9,
              padding: "10px 15px",
              cursor: "pointer",
            }}
          >
            {ar ? "English" : "العربية"}
          </button>
        </header>

        {/* Create Memory button */}
        <div style={{ marginBottom: 24 }}>
          <Link
            href="/dashboard/memories/new"
            style={{
              display: "inline-block",
              background: "#873b50",
              color: "#fff",
              padding: "12px 20px",
              borderRadius: 9,
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            {ar ? "+ أضف ذكرى جديدة" : "+ Create a Memory"}
          </Link>
        </div>

        {/* Loading state */}
        {loading && (
          <p>
            {ar
              ? "جارٍ تحميل الذكريات..."
              : "Loading memories..."}
          </p>
        )}

        {/* Error message */}
        {error && (
          <p
            role="alert"
            style={{
              color: "#b42318",
              background: "#fff1f0",
              border: "1px solid #ffd5d2",
              borderRadius: 9,
              padding: 14,
              marginBottom: 20,
            }}
          >
            {error}
          </p>
        )}

        {/* Empty state */}
        {!loading && !error && memories.length === 0 && (
          <div
            style={{
              background: "#fff",
              padding: 32,
              borderRadius: 16,
              textAlign: "center",
            }}
          >
            <h2 style={{ color: "#873b50" }}>
              {ar
                ? "لا توجد ذكريات بعد"
                : "No memories yet"}
            </h2>

            <p style={{ color: "#756c70" }}>
              {ar
                ? "ابدأ بإضافة أول ذكرى من أيام الدراسة."
                : "Start by adding your first school or university memory."}
            </p>
          </div>
        )}

        {/* Memories list */}
        {!loading && memories.length > 0 && (
          <div
            style={{
              display: "grid",
              gap: 18,
            }}
          >
            {memories.map((memory) => (
              <article
                key={memory.id}
                style={{
                  background: "#fff",
                  border: "1px solid #eee5e8",
                  borderRadius: 16,
                  padding: 24,
                  boxShadow:
                    "0 5px 18px rgba(0,0,0,0.03)",
                }}
              >
                {/* Memory title */}
                <h2
                  style={{
                    color: "#873b50",
                    margin: "0 0 12px",
                    fontSize: 22,
                  }}
                >
                  {memory.title}
                </h2>

                {/* Institution and year */}
                <p
                  style={{
                    color: "#756c70",
                    fontSize: 14,
                  }}
                >
                  🎓{" "}
                  {institutionNames[memory.institution_id] ||
                    (ar
                      ? "مؤسسة تعليمية"
                      : "Institution")}
                  {" · "}
                  {memory.memory_year ?? "—"}
                </p>

                {/* Memory story */}
                <p
                  style={{
                    lineHeight: 1.8,
                    whiteSpace: "pre-wrap",
                    overflowWrap: "anywhere",
                  }}
                >
                  {memory.body}
                </p>
                {/* Memory photographs */}
<MemoryCardPhotos
  memoryId={memory.id}
  lang={lang}
/>

                {/* Privacy and date */}
                <div
                  style={{
                    borderTop: "1px solid #f0e7ea",
                    paddingTop: 14,
                    marginTop: 18,
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    flexWrap: "wrap",
                    color: "#756c70",
                    fontSize: 13,
                  }}
                >
                  <span>
                    🔒 {ar ? "خاص" : "Private"}
                  </span>

                  <span>
                    {new Date(
                      memory.created_at
                    ).toLocaleDateString(
                      ar ? "ar-JO" : "en-GB"
                    )}
                  </span>
                </div>
<MemorySharingControl
  memoryId={memory.id}
  initialVisibility={memory.visibility}
  lang={lang}
/>
                {/* Edit and Delete controls */}
                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    marginTop: 18,
                    flexWrap: "wrap",
                  }}
                >
                  <Link
                    href={`/dashboard/memories/${memory.id}/edit`}
                    style={{
                      background: "#f2e5e9",
                      color: "#873b50",
                      padding: "10px 18px",
                      borderRadius: 8,
                      textDecoration: "none",
                      fontWeight: 600,
                    }}
                  >
                    {ar ? "تعديل" : "Edit"}
                  </Link>

                  <button
                    type="button"
                    disabled={deletingId !== null}
                    onClick={() =>
                      void deleteMemory(memory.id)
                    }
                    style={{
                      background: "#fff",
                      color: "#b42318",
                      border: "1px solid #b42318",
                      padding: "10px 18px",
                      borderRadius: 8,
                      cursor:
                        deletingId !== null
                          ? "wait"
                          : "pointer",
                      fontWeight: 600,
                    }}
                  >
                    {deletingId === memory.id
                      ? ar
                        ? "جارٍ الحذف..."
                        : "Deleting..."
                      : ar
                        ? "حذف"
                        : "Delete"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}

        {/* Back to dashboard */}
        <p style={{ marginTop: 30 }}>
          <Link
            href="/dashboard"
            style={{
              color: "#873b50",
            }}
          >
            {ar
              ? "العودة إلى لوحة التحكم"
              : "Back to dashboard"}
          </Link>
        </p>
      </div>
    </main>
  );
}
