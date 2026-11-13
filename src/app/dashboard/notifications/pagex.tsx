
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Language = "en" | "ar";

type Connection = {
  id: string;
  requester_id: string;
  recipient_id: string;
  status: string;
  created_at: string;
  updated_at: string | null;
};

export default function NotificationsPage() {
  const [lang, setLang] = useState<Language>("en");
  const [userId, setUserId] = useState("");
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const ar = lang === "ar";
  const t = (en: string, arabic: string) => ar ? arabic : en;

  const loadNotifications = useCallback(async (id: string) => {
    const supabase = createClient();

    const { data, error: loadError } = await supabase
      .from("connections")
      .select(
        "id, requester_id, recipient_id, status, created_at, updated_at"
      )
      .or(`requester_id.eq.${id},recipient_id.eq.${id}`)
      .in("status", ["pending", "accepted"])
      .order("updated_at", { ascending: false });

    if (loadError) {
      setError(loadError.message);
      return;
    }

    setConnections(data ?? []);
  }, []);

  useEffect(() => {
    let active = true;

    async function initialize() {
      const supabase = createClient();

      const { data: auth, error: authError } =
        await supabase.auth.getUser();

      if (!active) return;

      if (authError || !auth.user) {
        setError("Please sign in to continue.");
        setLoading(false);
        return;
      }

      setUserId(auth.user.id);

      const { data: profile } = await supabase
        .from("profiles")
        .select("locale")
        .eq("id", auth.user.id)
        .single();

      if (!active) return;

      if (profile?.locale === "ar") {
        setLang("ar");
      }

      await loadNotifications(auth.user.id);

      if (active) setLoading(false);
    }

    void initialize();

    return () => {
      active = false;
    };
  }, [loadNotifications]);

  const incoming = connections.filter(
    (item) =>
      item.status === "pending" &&
      item.recipient_id === userId
  );

  const accepted = connections.filter(
    (item) => item.status === "accepted"
  );

  const dateLabel = (value: string | null) => {
    if (!value) return "";

    return new Date(value).toLocaleDateString(
      ar ? "ar-JO" : "en-GB",
      {
        year: "numeric",
        month: "short",
        day: "numeric",
      }
    );
  };

  if (loading) {
    return (
      <main style={{ padding: 40, background: "#f8f5f0" }}>
        Loading notifications...
      </main>
    );
  }

  return (
    <main
      dir={ar ? "rtl" : "ltr"}
      style={{
        minHeight: "100vh",
        background: "#f8f5f0",
        padding: "35px 16px 60px",
        fontFamily: "Arial, sans-serif",
        color: "#292524",
      }}
    >
      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
            marginBottom: 25,
          }}
        >
          <div>
            <p style={{ color: "#873b50", fontWeight: 700 }}>
              MEMORIES
            </p>

            <h1 style={{ color: "#873b50" }}>
              {t("Notifications", "الإشعارات")}
            </h1>

            <p style={{ color: "#777" }}>
              {t(
                "Stay connected with your classmates.",
                "ابقَ على تواصل مع زملاء الدراسة."
              )}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setLang(ar ? "en" : "ar")}
            style={{
              padding: "10px 15px",
              border: "1px solid #ded5d0",
              background: "#fff",
              color: "#873b50",
              borderRadius: 9,
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            {ar ? "English" : "العربية"}
          </button>
        </header>

        {error && (
          <p role="alert" style={{ color: "#b42318" }}>
            {error}
          </p>
        )}

        <section
          style={{
            background: "#fff",
            padding: 25,
            borderRadius: 16,
            marginBottom: 20,
          }}
        >
          <h2 style={{ color: "#873b50" }}>
            {t("Incoming Requests", "طلبات التواصل الواردة")}
            {" "}
            ({incoming.length})
          </h2>

          {incoming.length === 0 ? (
            <p style={{ color: "#777" }}>
              {t(
                "No pending connection requests.",
                "لا توجد طلبات تواصل قيد الانتظار."
              )}
            </p>
          ) : (
            incoming.map((item) => (
              <div
                key={item.id}
                style={{
                  padding: "17px 0",
                  borderBottom: "1px solid #eee",
                }}
              >
                <strong>
                  {t(
                    "New connection request",
                    "طلب تواصل جديد"
                  )}
                </strong>

                <p style={{ color: "#777" }}>
                  {t(
                    "A classmate would like to reconnect with you.",
                    "أحد زملائك يرغب في إعادة التواصل معك."
                  )}
                </p>

                <p style={{ color: "#999", fontSize: 13 }}>
                  {dateLabel(item.created_at)}
                </p>

                <Link
                  href="/dashboard/connection-requests"
                  style={{
                    color: "#873b50",
                    fontWeight: 700,
                  }}
                >
                  {t("Review request", "مراجعة الطلب")}
                </Link>
              </div>
            ))
          )}
        </section>

        <section
          style={{
            background: "#fff",
            padding: 25,
            borderRadius: 16,
          }}
        >
          <h2 style={{ color: "#873b50" }}>
            {t("Accepted Connections", "طلبات التواصل المقبولة")}
          </h2>

          {accepted.length === 0 ? (
            <p style={{ color: "#777" }}>
              {t(
                "No accepted connections yet.",
                "لا توجد اتصالات مقبولة بعد."
              )}
            </p>
          ) : (
            accepted.map((item) => (
              <div
                key={item.id}
                style={{
                  padding: "17px 0",
                  borderBottom: "1px solid #eee",
                }}
              >
                <strong>
                  {item.requester_id === userId
                    ? t(
                        "Your request was accepted",
                        "تم قبول طلب التواصل الذي أرسلته"
                      )
                    : t(
                        "Connection established",
                        "تم إنشاء اتصال جديد"
                      )}
                </strong>

                <p style={{ color: "#777" }}>
                  {t(
                    "You are now connected with a classmate.",
                    "أصبحت الآن على تواصل مع أحد زملائك."
                  )}
                </p>

                <p style={{ color: "#999", fontSize: 13 }}>
                  {dateLabel(
                    item.updated_at ?? item.created_at
                  )}
                </p>

                <Link
                  href="/dashboard/connections"
                  style={{
                    color: "#873b50",
                    fontWeight: 700,
                  }}
                >
                  {t("View connections", "عرض زملائي المتصلين")}
                </Link>
              </div>
            ))
          )}
        </section>

        <p style={{ textAlign: "center", marginTop: 25 }}>
          <Link href="/dashboard" style={{ color: "#873b50" }}>
            {t("Back to dashboard", "العودة إلى لوحة التحكم")}
          </Link>
        </p>
      </div>
    </main>
  );
}
