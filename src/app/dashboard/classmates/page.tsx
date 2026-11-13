
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Classmate = {
  classmate_id: string;
  classmate_name: string;
  institution_id: string;
  institution_name: string;
  shared_start_year: number;
  shared_end_year: number;
};

const supabase = createClient();

export default function ClassmatesPage() {
  const [lang, setLang] = useState<"en" | "ar">("en");
  const [classmates, setClassmates] = useState<Classmate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const ar = lang === "ar";

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError("");

      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (!active) return;

      if (authError || !authData.user) {
        setError("Please sign in to find classmates.");
        setLoading(false);
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

      const { data, error: rpcError } =
        await supabase.rpc("find_classmates");

      if (!active) return;

      if (rpcError) {
        setError(rpcError.message);
      } else {
        setClassmates((data ?? []) as Classmate[]);
      }

      setLoading(false);
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
        minHeight: "100vh",
        background: "#f8f5f0",
        padding: "48px 20px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: 900,
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
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <h1 style={{ color: "#873b50" }}>
            {ar
              ? "ابحث عن زملائك القدامى"
              : "Find Your Classmates"}
          </h1>

          <button
            type="button"
            onClick={() => setLang(ar ? "en" : "ar")}
            style={{
              border: "none",
              borderRadius: 8,
              padding: "10px 16px",
              background: "#f2e5e9",
              color: "#873b50",
              cursor: "pointer",
            }}
          >
            {ar ? "English" : "العربية"}
          </button>
        </div>

        <p style={{ color: "#666", lineHeight: 1.7 }}>
          {ar
            ? "اكتشف زملاء الدراسة الذين شاركوك نفس المؤسسة التعليمية خلال سنوات متقاربة."
            : "Reconnect with people who attended the same institution during overlapping years."}
        </p>

        {loading && (
          <p>
            {ar
              ? "جارٍ البحث..."
              : "Searching for classmates..."}
          </p>
        )}

        {error && (
          <p role="alert" style={{ color: "#b42318" }}>
            {ar && error === "Please sign in to find classmates."
              ? "يرجى تسجيل الدخول للبحث عن زملائك."
              : error}
          </p>
        )}

        {!loading && !error && classmates.length === 0 && (
          <div
            style={{
              padding: 28,
              borderRadius: 12,
              background: "#f8f5f0",
              textAlign: "center",
              marginTop: 24,
            }}
          >
            <h2 style={{ color: "#873b50" }}>
              {ar
                ? "لم نعثر على زملاء مطابقين بعد"
                : "No matching classmates yet"}
            </h2>

            <p style={{ color: "#666" }}>
              {ar
                ? "عندما ينضم زملاؤك ويوافقون على الظهور ويتم اعتماد عضوياتهم، سيظهرون هنا."
                : "Classmates will appear here once they join, opt into discovery, and have approved memberships."}
            </p>
          </div>
        )}

        {!loading && !error && classmates.length > 0 && (
          <div
            style={{
              display: "grid",
              gap: 16,
              marginTop: 24,
            }}
          >
            {classmates.map((person) => (
              <article
                key={`${person.classmate_id}-${person.institution_id}`}
                style={{
                  border: "1px solid #eadfe2",
                  borderRadius: 12,
                  padding: 20,
                  background: "#fff",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    marginBottom: 16,
                  }}
                >
                  <div
                    aria-hidden="true"
                    style={{
                      width: 54,
                      height: 54,
                      borderRadius: "50%",
                      background: "#873b50",
                      color: "#fff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 22,
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    {person.classmate_name
                      .trim()
                      .charAt(0)
                      .toUpperCase()}
                  </div>

                  <div>
                    <h2
                      style={{
                        color: "#873b50",
                        margin: 0,
                        fontSize: 21,
                      }}
                    >
                      {person.classmate_name}
                    </h2>

                    <span
                      style={{
                        color: "#6b5e63",
                        fontSize: 13,
                      }}
                    >
                      {ar
                        ? "زميل دراسة موثّق"
                        : "Verified Classmate"}
                    </span>
                  </div>
                </div>

                <p>
                  <strong>
                    {ar
                      ? "المؤسسة التعليمية:"
                      : "Institution:"}
                  </strong>{" "}
                  {person.institution_name}
                </p>

                <p>
                  <strong>
                    {ar
                      ? "سنوات الدراسة المشتركة:"
                      : "Shared years:"}
                  </strong>{" "}
                  {person.shared_start_year} –{" "}
                  {person.shared_end_year}
                </p>

                <div
                  style={{
                    marginTop: 20,
                    display: "flex",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <Link
                    href={`/dashboard/classmates/${encodeURIComponent(
                      person.classmate_id
                    )}`}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "#873b50",
                      color: "#fff",
                      padding: "11px 20px",
                      borderRadius: 9,
                      textDecoration: "none",
                      fontSize: 14,
                      fontWeight: 600,
                    }}
                  >
                    {ar
                      ? "عرض الملف الشخصي"
                      : "View Profile"}
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}

        <p style={{ marginTop: 30 }}>
          <Link
            href="/dashboard"
            style={{ color: "#873b50" }}
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
