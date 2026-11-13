
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Membership = {
  membership_id: string;
  member_name: string;
  institution_name: string;
  institution_kind: string;
  start_year: number;
  end_year: number | null;
  membership_status: string;
};

const supabase = createClient();

export default function AdminMembershipsPage() {
  const [lang, setLang] = useState<"en" | "ar">("en");
  const [items, setItems] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const ar = lang === "ar";

  const loadMemberships = useCallback(async () => {
    setLoading(true);
    setError("");

    const { data, error: rpcError } = await supabase.rpc(
      "get_pending_memberships"
    );

    if (rpcError) {
      setError(rpcError.message);
      setItems([]);
    } else {
      setItems((data ?? []) as Membership[]);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    const initialize = async () => {
      const { data } = await supabase.auth.getUser();

      if (!data.user) {
        setError("Please sign in first.");
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("locale")
        .eq("id", data.user.id)
        .single();

      if (profile?.locale === "ar") {
        setLang("ar");
      }

      await loadMemberships();
    };

    void initialize();
  }, [loadMemberships]);

  async function review(
    membershipId: string,
    status: "approved" | "rejected"
  ) {
    const confirmed = window.confirm(
      status === "approved"
        ? ar
          ? "هل تريد الموافقة على هذا الطلب؟"
          : "Approve this membership?"
        : ar
          ? "هل تريد رفض هذا الطلب؟"
          : "Reject this membership?"
    );

    if (!confirmed) return;

    setBusyId(membershipId);
    setError("");
    setMessage("");

    const { error: rpcError } = await supabase.rpc(
      "review_membership",
      {
        p_membership_id: membershipId,
        p_new_status: status,
      }
    );

    if (rpcError) {
      setError(rpcError.message);
    } else {
      setMessage(
        status === "approved"
          ? ar
            ? "تمت الموافقة على الطلب."
            : "Membership approved."
          : ar
            ? "تم رفض الطلب."
            : "Membership rejected."
      );

      await loadMemberships();
    }

    setBusyId(null);
  }

  const styles = {
    page: {
      minHeight: "100vh",
      background: "#f8f5f0",
      padding: "48px 20px",
      fontFamily: "Arial, sans-serif",
    },
    container: {
      maxWidth: 1000,
      margin: "0 auto",
      background: "#fff",
      borderRadius: 18,
      padding: 28,
      boxShadow: "0 8px 28px rgba(0,0,0,0.05)",
    },
    button: {
      border: "none",
      borderRadius: 8,
      padding: "10px 16px",
      cursor: "pointer",
      fontWeight: 600,
    },
  } as const;

  return (
    <main style={styles.page} dir={ar ? "rtl" : "ltr"}>
      <div style={styles.container}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 16,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <h1 style={{ color: "#873b50" }}>
            {ar
              ? "مراجعة العضويات التعليمية"
              : "Educational Membership Review"}
          </h1>

          <button
            onClick={() => setLang(ar ? "en" : "ar")}
            style={{
              ...styles.button,
              background: "#f2e5e9",
              color: "#873b50",
            }}
          >
            {ar ? "English" : "العربية"}
          </button>
        </div>

        <p style={{ color: "#666", lineHeight: 1.7 }}>
          {ar
            ? "راجع طلبات الانضمام إلى المدارس والجامعات."
            : "Review pending school and university memberships."}
        </p>

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

        {loading ? (
          <p>{ar ? "جارٍ التحميل..." : "Loading..."}</p>
        ) : !error && items.length === 0 ? (
          <p>
            {ar
              ? "لا توجد طلبات بانتظار المراجعة."
              : "No pending memberships."}
          </p>
        ) : (
          <div style={{ display: "grid", gap: 16, marginTop: 24 }}>
            {items.map((item) => (
              <article
                key={item.membership_id}
                style={{
                  border: "1px solid #eadfe2",
                  borderRadius: 12,
                  padding: 20,
                }}
              >
                <h2
                  style={{
                    margin: "0 0 10px",
                    color: "#873b50",
                    fontSize: 20,
                  }}
                >
                  {item.member_name}
                </h2>

                <p>
                  <strong>
                    {ar ? "المؤسسة:" : "Institution:"}
                  </strong>{" "}
                  {item.institution_name}
                </p>

                <p>
                  <strong>{ar ? "النوع:" : "Type:"}</strong>{" "}
                  {item.institution_kind}
                </p>

                <p>
                  <strong>{ar ? "السنوات:" : "Years:"}</strong>{" "}
                  {item.start_year} – {item.end_year ?? "Present"}
                </p>

                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    flexWrap: "wrap",
                    marginTop: 16,
                  }}
                >
                  <button
                    disabled={busyId !== null}
                    onClick={() =>
                      review(item.membership_id, "approved")
                    }
                    style={{
                      ...styles.button,
                      background: "#167347",
                      color: "#fff",
                    }}
                  >
                    {busyId === item.membership_id
                      ? "..."
                      : ar
                        ? "موافقة"
                        : "Approve"}
                  </button>

                  <button
                    disabled={busyId !== null}
                    onClick={() =>
                      review(item.membership_id, "rejected")
                    }
                    style={{
                      ...styles.button,
                      background: "#b42318",
                      color: "#fff",
                    }}
                  >
                    {busyId === item.membership_id
                      ? "..."
                      : ar
                        ? "رفض"
                        : "Reject"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}

        <p style={{ marginTop: 30 }}>
          <Link href="/dashboard" style={{ color: "#873b50" }}>
            {ar ? "العودة إلى لوحة التحكم" : "Back to dashboard"}
          </Link>
        </p>
      </div>
    </main>
  );
}
