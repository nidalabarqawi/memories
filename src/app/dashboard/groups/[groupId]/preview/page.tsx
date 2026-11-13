
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const burgundy = "#873b50";

type Group = {
  group_id: string;
  group_name: string;
  group_description: string | null;
  institution_id: string | null;
  institution_name: string | null;
  group_type: "general" | "institution";
  category: string;
  created_at: string;
};

type MemberCount = {
  group_id: string;
  member_count: number;
};

type GroupAdmin = {
  group_id: string;
  admin_id: string;
  admin_name: string;
};

type GroupStatus = "none" | "pending" | "declined" | "member";

type GroupStatusRow = {
  group_id: string;
  membership_status: GroupStatus;
};

const categoryLabels: Record<string, { en: string; ar: string }> = {
  education: { en: "Education", ar: "التعليم" },
  careers: { en: "Careers", ar: "المهن والوظائف" },
  technology: { en: "Technology", ar: "التكنولوجيا" },
  business: { en: "Business", ar: "الأعمال" },
  hobbies: { en: "Hobbies", ar: "الهوايات" },
  social: { en: "Social", ar: "اجتماعي" },
  other: { en: "Other", ar: "أخرى" },
};

export default function GroupPreviewPage() {
  const router = useRouter();
  const params = useParams();
  const groupId = params.groupId as string;

  const [lang, setLang] = useState<"en" | "ar">("en");
  const [group, setGroup] = useState<Group | null>(null);
  const [memberCount, setMemberCount] = useState(0);
  const [admins, setAdmins] = useState<GroupAdmin[]>([]);
  const [status, setStatus] = useState<GroupStatus>("none");
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState("");

  const ar = lang === "ar";

  useEffect(() => {
    let active = true;

    async function loadPreview() {
      const supabase = createClient();

      const { data: authData } = await supabase.auth.getUser();

      if (!active) return;

      if (!authData.user) {
        router.replace("/login");
        return;
      }

      const [profileResult, groupsResult, countsResult,
        adminsResult, statusesResult] = await Promise.all([
        supabase
          .from("profiles")
          .select("locale")
          .eq("id", authData.user.id)
          .single(),
        supabase.rpc("discover_chat_groups"),
        supabase.rpc("get_discoverable_group_member_counts"),
        supabase.rpc("get_discoverable_group_admins"),
        supabase.rpc("get_my_chat_group_statuses"),
      ]);

      if (!active) return;

      setLang(
        profileResult.data?.locale === "ar" ? "ar" : "en"
      );

      if (groupsResult.error) {
        setError(groupsResult.error.message);
        setLoading(false);
        return;
      }

      const found = ((groupsResult.data ?? []) as Group[])
        .find((item) => item.group_id === groupId);

      if (!found) {
        setError("Group not found or not available.");
        setLoading(false);
        return;
      }

      setGroup(found);

      if (!countsResult.error) {
        const count = ((countsResult.data ?? []) as MemberCount[])
          .find((item) => item.group_id === groupId);

        setMemberCount(Number(count?.member_count ?? 0));
      }

      if (!adminsResult.error) {
        setAdmins(
          ((adminsResult.data ?? []) as GroupAdmin[])
            .filter((item) => item.group_id === groupId)
        );
      }

      if (!statusesResult.error) {
        const current = (
          (statusesResult.data ?? []) as GroupStatusRow[]
        ).find((item) => item.group_id === groupId);

        setStatus(current?.membership_status ?? "none");
      }

      setLoading(false);
    }

    void loadPreview();

    return () => {
      active = false;
    };
  }, [groupId, router]);

  async function requestToJoin() {
    if (requesting || status === "pending" || status === "member") {
      return;
    }

    setRequesting(true);
    setError("");

    const supabase = createClient();

    const { error: requestError } = await supabase.rpc(
      "request_to_join_chat_group",
      { p_group_id: groupId }
    );

    if (requestError) {
      setError(requestError.message);
    } else {
      setStatus("pending");
    }

    setRequesting(false);
  }

  if (loading) {
    return (
      <main style={{ padding: 40, background: "#f8f5f0", minHeight: "100vh" }}>
        Loading group details...
      </main>
    );
  }

  return (
    <main
      dir={ar ? "rtl" : "ltr"}
      style={{
        minHeight: "100vh",
        background: "#f8f5f0",
        padding: "32px 18px",
        fontFamily: "Arial, sans-serif",
        color: "#29232a",
      }}
    >
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <Link
          href="/dashboard/groups/discover"
          style={{ color: burgundy, textDecoration: "none", fontWeight: 700 }}
        >
          {ar ? "← العودة إلى اكتشاف المجموعات" : "← Back to Discover Groups"}
        </Link>

        {error && (
          <p role="alert" style={{ color: "#b42338", marginTop: 20 }}>
            {error}
          </p>
        )}

        {group && (
          <article
            style={{
              background: "white",
              border: "1px solid #eee5e8",
              borderRadius: 18,
              padding: 28,
              marginTop: 24,
            }}
          >
            <h1 style={{ color: burgundy, marginTop: 0 }}>
              {group.group_name}
            </h1>

            <p style={{ lineHeight: 1.8, color: "#655b60" }}>
              {group.group_description ||
                (ar ? "لا يوجد وصف لهذه المجموعة." : "No description available.")}
            </p>

            <div style={{ display: "grid", gap: 14, marginTop: 24 }}>
              <div>
                <strong>{ar ? "التصنيف:" : "Category:"}</strong>{" "}
                {categoryLabels[group.category]?.[lang] ?? group.category}
              </div>

              <div>
                <strong>{ar ? "نوع المجموعة:" : "Group Type:"}</strong>{" "}
                {group.group_type === "institution"
                  ? ar ? "مجموعة تعليمية" : "Institution Group"
                  : ar ? "مجموعة عامة" : "General Group"}
              </div>

              {group.institution_name && (
                <div>
                  <strong>{ar ? "المؤسسة:" : "Institution:"}</strong>{" "}
                  {group.institution_name}
                </div>
              )}

              <div>
                <strong>{ar ? "عدد الأعضاء:" : "Members:"}</strong>{" "}
                {memberCount}
              </div>

              <div>
                <strong>{ar ? "المشرفون:" : "Administrators:"}</strong>{" "}
                {admins.length
                  ? admins.map((admin) => admin.admin_name).join(", ")
                  : ar ? "غير متوفر" : "Not available"}
              </div>

              <div>
                <strong>{ar ? "تاريخ الإنشاء:" : "Created:"}</strong>{" "}
                {new Date(group.created_at).toLocaleDateString(
                  ar ? "ar-JO" : "en-GB"
                )}
              </div>
            </div>

            <div style={{ marginTop: 28, display: "flex", gap: 12, flexWrap: "wrap" }}>
              {status === "member" ? (
                <Link
                  href={`/dashboard/groups/${groupId}`}
                  style={{
                    background: burgundy,
                    color: "white",
                    padding: "12px 20px",
                    borderRadius: 9,
                    textDecoration: "none",
                    fontWeight: 700,
                  }}
                >
                  {ar ? "فتح المجموعة" : "Open Group"}
                </Link>
              ) : (
                <button
                  type="button"
                  disabled={requesting || status === "pending"}
                  onClick={() => void requestToJoin()}
                  style={{
                    background: status === "pending" ? "#eee5e8" : burgundy,
                    color: status === "pending" ? burgundy : "white",
                    border: 0,
                    borderRadius: 9,
                    padding: "12px 20px",
                    fontWeight: 700,
                    cursor: status === "pending" ? "default" : "pointer",
                  }}
                >
                  {status === "pending"
                    ? ar ? "الطلب قيد الانتظار" : "Request Pending"
                    : requesting
                      ? ar ? "جارٍ الإرسال..." : "Submitting..."
                      : status === "declined"
                        ? ar ? "إعادة طلب الانضمام" : "Request to Join Again"
                        : ar ? "طلب الانضمام" : "Request to Join"}
                </button>
              )}
            </div>
          </article>
        )}
      </div>
    </main>
  );
}
