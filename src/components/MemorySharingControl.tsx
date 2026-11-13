
"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

type Props = {
  memoryId: string;
  initialVisibility: "private" | "classmates";
  lang: "en" | "ar";
};

export default function MemorySharingControl({
  memoryId,
  initialVisibility,
  lang,
}: Props) {
  const [visibility, setVisibility] = useState(initialVisibility);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const ar = lang === "ar";
  const shared = visibility === "classmates";

  async function toggleSharing() {
    if (saving) return;

    const nextVisibility = shared ? "private" : "classmates";

    if (
      nextVisibility === "classmates" &&
      !window.confirm(
        ar
          ? "هل تريد مشاركة هذه الذكرى وصورها مع زملائك الذين تم التحقق من عضويتهم؟"
          : "Share this memory and its photos with your verified classmates?"
      )
    ) {
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const { data: auth, error: authError } =
        await supabase.auth.getUser();

      if (authError || !auth.user) {
        throw new Error(
          ar ? "يرجى تسجيل الدخول." : "Please sign in."
        );
      }

      const { data, error: updateError } =
        await supabase
          .from("memories")
          .update({ visibility: nextVisibility })
          .eq("id", memoryId)
          .eq("author_id", auth.user.id)
          .eq("visibility", visibility)
          .select("visibility")
          .single();

      if (updateError) throw updateError;

      if (!data || data.visibility !== nextVisibility) {
        throw new Error(
          ar
            ? "تعذر تحديث إعدادات المشاركة."
            : "Could not update sharing settings."
        );
      }

      setVisibility(nextVisibility);

      setSuccess(
        nextVisibility === "classmates"
          ? ar
            ? "تمت مشاركة الذكرى مع زملائك."
            : "Memory shared with classmates."
          : ar
            ? "أصبحت الذكرى خاصة."
            : "Memory is now private."
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : ar
            ? "حدث خطأ أثناء تحديث المشاركة."
            : "Something went wrong."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      dir={ar ? "rtl" : "ltr"}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 8,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: shared ? "#276749" : "#71686b",
            background: shared ? "#e8f5ed" : "#f3eff0",
            padding: "6px 10px",
            borderRadius: 20,
          }}
        >
          {shared
            ? ar
              ? "مشاركة مع زملاء الدراسة"
              : "Shared with classmates"
            : ar
              ? "خاصة"
              : "Private"}
        </span>

        <button
          type="button"
          onClick={toggleSharing}
          disabled={saving}
          style={{
            background: shared ? "#fff" : "#873b50",
            color: shared ? "#873b50" : "#fff",
            border: "1px solid #873b50",
            borderRadius: 9,
            padding: "9px 14px",
            fontWeight: 600,
            cursor: saving ? "wait" : "pointer",
            opacity: saving ? 0.65 : 1,
          }}
        >
          {saving
            ? ar
              ? "جارٍ الحفظ..."
              : "Saving..."
            : shared
              ? ar
                ? "إلغاء المشاركة"
                : "Unshare"
              : ar
                ? "مشاركة مع زملاء الدراسة"
                : "Share with Classmates"}
        </button>
      </div>

      {success && (
        <p
          role="status"
          style={{ color: "#276749", fontSize: 13, margin: 0 }}
        >
          {success}
        </p>
      )}

      {error && (
        <p
          role="alert"
          style={{ color: "#b42318", fontSize: 13, margin: 0 }}
        >
          {error}
        </p>
      )}
    </div>
  );
}
