
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

type Request = {
  id: string;
  requester_id: string;
  created_at: string;
};

type RequestCard = Request & {
  requester_name: string;
};

export default function ConnectionRequestsPage() {
  const [lang, setLang] = useState<"en" | "ar">("en");
  const [requests, setRequests] = useState<RequestCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const ar = lang === "ar";

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const { data: auth, error: authError } =
        await supabase.auth.getUser();

      if (authError || !auth.user) {
        throw new Error("Please sign in.");
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("locale")
        .eq("id", auth.user.id)
        .single();

      if (profile?.locale === "ar") {
        setLang("ar");
      }

      const { data, error: requestError } =
        await supabase
          .from("connections")
          .select("id,requester_id,created_at")
          .eq("recipient_id", auth.user.id)
          .eq("status", "pending")
          .order("created_at", { ascending: false });

      if (requestError) throw requestError;

      const incoming = (data ?? []) as Request[];

      const cards: RequestCard[] = [];

      for (const request of incoming) {
        const { data: classmate, error: profileError } =
          await supabase.rpc("get_classmate_profile", {
            p_classmate_id: request.requester_id,
          });

        if (profileError) throw profileError;

        cards.push({
          ...request,
          requester_name:
            classmate?.[0]?.display_name ??
            (lang === "ar" ? "زميل دراسة" : "Classmate"),
        });
      }

      setRequests(cards);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load requests."
      );
    } finally {
      setLoading(false);
    }
  }, [lang]);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  async function respond(
    requestId: string,
    accept: boolean
  ) {
    if (busyId) return;

    setBusyId(requestId);
    setError("");
    setMessage("");

    const { data, error: rpcError } =
      await supabase.rpc("respond_connection_request", {
        p_connection_id: requestId,
        p_accept: accept,
      });

    if (rpcError) {
      setError(rpcError.message);
    } else if (data !== true) {
      setError(
        ar
          ? "لم يعد هذا الطلب متاحًا."
          : "This request is no longer available."
      );
    } else {
      setMessage(
        accept
          ? ar
            ? "تم قبول طلب التواصل."
            : "Connection request accepted."
          : ar
            ? "تم رفض طلب التواصل."
            : "Connection request declined."
      );

      await loadRequests();
    }

    setBusyId(null);
  }

  return (
    <main
      dir={ar ? "rtl" : "ltr"}
      style={{
        minHeight: "100vh",
        background: "#f8f5f0",
        padding: "48px 20px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: 820,
          margin: "0 auto",
          background: "#fff",
          borderRadius: 18,
          padding: 28,
          boxShadow: "0 8px 28px rgba(0,0,0,0.05)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
          }}
        >
          <h1 style={{ color: "#873b50" }}>
            {ar
              ? "طلبات التواصل"
              : "Connection Requests"}
          </h1>

          <button
            type="button"
            onClick={() => setLang(ar ? "en" : "ar")}
            style={{
              background: "#f2e5e9",
              color: "#873b50",
              border: "none",
              borderRadius: 8,
              padding: "10px 16px",
              cursor: "pointer",
            }}
          >
            {ar ? "English" : "العربية"}
          </button>
        </div>

        <p style={{ color: "#666" }}>
          {ar
            ? "راجع طلبات التواصل الواردة من زملائك."
            : "Review invitations from your classmates."}
        </p>

        {loading && (
          <p>{ar ? "جارٍ التحميل..." : "Loading..."}</p>
        )}

        {error && (
          <p role="alert" style={{ color: "#b42318" }}>
            {error}
          </p>
        )}

        {message && (
          <p role="status" style={{ color: "#26734d" }}>
            {message}
          </p>
        )}

        {!loading && requests.length === 0 && !error && (
          <div
            style={{
              padding: 28,
              background: "#f8f5f0",
              borderRadius: 12,
              marginTop: 24,
              textAlign: "center",
            }}
          >
            {ar
              ? "لا توجد طلبات تواصل جديدة."
              : "No new connection requests."}
          </div>
        )}

        <div
          style={{
            display: "grid",
            gap: 16,
            marginTop: 24,
          }}
        >
          {requests.map((request) => (
            <article
              key={request.id}
              style={{
                border: "1px solid #eadfe2",
                borderRadius: 12,
                padding: 20,
              }}
            >
              <h2 style={{ color: "#873b50" }}>
                {request.requester_name}
              </h2>

              <p style={{ color: "#666" }}>
                {ar
                  ? "يرغب هذا الزميل بالتواصل معك."
                  : "This classmate wants to connect with you."}
              </p>

              <div
                style={{
                  display: "flex",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <button
                  type="button"
                  disabled={busyId !== null}
                  onClick={() => respond(request.id, true)}
                  style={{
                    background: "#873b50",
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    padding: "11px 18px",
                    cursor: "pointer",
                  }}
                >
                  {ar ? "قبول" : "Accept"}
                </button>

                <button
                  type="button"
                  disabled={busyId !== null}
                  onClick={() => respond(request.id, false)}
                  style={{
                    background: "#f2e5e9",
                    color: "#873b50",
                    border: "none",
                    borderRadius: 8,
                    padding: "11px 18px",
                    cursor: "pointer",
                  }}
                >
                  {ar ? "رفض" : "Decline"}
                </button>
              </div>
            </article>
          ))}
        </div>

        <p style={{ marginTop: 30 }}>
          <Link href="/dashboard" style={{ color: "#873b50" }}>
            {ar
              ? "العودة إلى لوحة التحكم"
              : "Back to dashboard"}
          </Link>
        </p>
      </div>
    </main>
  );
}
