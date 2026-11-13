"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type GroupMember = { user_id: string; display_name: string; role: string; joined_at: string };
type Education = { classmate_id: string; display_name: string; institution_id: string; institution_name: string; start_year: number; end_year: number };
type Connection = { requester_id: string; recipient_id: string; status: string };
const burgundy = "#873b50";

export default function GroupMemberProfilePage() {
  const { groupId, userId } = useParams<{ groupId: string; userId: string }>();
  const router = useRouter();
  const [ar, setAr] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [member, setMember] = useState<GroupMember | null>(null);
  const [education, setEducation] = useState<Education[]>([]);
  const [connection, setConnection] = useState(false);
  const [self, setSelf] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const supabase = createClient();
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (cancelled) return;
      if (authError || !auth.user) { router.replace("/login"); return; }
      const viewerId = auth.user.id;
      const { data: profile } = await supabase.from("profiles").select("locale").eq("id", viewerId).maybeSingle();
      if (cancelled) return;
      setAr(profile?.locale === "ar");
      setSelf(viewerId === userId);

      // The RPC itself verifies that the viewer belongs to this group.
      const { data: memberRows, error: membersError } = await supabase.rpc("get_chat_group_members", { p_group_id: groupId });
      if (cancelled) return;
      if (membersError) { setError(membersError.message); setLoading(false); return; }
      const found = ((memberRows ?? []) as GroupMember[]).find((m) => m.user_id === userId);
      if (!found) { setError("Member not found or access denied."); setLoading(false); return; }
      setMember(found);

      if (viewerId !== userId) {
        // Do not bypass discoverability or approved/overlapping school membership checks.
        const { data: educationRows, error: educationError } = await supabase.rpc("get_classmate_profile", { p_classmate_id: userId });
        if (educationError) console.error("Classmate education:", educationError.message);
        if (cancelled) return;
        setEducation((educationRows ?? []) as Education[]);

        // Only accepted connections are shown; rely on the existing connections RLS.
        const { data: connections, error: connectionsError } = await supabase.from("connections")
          .select("requester_id, recipient_id, status")
          .eq("status", "accepted")
          .or(`and(requester_id.eq.${viewerId},recipient_id.eq.${userId}),and(requester_id.eq.${userId},recipient_id.eq.${viewerId})`);
        if (connectionsError) console.error("Connection status:", connectionsError.message);
        if (cancelled) return;
        setConnection(((connections ?? []) as Connection[]).length > 0);
      }
      setLoading(false);
    }
    void load();
    return () => { cancelled = true; };
  }, [groupId, userId, router]);

  const t = (en: string, arabic: string) => ar ? arabic : en;
  return (
    <main dir={ar ? "rtl" : "ltr"} style={{ minHeight: "100vh", background: "#f8f5f0", padding: "28px 16px", fontFamily: "Arial, sans-serif" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <Link href={`/dashboard/groups/${encodeURIComponent(groupId)}/members`} style={{ color: burgundy, fontWeight: 700 }}>
          {t("← Back to Members", "العودة إلى الأعضاء")}
        </Link>
        <h1 style={{ color: burgundy }}>{t("Member Profile", "ملف العضو")}</h1>
        {loading ? <p>{t("Loading...", "جارٍ التحميل...")}</p> : error ? (
          <p role="alert" style={{ color: "#b42318" }}>{error === "Member not found or access denied." ? t(error, "العضو غير موجود أو لا تملك صلاحية الوصول.") : error}</p>
        ) : member && (
          <>
            <section style={{ background: "white", borderRadius: 14, padding: 24, marginBottom: 18 }}>
              <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                <div aria-hidden="true" style={{ width: 60, height: 60, borderRadius: "50%", background: "#f0e5e9", color: burgundy, display: "grid", placeItems: "center", fontSize: 24, fontWeight: 700 }}>
                  {member.display_name.trim().charAt(0).toUpperCase() || "?"}
                </div>
                <div>
                  <h2 style={{ margin: "0 0 6px", color: burgundy }}>{member.display_name}{self ? ` (${t("You", "أنت")})` : ""}</h2>
                  <span>{member.role === "admin" ? t("Admin", "مشرف") : t("Member", "عضو")}</span>
                </div>
              </div>
              <p style={{ marginBottom: 0 }}>{t("Joined group", "تاريخ الانضمام للمجموعة")}: {new Date(member.joined_at).toLocaleDateString(ar ? "ar-JO" : "en-GB")}</p>
              {!self && <p style={{ marginBottom: 0 }}>{t("Connection", "العلاقة")}: {connection ? t("Connected", "متصلان") : t("Not connected", "غير متصلين")}</p>}
            </section>
            <section style={{ background: "white", borderRadius: 14, padding: 24 }}>
              <h2 style={{ color: burgundy, marginTop: 0 }}>{t("Educational Journey", "المسيرة التعليمية")}</h2>
              {education.length > 0 ? education.map((item) => (
                <div key={`${item.institution_id}-${item.start_year}-${item.end_year}`} style={{ padding: "12px 0", borderBottom: "1px solid #eee5e8" }}>
                  <strong>{item.institution_name}</strong>
                  <div>{item.start_year} – {item.end_year}</div>
                </div>
              )) : <p style={{ color: "#665b60" }}>
                {self ? t("Your educational history is available in your own Educational Journey page.", "يمكنك عرض مسيرتك التعليمية من صفحتك الخاصة بالمسيرة التعليمية.") : t("No educational history is available to you under the current privacy settings.", "لا توجد معلومات تعليمية متاحة لك وفق إعدادات الخصوصية الحالية.")}
              </p>}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
