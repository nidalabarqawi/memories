"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Language = "en" | "ar";

export default function DashboardPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [lang, setLang] = useState<Language>("en");
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [pendingRequests, setPendingRequests] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);

  const ar = lang === "ar";

  useEffect(() => {
    let active = true;
    const supabase = createClient();

    async function loadDashboard() {
      const { data, error } = await supabase.auth.getUser();

      if (!active) return;

      if (error || !data.user) {
        router.replace("/login");



        return;
      }

      setEmail(data.user.email || "");

      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name, locale")
        .eq("id", data.user.id)
        .single();

      if (!active) return;

      if (profile) {
        setName(profile.display_name || "");
        setLang(profile.locale === "ar" ? "ar" : "en");
      }

const { data: adminStatus, error: adminError } =
  await supabase.rpc("is_app_admin");

if (!active) return;

if (!adminError && adminStatus === true) {
  setIsAdmin(true);
}

      setLoading(false);
    }

    void loadDashboard();

    return () => {
      active = false;
    };
  }, [router]);

  // Keep connection requests, notifications and messages synchronized.
  useEffect(() => {
    const supabase = createClient();
    let active = true;
    let userId = "";
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let requestVersion = 0;

    async function refreshCounts() {
      if (!active || !userId) return;
      const version = ++requestVersion;

      const [pendingResult, unreadResult, messagesResult] = await Promise.all([
        supabase
          .from("connections")
          .select("id", { count: "exact", head: true })
          .eq("recipient_id", userId)
          .eq("status", "pending"),
        supabase
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("is_read", false),
        supabase
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("recipient_id", userId)
          .eq("is_read", false),
      ]);

      if (!active || version !== requestVersion) return;

      if (pendingResult.error) {
        console.error("Pending requests count error:", pendingResult.error.message);
      } else {
        setPendingRequests(pendingResult.count ?? 0);
      }

      if (unreadResult.error) {
        console.error("Unread notifications count error:", unreadResult.error.message);
      } else {
        setUnreadNotifications(unreadResult.count ?? 0);
      }

      if (messagesResult.error) {
        console.error("Unread messages count error:", messagesResult.error.message);
      } else {
        setUnreadMessages(messagesResult.count ?? 0);
      }
    }

    async function initializeRealtime() {
      const { data, error } = await supabase.auth.getUser();
      if (!active || error || !data.user) return;
      userId = data.user.id;

      channel = supabase
        .channel(`dashboard-notifications-${userId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${userId}`,
          },
          () => { void refreshCounts(); }
        )
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "connections",
            filter: `recipient_id=eq.${userId}`,
          },
          () => { void refreshCounts(); }
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "connections",
            filter: `recipient_id=eq.${userId}`,
          },
          () => { void refreshCounts(); }
        )
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter: `recipient_id=eq.${userId}`,
          },
          () => { void refreshCounts(); }
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "messages",
            filter: `recipient_id=eq.${userId}`,
          },
          () => { void refreshCounts(); }
        )
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            void refreshCounts();
          } else if (status === "CHANNEL_ERROR") {
            console.error("Dashboard notifications Realtime channel error");
          }
        });
    }

    void initializeRealtime();

    function handleFocus() { void refreshCounts(); }
    function handleVisibility() {
      if (document.visibilityState === "visible") void refreshCounts();
    }

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      active = false;
      requestVersion++;
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
      if (channel) void supabase.removeChannel(channel);
    };
  }, []);

  async function changeLanguage(next: Language) {
    setLang(next);

    const supabase = createClient();
    const { data } = await supabase.auth.getUser();

    if (data.user) {
      const { error } = await supabase
        .from("profiles")
        .update({ locale: next })
        .eq("id", data.user.id);

      if (error) {
        console.error(
          "Could not save language:",
          error.message
        );
      }
    }
  }


async function logout() {
  if (signingOut) return;

  setSigningOut(true);

  try {
    const supabase = createClient();

    const { error } = await supabase.auth.signOut();

   

    if (error) {
      throw error;
    }

    // Clear cached private-photo URLs after successful logout.
    try {
      const keysToRemove: string[] = [];

      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);

        if (key?.startsWith("memories-photo-url:")) {
          keysToRemove.push(key);
        }
      }

      keysToRemove.forEach((key) => {
        sessionStorage.removeItem(key);
      });
    } catch (cacheError) {
      console.warn("Could not clear photo URL cache:", cacheError);
    }

    router.replace("/login");
    router.refresh();


  } catch (err) {
    console.error("Logout failed:", err);

    alert(
      err instanceof Error
        ? err.message
        : "Unable to sign out. Please try again."
    );
  } finally {
    setSigningOut(false);
  }
}


  if (loading) {
    return (
      <main
        style={{
          minHeight: "100vh",
          background: "#f8f5f0",
          padding: 40,
          color: "#873b50",
        }}
      >
        Loading Memories...
      </main>
    );
  }

  const cards = [
    {
      href: "/dashboard/education",
      icon: "🎓",
      title: ar
        ? "رحلتي التعليمية"
        : "Educational Journey",
      description: ar
        ? "أضف مدارسك وجامعاتك وسنوات الدراسة."
        : "Manage your schools, universities, and attendance years.",
    },
    {
      href: "/dashboard/classmates",
      icon: "👥",
      title: ar
        ? "ابحث عن زملائك"
        : "Find Classmates",
      description: ar
        ? "اكتشف زملاء الدراسة القدامى وتواصل معهم."
        : "Rediscover classmates from your educational journey.",
    },
    {
      href: "/dashboard/connections",
      icon: "🤝",
      title: ar
        ? "زملائي المتصلون"
        : "My Connections",
      description: ar
        ? "استعرض زملاء الدراسة الذين أصبحت على تواصل معهم."
        : "View classmates you've connected with and revisit their profiles.",
    },
    {
      href: "/dashboard/messages",
      notificationCount: unreadMessages,
      badgeType: "unread" as const,
      icon: "💬",
      title: ar ? "محادثاتي" : "My Conversations",
      description: ar
        ? "تبادل الرسائل الخاصة مع زملائك المتصلين."
        : "Send and receive private messages with connected classmates.",
    },

{
  href: "/dashboard/groups",
  icon: "👥",
  title: ar ? "مجموعاتي" : "My Groups",
  description: ar
    ? "انضم إلى المجموعات، وتواصل مع زملائك، وشارك في المحادثات الجماعية."
    : "Join groups, reconnect with classmates, and participate in group conversations.",
},

    {
      href: "/dashboard/connection-requests",
      notificationCount: pendingRequests,
      icon: "💌",
      title: ar
        ? "طلبات التواصل"
        : "Connection Requests",
      description: ar
        ? "راجع طلبات التواصل الواردة واقبلها أو ارفضها."
        : "Review incoming connection requests and accept or decline invitations.",
    },
    {
      href: "/dashboard/memories",
      icon: "📸",
      title: ar ? "ذكرياتي" : "My Memories",
      description: ar
        ? "استعرض ذكرياتك وأضف قصصاً جديدة من أيام الدراسة."
        : "Explore your memories and add new stories from your school days.",
    },
    {
      href: "/dashboard/classmate-memories",
      icon: "📖",
      title: ar
        ? "ذكريات الزملاء"
        : "Classmate Memories",
      description: ar
        ? "استكشف الذكريات التي شاركها زملاؤك الموثّقون."
        : "Explore memories shared by your verified classmates.",
    },
    {
      href: "/dashboard/profile",
      icon: "👤",
      title: ar ? "ملفي الشخصي" : "My Profile",
      description: ar
        ? "حدّث بياناتك وتحكم بإعدادات الخصوصية."
        : "Update your information and privacy settings.",
    },

    ...(isAdmin
      ? [
          {
            href: "/dashboard/admin/institutions",
            icon: "🛡️",
            title: ar
              ? "إدارة المؤسسات التعليمية"
              : "Institution Administration",
            description: ar
              ? "مراجعة طلبات إضافة المدارس والجامعات والموافقة عليها أو رفضها."
              : "Review, approve, or reject new school and university requests.",
          },
        ]
      : []),
  ];


  return (
    <main
      dir={ar ? "rtl" : "ltr"}
      style={{
        minHeight: "100vh",
        background: "#f8f5f0",
        padding: "32px 18px 60px",
        fontFamily: "Arial, sans-serif",
        color: "#29232a",
      }}
    >
      <div
        style={{
          maxWidth: 1050,
          margin: "0 auto",
        }}
      >
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
            marginBottom: 26,
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                color: "#873b50",
                fontSize: 32,
                fontWeight: 800,
              }}
            >
              Memories
            </h1>

            <p
              style={{
                margin: "5px 0 0",
                color: "#776b70",
                fontSize: 13,
              }}
            >
              {ar
                ? "لأن بعض الذكريات تستحق أن تعود"
                : "Some memories deserve to be rediscovered"}
            </p>
          </div>

          <div
            style={{
              display: "flex",
              gap: 10,
            }}
          >
            <button
              type="button"
              onClick={() =>
                changeLanguage(ar ? "en" : "ar")
              }
              style={{
                background: "#ffffff",
                color: "#873b50",
                border: "1px solid #e3d6da",
                borderRadius: 9,
                padding: "10px 15px",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              {ar ? "English" : "العربية"}
            </button>

<Link
  href="/dashboard/notifications"
  aria-label={
    ar
      ? `الإشعارات: ${unreadNotifications} إشعارات غير مقروءة`
      : `Notifications: ${unreadNotifications} unread notifications`
  }
  title={ar ? "الإشعارات" : "Notifications"}
  style={{
    position: "relative",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 46,
    height: 46,
    background: "#fff",
    border: "1px solid #e9dfe2",
    borderRadius: 12,
    color: "#873b50",
    textDecoration: "none",
  }}
>
  <svg
    width="23"
    height="23"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
    <path d="M10 21h4" />
  </svg>

  {unreadNotifications > 0 && (
    <span
      style={{
        position: "absolute",
        top: -7,
        right: -7,
        minWidth: 21,
        height: 21,
        padding: "0 5px",
        borderRadius: 20,
        background: "#b42338",
        color: "#fff",
        fontSize: 11,
        fontWeight: 700,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: "2px solid #f8f5f0",
      }}
    >
      {unreadNotifications > 99 ? "99+" : unreadNotifications}
    </span>
  )}
</Link>

            <button
              type="button"
              onClick={logout}
              disabled={signingOut}
              style={{
                background: "#873b50",
                color: "#fff",
                border: "none",
                borderRadius: 9,
                padding: "10px 15px",
                cursor: signingOut ? "wait" : "pointer",
                fontWeight: 600,
              }}
            >
              {signingOut
                ? "..."
                : ar
                  ? "تسجيل الخروج"
                  : "Sign out"}
            </button>
          </div>
        </header>

        <section
          style={{
            background:
              "linear-gradient(135deg, #873b50, #5c263a)",
            color: "#fff",
            padding: "36px 30px",
            borderRadius: 20,
            marginBottom: 28,
          }}
        >
          <p
            style={{
              margin: "0 0 10px",
              opacity: 0.85,
              fontSize: 14,
            }}
          >
            {ar
              ? "مرحباً بعودتك إلى Memories"
              : "Welcome back to Memories"}
          </p>

          <h2
            style={{
              margin: "0 0 12px",
              fontSize: "clamp(25px, 4vw, 36px)",
            }}
          >
            {name ||
              (ar ? "صديقنا العزيز" : "Dear friend")}
          </h2>

          <p
            style={{
              maxWidth: 650,
              lineHeight: 1.8,
              opacity: 0.92,
              margin: 0,
            }}
          >
            {ar
              ? "كل صداقة لها حكاية، وكل ذكرى تستحق أن تُروى. ابدأ رحلتك في استعادة أجمل أيام الدراسة."
              : "Every friendship has a story, and every memory deserves to be remembered. Begin rediscovering the people who shared your school years."}
          </p>
        </section>

        <section>
          <h2
            style={{
              color: "#873b50",
              fontSize: 23,
              marginBottom: 8,
            }}
          >
            {ar
              ? "اكتشف عالم ذكرياتك"
              : "Explore Your Memories"}
          </h2>

          <p
            style={{
              color: "#756c70",
              marginBottom: 24,
              lineHeight: 1.6,
            }}
          >
            {ar
              ? "كل ما تحتاجه للعودة إلى أجمل اللحظات."
              : "Your journey back to meaningful connections starts here."}
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(230px, 1fr))",
              gap: 18,
            }}
          >
                {cards.map((card) => (
                <Link
                key={card.href}
                href={card.href}
                style={{
                  background: "#fff",
                  padding: 24,
                  borderRadius: 16,
                  border: "1px solid #eee5e8",
                  textDecoration: "none",
                  minHeight: 230,
                  boxShadow:
                    "0 5px 18px rgba(0,0,0,0.03)",
                  display: "block",
                }}
              >

{"notificationCount" in card &&
  typeof card.notificationCount === "number" &&
  card.notificationCount > 0 && (
    <div
      style={{
        display: "flex",
        justifyContent: "flex-end",
        marginBottom: 8,
      }}
    >
      <span
        style={{
          background: "#873b50",
          color: "#fff",
          borderRadius: 20,
          padding: "5px 10px",
          fontSize: 12,
          fontWeight: 700,
        }}
      >
        {card.notificationCount}{" "}
        {"badgeType" in card && card.badgeType === "unread"
          ? (ar ? "غير مقروءة" : "unread")
          : (ar ? "بانتظار الرد" : "pending")}
      </span>
    </div>
  )}

                <div
                  style={{
                    fontSize: 32,
                    marginBottom: 18,
                  }}
                >
                  {card.icon}
                </div>

                <h3
                  style={{
                    color: "#873b50",
                    margin: "0 0 10px",
                    fontSize: 19,
                  }}
                >
                  {card.title}
                </h3>

                <p
                  style={{
                    color: "#70686c",
                    lineHeight: 1.7,
                    fontSize: 14,
                    margin: "0 0 20px",
                  }}
                >
                  {card.description}
                </p>

                <span
                  style={{
                    color: "#873b50",
                    fontWeight: 700,
                    fontSize: 13,
                  }}
                >
                  {ar ? "استكشف ←" : "Explore →"}
                </span>
              </Link>
            ))}
          </div>
        </section>

        <footer
          style={{
            textAlign: "center",
            marginTop: 45,
            color: "#887d81",
            fontSize: 13,
          }}
        >
          <p>{email}</p>
          <p>
            © {new Date().getFullYear()} Memories
          </p>
        </footer>
      </div>
    </main>
  );
}
