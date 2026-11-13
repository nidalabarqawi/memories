
"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Suspense } from "react";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [language, setLanguage] = useState<"en" | "ar">("en");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const ar = language === "ar";

  async function handleLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Login failed"
      );
    } finally {
      setLoading(false);
    }
  }

  const inputStyle = {
    padding: 14,
    borderRadius: 9,
    border: "1px solid #ddd5d0",
    width: "100%",
    boxSizing: "border-box" as const,
  };

  return (
    <main
      dir={ar ? "rtl" : "ltr"}
      style={{
        minHeight: "100vh",
        background: "#f8f5f0",
        padding: "50px 20px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div style={{
        maxWidth: 440,
        margin: "auto",
        padding: 32,
        background: "white",
        borderRadius: 18,
        boxShadow: "0 8px 35px #0000000b",
      }}>
        <button
          type="button"
          onClick={() => setLanguage(ar ? "en" : "ar")}
          style={{
            background: "none",
            border: "none",
            color: "#873b50",
            cursor: "pointer",
          }}
        >
          {ar ? "English" : "العربية"}
        </button>

        <h1 style={{
          textAlign: "center",
          color: "#873b50",
          fontSize: 34,
        }}>
          Memories
        </h1>

        <p style={{ textAlign: "center", color: "#777" }}>
          {ar ? "ذكريات تجمعنا من جديد" :
            "Reconnect with your past"}
        </p>

        <h2>{ar ? "تسجيل الدخول" : "Welcome back"}</h2>

        {params.get("verified") === "true" && (
          <p role="status" style={{ color: "green" }}>
            {ar ? "تم تأكيد البريد الإلكتروني بنجاح" :
              "Email verified successfully. Please sign in."}
          </p>
        )}

        {params.get("error") === "confirmation" && (
          <p role="alert" style={{ color: "#b42318" }}>
            {ar ? "تعذر تأكيد البريد الإلكتروني" :
              "Email confirmation failed or the link expired."}
          </p>
        )}

        <form
          onSubmit={handleLogin}
          style={{ display: "grid", gap: 16 }}
        >
          <input
            type="email"
            placeholder={ar ? "البريد الإلكتروني" : "Email address"}
            aria-label={ar ? "البريد الإلكتروني" : "Email address"}
            style={inputStyle}
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />

          <input
            type="password"
            placeholder={ar ? "كلمة المرور" : "Password"}
            aria-label={ar ? "كلمة المرور" : "Password"}
            style={inputStyle}
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />

          <button
            type="submit"
            disabled={loading}
            style={{
              background: "#873b50",
              color: "white",
              padding: 14,
              border: "none",
              borderRadius: 9,
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            {loading
              ? (ar ? "جارٍ الدخول..." : "Signing in...")
              : (ar ? "تسجيل الدخول" : "Sign in")}
          </button>
        </form>

        {message && (
          <p role="alert" style={{ color: "#b42318" }}>
            {message}
          </p>
        )}

        <p style={{ textAlign: "center", marginTop: 24 }}>
          {ar ? "ليس لديك حساب؟" : "Don't have an account?"}
          {" "}
          <Link href="/register" style={{ color: "#873b50" }}>
            {ar ? "إنشاء حساب" : "Register"}
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

export default function LoginPage() {
  return (
    <Suspense fallback={<p>Loading login...</p>}>
      <LoginForm />
    </Suspense>
  );
}
