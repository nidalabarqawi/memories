
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Language = "en" | "ar";

type InstitutionRequest = {
  id: string;
  requested_by: string;
  kind: string;
  name: string;
  city: string;
  country_code: string;
  status: string;
  created_at: string;
};

type Institution = {
  id: string;
  name: string;
  kind: string;
  city: string | null;
  country_code: string | null;
};

export default function AdminInstitutionsPage() {
  const [lang, setLang] = useState<Language>("en");
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [requests, setRequests] = useState<InstitutionRequest[]>([]);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [processingId, setProcessingId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const ar = lang === "ar";
  const t = (en: string, arabic: string) => ar ? arabic : en;

  const loadRequests = useCallback(async () => {
    const supabase = createClient();

    const { data, error: loadError } = await supabase.rpc(
      "get_admin_institution_requests"
    );

    if (loadError) {
      setError(loadError.message);
      return;
    }

    setRequests(data ?? []);
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

      const { data: isAdmin, error: adminError } =
        await supabase.rpc("is_app_admin");

      if (!active) return;

      if (adminError || isAdmin !== true) {
        setAuthorized(false);
        setLoading(false);
        return;
      }

      setAuthorized(true);

      const [profileResult, requestsResult, institutionsResult] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("locale")
            .eq("id", auth.user.id)
            .single(),

          supabase.rpc("get_admin_institution_requests"),

          supabase
            .from("institutions")
            .select("id, name, kind, city, country_code")
            .order("name"),
        ]);

      if (!active) return;

      if (profileResult.data?.locale === "ar") {
        setLang("ar");
      }

      if (requestsResult.error) {
        setError(requestsResult.error.message);
      } else {
        setRequests(requestsResult.data ?? []);
      }

      if (institutionsResult.error) {
        setError(institutionsResult.error.message);
      } else {
        setInstitutions(institutionsResult.data ?? []);
      }

      setLoading(false);
    }

    void initialize();

    return () => {
      active = false;
    };
  }, []);

  function findSimilar(request: InstitutionRequest) {
    const normalize = (value: string) =>
      value.trim().replace(/\s+/g, " ").toLowerCase();

    return institutions.filter((institution) => {
      if (institution.kind !== request.kind) return false;

      const nameA = normalize(institution.name);
      const nameB = normalize(request.name);

      return (
        nameA.includes(nameB) ||
        nameB.includes(nameA)
      );
    }).slice(0, 5);
  }

  async function reviewRequest(
    request: InstitutionRequest,
    approve: boolean
  ) {
    const action = approve
      ? t("approve", "الموافقة على")
      : t("reject", "رفض");

    const confirmed = window.confirm(
      t(
        `Are you sure you want to ${action} "${request.name}"?`,
        `هل أنت متأكد من ${action} طلب "${request.name}"؟`
      )
    );

    if (!confirmed) return;

    setProcessingId(request.id);
    setError("");
    setMessage("");

    try {
      const supabase = createClient();

      const { error: reviewError } = await supabase.rpc(
        "review_institution_request",
        {
          p_request_id: request.id,
          p_approve: approve,
        }
      );

      if (reviewError) throw reviewError;

      setMessage(
        approve
          ? t(
              "Institution request approved successfully.",
              "تمت الموافقة على طلب المؤسسة بنجاح."
            )
          : t(
              "Institution request rejected.",
              "تم رفض طلب المؤسسة."
            )
      );

      await loadRequests();

      if (approve) {
        const { data, error: institutionsError } =
          await supabase
            .from("institutions")
            .select("id, name, kind, city, country_code")
            .order("name");

        if (institutionsError) {
          setError(institutionsError.message);
        } else {
          setInstitutions(data ?? []);
        }
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to review institution request."
      );
    } finally {
      setProcessingId("");
    }
  }

  if (loading) {
    return (
      <main style={{ padding: 40, background: "#f8f5f0", minHeight: "100vh" }}>
        Loading administrator dashboard...
      </main>
    );
  }

  if (!authorized) {
    return (
      <main
        style={{
          padding: 40,
          background: "#f8f5f0",
          minHeight: "100vh",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <h1 style={{ color: "#873b50" }}>
          Access restricted
        </h1>

        <p>
          This page is available only to Memories administrators.
        </p>

        <Link href="/dashboard" style={{ color: "#873b50" }}>
          Back to dashboard
        </Link>
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
      <div style={{ maxWidth: 950, margin: "0 auto" }}>
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
            marginBottom: 25,
          }}
        >
          <div>
            <p style={{ color: "#873b50", fontWeight: 700 }}>
              MEMORIES ADMIN
            </p>

            <h1 style={{ color: "#873b50", margin: 0 }}>
              {t(
                "Institution Requests",
                "طلبات إضافة المؤسسات التعليمية"
              )}
            </h1>

            <p style={{ color: "#777", lineHeight: 1.7 }}>
              {t(
                "Review requested schools and universities before adding them to the directory.",
                "راجع طلبات المدارس والجامعات قبل إضافتها إلى دليل المؤسسات."
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

        <section
          style={{
            background: "linear-gradient(135deg, #873b50, #5c263a)",
            color: "#fff",
            padding: 25,
            borderRadius: 16,
            marginBottom: 25,
          }}
        >
          <p style={{ margin: "0 0 8px" }}>
            {t("Pending requests", "الطلبات قيد المراجعة")}
          </p>

          <strong style={{ fontSize: 36 }}>
            {requests.length}
          </strong>
        </section>

        {error && (
          <p
            role="alert"
            style={{
              padding: 15,
              background: "#fff1f0",
              color: "#b42318",
              borderRadius: 10,
            }}
          >
            {error}
          </p>
        )}

        {message && (
          <p
            role="status"
            style={{
              padding: 15,
              background: "#edf8f0",
              color: "#167347",
              borderRadius: 10,
            }}
          >
            {message}
          </p>
        )}

        {requests.length === 0 ? (
          <section
            style={{
              padding: 35,
              background: "#fff",
              borderRadius: 16,
              textAlign: "center",
            }}
          >
            <h2 style={{ color: "#873b50" }}>
              {t(
                "No pending requests",
                "لا توجد طلبات قيد المراجعة"
              )}
            </h2>

            <p style={{ color: "#777" }}>
              {t(
                "New institution requests will appear here.",
                "ستظهر طلبات إضافة المؤسسات الجديدة هنا."
              )}
            </p>
          </section>
        ) : (
          <div style={{ display: "grid", gap: 18 }}>
            {requests.map((request) => {
              const similar = findSimilar(request);
              const processing = processingId === request.id;

              return (
                <section
                  key={request.id}
                  style={{
                    background: "#fff",
                    padding: 25,
                    borderRadius: 16,
                    border: "1px solid #eee5e8",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    <div>
                      <h2
                        style={{
                          color: "#873b50",
                          margin: "0 0 10px",
                        }}
                      >
                        {request.name}
                      </h2>

                      <p style={{ color: "#777", margin: 0 }}>
                        {request.kind === "school"
                          ? t("School", "مدرسة")
                          : t("University", "جامعة")}
                        {" · "}
                        {request.city}, {request.country_code}
                      </p>
                    </div>

                    <span
                      style={{
                        background: "#fff3df",
                        color: "#805400",
                        padding: "7px 12px",
                        borderRadius: 20,
                        height: "fit-content",
                        fontSize: 13,
                      }}
                    >
                      {t("Pending", "قيد المراجعة")}
                    </span>
                  </div>

                  <p style={{ color: "#777", fontSize: 13 }}>
                    {t("Submitted", "تاريخ الطلب")}:{" "}
                    {new Date(request.created_at).toLocaleDateString(
                      ar ? "ar-JO" : "en-GB"
                    )}
                  </p>

                  {similar.length > 0 && (
                    <div
                      style={{
                        background: "#f8f5f0",
                        padding: 15,
                        borderRadius: 10,
                        marginBottom: 18,
                      }}
                    >
                      <strong style={{ color: "#873b50" }}>
                        {t(
                          "Possible existing matches",
                          "مؤسسات مشابهة موجودة"
                        )}
                      </strong>

                      {similar.map((institution) => (
                        <p
                          key={institution.id}
                          style={{
                            margin: "9px 0",
                            color: "#555",
                          }}
                        >
                          {institution.name}
                          {" — "}
                          {institution.city ?? ""}
                          {", "}
                          {institution.country_code ?? ""}
                        </p>
                      ))}
                    </div>
                  )}

                  <div
                    style={{
                      display: "flex",
                      gap: 10,
                      flexWrap: "wrap",
                    }}
                  >
                    <button
                      type="button"
                      disabled={processingId !== ""}
                      onClick={() =>
                        reviewRequest(request, true)
                      }
                      style={{
                        background: "#873b50",
                        color: "#fff",
                        border: "none",
                        borderRadius: 9,
                        padding: "12px 22px",
                        cursor: processing ? "wait" : "pointer",
                        fontWeight: 700,
                      }}
                    >
                      {processing
                        ? t("Processing...", "جارٍ التنفيذ...")
                        : t("Approve", "موافقة")}
                    </button>

                    <button
                      type="button"
                      disabled={processingId !== ""}
                      onClick={() =>
                        reviewRequest(request, false)
                      }
                      style={{
                        background: "#fff",
                        color: "#a33a3a",
                        border: "1px solid #e3b8b8",
                        borderRadius: 9,
                        padding: "12px 22px",
                        cursor: processing ? "wait" : "pointer",
                        fontWeight: 700,
                      }}
                    >
                      {t("Reject", "رفض")}
                    </button>
                  </div>
                </section>
              );
            })}
          </div>
        )}

        <p style={{ marginTop: 30, textAlign: "center" }}>
          <Link href="/dashboard" style={{ color: "#873b50" }}>
            {t(
              "Back to dashboard",
              "العودة إلى لوحة التحكم"
            )}
          </Link>
        </p>
      </div>
    </main>
  );
}
