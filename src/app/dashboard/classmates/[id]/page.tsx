
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ConnectionButton from "@/components/ConnectionButton";

type ClassmateProfile = {
  classmate_id: string;
  display_name: string;
  institution_id: string;
  institution_name: string;
  start_year: number;
  end_year: number;
};

export default function ClassmateProfilePage() {
  const params = useParams();
  const router = useRouter();

  const classmateId = params.id as string;

  const [profile, setProfile] =
    useState<ClassmateProfile | null>(null);

  const [education, setEducation] =
    useState<ClassmateProfile[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [locale, setLocale] = useState<"en" | "ar">("en");

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      setLoading(true);
      setError("");

      const supabase = createClient();

      const { data: auth, error: authError } =
        await supabase.auth.getUser();

      if (authError || !auth.user) {
        router.replace("/login");
        return;
      }

      const { data: ownProfile } = await supabase
        .from("profiles")
        .select("locale")
        .eq("id", auth.user.id)
        .single();

      if (active && ownProfile?.locale === "ar") {
        setLocale("ar");
      }

      const { data, error: rpcError } =
        await supabase.rpc("get_classmate_profile", {
          p_classmate_id: classmateId,
        });

      if (!active) return;

      if (rpcError) {
        setError(rpcError.message);
      } else if (!data || data.length === 0) {
        setError(
          "This profile is unavailable or you are not verified classmates."
        );
      } else {
        setProfile(data[0]);
        setEducation(data);
      }

      setLoading(false);
    }

    if (classmateId) {
      void loadProfile();
    }

    return () => {
      active = false;
    };
  }, [classmateId, router]);

  const ar = locale === "ar";

  return (
    <main
      dir={ar ? "rtl" : "ltr"}
      style={{
        maxWidth: 820,
        margin: "40px auto",
        padding: "24px",
        fontFamily: "Arial, sans-serif",
        color: "#30272b",
      }}
    >
      <button
        type="button"
        onClick={() => router.back()}
        style={{
          border: "none",
          background: "transparent",
          color: "#873b50",
          cursor: "pointer",
          marginBottom: 24,
          fontSize: 15,
        }}
      >
        {ar ? "← العودة" : "← Back"}
      </button>

      {loading ? (
        <p>{ar ? "جاري التحميل..." : "Loading profile..."}</p>
      ) : error ? (
        <div
          style={{
            padding: 24,
            background: "#f8f5f0",
            borderRadius: 14,
          }}
        >
          <h2 style={{ color: "#873b50" }}>
            {ar ? "الملف الشخصي غير متاح" : "Profile unavailable"}
          </h2>

          <p>
            {ar
              ? "لا يمكنك عرض هذا الملف إلا إذا كنتما زميلين موثّقين."
              : error}
          </p>
        </div>
      ) : profile ? (
        <>
          <section
            style={{
              padding: 28,
              borderRadius: 18,
              background: "#f8f5f0",
              border: "1px solid #e9dfe2",
              marginBottom: 24,
            }}
          >
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: "50%",
                background: "#873b50",
                color: "white",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 30,
                marginBottom: 16,
              }}
            >
              {profile.display_name.charAt(0).toUpperCase()}
            </div>

            <h1
              style={{
                fontSize: 30,
                color: "#873b50",
                marginBottom: 8,
              }}
            >
              {profile.display_name}
            </h1>

            <p style={{ color: "#6b5e63" }}>
              {ar ? "زميل دراسة موثّق" : "Verified Classmate"}
            </p>
            <ConnectionButton
  classmateId={classmateId}
  locale={locale}
/>
          </section>

          <section
            style={{
              padding: 28,
              borderRadius: 18,
              background: "#ffffff",
              border: "1px solid #e9dfe2",
            }}
          >
            <h2 style={{ color: "#873b50" }}>
              {ar ? "التعليم" : "Education"}
            </h2>

            {education.map((item, index) => (
              <div
                key={`${item.institution_id}-${index}`}
                style={{
                  padding: "16px 0",
                  borderBottom:
                    index === education.length - 1
                      ? "none"
                      : "1px solid #eee",
                }}
              >
                <strong>{item.institution_name}</strong>

                <p style={{ color: "#6b5e63" }}>
                  {item.start_year} – {item.end_year}
                </p>
              </div>
            ))}
          </section>
        </>
      ) : null}
    </main>
  );
}
