"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Language = "en" | "ar";
type Notification = {
  id: string;
  user_id: string;
  actor_id: string | null;


type:
  | "connection_request"
  | "connection_accepted"
  | "group_ownership_received"
  | "group_ownership_transferred"
  | "group_join_approved"
  | "group_join_declined"
  | "group_invitation";

  connection_id: string | null;
  group_id: string | null;
  is_read: boolean;
  created_at: string;
};

export default function NotificationsPage() {
  const [lang, setLang] = useState<Language>("en");
  const [userId, setUserId] = useState("");
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [actorNames, setActorNames] = useState<Record<string, string>>({});

const [groupNames, setGroupNames] = useState<Record<string, string>>({});

  const [profileAccess, setProfileAccess] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savingAll, setSavingAll] = useState(false);
  const ar = lang === "ar";
  const t = (en: string, arabic: string) => (ar ? arabic : en);

  const loadNotifications = useCallback(async (id: string) => {
    const supabase = createClient();
    const { data, error: loadError } = await supabase
      .from("notifications")

.select("id, user_id, actor_id, type, connection_id, group_id, is_read, created_at")

      .eq("user_id", id)
      .order("created_at", { ascending: false })
      .limit(100);

    if (loadError) {
      setError(loadError.message);
      return;
    }
    setError("");
    const rows = (data ?? []) as Notification[];
    setNotifications(rows);

    // Resolve names through the existing access-controlled classmate RPC.
    // If a profile is not accessible, keep a generic notification message.
    const actorIds = Array.from(new Set(
      rows.map((item) => item.actor_id).filter((value): value is string => Boolean(value))
    ));
    const results = await Promise.all(actorIds.map(async (actorId) => {
      const { data: profile, error: profileError } = await supabase.rpc(
        "get_classmate_profile", { p_classmate_id: actorId }
      );
      const record = Array.isArray(profile) ? profile[0] : profile;
      const name = !profileError && record && typeof record.display_name === "string"
        ? record.display_name.trim() : "";
      return { actorId, name, available: Boolean(name) };
    }));
    setActorNames(Object.fromEntries(results.map((item) => [item.actorId, item.name])));
    setProfileAccess(Object.fromEntries(results.map((item) => [item.actorId, item.available])));

    // Load group names for ownership notifications.
      
const groupIds = Array.from(
  new Set(
    rows
      .filter(
        (item) =>
          item.type === "group_ownership_received" ||
          item.type === "group_ownership_transferred" ||
          item.type === "group_join_approved" ||
          item.type === "group_join_declined" ||
          item.type === "group_invitation"
      )
      .map((item) => item.group_id)
      .filter((value): value is string => Boolean(value))
  )
);


    if (groupIds.length > 0) {
      const { data: groups, error: groupsError } = await supabase
        .from("chat_groups")
        .select("id, name")
        .in("id", groupIds);

      if (groupsError) {
        console.error("Unable to load group names:", groupsError.message);
        setGroupNames({});
      } else {
        setGroupNames(
          Object.fromEntries(
            (groups ?? []).map((group) => [group.id, group.name])
          )
        );
      }
    } else {
      setGroupNames({});
    }

  }, []);

  useEffect(() => {
    let active = true;
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function initialize() {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (!active) return;
      if (authError || !auth.user) {
        setError("Please sign in to continue.");
        setLoading(false);
        return;
      }

      const id = auth.user.id;
      setUserId(id);
      const { data: profile } = await supabase
        .from("profiles")
        .select("locale")
        .eq("id", id)
        .single();
      if (!active) return;
      setLang(profile?.locale === "ar" ? "ar" : "en");

      await loadNotifications(id);
      if (!active) return;
      setLoading(false);

      channel = supabase
        .channel(`notification-history-${id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${id}`,
          },
          () => {
            if (active) void loadNotifications(id);
          }
        )
        .subscribe((status) => {
          if (active && status === "SUBSCRIBED") {
            void loadNotifications(id);
          }
        });
    }

    void initialize();
    return () => {
      active = false;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [loadNotifications]);

  useEffect(() => {
    if (!userId) return;
    function refreshOnFocus() {
      void loadNotifications(userId);
    }
    function refreshOnVisibility() {
      if (document.visibilityState === "visible") refreshOnFocus();
    }
    window.addEventListener("focus", refreshOnFocus);
    document.addEventListener("visibilitychange", refreshOnVisibility);
    return () => {
      window.removeEventListener("focus", refreshOnFocus);
      document.removeEventListener("visibilitychange", refreshOnVisibility);
    };
  }, [userId, loadNotifications]);

  async function markAsRead(id: string) {
    if (!userId || savingId || savingAll) return;
    setSavingId(id);
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", id)
      .eq("user_id", userId);
    if (updateError) setError(updateError.message);
    else {
      setError("");
      setNotifications((current) =>
        current.map((item) => item.id === id ? { ...item, is_read: true } : item)
      );
    }
    setSavingId(null);
  }

  async function markAllAsRead() {
    if (!userId || savingAll || savingId) return;
    setSavingAll(true);
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", userId)
      .eq("is_read", false);
    if (updateError) setError(updateError.message);
    else {
      setError("");
      setNotifications((current) => current.map((item) => ({ ...item, is_read: true })));
    }
    setSavingAll(false);
  }

  function dateLabel(value: string) {
    return new Date(value).toLocaleString(ar ? "ar-JO" : "en-GB", {
      year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });
  }

  const unreadCount = notifications.filter((item) => !item.is_read).length;
  const buttonStyle = {
    padding: "10px 15px",
    border: "1px solid #ded5d0",
    background: "#fff",
    color: "#873b50",
    borderRadius: 9,
    cursor: "pointer",
    fontWeight: 700,
  } as const;

  if (loading) {
    return (
      <main style={{ minHeight: "100vh", padding: 40, background: "#f8f5f0", color: "#873b50" }}>
        {t("Loading notifications...", "جارٍ تحميل الإشعارات...")}
      </main>
    );
  }

  return (
    <main
      dir={ar ? "rtl" : "ltr"}
      style={{
        minHeight: "100vh", background: "#f8f5f0", padding: "35px 16px 60px",
        fontFamily: "Arial, sans-serif", color: "#292524",
      }}
    >
      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 25 }}>
          <div>
            <p style={{ color: "#873b50", fontWeight: 700 }}>MEMORIES</p>
            <h1 style={{ color: "#873b50", marginBottom: 8 }}>{t("Notifications", "الإشعارات")}</h1>
            <p style={{ color: "#777" }}>
              {t("Stay connected with your classmates.", "ابقَ على تواصل مع زملاء الدراسة.")}
            </p>
          </div>
          <button type="button" onClick={() => setLang(ar ? "en" : "ar")} style={buttonStyle}>
            {ar ? "English" : "العربية"}
          </button>
        </header>

        {error && <p role="alert" style={{ color: "#b42318" }}>{error}</p>}

        <section style={{ background: "#fff", padding: 25, borderRadius: 16, marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 12 }}>
            <div>
              <h2 style={{ color: "#873b50", margin: "0 0 6px" }}>
                {t("Notification History", "سجل الإشعارات")}
              </h2>
              <p style={{ color: "#777", margin: 0 }}>
                {unreadCount} {t("unread", "غير مقروء")}
              </p>
            </div>
            <button
              type="button"
              disabled={unreadCount === 0 || savingAll || Boolean(savingId)}
              onClick={() => void markAllAsRead()}
              style={{ ...buttonStyle, opacity: unreadCount === 0 || savingAll ? 0.5 : 1 }}
            >
              {savingAll ? t("Saving...", "جارٍ الحفظ...") : t("Mark all as read", "تحديد الكل كمقروء")}
            </button>
          </div>

          {notifications.length === 0 ? (
            <p style={{ color: "#777", padding: "16px 0" }}>
              {t("No notifications yet.", "لا توجد إشعارات بعد.")}
            </p>
          ) : (
            notifications.map((item) => {

const request = item.type === "connection_request";

const ownershipReceived =
  item.type === "group_ownership_received";

const ownershipTransferred =
  item.type === "group_ownership_transferred";

const joinApproved =
  item.type === "group_join_approved";


const joinDeclined =
  item.type === "group_join_declined";

const groupInvitation =
  item.type === "group_invitation";



const isOwnershipNotification =
  ownershipReceived || ownershipTransferred;

              const actorName = item.actor_id ? actorNames[item.actor_id] : "";

const groupName = item.group_id
  ? groupNames[item.group_id] || ""
  : "";

              const canViewProfile = Boolean(item.actor_id && profileAccess[item.actor_id]);
              const profileHref = item.actor_id
                ? `/dashboard/classmates/${encodeURIComponent(item.actor_id)}`
                : "";
              return (
                <article
                  key={item.id}
                  style={{
                    padding: "18px 14px", margin: "10px 0", borderRadius: 12,
                    border: item.is_read ? "1px solid #eee" : "1px solid #e6c7d0",
                    background: item.is_read ? "#fff" : "#fff6f8",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>




<strong style={{ color: "#873b50" }}>
  {groupInvitation
    ? t(
        actorName
          ? `${actorName} invited you to join ${groupName || "a classmate group"}`
          : `You have been invited to join ${groupName || "a classmate group"}`,
        actorName
          ? `دعاك ${actorName} للانضمام إلى ${groupName || "مجموعة زملاء الدراسة"}`
          : `تمت دعوتك للانضمام إلى ${groupName || "مجموعة زملاء الدراسة"}`
      )
    : joinDeclined

    ? t(
        "Group join request declined",
        "تم رفض طلب الانضمام إلى المجموعة"
      )
    : joinApproved
      ? t(
          "Group join request approved",
          "تمت الموافقة على طلب الانضمام إلى المجموعة"
        )
      : ownershipReceived

    ? actorName
      ? groupName
        ? t(
            `${actorName} transferred ownership of ${groupName} to you`,
            `قام ${actorName} بنقل ملكية مجموعة ${groupName} إليك`
          )
        : t(
            `${actorName} transferred group ownership to you`,
            `قام ${actorName} بنقل ملكية المجموعة إليك`
          )
      : groupName
        ? t(
            `You are now the owner of ${groupName}`,
            `أصبحت الآن مالك مجموعة ${groupName}`
          )
        : t(
            "You are now a group owner",
            "أصبحت مالكاً للمجموعة"
          )
    : ownershipTransferred
      ? actorName
        ? groupName
          ? t(
              `You transferred ownership of ${groupName} to ${actorName}`,
              `قمت بنقل ملكية مجموعة ${groupName} إلى ${actorName}`
            )
          : t(
              `You transferred group ownership to ${actorName}`,
              `قمت بنقل ملكية المجموعة إلى ${actorName}`
            )
        : groupName
          ? t(
              `You transferred ownership of ${groupName}`,
              `قمت بنقل ملكية مجموعة ${groupName}`
            )
          : t(
              "You transferred group ownership",
              "قمت بنقل ملكية المجموعة"
            )
      : request
        ? actorName
          ? t(
              `${actorName} sent you a connection request`,
              `أرسل إليك ${actorName} طلب تواصل`
            )
          : t("New connection request", "طلب تواصل جديد")
        : actorName
          ? t(
              `${actorName} accepted your connection request`,
              `وافق ${actorName} على طلب التواصل الذي أرسلته`
            )
          : t(
              "Your connection request was accepted",
              "تم قبول طلب التواصل الذي أرسلته"
            )}
</strong>


                    {!item.is_read && (
                      <span style={{ color: "#b42338", fontSize: 12, fontWeight: 700 }}>
                        ● {t("Unread", "غير مقروء")}
                      </span>
                    )}
                  </div>



<p style={{ color: "#6e6268", lineHeight: 1.7, margin: "10px 0" }}>

{groupInvitation
  ? t(
      `You have been invited to join ${groupName || "a classmate group"}.`,
      `تمت دعوتك للانضمام إلى ${groupName || "مجموعة زملاء الدراسة"}.`
    )
  : joinDeclined
    ? t(
      `Your request to join ${groupName || "the group"} was declined.`,
      `تم رفض طلب انضمامك إلى مجموعة ${groupName || "المجموعة"}.`
    )
  : joinApproved
    ? t(
        `Your request to join ${groupName || "the group"} has been approved.`,
        `تمت الموافقة على طلب انضمامك إلى مجموعة ${groupName || "المجموعة"}.`
      )
    : ownershipReceived

      ? t(
          "You are now responsible for managing this group.",
          "أصبحت الآن مسؤولاً عن إدارة هذه المجموعة."
        )
      : ownershipTransferred
        ? t(
            "Your group ownership transfer was completed successfully.",
            "تم نقل ملكية المجموعة بنجاح."
          )
        : request
          ? t(
              "A classmate would like to reconnect with you.",
              "أحد زملائك يرغب في إعادة التواصل معك."
            )
          : t(
              "A classmate accepted your request. You can now view your connections.",
              "وافق أحد زملائك على طلبك. يمكنك الآن عرض زملائك المتصلين."
            )}
</p>


                  <p style={{ color: "#999", fontSize: 13 }}>{dateLabel(item.created_at)}</p>
                  <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>




<Link
  href={
  groupInvitation
    ? "/dashboard/groups"
    : joinDeclined
      ? "/dashboard/groups/discover"
      : isOwnershipNotification || joinApproved
        ? item.group_id
          ? `/dashboard/groups/${item.group_id}`
          : "/dashboard/groups"
        : request
          ? "/dashboard/connection-requests"
          : "/dashboard/connections"
}
  style={{ color: "#873b50", fontWeight: 700 }}
>




{groupInvitation
  ? t("View invitation", "عرض الدعوة")
  : joinDeclined
    ? t("Discover groups", "استكشاف المجموعات")
    : isOwnershipNotification || joinApproved
      ? item.group_id
        ? t("View group", "عرض المجموعة")
        : t("View my groups", "عرض مجموعاتي")
      : request
        ? t("Review requests", "مراجعة الطلبات")
        : t("View connections", "عرض زملائي المتصلين")}

</Link>



                    {canViewProfile && (
                      <Link href={profileHref} style={{ color: "#873b50", fontWeight: 700 }}>
                        {t(`View ${actorName}'s profile`, `عرض ملف ${actorName} الشخصي`)}
                      </Link>
                    )}
                    {!item.is_read && (
                      <button
                        type="button"
                        disabled={savingId === item.id || savingAll}
                        onClick={() => void markAsRead(item.id)}
                        style={{ ...buttonStyle, padding: "7px 12px" }}
                      >
                        {savingId === item.id ? t("Saving...", "جارٍ الحفظ...") : t("Mark as read", "تحديد كمقروء")}
                      </button>
                    )}
                  </div>
                </article>
              );
            })
          )}
        </section>
        <p style={{ textAlign: "center", marginTop: 25 }}>
          <Link href="/dashboard" style={{ color: "#873b50", fontWeight: 700 }}>
            {t("Back to dashboard", "العودة إلى لوحة التحكم")}
          </Link>
        </p>
      </div>
    </main>
  );
}
