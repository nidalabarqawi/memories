"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Member = {
  user_id: string;
  display_name: string;
  role: string;
  joined_at: string;
};

type Group = { id: string; name: string };
const burgundy = "#873b50";

export default function GroupMembersPage() {
  const params = useParams<{ groupId: string }>();
  const router = useRouter();
  const groupId = params.groupId;
  const [lang, setLang] = useState<"en" | "ar">("en");
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");
const [removingId, setRemovingId] = useState<string | null>(null);
const [promotingId, setPromotingId] = useState<string | null>(null);
const [steppingDown, setSteppingDown] = useState(false);

const isAdmin = members.some(
  (member) =>
    member.user_id === currentUserId &&
    member.role === "admin"
);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const ar = lang === "ar";

  const loadMembers = useCallback(async () => {
    if (!groupId) return;
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) {
      router.replace("/login");
      return;
    }
    setCurrentUserId(auth.user.id);

    const { data: profile } = await supabase
      .from("profiles")
      .select("locale")
      .eq("id", auth.user.id)
      .maybeSingle();
    setLang(profile?.locale === "ar" ? "ar" : "en");

    // Confirm membership before showing the group or its members.
    const { data: membership, error: membershipError } = await supabase
      .from("chat_group_members")
      .select("group_id")
      .eq("group_id", groupId)
      .eq("user_id", auth.user.id)
      .maybeSingle();
    if (membershipError || !membership) {
      setError(membershipError?.message || "You are not a member of this group.");
      setLoading(false);
      return;
    }

    const [groupResult, membersResult] = await Promise.all([
      supabase.from("chat_groups").select("id, name").eq("id", groupId).maybeSingle(),
      supabase.rpc("get_chat_group_members", { p_group_id: groupId }),
    ]);

    if (groupResult.error || membersResult.error) {
      setError(groupResult.error?.message || membersResult.error?.message || "Unable to load members.");
    } else {
      setGroup((groupResult.data as Group | null) ?? null);
      setMembers((membersResult.data ?? []) as Member[]);
    }
    setLoading(false);
  }, [groupId, router]);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);
  const [leaving, setLeaving] = useState(false);

  async function leaveGroup() {
    const confirmed = window.confirm(
      ar
        ? "هل أنت متأكد من مغادرة المجموعة؟"
        : "Are you sure you want to leave this group?"
    );

    if (!confirmed || leaving) return;

    setLeaving(true);
    setError("");

    try {
      const supabase = createClient();

      const { error: leaveError } = await supabase.rpc(
        "leave_chat_group",
        { p_group_id: groupId }
      );

      if (leaveError) {
        setError(leaveError.message);
        return;
      }

      router.replace("/dashboard/groups");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to leave group."
      );
    } finally {
      setLeaving(false);
    }
  }
  async function stepDownAsAdmin() {
  if (!isAdmin || steppingDown || promotingId || removingId || leaving) {
    return;
  }

  const otherAdmins = members.filter(
    (member) =>
      member.role === "admin" &&
      member.user_id !== currentUserId
  );

  if (otherAdmins.length === 0) {
    setError(
      ar
        ? "لا يمكنك التنازل عن صلاحيات المشرف لأنك المشرف الوحيد."
        : "You cannot step down because you are the only administrator."
    );
    return;
  }

  const confirmed = window.confirm(
    ar
      ? "هل أنت متأكد من التنازل عن صلاحيات المشرف؟ ستبقى عضوًا في المجموعة، لكنك ستفقد صلاحيات الإدارة."
      : "Are you sure you want to step down as administrator? You will remain a group member but lose administrator privileges."
  );

  if (!confirmed) return;

  setSteppingDown(true);
  setError("");

  try {
    const supabase = createClient();

    const { error: stepDownError } = await supabase.rpc(
      "step_down_chat_group_admin",
      {
        p_group_id: groupId,
      }
    );

    if (stepDownError) {
      setError(stepDownError.message);
      return;
    }

    await loadMembers();
  } catch (err) {
    setError(
      err instanceof Error
        ? err.message
        : ar
          ? "تعذر التنازل عن صلاحيات المشرف."
          : "Unable to step down as administrator."
    );
  } finally {
    setSteppingDown(false);
  }
}
  async function promoteMember(member: Member) {
  if (
    !isAdmin ||
    member.role !== "member" ||
    promotingId !== null ||
    removingId !== null ||
    leaving
  ) {
    return;
  }

  const confirmed = window.confirm(
    ar
      ? `هل أنت متأكد من تعيين ${member.display_name} مشرفًا على المجموعة؟`
      : `Are you sure you want to make ${member.display_name} a group administrator?`
  );

  if (!confirmed) return;

  setPromotingId(member.user_id);
  setError("");

  try {
    const supabase = createClient();

    const { error: promotionError } = await supabase.rpc(
      "promote_chat_group_member",
      {
        p_group_id: groupId,
        p_member_id: member.user_id,
      }
    );

    if (promotionError) {
      setError(promotionError.message);
      return;
    }

    await loadMembers();
  } catch (err) {
    setError(
      err instanceof Error
        ? err.message
        : ar
          ? "تعذر تعيين المشرف."
          : "Unable to promote member."
    );
  } finally {
    setPromotingId(null);
  }
}
  async function removeMember(member: Member) {
  if (!isAdmin || removingId || member.user_id === currentUserId) {
    return;
  }

  const confirmed = window.confirm(
    ar
      ? `هل أنت متأكد من إزالة ${member.display_name} من المجموعة؟`
      : `Are you sure you want to remove ${member.display_name} from this group?`
  );

  if (!confirmed) return;

  setRemovingId(member.user_id);
  setError("");

  try {
    const supabase = createClient();

    const { error: removeError } = await supabase.rpc(
      "remove_chat_group_member",
      {
        p_group_id: groupId,
        p_member_id: member.user_id,
      }
    );

    if (removeError) {
      setError(removeError.message);
      return;
    }

    await loadMembers();
  } catch (err) {
    setError(
      err instanceof Error
        ? err.message
        : "Unable to remove member."
    );
  } finally {
    setRemovingId(null);
  }
}
  const formatDate = (date: string) => {
    const parsed = new Date(date);
    return Number.isNaN(parsed.getTime())
      ? "—"
      : new Intl.DateTimeFormat(ar ? "ar-JO" : "en-GB", {
          year: "numeric", month: "short", day: "numeric",
        }).format(parsed);
  };

  return (
    <main dir={ar ? "rtl" : "ltr"} style={{ minHeight: "100vh", background: "#f8f5f0", padding: "28px 16px", fontFamily: "Arial, sans-serif" }}>
      <div style={{ maxWidth: 850, margin: "0 auto" }}>
        <Link href={`/dashboard/groups/${encodeURIComponent(groupId)}`} style={{ color: burgundy, fontWeight: 700, textDecoration: "none" }}>
          {ar ? "العودة إلى المحادثة" : "← Back to Conversation"}
        </Link>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, margin: "22px 0", flexWrap: "wrap" }}>
          <div>
            <h1 style={{ color: burgundy, margin: "0 0 8px" }}>{ar ? "أعضاء المجموعة" : "Group Members"}</h1>
            <p style={{ color: "#655e61", margin: 0 }}>
              {group?.name || (ar ? "المجموعة" : "Group")}
              {!loading && !error ? ` · ${members.length} ${ar ? "عضو" : members.length === 1 ? "member" : "members"}` : ""}
            </p>
          </div>
          <button type="button" onClick={() => void loadMembers()} disabled={loading} style={{ border: `1px solid ${burgundy}`, background: "white", color: burgundy, padding: "10px 14px", borderRadius: 9, cursor: loading ? "wait" : "pointer" }}>
            {ar ? "تحديث" : "Refresh"}
          </button>
          {isAdmin && (
  <button
    type="button"
    onClick={() => void stepDownAsAdmin()}
    disabled={
      steppingDown ||
      promotingId !== null ||
      removingId !== null ||
      leaving
    }
    style={{
      background: "#ffffff",
      color: burgundy,
      border: `1px solid ${burgundy}`,
      padding: "10px 14px",
      borderRadius: 9,
      fontWeight: 700,
      cursor: steppingDown ? "wait" : "pointer",
    }}
  >
    {steppingDown
      ? ar
        ? "جارٍ التنازل..."
        : "Stepping down..."
      : ar
        ? "التنازل عن صلاحيات المشرف"
        : "Step Down as Admin"}
  </button>
)}
                    <button
            type="button"
            onClick={() => void leaveGroup()}
            disabled={loading || leaving || !!error}
            style={{
              background: "#fff",
              color: "#b42318",
              border: "1px solid #b42318",
              padding: "10px 14px",
              borderRadius: 9,
              fontWeight: 700,
              cursor: leaving ? "wait" : "pointer",
            }}
          >
            {leaving
              ? (ar ? "جارٍ المغادرة..." : "Leaving...")
              : (ar ? "مغادرة المجموعة" : "Leave Group")}
          </button>
        </div>
        {error && <p role="alert" style={{ color: "#b42318", background: "white", borderRadius: 10, padding: 14 }}>{error}</p>}
        {loading ? (
          <p>{ar ? "جارٍ تحميل الأعضاء..." : "Loading members..."}</p>
        ) : !error && members.length === 0 ? (
          <p>{ar ? "لا يوجد أعضاء لعرضهم." : "No members to display."}</p>
        ) : !error && (
          <div style={{ display: "grid", gap: 12 }}>
            {members.map((member) => (
              <section key={member.user_id} style={{ display: "flex", alignItems: "center", gap: 14, background: "white", border: "1px solid #eee5e8", borderRadius: 14, padding: 18 }}>
                <div aria-hidden="true" style={{ display: "grid", placeItems: "center", flexShrink: 0, width: 48, height: 48, borderRadius: "50%", background: "#f1e3e8", color: burgundy, fontWeight: 700, fontSize: 20 }}>
                  {(member.display_name || "?").trim().charAt(0).toUpperCase() || "?"}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Link
  href={`/dashboard/groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(member.user_id)}`}
  style={{
    display: "inline-block",
    fontWeight: 700,
    color: burgundy,
    overflowWrap: "anywhere",
    textDecoration: "underline",
    textUnderlineOffset: 3,
  }}
  title={ar ? "عرض الملف الشخصي" : "View Profile"}
>
  {member.display_name || (ar ? "عضو" : "Member")}
</Link>
                  <div style={{ fontSize: 13, color: "#655e61", marginTop: 5 }}>
                    {ar ? "انضم بتاريخ" : "Joined"} {formatDate(member.joined_at)}
                  </div>
                </div>
                <span style={{ flexShrink: 0, color: member.role === "admin" ? burgundy : "#655e61", fontSize: 12, fontWeight: 700, padding: "6px 10px", borderRadius: 999, background: member.role === "admin" ? "#f1e3e8" : "#f3f1f1" }}>
                  {member.role === "admin" ? (ar ? "مشرف" : "Admin") : (ar ? "عضو" : "Member")}
                </span>
                {isAdmin && member.role === "member" && (
  <button
    type="button"
    onClick={() => void promoteMember(member)}
    disabled={
      promotingId !== null ||
      removingId !== null ||
      leaving
    }
    style={{
      background: "#ffffff",
      color: burgundy,
      border: `1px solid ${burgundy}`,
      borderRadius: 8,
      padding: "8px 12px",
      fontWeight: 700,
      cursor:
        promotingId !== null ||
        removingId !== null ||
        leaving
          ? "wait"
          : "pointer",
      flexShrink: 0,
    }}
  >
    {promotingId === member.user_id
      ? ar
        ? "جارٍ التعيين..."
        : "Promoting..."
      : ar
        ? "تعيين مشرف"
        : "Make Admin"}
  </button>
)}
                {isAdmin && member.user_id !== currentUserId && (
  <button
    type="button"
    onClick={() => void removeMember(member)}
    disabled={removingId !== null}
    style={{
      background: "#fff",
      color: "#b42318",
      border: "1px solid #b42318",
      borderRadius: 8,
      padding: "8px 12px",
      fontWeight: 700,
      cursor: removingId ? "wait" : "pointer",
      flexShrink: 0,
    }}
  >
    {removingId === member.user_id
      ? (ar ? "جارٍ الإزالة..." : "Removing...")
      : (ar ? "إزالة العضو" : "Remove Member")}
  </button>
)}
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
