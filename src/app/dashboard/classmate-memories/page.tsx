
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import MemoryCardPhotos from "@/components/MemoryCardPhotos";

const supabase = createClient();

type Memory = {
  id: string;
  title: string;
  body: string | null;
  memory_year: number | null;
  author_id: string;
  institution_id: string;
  created_at: string;
};

type Profile = {
  id: string;
  display_name: string | null;
};

export default function ClassmateMemoriesPage() {
  const [lang, setLang] = useState<"en" | "ar">("en");
  const [memories, setMemories] = useState<Memory[]>([]);
  const [authors, setAuthors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const ar = lang === "ar";

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const { data: auth, error: authError } =
          await supabase.auth.getUser();

        if (authError || !auth.user) {
          throw new Error("Please sign in.");
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("locale")
          .eq("id", auth.user.id)
          .single();

        if (active) {
          setLang(profile?.locale === "ar" ? "ar" : "en");
        }

        // RLS returns only memories this user can read.
        const { data, error: memoryError } =
          await supabase
            .from("memories")
            .select(
              "id,title,body,memory_year,author_id,institution_id,created_at"
            )
            .eq("visibility", "classmates")
            .neq("author_id", auth.user.id)
            .order("created_at", { ascending: false });

        if (memoryError) throw memoryError;

        const rows = (data ?? []) as Memory[];

        const authorIds = [...new Set(rows.map((m) => m.author_id))];

        let names: Record<string, string> = {};

        if (authorIds.length > 0) {
          const { data: profiles, error: profileError } =
            await supabase
              .from("profiles")
              .select("id,display_name")
              .in("id", authorIds);

          if (profileError) throw profileError;

          names = Object.fromEntries(
            ((profiles ?? []) as Profile[]).map((p) => [
              p.id,
              p.display_name || "Classmate",
            ])
          );
        }

        if (active) {
          setMemories(rows);
          setAuthors(names);
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Could not load shared memories."
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
  }, []);

  return (
    <main
      dir={ar ? "rtl" : "ltr"}
      style={{
        maxWidth: 900,
        margin: "0 auto",
        padding: "32px 20px",
        color: "#30262a",
      }}
    >
      <Link
        href="/dashboard"
        style={{
          color: "#873b50",
          textDecoration: "none",
          fontWeight: 600,
        }}
      >
        {ar ? "العودة إلى لوحة التحكم" : "← Back to Dashboard"}
      </Link>

      <h1 style={{ marginTop: 30, color: "#873b50" }}>
        {ar ? "ذكريات زملاء الدراسة" : "Classmate Memories"}
      </h1>

      <p style={{ color: "#71686b" }}>
        {ar
          ? "ذكريات شاركها زملاؤك الذين تم التحقق من عضويتهم الدراسية."
          : "Memories shared by your verified classmates."}
      </p>

      {loading && (
        <p>{ar ? "جارٍ التحميل..." : "Loading memories..."}</p>
      )}

      {error && (
        <p role="alert" style={{ color: "#b42318" }}>
          {error}
        </p>
      )}

      {!loading && !error && memories.length === 0 && (
        <div
          style={{
            marginTop: 24,
            padding: 30,
            background: "#f8f5f0",
            borderRadius: 14,
            textAlign: "center",
          }}
        >
          {ar
            ? "لا توجد ذكريات مشتركة من زملائك حتى الآن."
            : "No memories shared by your classmates yet."}
        </div>
      )}

      <div style={{ display: "grid", gap: 20, marginTop: 28 }}>
        {memories.map((memory) => (
          <article
            key={memory.id}
            style={{
              padding: 24,
              background: "#fff",
              border: "1px solid #e8dfe1",
              borderRadius: 14,
              boxShadow: "0 3px 14px rgba(0,0,0,0.04)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
                marginBottom: 12,
              }}
            >
              <strong style={{ color: "#873b50" }}>
                {authors[memory.author_id] ||
                  (ar ? "زميل دراسة" : "Classmate")}
              </strong>

              <span
                style={{
                  fontSize: 12,
                  background: "#f8f5f0",
                  color: "#873b50",
                  padding: "5px 10px",
                  borderRadius: 20,
                }}
              >
                {ar ? "مشاركة مع الزملاء" : "Shared with classmates"}
              </span>
            </div>

            <h2 style={{ fontSize: 21, marginBottom: 8 }}>
              {memory.title}
            </h2>

            {memory.memory_year && (
              <p style={{ fontSize: 13, color: "#71686b" }}>
                {memory.memory_year}
              </p>
            )}

            {memory.body && (
              <p
                style={{
                  whiteSpace: "pre-wrap",
                  overflowWrap: "anywhere",
                  lineHeight: 1.8,
                }}
              >
                {memory.body}
              </p>
            )}
            <MemoryCardPhotos
  memoryId={memory.id}
  lang={lang}
  sharedView
/>
          </article>
        ))}
      </div>
    </main>
  );
}
