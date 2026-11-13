
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Props = {
  lang?: "en" | "ar";
};

export default function DiscoverabilitySetting({
  lang = "en",
}: Props) {
  const supabase = createClient();

  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const ar = lang === "ar";

  useEffect(() => {
    let active = true;

    async function loadSetting() {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError || !authData.user) {
        if (active) {
          setMessage(
            ar
              ? "يرجى تسجيل الدخول أولاً."
              : "Please sign in first."
          );
          setLoading(false);
        }
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("discoverable")
        .eq("id", authData.user.id)
        .single();

      if (!active) return;

      if (error) {
        setMessage(error.message);
      } else {
        setEnabled(data.discoverable === true);
      }

      setLoading(false);
    }

    loadSetting();

    return () => {
      active = false;
    };
  }, [ar, supabase]);

  async function updateSetting(value: boolean) {
    if (saving || loading) return;

    setSaving(true);
    setMessage("");

    const { data: authData, error: authError } =
      await supabase.auth.getUser();

    if (authError || !authData.user) {
      setMessage(
        ar ? "انتهت جلسة تسجيل الدخول." : "Session expired."
      );
      setSaving(false);
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .update({ discoverable: value })
      .eq("id", authData.user.id)
      .select("discoverable")
      .single();

    if (error) {
      setMessage(error.message);
    } else {
      setEnabled(data.discoverable === true);
      setMessage(
        ar
          ? "تم حفظ إعدادات الخصوصية بنجاح."
          : "Privacy settings saved successfully."
      );
    }

    setSaving(false);
  }

  return (
    <section
      dir={ar ? "rtl" : "ltr"}
      style={{
        background: "#fff",
        border: "1px solid #e8dfe2",
        borderRadius: 16,
        padding: 24,
        marginTop: 24,
      }}
    >
      <h2 style={{ color: "#873b50", marginTop: 0 }}>
        {ar ? "الخصوصية والظهور" : "Privacy & Discoverability"}
      </h2>

      <p style={{ color: "#666", lineHeight: 1.7 }}>
        {ar
          ? "اختر ما إذا كنت ترغب بالسماح لزملائك السابقين بالعثور عليك في Memories."
          : "Choose whether former classmates may find you on Memories."}
      </p>

      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          cursor: loading || saving ? "wait" : "pointer",
        }}
      >
        <input
          type="checkbox"
          checked={enabled}
          disabled={loading || saving}
          onChange={(e) => updateSetting(e.target.checked)}
          style={{
            width: 20,
            height: 20,
            accentColor: "#873b50",
          }}
        />

        <span style={{ fontWeight: 600 }}>
          {ar
            ? "السماح لزملائي السابقين بالعثور علي"
            : "Allow former classmates to find me"}
        </span>
      </label>

      <p style={{ color: "#777", fontSize: 13 }}>
        {enabled
          ? ar
            ? "تم تفعيل خيار الظهور."
            : "Discoverability preference is enabled."
          : ar
          ? "حسابك غير مفعّل للظهور في البحث."
          : "Your profile is not opted into discovery."}
      </p>

      {message && (
        <p role="status" style={{ color: "#873b50" }}>
          {message}
        </p>
      )}
    </section>
  );
}
