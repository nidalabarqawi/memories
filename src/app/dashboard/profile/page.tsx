
"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import DiscoverabilitySetting from "@/components/DiscoverabilitySetting";


type Language = "en" | "ar";

export default function ProfilePage() {
  const [language, setLanguage] = useState<Language>("en");
  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const ar = language === "ar";

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      try {
        const supabase = createClient();

        const { data: authData, error: authError } =
          await supabase.auth.getUser();

        if (authError || !authData.user) {
          throw new Error("Please sign in again.");
        }

        const { data, error: profileError } = await supabase
          .from("profiles")
          .select("display_name, locale, birth_date")
          .eq("id", authData.user.id)
          .single();

        if (profileError) throw profileError;

        if (active) {
          setUserId(authData.user.id);
          setName(data.display_name ?? "");
          setBirthDate(data.birth_date ?? "");
          setLanguage(data.locale === "ar" ? "ar" : "en");
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load profile."
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadProfile();

    return () => {
      active = false;
    };
  }, []);

  async function saveProfile(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage("");
    setError("");

    if (!userId) {
      setError(ar ? "يرجى تسجيل الدخول" : "Please sign in.");
      return;
    }

    const today = new Date();
    const minDate = new Date(
      today.getFullYear() - 120,
      today.getMonth(),
      today.getDate()
    );
    const maxDate = new Date(
      today.getFullYear() - 18,
      today.getMonth(),
      today.getDate()
    );
    const selectedDate = new Date(`${birthDate}T00:00:00`);

    if (
      !birthDate ||
      Number.isNaN(selectedDate.getTime()) ||
      selectedDate < minDate ||
      selectedDate > maxDate
    ) {
      setError(
        ar
          ? "يرجى إدخال تاريخ ميلاد صحيح لعمر بين 18 و120 سنة"
          : "Enter a valid birth date for an age between 18 and 120."
      );
      return;
    }

    if (name.trim().length < 2) {
      setError(
        ar
          ? "يرجى إدخال الاسم الكامل"
          : "Please enter a valid name."
      );
      return;
    }

    setSaving(true);

    try {
      const supabase = createClient();

      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError || authData.user?.id !== userId) {
        throw new Error("Session expired. Please sign in again.");
      }

      const { data, error: updateError } = await supabase
        .from("profiles")
        .update({
          display_name: name.trim(),
          locale: language,
          birth_date: birthDate,
        })
        .eq("id", userId)
        .select("id")
        .single();

      if (updateError) throw updateError;
      if (!data) throw new Error("Profile was not updated.");

      setMessage(
        ar
          ? "تم حفظ الملف الشخصي بنجاح"
          : "Your profile has been saved successfully."
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to save profile."
      );
    } finally {
      setSaving(false);
    }
  }

  const inputStyle = {
    width: "100%",
    padding: "13px",
    border: "1px solid #ddd5d0",
    borderRadius: 9,
    fontSize: 15,
    boxSizing: "border-box" as const,
    background: "#fff",
    color: "#292524",
  };

  if (loading) {
    return (
      <main style={{ padding: 40 }}>
        Loading your Memories profile...
      </main>
    );
  }

  return (
    <main
      dir={ar ? "rtl" : "ltr"}
      style={{
        minHeight: "100vh",
        background: "#f8f5f0",
        padding: "45px 20px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: 520,
          margin: "0 auto",
          background: "white",
          padding: 32,
          borderRadius: 18,
          boxShadow: "0 8px 35px #0000000b",
        }}
      >
        <button
          type="button"
          onClick={() =>
            setLanguage(ar ? "en" : "ar")
          }
          style={{
            border: "none",
            background: "transparent",
            color: "#873b50",
            cursor: "pointer",
            fontWeight: "bold",
          }}
        >
          {ar ? "English" : "العربية"}
        </button>

        <h1
          style={{
            color: "#873b50",
            textAlign: "center",
            fontSize: 34,
          }}
        >
          Memories
        </h1>

        <p style={{ textAlign: "center", color: "#777" }}>
          {ar
            ? "ذكريات تجمعنا من جديد"
            : "Reconnect with your past"}
        </p>

        <h2 style={{ marginTop: 30 }}>
          {ar ? "ملفي الشخصي" : "My Profile"}
        </h2>

        <p style={{ color: "#777" }}>
          {ar
            ? "قم بتحديث معلوماتك الشخصية"
            : "Update your personal information"}
        </p>

        <form
          onSubmit={saveProfile}
          style={{ display: "grid", gap: 20, marginTop: 25 }}
        >
          <label>
            {ar ? "الاسم الكامل" : "Full name"}
            <input
              style={{ ...inputStyle, marginTop: 8 }}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={100}
            />
          </label>

          <label>
            {ar ? "تاريخ الميلاد" : "Date of birth"}
            <input
              style={{ ...inputStyle, marginTop: 8 }}
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              required
            />
          </label>

          <label>
            {ar ? "اللغة المفضلة" : "Preferred language"}
            <select
              style={{ ...inputStyle, marginTop: 8 }}
              value={language}
              onChange={(e) =>
                setLanguage(e.target.value as Language)
              }
            >
              <option value="en">English</option>
              <option value="ar">العربية</option>
            </select>
          </label>

          <button
            type="submit"
            disabled={saving || !userId}
            style={{
              background: "#873b50",
              color: "white",
              padding: 15,
              border: "none",
              borderRadius: 9,
              cursor: saving ? "wait" : "pointer",
              fontSize: 16,
              fontWeight: "bold",
            }}
          >
            {saving
              ? (ar ? "جارٍ الحفظ..." : "Saving...")
              : (ar ? "حفظ التغييرات" : "Save changes")}
          </button>
        </form>
        {message && (
          <p role="status" style={{ color: "#167347" }}>
            {message}
          </p>
        )}

        {error && (
          <p role="alert" style={{ color: "#b42318" }}>
            {error}
          </p>
        )}

<DiscoverabilitySetting lang={ar ? "ar" : "en"} />

        <p style={{ textAlign: "center", marginTop: 30 }}>
          <Link href="/dashboard" style={{ color: "#873b50" }}>
            {ar
              ? "العودة إلى لوحة التحكم"
              : "Back to dashboard"}
          </Link>
        </p>
      </div>
    </main>
  );
}
