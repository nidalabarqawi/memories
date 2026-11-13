
  "use client";

  import { useCallback, useEffect, useState } from "react";
  import Link from "next/link";
  import { useRouter } from "next/navigation";
  import { createClient } from "@/lib/supabase/client";

  const burgundy = "#873b50";
  type GroupMemberCount = {

  group_id: string;
  member_count: number;
};

type GroupAdmin = {
  group_id: string;
  admin_id: string;
  admin_name: string;
};

  type GroupStatus = "none" | "pending" | "declined" | "cancelled" | "member";

  type GroupStatusRow = {
    group_id: string;
    membership_status: GroupStatus;
  };


type DiscoverableGroup = {
  group_id: string;
  group_name: string;
  group_description: string | null;
  institution_id: string | null;
  institution_name: string | null;
  group_type: "general" | "institution";
  category: string;
  created_at: string;

};

const categoryLabels: Record<
  string,
  { en: string; ar: string }
> = {
  education: { en: "Education", ar: "التعليم" },
  careers: { en: "Careers", ar: "المهن والوظائف" },
  technology: { en: "Technology", ar: "التكنولوجيا" },
  business: { en: "Business", ar: "الأعمال" },
  hobbies: { en: "Hobbies", ar: "الهوايات" },
  social: { en: "Social", ar: "اجتماعي" },
  other: { en: "Other", ar: "أخرى" },
};


  export default function DiscoverGroupsPage() {
    const router = useRouter();

    const [lang, setLang] = useState<"en" | "ar">("en");
    const [groups, setGroups] = useState<DiscoverableGroup[]>([]);
    const [memberCounts, setMemberCounts] = useState<Record<string, number>>({});

const [groupAdmins, setGroupAdmins] = useState<Record<string, string[]>>({});

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");

const [selectedCategory, setSelectedCategory] =
  useState("all");

const [selectedInstitution, setSelectedInstitution] =
  useState("all");


const [sortBy, setSortBy] = useState<
  | "name_asc"
  | "name_desc"
  | "members_desc"
  | "members_asc"
  | "newest"
  | "oldest"
>("name_asc");


  const [requestingId, setRequestingId] = useState<string | null>(null);

  const [groupStatuses, setGroupStatuses] = useState<
    Record<string, GroupStatus>
  >({});

    const ar = lang === "ar";
    const toggleLanguage = () => {
    setLang((current) => (current === "en" ? "ar" : "en"));
  };

    const loadGroups = useCallback(async () => {
      setLoading(true);
      setError("");

      try {
        const supabase = createClient();

        const { data: auth, error: authError } =
          await supabase.auth.getUser();

        if (authError || !auth.user) {
          router.replace("/login");
          return;
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("locale")
          .eq("id", auth.user.id)
          .maybeSingle();

        setLang(profile?.locale === "ar" ? "ar" : "en");

        const { data, error: discoveryError } =
          await supabase.rpc("discover_chat_groups");

        if (discoveryError) {
          throw discoveryError;
        }

        setGroups((data ?? []) as DiscoverableGroup[]);
        const { data: statusData, error: statusError } =
    await supabase.rpc("get_my_chat_group_statuses");

  if (statusError) {
    throw statusError;
  }

  const statuses: Record<string, GroupStatus> = {};

  for (const row of (statusData ?? []) as GroupStatusRow[]) {
    statuses[row.group_id] = row.membership_status;
  }

  setGroupStatuses(statuses);
  const { data: countData, error: countError } =
  await supabase.rpc("get_discoverable_group_member_counts");

if (countError) throw countError;

const counts: Record<string, number> = {};

for (const row of (countData ?? []) as GroupMemberCount[]) {
  counts[row.group_id] = Number(row.member_count);
}

setMemberCounts(counts);

const { data: adminData, error: adminError } =
  await supabase.rpc("get_discoverable_group_admins");

if (adminError) throw adminError;

const admins: Record<string, string[]> = {};

for (const row of (adminData ?? []) as GroupAdmin[]) {
  if (!admins[row.group_id]) {
    admins[row.group_id] = [];
  }

  admins[row.group_id].push(row.admin_name);
}

setGroupAdmins(admins);

      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to discover groups."
        );
      } finally {
        setLoading(false);
      }
    }, [router]);

    useEffect(() => {
      void loadGroups();
    }, [loadGroups]);
  const requestToJoin = async (groupId: string) => {
    if (requestingId) return;

    const status = groupStatuses[groupId] ?? "none";

    if (status === "pending" || status === "member") return;

    setRequestingId(groupId);

    try {
      const supabase = createClient();

      const { error: requestError } = await supabase.rpc(
        "request_to_join_chat_group",
        { p_group_id: groupId }
      );

      if (requestError) throw requestError;

      setGroupStatuses((current) => ({
        ...current,
        [groupId]: "pending",
      }));
    } catch (err) {
      window.alert(
        err instanceof Error
          ? err.message
          : ar
            ? "تعذر إرسال طلب الانضمام."
            : "Unable to submit your join request."
      );
    } finally {
      setRequestingId(null);
    }
  };

const cancelJoinRequest = async (groupId: string) => {
  if (requestingId) return;

  if (groupStatuses[groupId] !== "pending") return;

  setRequestingId(groupId);

  try {
    const supabase = createClient();

    const { data: auth, error: authError } =
      await supabase.auth.getUser();

    if (authError || !auth.user) {
      throw new Error("Authentication required.");
    }

    const { data: request, error: lookupError } =
      await supabase
        .from("chat_group_join_requests")
        .select("id")
        .eq("group_id", groupId)
        .eq("user_id", auth.user.id)
        .eq("status", "pending")
        .maybeSingle();

    if (lookupError) throw lookupError;

    if (!request) {
      throw new Error("Pending join request not found.");
    }

    const { error: cancelError } = await supabase.rpc(
      "cancel_chat_group_join_request",
      { p_request_id: request.id }
    );

    if (cancelError) throw cancelError;

    setGroupStatuses((current) => ({
      ...current,
      [groupId]: "cancelled",
    }));
  } catch (err) {
    window.alert(
      err instanceof Error
        ? err.message
        : ar
          ? "تعذر إلغاء طلب الانضمام."
          : "Unable to cancel your join request."
    );
  } finally {
    setRequestingId(null);
  }
};

const availableInstitutions = Array.from(
  new Map(
    groups
      .filter(
        (group) =>
          group.institution_id !== null
      )
      .map((group) => [
        group.institution_id as string,
        group.institution_name ?? "Unnamed Institution",
      ])
  )
).sort((a, b) => a[1].localeCompare(b[1]));

const clearFilters = () => {
  setSearch("");
  setSelectedCategory("all");
  setSelectedInstitution("all");
  setSortBy("name_asc");
};

const filteredGroups = groups.filter((group) => {
  const query = search.trim().toLowerCase();

  const categoryMatches =
    selectedCategory === "all" ||
    group.category === selectedCategory;

  const categoryName =
    categoryLabels[group.category];

  const searchMatches =
    group.group_name.toLowerCase().includes(query) ||
    (group.group_description ?? "")
      .toLowerCase()
      .includes(query) ||
    (group.institution_name ?? "")
      .toLowerCase()
      .includes(query) ||
    (categoryName?.en ?? "")
      .toLowerCase()
      .includes(query) ||
    (categoryName?.ar ?? "")
      .includes(query);


const institutionMatches =
  selectedInstitution === "all" ||
  (selectedInstitution === "general" &&
    group.institution_id === null) ||
  group.institution_id === selectedInstitution;

return (
  categoryMatches &&
  institutionMatches &&
  searchMatches
);

});


const sortedGroups = [...filteredGroups].sort((a, b) => {

if (sortBy === "newest") {
  return (
    new Date(b.created_at).getTime() -
    new Date(a.created_at).getTime()
  );
}

if (sortBy === "oldest") {
  return (
    new Date(a.created_at).getTime() -
    new Date(b.created_at).getTime()
  );
}

  if (sortBy === "name_asc") {
    return a.group_name.localeCompare(b.group_name);
  }

  if (sortBy === "name_desc") {
    return b.group_name.localeCompare(a.group_name);
  }

  const aCount = memberCounts[a.group_id] ?? 0;
  const bCount = memberCounts[b.group_id] ?? 0;

  if (sortBy === "members_desc") {
    return (
      bCount - aCount ||
      a.group_name.localeCompare(b.group_name)
    );
  }

  return (
    aCount - bCount ||
    a.group_name.localeCompare(b.group_name)
  );
});

    return (
      <main
        dir={ar ? "rtl" : "ltr"}
        style={{
          minHeight: "100vh",
          background: "#f8f5f0",
          padding: "28px 16px",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div style={{ maxWidth: 850, margin: "0 auto" }}>
          <div
    style={{
      display: "flex",
      justifyContent: "flex-end",
      marginBottom: 20,
    }}
  >
    <button
      type="button"
      onClick={toggleLanguage}
      style={{
        padding: "9px 16px",
        background: "#ffffff",
        color: "#873b50",
        border: "1px solid #873b50",
        borderRadius: 8,
        fontSize: 14,
        fontWeight: 700,
        cursor: "pointer",
      }}
    >
      {ar ? "English" : "العربية"}
    </button>
  </div>
          <Link
            href="/dashboard/groups"
            style={{
              color: burgundy,
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            {ar ? "العودة إلى مجموعاتي" : "← Back to My Groups"}
          </Link>

          <h1
            style={{
              color: burgundy,
              marginTop: 28,
              marginBottom: 8,
            }}
          >
            {ar ? "اكتشف المجموعات" : "Discover Groups"}
          </h1>

          <p style={{ color: "#655e61", marginBottom: 24 }}>
            {ar
              ? "استكشف المجموعات العامة المتاحة لك."
              : "Explore public groups available to you."}
          </p>

          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={
              ar
                ? "ابحث باسم المجموعة أو المؤسسة..."
                : "Search groups or institutions..."
            }
            aria-label={ar ? "بحث عن مجموعات" : "Search groups"}
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: 14,
              borderRadius: 10,
              border: "1px solid #ded5d8",
              background: "white",
              fontSize: 16,
              marginBottom: 22,
            }}
          />
<div style={{ marginBottom: 22 }}>
  <label
    htmlFor="group-category-filter"
    style={{
      display: "block",
      marginBottom: 8,
      color: burgundy,
      fontWeight: 700,
    }}
  >
    {ar ? "تصفية حسب الفئة" : "Filter by Category"}
  </label>

  <select
    id="group-category-filter"
    value={selectedCategory}
    onChange={(event) =>
      setSelectedCategory(event.target.value)
    }
    style={{
      width: "100%",
      padding: 13,
      borderRadius: 10,
      border: "1px solid #ded5d8",
      background: "white",
      fontSize: 15,
      color: "#333",
    }}
  >
    <option value="all">
      {ar ? "جميع الفئات" : "All Categories"}
    </option>

    {Object.entries(categoryLabels).map(
      ([value, label]) => (
        <option key={value} value={value}>
          {ar ? label.ar : label.en}
        </option>
      )
    )}
  </select>
</div>


<div style={{ marginBottom: 22 }}>
  <label
    htmlFor="group-institution-filter"
    style={{
      display: "block",
      marginBottom: 8,
      color: burgundy,
      fontWeight: 700,
    }}
  >
    {ar ? "تصفية حسب المؤسسة" : "Filter by Institution"}
  </label>

<div style={{ marginBottom: 22 }}>
  <label
    htmlFor="group-sort"
    style={{
      display: "block",
      marginBottom: 8,
      color: burgundy,
      fontWeight: 700,
    }}
  >
    {ar ? "ترتيب المجموعات" : "Sort Groups"}
  </label>

  <select
    id="group-sort"
    value={sortBy}
    onChange={(event) =>
      setSortBy(
        event.target.value as
          | "name_asc"
          | "name_desc"
          | "members_desc"
          | "members_asc"
      )
    }
    style={{
      width: "100%",
      padding: 13,
      borderRadius: 10,
      border: "1px solid #ded5d8",
      background: "white",
      fontSize: 15,
      color: "#333",
    }}
  >
    <option value="name_asc">
      {ar ? "الاسم: أ إلى ي" : "Name: A to Z"}
    </option>

    <option value="name_desc">
      {ar ? "الاسم: ي إلى أ" : "Name: Z to A"}
    </option>

    <option value="members_desc">
      {ar ? "الأكثر أعضاءً" : "Most Members"}
    </option>

<option value="newest">
  {ar ? "الأحدث أولاً" : "Newest First"}
</option>

<option value="oldest">
  {ar ? "الأقدم أولاً" : "Oldest First"}
</option>

    <option value="members_asc">
      {ar ? "الأقل أعضاءً" : "Fewest Members"}
    </option>
  </select>
</div>

  <select
    id="group-institution-filter"
    value={selectedInstitution}
    onChange={(event) =>
      setSelectedInstitution(event.target.value)
    }
    style={{
      width: "100%",
      padding: 13,
      borderRadius: 10,
      border: "1px solid #ded5d8",
      background: "white",
      fontSize: 15,
      color: "#333",
    }}
  >
    <option value="all">
      {ar ? "جميع المجموعات" : "All Groups"}
    </option>

    <option value="general">
      {ar
        ? "مجموعات الاهتمامات العامة"
        : "General-Interest Groups"}
    </option>
<option value="newest">
  {ar ? "الأحدث أولاً" : "Newest First"}
</option>

<option value="oldest">
  {ar ? "الأقدم أولاً" : "Oldest First"}
</option>
    {availableInstitutions.map(([id, name]) => (
      <option key={id} value={id}>
        {name}
      </option>
    ))}
  </select>
</div>

<div
  style={{
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 22,
  }}
>
  <span
    style={{
      color: "#655e61",
      fontSize: 14,
      fontWeight: 700,
    }}
  >
    {loading
      ? ar
        ? "جارٍ تحميل النتائج..."
        : "Loading results..."
      : ar
        ? `عدد المجموعات: ${filteredGroups.length}`
        : `${filteredGroups.length} groups found`}
  </span>

  <button
    type="button"
    onClick={clearFilters}
    disabled={
  search === "" &&
  selectedCategory === "all" &&
  selectedInstitution === "all" &&
  sortBy === "name_asc"
}
    style={{
      background: "white",
      color: burgundy,
      border: `1px solid ${burgundy}`,
      borderRadius: 8,
      padding: "9px 16px",
      fontWeight: 700,
      cursor: "pointer",
    }}
  >
    {ar ? "مسح الفلاتر" : "Clear Filters"}
  </button>
</div>

          {loading ? (
            <p>{ar ? "جارٍ تحميل المجموعات..." : "Loading groups..."}</p>
          ) : error ? (
            <div
              role="alert"
              style={{
                background: "white",
                padding: 20,
                borderRadius: 12,
                color: "#b42318",
              }}
            >
              <p>{error}</p>
              <button
                type="button"
                onClick={() => void loadGroups()}
                style={{
                  background: burgundy,
                  color: "white",
                  padding: "10px 16px",
                  border: 0,
                  borderRadius: 8,
                  cursor: "pointer",
                }}
              >
                {ar ? "إعادة المحاولة" : "Try Again"}
              </button>
            </div>
          ) : filteredGroups.length === 0 ? (
            <div
              style={{
                background: "white",
                borderRadius: 12,
                padding: 24,
                textAlign: "center",
                color: "#655e61",
              }}
            >

{search.trim() ||
selectedCategory !== "all" ||
selectedInstitution !== "all"
  ? ar
    ? "لا توجد مجموعات تطابق معايير البحث والتصفية."
    : "No groups match your search or selected filters."
  : ar
    ? "لا توجد مجموعات عامة متاحة حاليًا."
    : "No public groups are available yet."}

            </div>
          ) : (
            <div style={{ display: "grid", gap: 16 }}>
             {sortedGroups.map((group) => (
                <article
                  key={group.group_id}
                  style={{
                    background: "white",
                    border: "1px solid #eee5e8",
                    borderRadius: 14,
                    padding: 22,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    <h2
                      style={{
                        color: burgundy,
                        margin: 0,
                        fontSize: 20,
                      }}
                    >
                      {group.group_name}
                    </h2>

                    <span
                      style={{
                        color: burgundy,
                        background: "#f8edf1",
                        borderRadius: 20,
                        padding: "5px 12px",
                        fontSize: 13,
                        fontWeight: 700,
                      }}
                    >
                      {ar ? "عامة" : "Public"}
                    </span>
                  </div>

<p
  style={{
    fontSize: 14,
    color: burgundy,
    fontWeight: 700,
    marginTop: 12,
    marginBottom: 8,
  }}
>
  {ar ? "الفئة:" : "Category:"}{" "}
  {categoryLabels[group.category]
    ? categoryLabels[group.category][ar ? "ar" : "en"]
    : group.category}
</p>

                  <p style={{ color: "#655e61", lineHeight: 1.7 }}>
                    {group.group_description ||
                      (ar ? "لا يوجد وصف." : "No description.")}
                  </p>

                  <p style={{ fontSize: 14, color: "#655e61" }}>
                    {group.group_type === "institution"
                      ? `${ar ? "المؤسسة التعليمية" : "Institution"}: ${
                          group.institution_name ?? "—"
                        }`
                      : ar
                        ? "مجموعة اهتمامات عامة"
                        : "General-interest group"}
                  </p>
<p
  style={{
    fontSize: 14,
    color: "#655e61",
    display: "flex",
    alignItems: "center",
    gap: 8,
  }}
>
  <span aria-hidden="true">👥</span>
  <span>
    {ar ? "عدد الأعضاء:" : "Members:"}{" "}
    <strong>{memberCounts[group.group_id] ?? 0}</strong>
  </span>
</p>

<p
  style={{
    fontSize: 14,
    color: "#655e61",
    display: "flex",
    alignItems: "flex-start",
    gap: 8,
  }}
>
  <span aria-hidden="true">🛡️</span>

  <span>
    {ar ? "مسؤولو المجموعة:" : "Group administrators:"}{" "}
    <strong>
      {groupAdmins[group.group_id]?.length
        ? groupAdmins[group.group_id].join("، ")
        : ar
          ? "لا يوجد مسؤول حاليًا"
          : "No current administrator"}
    </strong>
  </span>
</p>

                  <div
    style={{
      borderTop: "1px solid #eee5e8",
      paddingTop: 16,
      marginTop: 16,
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 12,
      flexWrap: "wrap",
    }}
  >
    <span style={{ fontSize: 13, color: "#777" }}>
      {ar
        ? "تتطلب العضوية موافقة مشرف المجموعة."
        : "Membership requires administrator approval."}
    </span>

<Link
  href={`/dashboard/groups/${group.group_id}/preview`}
  style={{
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "white",
    color: burgundy,
    border: `1px solid ${burgundy}`,
    borderRadius: 9,
    padding: "11px 18px",
    fontWeight: 700,
    fontSize: 14,
    textDecoration: "none",
  }}
>
  {ar ? "عرض التفاصيل" : "View Details"}
</Link>

    <button
    type="button"
    disabled={
      requestingId !== null ||
      groupStatuses[group.group_id] === "pending" ||
      groupStatuses[group.group_id] === "member"
    }
    onClick={() => void requestToJoin(group.group_id)}
    style={{
      background:
        groupStatuses[group.group_id] === "pending" ||
        groupStatuses[group.group_id] === "member"
          ? "#eee5e8"
          : burgundy,
      color:
        groupStatuses[group.group_id] === "pending" ||
        groupStatuses[group.group_id] === "member"
          ? burgundy
          : "white",
      border: 0,
      borderRadius: 9,
      padding: "11px 18px",
      fontWeight: 700,
      cursor:
        requestingId !== null ||
        groupStatuses[group.group_id] === "pending" ||
        groupStatuses[group.group_id] === "member"
          ? "default"
          : "pointer",
    }}
  >
    {groupStatuses[group.group_id] === "member"
      ? ar
        ? "أنت عضو بالفعل"
        : "Already a Member"
      : groupStatuses[group.group_id] === "pending"
        ? ar
          ? "الطلب قيد الانتظار"
          : "Request Pending"
        : requestingId === group.group_id
          ? ar
            ? "جارٍ الإرسال..."
            : "Submitting..."
          : groupStatuses[group.group_id] === "declined"
            ? ar
              ? "إعادة طلب الانضمام"
              : "Request to Join Again"
            : ar
              ? "طلب الانضمام"
              : "Request to Join"}
  </button>

{groupStatuses[group.group_id] === "pending" && (
  <button
    type="button"
    disabled={requestingId !== null}
    onClick={() => void cancelJoinRequest(group.group_id)}
    style={{
      background: "white",
      color: "#873b50",
      border: "1px solid #873b50",
      borderRadius: 9,
      padding: "11px 18px",
      fontWeight: 700,
      cursor: requestingId !== null ? "default" : "pointer",
      marginInlineStart: 8,
    }}
  >
    {ar ? "إلغاء الطلب" : "Cancel Request"}
  </button>
)}

  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </main>
    );
  }
