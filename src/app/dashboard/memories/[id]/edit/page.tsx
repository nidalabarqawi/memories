

"use client";

import { useEffect, useState } from "react";
import type { FormEvent, CSSProperties } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import MemoryPhotoUploader from "@/components/MemoryPhotoUploader";
import MemoryPhotoGallery from "@/components/MemoryPhotoGallery";

const supabase = createClient();

type Visibility = "private" | "classmates";

export default function EditMemoryPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [photoRefreshKey, setPhotoRefreshKey] = useState(0);

  const [lang, setLang] = useState<"en" | "ar">("en");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [year, setYear] = useState("");
  const [visibility, setVisibility] =
    useState<Visibility>("private");

  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const ar = lang === "ar";

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setLoaded(false);
      setError("");

      try {
        const { data: authData, error: authError } =
          await supabase.auth.getUser();

        if (!active) return;

        if (authError || !authData.user) {
          router.replace("/login");
          return;
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("locale")
          .eq("id", authData.user.id)
          .single();

        if (!active) return;

        if (profile?.locale === "ar") {
          setLang("ar");
        }

        // Owners can edit both private and shared memories.
        const { data: memory, error: memoryError } =
          await supabase
            .from("memories")
            .select(
              "title, body, memory_year, visibility"
            )
            .eq("id", id)
            .eq("author_id", authData.user.id)
            .single();

        if (!active) return;

        if (memoryError || !memory) {
          throw new Error(
            "Memory not found or you do not have permission."
          );
        }

        if (
          memory.visibility !== "private" &&
          memory.visibility !== "classmates"
        ) {
          throw new Error("Unsupported memory visibility.");
        }

        setTitle(memory.title ?? "");
        setBody(memory.body ?? "");
        setYear(
          memory.memory_year == null
            ? ""
            : String(memory.memory_year)
        );
        setVisibility(memory.visibility);
        setLoaded(true);
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Could not load memory."
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
  }, [id, router]);

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (saving || !loaded) return;

    setError("");

    const cleanTitle = title.trim();
    const cleanBody = body.trim();
    const memoryYear = Number(year);

    if (cleanTitle.length < 3 || cleanTitle.length > 150) {
      setError(
        ar
          ? "العنوان يجب أن يكون بين 3 و150 حرفاً."
          : "Title must be between 3 and 150 characters."
      );
      return;
    }

    if (cleanBody.length < 10 || cleanBody.length > 5000) {
      setError(
        ar
          ? "القصة يجب أن تكون بين 10 و5000 حرف."
          : "Story must be between 10 and 5000 characters."
      );
      return;
    }

    if (
      !year.trim() ||
      !Number.isInteger(memoryYear) ||
      memoryYear < 1900 ||
      memoryYear > new Date().getFullYear()
    ) {
      setError(
        ar ? "سنة غير صحيحة." : "Invalid memory year."
      );
      return;
    }

    setSaving(true);

    try {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError || !authData.user) {
        throw new Error(
          ar ? "يرجى تسجيل الدخول." : "Please sign in."
        );
      }

      // Only update story fields.
      // Do not change the memory's visibility.
      const { data, error: updateError } =
        await supabase
          .from("memories")
          .update({
            title: cleanTitle,
            body: cleanBody,
            memory_year: memoryYear,
          })
          .eq("id", id)
          .eq("author_id", authData.user.id)
          .select("id")
          .single();

      if (updateError || !data) {
        throw new Error(
          updateError?.message ??
            "Memory could not be updated."
        );
      }

      router.push("/dashboard/memories");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : ar
            ? "تعذر حفظ التغييرات."
            : "Could not save changes."
      );
    } finally {
      setSaving(false);
    }
  }

  const inputStyle: CSSProperties = {
    width: "100%",
    boxSizing: "border-box",
    padding: 14,
    border: "1px solid #dfd2d6",
    borderRadius: 9,
    fontSize: 15,
    color: "#29232a",
    background: "#fff",
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
        }}
      >
        <h1 style={{ color: "#873b50" }}>
          {ar ? "تعديل الذكرى" : "Edit Memory"}
        </h1>

        <button
          type="button"
          onClick={() => setLang(ar ? "en" : "ar")}
          style={{
            padding: "8px 14px",
            marginBottom: 24,
            cursor: "pointer",
          }}
        >
          {ar ? "English" : "العربية"}
        </button>

        {loading ? (
          <p>{ar ? "جارٍ التحميل..." : "Loading..."}</p>
        ) : !loaded ? (
          <p role="alert" style={{ color: "#b42318" }}>
            {error ||
              (ar
                ? "تعذر تحميل الذكرى."
                : "Could not load memory.")}
          </p>
        ) : (
          <>
            <form onSubmit={save}>
              <div style={{ marginBottom: 20 }}>
                <label htmlFor="title" style={labelStyle}>
                  {ar ? "عنوان الذكرى" : "Memory title"}
                </label>

                <input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={150}
                  required
                  style={inputStyle}
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label htmlFor="story" style={labelStyle}>
                  {ar ? "القصة" : "Your story"}
                </label>

                <textarea
                  id="story"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  maxLength={5000}
                  rows={8}
                  required
                  style={inputStyle}
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label htmlFor="year" style={labelStyle}>
                  {ar ? "سنة الذكرى" : "Memory year"}
                </label>

                <input
                  id="year"
                  type="number"
                  min={1900}
                  max={new Date().getFullYear()}
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  required
                  style={inputStyle}
                />
              </div>

              <div
                style={{
                  marginBottom: 20,
                  padding: "12px 14px",
                  borderRadius: 10,
                  background:
                    visibility === "classmates"
                      ? "#e8f5ed"
                      : "#f3eff0",
                  color:
                    visibility === "classmates"
                      ? "#276749"
                      : "#71686b",
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                {visibility === "classmates"
                  ? ar
                    ? "👥 مشاركة مع زملاء الدراسة"
                    : "👥 Shared with Classmates"
                  : ar
                    ? "🔒 ذكرى خاصة"
                    : "🔒 Private Memory"}
              </div>

              {error && (
                <p
                  role="alert"
                  style={{ color: "#b42318" }}
                >
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={saving}
                style={{
                  width: "100%",
                  padding: 15,
                  background: "#873b50",
                  color: "#fff",
                  border: "none",
                  borderRadius: 9,
                  cursor: saving ? "wait" : "pointer",
                  fontWeight: "bold",
                  fontSize: 16,
                }}
              >
                {saving
                  ? ar
                    ? "جارٍ الحفظ..."
                    : "Saving..."
                  : ar
                    ? "حفظ التغييرات"
                    : "Save Changes"}
              </button>
            </form>

            <MemoryPhotoUploader
              memoryId={id}
              lang={lang}
              onUploaded={() => {
                setPhotoRefreshKey(
                  (current) => current + 1
                );
              }}
            />

            <MemoryPhotoGallery
              memoryId={id}
              lang={lang}
              refreshKey={photoRefreshKey}
            />
          </>
        )}

        <p style={{ marginTop: 28 }}>
          <Link
            href="/dashboard/memories"
            style={{ color: "#873b50" }}
          >
            {ar
              ? "العودة إلى ذكرياتي"
              : "Back to My Memories"}
          </Link>
        </p>
      </div>
    </main>
  );
}
