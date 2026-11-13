
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

type Connection = {
  id: string;
  requester_id: string;
  recipient_id: string;
  status: string;
  created_at: string;
};

type ConnectedClassmate = {
  connectionId: string;
  classmateId: string;
  name: string;
  institution: string;
  years: string;
  connectedAt: string;
  profileAvailable: boolean;
};

type ProfileRow = {
  display_name: string;
  institution_name: string;
  start_year: number;
  end_year: number;
};

export default function ConnectionsPage() {
  const [lang, setLang] = useState<"en" | "ar">("en");
  const [connections, setConnections] =
    useState<ConnectedClassmate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState("");

  const ar = lang === "ar";

  useEffect(() => {
    let active = true;

    async function loadConnections() {
      setLoading(true);
      setError("");

      try {
        const { data: auth, error: authError } =
          await supabase.auth.getUser();

        if (authError || !auth.user) {
          throw new Error("Please sign in.");
        }

        const userId = auth.user.id;

        const { data: ownProfile } = await supabase
          .from("profiles")
          .select("locale")
          .eq("id", userId)
          .single();

        if (!active) return;

        if (ownProfile?.locale === "ar") {
          setLang("ar");
        }

        const { data, error: connectionError } =
          await supabase
            .from("connections")
            .select(
              "id,requester_id,recipient_id,status,created_at"
            )
            .eq("status", "accepted")
            .or(
              `requester_id.eq.${userId},recipient_id.eq.${userId}`
            )
            .order("created_at", {
              ascending: false,
            });

        if (connectionError) {
          throw connectionError;
        }

        const rows = (data ?? []) as Connection[];

        const results = await Promise.all(
          rows.map(async (connection) => {
            const classmateId =
              connection.requester_id === userId
                ? connection.recipient_id
                : connection.requester_id;

            const { data: profileData } =
              await supabase.rpc(
                "get_classmate_profile",
                {
                  p_classmate_id: classmateId,
                }
              );

            const profiles =
              (profileData ?? []) as ProfileRow[];

            const profile = profiles[0];

            return {
              connectionId: connection.id,
              classmateId,
              name: profile?.display_name ?? "",
              institution:
                profiles
                  .map((item) => item.institution_name)
                  .filter((value, index, array) =>
                    array.indexOf(value) === index
                  )
                  .join(", "),
              years: profile
                ? `${profile.start_year} – ${profile.end_year}`
                : "",
              connectedAt: connection.created_at,
              profileAvailable: profiles.length > 0,
            };
          })
        );

        if (active) {
          setConnections(results);
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load connections."
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadConnections();

    return () => {
      active = false;
    };
  }, []);

  async function handleRemoveConnection(
    connectionId: string,
    classmateName: string
  ) {
    if (removingId) return;

    const confirmed = window.confirm(
      ar
        ? `هل أنت متأكد من إزالة الاتصال مع ${classmateName}؟`
        : `Are you sure you want to remove your connection with ${classmateName}?`
    );

    if (!confirmed) return;

    setRemovingId(connectionId);
    setRemoveError("");

    try {
      const { error: rpcError } = await supabase.rpc(
        "remove_connection",
        { p_connection_id: connectionId }
      );

      if (rpcError) throw rpcError;

      setConnections((current) =>
        current.filter((item) => item.connectionId !== connectionId)
      );
    } catch (err) {
      setRemoveError(
        err instanceof Error
          ? err.message
          : "Unable to remove connection."
      );
    } finally {
      setRemovingId(null);
    }
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
          maxWidth: 900,
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
            flexWrap: "wrap",
            gap: 16,
          }}
        >
          <div>
            <h1 style={{ color: "#873b50" }}>
              {ar ? "زملائي المتصلون" : "My Connections"}
            </h1>

            <p style={{ color: "#666" }}>
              {ar
                ? "ابقَ على تواصل مع زملاء الدراسة الذين قبلت التواصل معهم."
                : "Stay in touch with classmates you've connected with."}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setLang(ar ? "en" : "ar")}
            style={{
              border: "none",
              borderRadius: 8,
              padding: "10px 16px",
              background: "#f2e5e9",
              color: "#873b50",
              cursor: "pointer",
            }}
          >
            {ar ? "English" : "العربية"}
          </button>
        </div>

        {removeError && (
          <p role="alert" style={{ color: "#b42318" }}>
            {ar ? "تعذرت إزالة الاتصال: " : "Unable to remove connection: "}
            {removeError}
          </p>
        )}

        {!loading && !error && (
          <p
            style={{
              color: "#873b50",
              fontWeight: 600,
              marginTop: 20,
            }}
          >
            {ar ? "عدد الاتصالات:" : "Total connections:"}{" "}
            {connections.length}
          </p>
        )}

        {loading && (
          <p>{ar ? "جارٍ التحميل..." : "Loading connections..."}</p>
        )}

        {error && (
          <p role="alert" style={{ color: "#b42318" }}>
            {error}
          </p>
        )}

        {!loading && !error && connections.length === 0 && (
          <div
            style={{
              padding: 28,
              background: "#f8f5f0",
              borderRadius: 12,
              textAlign: "center",
              marginTop: 24,
            }}
          >
            <h2 style={{ color: "#873b50" }}>
              {ar
                ? "لا توجد اتصالات بعد"
                : "No connections yet"}
            </h2>

            <p style={{ color: "#666" }}>
              {ar
                ? "ابدأ بالبحث عن زملائك وإرسال طلبات التواصل."
                : "Find your classmates and start sending connection requests."}
            </p>

            <Link
              href="/dashboard/classmates"
              style={{ color: "#873b50" }}
            >
              {ar ? "البحث عن زملاء" : "Find Classmates"}
            </Link>
          </div>
        )}

        {!loading && !error && connections.length > 0 && (
          <div
            style={{
              display: "grid",
              gap: 16,
              marginTop: 24,
            }}
          >
            {connections.map((person) => (
              <article
                key={person.connectionId}
                style={{
                  padding: 22,
                  border: "1px solid #eadfe2",
                  borderRadius: 14,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    marginBottom: 16,
                  }}
                >
                  <div
                    aria-hidden="true"
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: "50%",
                      background: "#873b50",
                      color: "#fff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 23,
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    {person.name
                      ? person.name.charAt(0).toUpperCase()
                      : "?"}
                  </div>

                  <div>
                    <h2
                      style={{
                        color: "#873b50",
                        margin: 0,
                      }}
                    >
                      {person.profileAvailable
                        ? person.name
                        : ar
                          ? "زميل متصل"
                          : "Connected Classmate"}
                    </h2>

                    <span
                      style={{
                        color: "#26734d",
                        fontSize: 14,
                      }}
                    >
                      {ar ? "✓ متصلان" : "✓ Connected"}
                    </span>
                  </div>
                </div>

                {person.profileAvailable ? (
                  <>
                    <p>
                      <strong>
                        {ar
                          ? "المؤسسة التعليمية:"
                          : "Institution:"}
                      </strong>{" "}
                      {person.institution}
                    </p>

                    <p>
                      <strong>
                        {ar
                          ? "سنوات الدراسة:"
                          : "Study years:"}
                      </strong>{" "}
                      {person.years}
                    </p>

                    <Link
                      href={`/dashboard/classmates/${encodeURIComponent(
                        person.classmateId
                      )}`}
                      style={{
                        display: "inline-block",
                        marginTop: 12,
                        padding: "11px 20px",
                        background: "#873b50",
                        color: "#fff",
                        borderRadius: 9,
                        textDecoration: "none",
                        fontWeight: 600,
                      }}
                    >
                      {ar
                        ? "عرض الملف الشخصي"
                        : "View Profile"}
                    </Link>
                  </>
                ) : (
                  <p style={{ color: "#666" }}>
                    {ar
                      ? "الملف الشخصي لهذا الزميل غير متاح حاليًا بسبب إعدادات الخصوصية."
                      : "This classmate's profile is currently unavailable due to privacy settings."}
                  </p>
                )}

                <button
                  type="button"
                  disabled={removingId !== null}
                  onClick={() =>
                    void handleRemoveConnection(
                      person.connectionId,
                      person.name || (ar ? "هذا الزميل" : "this classmate")
                    )
                  }
                  style={{
                    display: "inline-block",
                    marginTop: 12,
                    marginInlineStart: person.profileAvailable ? 10 : 0,
                    padding: "11px 20px",
                    background: "#fff",
                    color: "#b42338",
                    border: "1px solid #e6b9c2",
                    borderRadius: 9,
                    cursor: removingId !== null ? "wait" : "pointer",
                    fontWeight: 600,
                    opacity: removingId !== null ? 0.6 : 1,
                  }}
                >
                  {removingId === person.connectionId
                    ? ar ? "جارٍ الإزالة..." : "Removing..."
                    : ar ? "إزالة الاتصال" : "Remove Connection"}
                </button>
              </article>
            ))}
          </div>
        )}

        <div
          style={{
            display: "flex",
            gap: 20,
            flexWrap: "wrap",
            marginTop: 32,
          }}
        >
          <Link
            href="/dashboard/classmates"
            style={{ color: "#873b50" }}
          >
            {ar ? "البحث عن زملاء" : "Find Classmates"}
          </Link>

          <Link
            href="/dashboard/connection-requests"
            style={{ color: "#873b50" }}
          >
            {ar ? "طلبات التواصل" : "Connection Requests"}
          </Link>

          <Link
            href="/dashboard"
            style={{ color: "#873b50" }}
          >
            {ar ? "لوحة التحكم" : "Dashboard"}
          </Link>
        </div>
      </div>
    </main>
  );
}
