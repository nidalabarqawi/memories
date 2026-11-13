
"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function RegisterPage() {
  const [language, setLanguage] = useState<"en" | "ar">("en");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const ar = language === "ar";

  async function handleRegister(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage("");


const today = new Date();

const [year, month, day] = birthDate
  .split("-")
  .map(Number);

const birthday = new Date(year, month - 1, day);

const validBirthDate =
  /^\d{4}-\d{2}-\d{2}$/.test(birthDate) &&
  birthday.getFullYear() === year &&
  birthday.getMonth() === month - 1 &&
  birthday.getDate() === day &&
  birthday <= today;

const age =
  today.getFullYear() -
  year -
  (today.getMonth() + 1 < month ||
  (today.getMonth() + 1 === month &&
    today.getDate() < day)
    ? 1
    : 0);

if (!validBirthDate || age < 18) {
  setMessage(
    ar
      ? "يجب أن يكون عمرك 18 عاماً على الأقل"
      : "You must be at least 18 years old"
  );
  return;
}


    if (password.length < 8) {
      setMessage(ar
        ? "يجب أن تتكون كلمة المرور من 8 أحرف على الأقل"
        : "Password must be at least 8 characters");
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: {
            full_name: name.trim(),
            birth_date: birthDate,
          },
        },
      });

      if (error) throw error;

      setMessage(ar
        ? "تم إرسال الطلب. تحقق من بريدك الإلكتروني لتأكيد الحساب."
        : "Registration submitted. Check your email to verify your account.");
    } catch (error) {
      setMessage(error instanceof Error
        ? error.message
        : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  const fieldStyle = {
    width: "100%",
    padding: "13px",
    border: "1px solid #ddd5d0",
    borderRadius: "9px",
    fontSize: "15px",
    boxSizing: "border-box" as const,
  };

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
      <div style={{
        maxWidth: 440,
        margin: "0 auto",
        background: "white",
        padding: 32,
        borderRadius: 18,
        boxShadow: "0 8px 35px #0000000b",
      }}>
        <button
          type="button"
          onClick={() => setLanguage(ar ? "en" : "ar")}
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: "#873b50",
            fontWeight: "bold",
          }}
        >
          {ar ? "English" : "العربية"}
        </button>

        <h1 style={{
          textAlign: "center",
          color: "#873b50",
          marginBottom: 5,
          fontSize: 34,
        }}>
          Memories
        </h1>

        <p style={{
          textAlign: "center",
          color: "#777",
          marginBottom: 30,
        }}>
          {ar ? "ذكريات تجمعنا من جديد" :
            "Reconnect with your past"}
        </p>

        <h2 style={{ marginBottom: 22 }}>
          {ar ? "إنشاء حساب جديد" : "Create your account"}
        </h2>

        <form onSubmit={handleRegister}
          style={{ display: "grid", gap: 15 }}>
          <input
            style={fieldStyle}
            placeholder={ar ? "الاسم الكامل" : "Full name"}
            aria-label={ar ? "الاسم الكامل" : "Full name"}
            value={name}
            onChange={e => setName(e.target.value)}
            required
            maxLength={100}
          />

          <input
            style={fieldStyle}
            type="email"
            placeholder={ar ? "البريد الإلكتروني" : "Email address"}
            aria-label={ar ? "البريد الإلكتروني" : "Email address"}
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />

          <input
            style={fieldStyle}
            type="password"
            placeholder={ar ? "كلمة المرور" : "Password"}
            aria-label={ar ? "كلمة المرور" : "Password"}
            value={password}
            onChange={e => setPassword(e.target.value)}
            minLength={8}
            required
          />

          <label style={{ color: "#555", fontSize: 14 }}>
            {ar ? "تاريخ الميلاد" : "Date of birth"}
            <input
              style={{ ...fieldStyle, marginTop: 6 }}
              type="date"
              value={birthDate}
              onChange={e => setBirthDate(e.target.value)}
              required
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: 14,
              background: "#873b50",
              color: "white",
              border: "none",
              borderRadius: 9,
              cursor: loading ? "wait" : "pointer",
              fontWeight: "bold",
              fontSize: 16,
            }}
          >
            {loading
              ? (ar ? "جارٍ التسجيل..." : "Registering...")
              : (ar ? "إنشاء الحساب" : "Create account")}
          </button>
        </form>

        {message && (
          <p role="status" style={{
            marginTop: 20,
            color: "#873b50",
            overflowWrap: "anywhere",
          }}>
            {message}
          </p>
        )}

        <p style={{ textAlign: "center", marginTop: 24 }}>
          {ar ? "لديك حساب بالفعل؟" : "Already have an account?"}
          {" "}
          <Link href="/login" style={{ color: "#873b50" }}>
            {ar ? "تسجيل الدخول" : "Sign in"}
          </Link>
        </p>

        <p style={{ textAlign: "center" }}>
          <Link href="/" style={{ color: "#777" }}>
            {ar ? "العودة للرئيسية" : "Back to homepage"}
          </Link>
        </p>
      </div>
    </main>
  );
}
