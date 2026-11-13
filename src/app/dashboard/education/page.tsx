
"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Institution = {
  id: string;
  name: string;
  kind: string;
  city: string | null;
  country_code: string | null;
};

type Membership = {
  id: string;
  institution_id: string;
  start_year: number | null;
  end_year: number | null;
  status: string;
};

type InstitutionRequest = {
  id: string;
  kind: string;
  name: string;
  city: string;
  country_code: string;
  status: string;
  created_at: string;
  approved_institution_id: string | null;
};


export default function EducationPage() {
  const [lang, setLang] = useState<"en" | "ar">("en");
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [userId, setUserId] = useState("");
  const [kind, setKind] = useState("school");
  const [institutionId, setInstitutionId] = useState("");
  const [startYear, setStartYear] = useState("");
  const [endYear, setEndYear] = useState("");
  const [editingId, setEditingId] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [requests, setRequests] = useState<InstitutionRequest[]>([]);
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestName, setRequestName] = useState("");
  const [requestCity, setRequestCity] = useState("");
  const [requestCountry, setRequestCountry] = useState("JO");
  const [requestSaving, setRequestSaving] = useState(false);
  const [requestError, setRequestError] = useState("");
  const [requestMessage, setRequestMessage] = useState("");


  const ar = lang === "ar";

  const t = (en: string, arabic: string) => ar ? arabic : en;

  useEffect(() => {
    let active = true;

    async function load() {
      const supabase = createClient();

      const { data: auth, error: authError } =
        await supabase.auth.getUser();

      if (authError || !auth.user) {
        if (active) {
          setError("Please sign in again.");
          setLoading(false);
        }
        return;
      }

      const [institutionsResult, membershipsResult, profileResult] =
        await Promise.all([
          supabase
            .from("institutions")
            .select("id, name, kind, city, country_code")
            .order("name"),
          supabase
            .from("memberships")
            .select("id, institution_id, start_year, end_year, status")
            .eq("user_id", auth.user.id),
          supabase
            .from("profiles")
            .select("locale")
            .eq("id", auth.user.id)
            .single(),
        ]);

      if (!active) return;

      setUserId(auth.user.id);

const { data: existingRequests, error: requestsError } =
  await supabase
    .from("institution_requests")
    .select(
      "id, kind, name, city, country_code, status, created_at, approved_institution_id"
    )
    .eq("requested_by", auth.user.id)
    .order("created_at", { ascending: false });

if (active) {
  if (requestsError) {
    setRequestError(requestsError.message);
  } else {
    setRequests(existingRequests ?? []);
  }
}


      if (institutionsResult.error) {
        setError(institutionsResult.error.message);
      } else {
        setInstitutions(institutionsResult.data ?? []);
      }

      if (membershipsResult.error) {
        setError(membershipsResult.error.message);
      } else {
        setMemberships(membershipsResult.data ?? []);
      }

      if (profileResult.data?.locale === "ar") {
        setLang("ar");
      }

      setLoading(false);
    }

    void load();

    return () => {
      active = false;
    };
  }, []);

  const filteredInstitutions = institutions.filter((item) => {
    return (
      item.kind === kind &&
      `${item.name} ${item.city ?? ""}`
        .toLowerCase()
        .includes(search.toLowerCase())
    );
  });

  function resetForm() {
    setEditingId("");
    setInstitutionId("");
    setStartYear("");
    setEndYear("");
    setSearch("");
    setKind("school");
  }

  function editMembership(item: Membership) {
    if (item.status !== "pending") return;

    const institution = institutions.find(
      (i) => i.id === item.institution_id
    );

    setEditingId(item.id);
    setInstitutionId(item.institution_id);
    setKind(institution?.kind ?? "school");
    setStartYear(String(item.start_year ?? ""));
    setEndYear(String(item.end_year ?? ""));
    setSearch("");
    setError("");
    setMessage("");

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setMessage("");

    const start = Number(startYear);
    const end = Number(endYear);
    const currentYear = new Date().getFullYear();

    if (
      !institutionId ||
      !Number.isInteger(start) ||
      !Number.isInteger(end) ||
      start < 1900 ||
      end > Math.min(2100, currentYear + 10) ||
      end < start
    ) {
      setError(
        t(
          "Select an institution and enter valid attendance years.",
          "يرجى اختيار المؤسسة وإدخال سنوات دراسة صحيحة."
        )
      );
      return;
    }

    setSaving(true);

    try {
      const supabase = createClient();

      const { data: auth, error: authError } =
        await supabase.auth.getUser();

      if (authError || auth.user?.id !== userId) {
        throw new Error("Session expired. Please sign in again.");
      }

      const selected = institutions.find(
        (item) => item.id === institutionId && item.kind === kind
      );

      if (!selected) {
        throw new Error("Please select a valid institution.");
      }

      if (editingId) {
        const { data, error: updateError } = await supabase
          .from("memberships")
          .update({
            institution_id: institutionId,
            start_year: start,
            end_year: end,
          })
          .eq("id", editingId)
          .eq("user_id", userId)
          .eq("status", "pending")
          .select("id, institution_id, start_year, end_year, status")
          .single();

        if (updateError) throw updateError;

        setMemberships((previous) =>
          previous.map((item) =>
            item.id === editingId ? data : item
          )
        );
      } else {
        const { data, error: insertError } = await supabase
          .from("memberships")
          .insert({
            user_id: userId,
            institution_id: institutionId,
            start_year: start,
            end_year: end,
            status: "pending",
          })
          .select("id, institution_id, start_year, end_year, status")
          .single();

        if (insertError) throw insertError;

        setMemberships((previous) => [...previous, data]);
      }

      resetForm();
      setMessage(
        t(
          "Educational history saved. Verification is pending.",
          "تم حفظ المعلومات التعليمية وهي بانتظار التحقق."
        )
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to save."
      );
    } finally {
      setSaving(false);
    }
  }

async function loadInstitutionRequests() {
  if (!userId) return;

  const supabase = createClient();

  const { data, error } = await supabase
    .from("institution_requests")
    .select(
      "id, kind, name, city, country_code, status, created_at, approved_institution_id"
    )
    .eq("requested_by", userId)
    .order("created_at", { ascending: false });

  if (error) {
    setRequestError(error.message);
    return;
  }

  setRequests(data ?? []);
}

async function submitInstitutionRequest(
  e: FormEvent<HTMLFormElement>
) {
  e.preventDefault();

  setRequestError("");
  setRequestMessage("");

  const name = requestName.trim();
  const city = requestCity.trim();
  const country = requestCountry.trim().toUpperCase();

  if (
    name.length < 3 ||
    city.length < 2 ||
    !/^[A-Z]{2}$/.test(country)
  ) {
    setRequestError(
      t(
        "Enter a valid institution name, city, and two-letter country code.",
        "يرجى إدخال اسم المؤسسة والمدينة ورمز الدولة بشكل صحيح."
      )
    );
    return;
  }

  const normalize = (value: string) =>
    value.trim().replace(/\s+/g, " ").toLocaleLowerCase();

  const existing = institutions.find(
    (item) =>
      item.kind === kind &&
      normalize(item.name) === normalize(name) &&
      normalize(item.city ?? "") === normalize(city) &&
      (item.country_code ?? "").toUpperCase() === country
  );

  if (existing) {
    setRequestError(
      t(
        "This institution already exists. Select it from the institution list instead.",
        "هذه المؤسسة موجودة بالفعل. يرجى اختيارها من القائمة."
      )
    );
    setInstitutionId(existing.id);
    setSearch(existing.name);
    return;
  }

  const duplicatePending = requests.some(
    (item) =>
      item.status === "pending" &&
      item.kind === kind &&
      normalize(item.name) === normalize(name) &&
      normalize(item.city) === normalize(city) &&
      item.country_code.toUpperCase() === country
  );

  if (duplicatePending) {
    setRequestError(
      t(
        "You already have a pending request for this institution.",
        "لديك طلب قيد المراجعة لهذه المؤسسة بالفعل."
      )
    );
    return;
  }

  setRequestSaving(true);

  try {
    const supabase = createClient();

    const { data: auth, error: authError } =
      await supabase.auth.getUser();

    if (authError || !auth.user || auth.user.id !== userId) {
      throw new Error("Session expired. Please sign in again.");
    }

    const { data, error } = await supabase
      .from("institution_requests")
      .insert({
        requested_by: userId,
        kind,
        name,
        city,
        country_code: country,
      })
      .select(
        "id, kind, name, city, country_code, status, created_at, approved_institution_id"
      )
      .single();

    if (error) throw error;

    setRequests((previous) => [data, ...previous]);

    setRequestName("");
    setRequestCity("");
    setRequestCountry("JO");
    setRequestOpen(false);

    setRequestMessage(
      t(
        "Your institution request was submitted for administrator review.",
        "تم إرسال طلب إضافة المؤسسة للمراجعة من قبل الإدارة."
      )
    );
  } catch (err) {
    setRequestError(
      err instanceof Error
        ? err.message
        : "Unable to submit institution request."
    );
  } finally {
    setRequestSaving(false);
  }
}

  const fieldStyle = {
    width: "100%",
    boxSizing: "border-box" as const,
    padding: 13,
    border: "1px solid #ded5d0",
    borderRadius: 9,
    background: "white",
    color: "#292524",
    fontSize: 15,
    marginTop: 7,
  };

  if (loading) {
    return <main style={{ padding: 40 }}>Loading...</main>;
  }

  return (
    <main
      dir={ar ? "rtl" : "ltr"}
      style={{
        minHeight: "100vh",
        background: "#f8f5f0",
        padding: "40px 16px",
        fontFamily: "Arial, sans-serif",
        color: "#292524",
      }}
    >
      <div style={{ maxWidth: 700, margin: "auto" }}>
        <section
          style={{
            background: "white",
            padding: 30,
            borderRadius: 18,
            marginBottom: 24,
          }}
        >
          <button
            type="button"
            onClick={() => setLang(ar ? "en" : "ar")}
            style={{
              background: "none",
              border: "none",
              color: "#873b50",
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            {ar ? "English" : "العربية"}
          </button>

          <h1 style={{ color: "#873b50", fontSize: 32 }}>
            {t("My Educational Journey", "رحلتي التعليمية")}
          </h1>

          <p style={{ color: "#777" }}>
            {t(
              "Add the schools and universities you attended.",
              "أضف المدارس والجامعات التي درست فيها."
            )}
          </p>

          <form onSubmit={save} style={{ display: "grid", gap: 20 }}>
            <label>
              {t("Institution type", "نوع المؤسسة التعليمية")}
              <select
                style={fieldStyle}
                value={kind}
                onChange={(e) => {
                  setKind(e.target.value);
                  setInstitutionId("");
                }}
              >
                <option value="school">
                  {t("School", "مدرسة")}
                </option>
                <option value="university">
                  {t("University", "جامعة")}
                </option>
              </select>
            </label>

            <label>
              {t("Search institutions", "البحث عن مؤسسة")}
              <input
                style={fieldStyle}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("Search by name or city", "الاسم أو المدينة")}
              />
            </label>

            <label>
              {t("Select institution", "اختر المؤسسة")}
              <select
                style={fieldStyle}
                value={institutionId}
                onChange={(e) => setInstitutionId(e.target.value)}
                required
              >
                <option value="">
                  {t("Choose an institution", "اختر المؤسسة التعليمية")}
                </option>
                {filteredInstitutions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                    {item.city ? ` - ${item.city}` : ""}
                  </option>
                ))}
              </select>
            </label>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: 15,
              }}
            >
              <label>
                {t("Start year", "سنة البداية")}
                <input
                  style={fieldStyle}
                  type="number"
                  min="1900"
                  max="2100"
                  value={startYear}
                  onChange={(e) => setStartYear(e.target.value)}
                  required
                />
              </label>

              <label>
                {t("End year", "سنة النهاية")}
                <input
                  style={fieldStyle}
                  type="number"
                  min="1900"
                  max="2100"
                  value={endYear}
                  onChange={(e) => setEndYear(e.target.value)}
                  required
                />
              </label>
            </div>

            <button
              type="submit"
              disabled={saving || !userId}
              style={{
                background: "#873b50",
                color: "white",
                border: "none",
                borderRadius: 10,
                padding: 15,
                fontSize: 16,
                fontWeight: "bold",
                cursor: "pointer",
              }}
            >
              {saving
                ? t("Saving...", "جارٍ الحفظ...")
                : editingId
                  ? t("Update membership", "تحديث الدراسة")
                  : t("Add institution", "إضافة المؤسسة")}
            </button>

            {editingId && (
              <button type="button" onClick={resetForm}>
                {t("Cancel editing", "إلغاء التعديل")}
              </button>
            )}
          </form>

<div
  style={{
    marginTop: 24,
    paddingTop: 22,
    borderTop: "1px solid #eee5e8",
  }}
>
  <h3 style={{ color: "#873b50" }}>
    {t(
      "Can't find your school or university?",
      "لم تجد مدرستك أو جامعتك؟"
    )}
  </h3>

  <p style={{ color: "#777", lineHeight: 1.7 }}>
    {t(
      "Search the directory first. If your institution is missing, request that it be added.",
      "ابحث أولاً في دليل المؤسسات، وإذا لم تجدها يمكنك طلب إضافتها."
    )}
  </p>

  <button
    type="button"
    onClick={() => {
      setRequestOpen((previous) => !previous);
      setRequestError("");
      setRequestMessage("");
    }}
    style={{
      padding: "12px 18px",
      background: "#fff",
      color: "#873b50",
      border: "1px solid #873b50",
      borderRadius: 9,
      cursor: "pointer",
      fontWeight: 700,
    }}
  >
    {requestOpen
      ? t("Close request form", "إغلاق نموذج الطلب")
      : t("Request a new institution", "طلب إضافة مؤسسة جديدة")}
  </button>

  {requestOpen && (
    <form
      onSubmit={submitInstitutionRequest}
      style={{
        display: "grid",
        gap: 16,
        marginTop: 20,
        padding: 20,
        background: "#f8f5f0",
        borderRadius: 12,
      }}
    >
      <p style={{ margin: 0, color: "#776b70" }}>
        {t(
          "Institution type follows the School / University selection above.",
          "نوع المؤسسة يعتمد على اختيار مدرسة أو جامعة في الأعلى."
        )}
      </p>

      <label>
        {t("Institution name", "اسم المؤسسة")}
        <input
          style={fieldStyle}
          value={requestName}
          onChange={(e) => setRequestName(e.target.value)}
          minLength={3}
          maxLength={200}
          required
        />
      </label>

      <label>
        {t("City", "المدينة")}
        <input
          style={fieldStyle}
          value={requestCity}
          onChange={(e) => setRequestCity(e.target.value)}
          minLength={2}
          maxLength={100}
          required
        />
      </label>

      <label>
        {t("Country code", "رمز الدولة")}
        <input
          style={fieldStyle}
          value={requestCountry}
          onChange={(e) =>
            setRequestCountry(e.target.value.toUpperCase())
          }
          maxLength={2}
          pattern="[A-Z]{2}"
          placeholder="JO"
          required
        />
      </label>

      <button
        type="submit"
        disabled={requestSaving}
        style={{
          padding: 14,
          border: "none",
          borderRadius: 9,
          background: "#873b50",
          color: "#fff",
          fontWeight: 700,
          cursor: requestSaving ? "wait" : "pointer",
        }}
      >
        {requestSaving
          ? t("Submitting...", "جارٍ الإرسال...")
          : t("Submit for review", "إرسال للمراجعة")}
      </button>
    </form>
  )}

  {requestMessage && (
    <p role="status" style={{ color: "#167347" }}>
      {requestMessage}
    </p>
  )}

  {requestError && (
    <p role="alert" style={{ color: "#b42318" }}>
      {requestError}
    </p>
  )}
</div>

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
        </section>

        <section
          style={{
            background: "white",
            padding: 30,
            borderRadius: 18,
          }}
        >
          <h2>
            {t("My Institutions", "مؤسساتي التعليمية")}
          </h2>

          {memberships.length === 0 ? (
            <p style={{ color: "#777" }}>
              {t(
                "No institutions added yet.",
                "لم تتم إضافة أي مؤسسة بعد."
              )}
            </p>
          ) : (
            memberships.map((item) => {
              const institution = institutions.find(
                (i) => i.id === item.institution_id
              );

              return (
                <div
                  key={item.id}
                  style={{
                    borderBottom: "1px solid #eee",
                    padding: "18px 0",
                  }}
                >
                  <strong>
                    {institution?.name ?? item.institution_id}
                  </strong>
                  <p style={{ color: "#777" }}>
                    {item.start_year ?? "—"} – {item.end_year ?? "—"}
                  </p>
                  <p style={{ color: "#873b50" }}>
                    {t("Status", "الحالة")}: {item.status}
                  </p>
                  {item.status === "pending" && (
                    <button
                      type="button"
                      onClick={() => editMembership(item)}
                      style={{
                        background: "transparent",
                        color: "#873b50",
                        border: "1px solid #873b50",
                        padding: "8px 15px",
                        borderRadius: 8,
                        cursor: "pointer",
                      }}
                    >
                      {t("Edit", "تعديل")}
                    </button>
                  )}
                </div>
              );
            })
          )}
        </section>

<section
  style={{
    background: "#fff",
    padding: 30,
    borderRadius: 18,
    marginTop: 24,
  }}
>
  <h2 style={{ color: "#873b50" }}>
    {t("My Institution Requests", "طلبات إضافة المؤسسات")}
  </h2>

  {requests.length === 0 ? (
    <p style={{ color: "#777" }}>
      {t(
        "You haven't submitted any institution requests.",
        "لم تقم بإرسال أي طلب لإضافة مؤسسة."
      )}
    </p>
  ) : (
    requests.map((item) => (
      <div
        key={item.id}
        style={{
          padding: "15px 0",
          borderBottom: "1px solid #eee",
        }}
      >
        <strong>{item.name}</strong>

        <p style={{ color: "#777" }}>
          {item.city}, {item.country_code}
        </p>

        <p style={{ color: "#873b50" }}>
          {t("Status", "الحالة")}:{" "}
          {item.status === "pending"
            ? t("Pending", "قيد المراجعة")
            : item.status === "approved"
              ? t("Approved", "تمت الموافقة")
              : t("Rejected", "مرفوض")}
        </p>

        {item.status === "approved" &&
          item.approved_institution_id && (
            <p style={{ color: "#167347" }}>
              {t(
                "Approved! You can now select this institution above and add your attendance years.",
                "تمت الموافقة! يمكنك الآن اختيار المؤسسة من القائمة وإضافة سنوات الدراسة."
              )}
            </p>
          )}
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
