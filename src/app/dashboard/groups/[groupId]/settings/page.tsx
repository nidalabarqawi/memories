
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const burgundy = "#873b50";



type GroupDetails = {
  id: string;
  name: string;
  description: string | null;
  visibility: "private" | "public";
  category: string;
  owner_id: string | null;
};



type GroupAdministrator = {
  user_id: string;
  role: string;
  display_name: string;
};


type OwnershipHistoryEntry = {
  previous_owner_name: string;
  new_owner_name: string;
  transferred_by_name: string;
  transferred_at: string;
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


export default function GroupSettingsPage() {
  const params = useParams<{ groupId: string }>();
  const groupId = params.groupId;
  const router = useRouter();

  const [lang, setLang] = useState<"en" | "ar">("en");
  const [group, setGroup] = useState<GroupDetails | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] =
  useState<"private" | "public">("private");

const [category, setCategory] = useState("social");
const [savingCategory, setSavingCategory] = useState(false);
const [categorySuccess, setCategorySuccess] = useState("");


const [savingVisibility, setSavingVisibility] = useState(false);
const [visibilitySuccess, setVisibilitySuccess] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);

const [isOwner, setIsOwner] = useState(false);

const [administrators, setAdministrators] =
  useState<GroupAdministrator[]>([]);

const [selectedNewOwnerId, setSelectedNewOwnerId] =
  useState("");

const [transferringOwnership, setTransferringOwnership] =
  useState(false);

const [ownershipSuccess, setOwnershipSuccess] =
  useState("");

const [ownershipHistory, setOwnershipHistory] =
  useState<OwnershipHistoryEntry[]>([]);

const [loadingOwnershipHistory, setLoadingOwnershipHistory] =
  useState(false);

const [ownershipHistoryError, setOwnershipHistoryError] =
  useState("");


  const ar = lang === "ar";

  const loadSettings = useCallback(async () => {
    if (!groupId) return;

    setLoading(true);
    setError("");
    setSuccess("");

    const supabase = createClient();

    const { data: auth, error: authError } =
      await supabase.auth.getUser();

    if (authError || !auth.user) {
      router.replace("/login");
      return;
    }

    const userId = auth.user.id;

    const { data: profile } = await supabase
      .from("profiles")
      .select("locale")
      .eq("id", userId)
      .maybeSingle();

    setLang(profile?.locale === "ar" ? "ar" : "en");

    const { data: membership, error: membershipError } =
      await supabase
        .from("chat_group_members")
        .select("role")
        .eq("group_id", groupId)
        .eq("user_id", userId)
        .maybeSingle();

    if (membershipError || !membership) {
      setError(
        membershipError?.message ||
          "You are not a member of this group."
      );
      setLoading(false);
      return;
    }

    const admin = membership.role === "admin";
    setIsAdmin(admin);

    if (!admin) {
      setError(
        profile?.locale === "ar"
          ? "هذه الصفحة مخصصة لمشرفي المجموعة فقط."
          : "Only group administrators can access these settings."
      );
      setLoading(false);
      return;
    }

    const { data, error: groupError } = await supabase
      .from("chat_groups")

.select("id, name, description, visibility, category, owner_id")

      .eq("id", groupId)
      .maybeSingle();

    if (groupError || !data) {
      setError(
        groupError?.message || "Unable to load group settings."
      );
    } else {
      const details = data as GroupDetails;
      setGroup(details);
      setIsOwner(details.owner_id === userId);



const { data: adminData, error: adminError } =
  await supabase.rpc("get_group_administrators", {
    p_group_id: groupId,
  });

const typedAdminData = (adminData ?? []) as {
  user_id: string;
  display_name: string | null;
}[];


if (adminError) {
  setError(adminError.message);
  setAdministrators([]);
} else {
  setAdministrators(

typedAdminData
  .filter(

        (admin) => admin.user_id !== details.owner_id
      )
      .map((admin) => ({
        user_id: admin.user_id,
        role: "admin",
        display_name:
          admin.display_name?.trim() || admin.user_id,
      }))
  );
}


      setName(details.name);
      setDescription(details.description ?? "");
      setCategory(details.category);
      setVisibility(
  data.visibility === "public" ? "public" : "private"
);
    }

    setLoading(false);
  }, [groupId, router]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

const loadOwnershipHistory = useCallback(async () => {
  if (!groupId) return;

  setLoadingOwnershipHistory(true);
  setOwnershipHistoryError("");

  try {
    const supabase = createClient();

    const { data, error: historyError } =
      await supabase.rpc("get_group_ownership_history", {
        p_group_id: groupId,
      });

    if (historyError) {
      setOwnershipHistoryError(historyError.message);
      setOwnershipHistory([]);
      return;
    }

    setOwnershipHistory(
      (data ?? []) as OwnershipHistoryEntry[]
    );
  } catch (err) {
    setOwnershipHistoryError(
      err instanceof Error
        ? err.message
        : "Unable to load ownership history."
    );
    setOwnershipHistory([]);
  } finally {
    setLoadingOwnershipHistory(false);
  }
}, [groupId]);

useEffect(() => {
  if (!loading && isAdmin && group) {
    void loadOwnershipHistory();
  }
}, [loading, isAdmin, group, loadOwnershipHistory]);

  async function saveChanges(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isAdmin || saving || !group) return;

    const trimmedName = name.trim();
    if (trimmedName.length < 3 || trimmedName.length > 100) {
      setError(ar
        ? "يجب أن يتكون اسم المجموعة من 3 إلى 100 حرف."
        : "Group name must contain 3 to 100 characters.");
      setSuccess("");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.rpc(
        "update_chat_group_details",
        {
          p_group_id: groupId,
          p_name: trimmedName,
          p_description: description,
        }
      );
      if (updateError) {
        setError(updateError.message);
        return;
      }
      setGroup((previous) => previous ? {
        ...previous,
        name: trimmedName,
        description: description.trim() || null,
      } : previous);
      setName(trimmedName);
      setDescription(description.trim());
      setSuccess(ar
        ? "تم حفظ إعدادات المجموعة بنجاح."
        : "Group settings saved successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save group settings.");
    } finally {
      setSaving(false);
    }
  }

  async function saveVisibility(nextVisibility: "private" | "public") {
    if (!isAdmin || savingVisibility || !group) return;

    setSavingVisibility(true);
    setError("");
    setVisibilitySuccess("");
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.rpc(
        "update_chat_group_visibility",
        {
          p_group_id: groupId,
          p_visibility: nextVisibility,
        }
      );
      if (updateError) {
        setError(updateError.message);
        return;
      }
      setVisibility(nextVisibility);
      setGroup((previous) => previous ? {
        ...previous,
        visibility: nextVisibility,
      } : previous);
      setVisibilitySuccess(ar
        ? "تم تحديث خصوصية المجموعة بنجاح."
        : "Group privacy updated successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update group privacy.");
    } finally {
      setSavingVisibility(false);
    }
  }

async function saveCategory() {
  if (!isAdmin || !group || savingCategory) return;

  if (category === group.category) return;

  setSavingCategory(true);
  setError("");
  setCategorySuccess("");

  try {
    const supabase = createClient();

    const { error: updateError } = await supabase.rpc(
      "update_chat_group_category",
      {
        p_group_id: groupId,
        p_category: category,
      }
    );

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setGroup((previous) =>
      previous
        ? { ...previous, category }
        : previous
    );

    setCategorySuccess(
      ar
        ? "تم تحديث فئة المجموعة بنجاح."
        : "Group category updated successfully."
    );
  } catch (err) {
    setError(
      err instanceof Error
        ? err.message
        : "Unable to update group category."
    );
  } finally {
    setSavingCategory(false);
  }
}

async function transferOwnership() {
  if (
    !isOwner ||
    !selectedNewOwnerId ||
    transferringOwnership
  ) {
    return;
  }

  const selectedAdmin = administrators.find(
    (admin) => admin.user_id === selectedNewOwnerId
  );

  if (!selectedAdmin) return;

  const confirmed = window.confirm(
    ar
      ? `هل أنت متأكد من نقل ملكية المجموعة إلى ${selectedAdmin.display_name}؟ لن تتمكن من إدارة ملكية المجموعة بعد النقل.`
      : `Are you sure you want to transfer ownership to ${selectedAdmin.display_name}? You will no longer be the group owner.`
  );

  if (!confirmed) return;

  setTransferringOwnership(true);
  setError("");
  setOwnershipSuccess("");

  try {
    const supabase = createClient();

    const { error: transferError } = await supabase.rpc(
      "transfer_chat_group_ownership",
      {
        p_group_id: groupId,
        p_new_owner_id: selectedNewOwnerId,
      }
    );

    if (transferError) {
      setError(transferError.message);
      return;
    }

    setOwnershipSuccess(
      ar
        ? "تم نقل ملكية المجموعة بنجاح."
        : "Group ownership transferred successfully."
    );

    setSelectedNewOwnerId("");
    setIsOwner(false);

    setGroup((previous) =>
      previous
        ? { ...previous, owner_id: selectedNewOwnerId }
        : previous
    );
  } catch (err) {
    setError(
      err instanceof Error
        ? err.message
        : "Unable to transfer group ownership."
    );
  } finally {
    setTransferringOwnership(false);
  }
}

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
      <div style={{ maxWidth: 750, margin: "0 auto" }}>
        <Link
          href={`/dashboard/groups/${encodeURIComponent(groupId)}`}
          style={{
            color: burgundy,
            fontWeight: 700,
            textDecoration: "none",
          }}
        >
          {ar
            ? "العودة إلى المحادثة"
            : "← Back to Conversation"}
        </Link>

        <h1
          style={{
            color: burgundy,
            marginTop: 28,
            marginBottom: 8,
          }}
        >
          {ar ? "إعدادات المجموعة" : "Group Settings"}
        </h1>

<button
  type="button"
  onClick={() =>
    setLang((current) =>
      current === "ar" ? "en" : "ar"
    )
  }
  style={{
    background: "#ffffff",
    color: burgundy,
    border: `1px solid ${burgundy}`,
    borderRadius: 8,
    padding: "8px 16px",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    marginBottom: 20,
  }}
>
  {ar ? "English" : "العربية"}
</button>

        <p style={{ color: "#655e61", marginBottom: 24 }}>
          {ar
            ? "إدارة اسم المجموعة ووصفها وخصوصيتها وفئتها."
: "Manage your group's name, description, privacy, and category."
            }
        </p>

        {error && (
          <p
            role="alert"
            style={{
              color: "#b42318",
              background: "white",
              borderRadius: 10,
              padding: 14,
            }}
          >
            {error}
          </p>
        )}

        {success && (
          <p
            role="status"
            style={{
              color: "#16703c",
              background: "white",
              borderRadius: 10,
              padding: 14,
            }}
          >
            {success}
          </p>
        )}

        {loading ? (
          <p>
            {ar
              ? "جارٍ تحميل الإعدادات..."
              : "Loading settings..."}
          </p>
        ) : isAdmin && group ? (
          <form
            onSubmit={saveChanges}
            style={{
              background: "white",
              border: "1px solid #eee5e8",
              borderRadius: 14,
              padding: 24,
              display: "grid",
              gap: 20,
            }}
          >
            <div>
              <label
                htmlFor="group-name"
                style={{
                  display: "block",
                  marginBottom: 8,
                  fontWeight: 700,
                  color: burgundy,
                }}
              >
                {ar ? "اسم المجموعة" : "Group Name"}
              </label>

              <input
                id="group-name"
                type="text"
                value={name}
                onChange={(event) =>
                  setName(event.target.value)
                }
                minLength={3}
                maxLength={100}
                required
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: 12,
                  borderRadius: 9,
                  border: "1px solid #d9cdd1",
                  fontSize: 16,
                }}
              />
            </div>

            <div>
              <label
                htmlFor="group-description"
                style={{
                  display: "block",
                  marginBottom: 8,
                  fontWeight: 700,
                  color: burgundy,
                }}
              >
                {ar ? "وصف المجموعة" : "Description"}
              </label>

              <textarea
                id="group-description"
                value={description}
                onChange={(event) =>
                  setDescription(event.target.value)
                }
                rows={5}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: 12,
                  borderRadius: 9,
                  border: "1px solid #d9cdd1",
                  fontSize: 16,
                  resize: "vertical",
                }}
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              style={{
                background: burgundy,
                color: "white",
                border: "none",
                borderRadius: 9,
                padding: "12px 18px",
                fontWeight: 700,
                cursor: saving ? "wait" : "pointer",
              }}
            >
              {saving
                ? ar
                  ? "جارٍ الحفظ..."
                  : "Saving..."
                : ar
                  ? "حفظ التغييرات"
                  : "Save Changes"}
            </button>
            <div
  style={{
    borderTop: "1px solid #eee5e8",
    paddingTop: 24,
    marginTop: 8,
  }}
>
  <h2 style={{ color: burgundy, marginTop: 0 }}>
    {ar ? "خصوصية المجموعة" : "Group Privacy"}
  </h2>

  <p style={{ color: "#655e61" }}>
    {ar
      ? "اختر من يمكنه اكتشاف مجموعتك وطلب الانضمام إليها."
      : "Choose who can discover your group and request to join."}
  </p>

  <div style={{ display: "grid", gap: 12 }}>
    {(["private", "public"] as const).map((option) => (
      <label
        key={option}
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 12,
          padding: 16,
          border: `1px solid ${
            visibility === option ? burgundy : "#ded5d8"
          }`,
          borderRadius: 10,
          cursor: savingVisibility ? "wait" : "pointer",
        }}
      >
        <input
          type="radio"
          name="group-visibility"
          checked={visibility === option}
          disabled={savingVisibility}
          onChange={() => void saveVisibility(option)}
          style={{ marginTop: 4 }}
        />

        <span>
          <strong style={{ color: burgundy }}>
            {option === "private"
              ? ar
                ? "خاصة"
                : "Private"
              : ar
                ? "عامة"
                : "Public"}
          </strong>

          <span
            style={{
              display: "block",
              color: "#655e61",
              fontSize: 14,
              marginTop: 5,
            }}
          >
            {option === "private"
              ? ar
                ? "يمكن الانضمام إلى المجموعة عن طريق الدعوة فقط."
                : "Members can join by invitation only."
              : ar
                ? "سيتمكن الزملاء المؤهلون من اكتشاف المجموعة وطلب الانضمام بعد تفعيل ميزة الاكتشاف."
                : "Eligible classmates will be able to discover the group and request to join once discovery is enabled."}
          </span>
        </span>
      </label>
    ))}
  </div>

  {visibilitySuccess && (
    <p role="status" style={{ color: "#16703c" }}>
      {visibilitySuccess}
    </p>
  )}

  {savingVisibility && (
    <p style={{ color: "#655e61" }}>
      {ar ? "جارٍ تحديث الخصوصية..." : "Updating privacy..."}
    </p>
  )}
</div>

<div
  style={{
    borderTop: "1px solid #eee5e8",
    paddingTop: 24,
    marginTop: 8,
  }}
>
  <h2 style={{ color: burgundy, marginTop: 0 }}>
    {ar ? "فئة المجموعة" : "Group Category"}
  </h2>

  <p style={{ color: "#655e61" }}>
    {ar
      ? "اختر الفئة التي تصف اهتمامات مجموعتك."
      : "Choose the category that best describes your group."}
  </p>

  <label
    htmlFor="group-category"
    style={{
      display: "block",
      fontWeight: 700,
      color: burgundy,
      marginBottom: 8,
    }}
  >
    {ar ? "الفئة الحالية" : "Current Category"}
  </label>

  <select
    id="group-category"
    value={category}
    onChange={(event) => {
      setCategory(event.target.value);
      setCategorySuccess("");
    }}
    disabled={savingCategory}
    style={{
      width: "100%",
      padding: 12,
      borderRadius: 9,
      border: "1px solid #d9cdd1",
      background: "white",
      fontSize: 16,
      marginBottom: 14,
    }}
  >
    {Object.entries(categoryLabels).map(
      ([value, label]) => (
        <option key={value} value={value}>
          {ar ? label.ar : label.en}
        </option>
      )
    )}
  </select>

  <button
    type="button"
    onClick={() => void saveCategory()}
    disabled={
      savingCategory ||
      category === group.category
    }
    style={{
      background: burgundy,
      color: "white",
      border: 0,
      borderRadius: 9,
      padding: "12px 18px",
      fontWeight: 700,
      cursor: savingCategory ? "wait" : "pointer",
      opacity:
        savingCategory || category === group.category
          ? 0.6
          : 1,
    }}
  >
    {savingCategory
      ? ar
        ? "جارٍ الحفظ..."
        : "Saving..."
      : ar
        ? "حفظ الفئة"
        : "Save Category"}
  </button>

  {categorySuccess && (
    <p role="status" style={{ color: "#16703c" }}>
      {categorySuccess}
    </p>
  )}
</div>

<div
  style={{
    borderTop: "1px solid #eee5e8",
    paddingTop: 24,
    marginTop: 8,
  }}
>
  <h2 style={{ color: burgundy, marginTop: 0 }}>
    {ar ? "ملكية المجموعة" : "Group Ownership"}
  </h2>

  <p style={{ color: "#655e61" }}>
    {isOwner
      ? ar
        ? "أنت المالك الحالي لهذه المجموعة."
        : "You are the current owner of this group."
      : ar
        ? "أنت مشرف في هذه المجموعة، ولكنك لست المالك."
        : "You are an administrator of this group, but not its owner."}
  </p>

  {isOwner && (
    <p style={{ color: "#655e61", fontSize: 14 }}>
      {ar
        ? "بصفتك المالك، يمكنك نقل ملكية المجموعة إلى مشرف آخر."
        : "As the owner, you can transfer group ownership to another administrator."}
    </p>
  )}

{isOwner && (
  <div style={{ marginTop: 16 }}>
    <label
      htmlFor="new-group-owner"
      style={{
        display: "block",
        fontWeight: 700,
        color: burgundy,
        marginBottom: 8,
      }}
    >
      {ar ? "اختر المالك الجديد" : "Select New Owner"}
    </label>

    <select
      id="new-group-owner"
      value={selectedNewOwnerId}
      onChange={(event) =>
        setSelectedNewOwnerId(event.target.value)
      }
      disabled={administrators.length === 0}
      style={{
        width: "100%",
        padding: 12,
        borderRadius: 9,
        border: "1px solid #d9cdd1",
        background: "white",
        fontSize: 16,
      }}
    >
      <option value="">
        {ar ? "اختر مشرفًا" : "Choose an administrator"}
      </option>


{administrators.map((admin) => (
  <option key={admin.user_id} value={admin.user_id}>
    {admin.display_name}
  </option>
))}

    </select>

    {administrators.length === 0 && (
      <p style={{ color: "#655e61", fontSize: 14 }}>
        {ar
          ? "لا يوجد مشرف آخر مؤهل لنقل ملكية المجموعة إليه."
          : "No other eligible administrator is available for ownership transfer."}
      </p>
    )}

<button
  type="button"
  onClick={() => void transferOwnership()}
  disabled={
    !selectedNewOwnerId || transferringOwnership
  }
  style={{
    background: burgundy,
    color: "white",
    border: "none",
    borderRadius: 9,
    padding: "12px 18px",
    marginTop: 16,
    fontWeight: 700,
    cursor: transferringOwnership
      ? "wait"
      : "pointer",
    opacity:
      !selectedNewOwnerId || transferringOwnership
        ? 0.6
        : 1,
  }}
>
  {transferringOwnership
    ? ar
      ? "جارٍ نقل الملكية..."
      : "Transferring Ownership..."
    : ar
      ? "نقل ملكية المجموعة"
      : "Transfer Ownership"}
</button>

{ownershipSuccess && (
  <p role="status" style={{ color: "#16703c" }}>
    {ownershipSuccess}
  </p>
)}

  </div>
)}

</div>

<div
  style={{
    borderTop: "1px solid #eee5e8",
    paddingTop: 24,
    marginTop: 24,
  }}
>
  <h2 style={{ color: burgundy, marginTop: 0 }}>
    {ar ? "سجل نقل ملكية المجموعة" : "Ownership History"}
  </h2>

  <p style={{ color: "#655e61", fontSize: 14 }}>
    {ar
      ? "سجل عمليات نقل ملكية المجموعة بين المشرفين."
      : "A record of ownership transfers between group administrators."}
  </p>

  {loadingOwnershipHistory ? (
    <p>{ar ? "جارٍ تحميل السجل..." : "Loading history..."}</p>
  ) : ownershipHistoryError ? (
    <p role="alert" style={{ color: "#b42318" }}>
      {ownershipHistoryError}
    </p>
  ) : ownershipHistory.length === 0 ? (
    <p style={{ color: "#777", fontSize: 14 }}>
      {ar
        ? "لا توجد عمليات نقل ملكية مسجلة حتى الآن."
        : "No ownership transfers recorded yet."}
    </p>
  ) : (
    <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
      {ownershipHistory.map((entry, index) => (
        <div
          key={`${entry.transferred_at}-${index}`}
          style={{
            padding: 16,
            border: "1px solid #eee5e8",
            borderRadius: 10,
            background: "#fff",
          }}
        >
          <p style={{ margin: "0 0 8px", fontWeight: 600 }}>
            {entry.previous_owner_name}
            {" → "}
            {entry.new_owner_name}
          </p>

          <p style={{ margin: "0 0 6px", fontSize: 13 }}>
            {ar ? "تم النقل بواسطة: " : "Transferred by: "}
            {entry.transferred_by_name}
          </p>

          <p style={{ margin: 0, color: "#777", fontSize: 12 }}>
            {new Date(entry.transferred_at).toLocaleString(
              ar ? "ar-JO" : "en-US"
            )}
          </p>
        </div>
      ))}
    </div>
  )}
</div>

          </form>
        ) : null}
      </div>
    </main>
  );
}
