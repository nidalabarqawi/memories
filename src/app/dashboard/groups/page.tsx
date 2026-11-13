"use client";



import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";



type Group = {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
  owner_id: string;
};

type Membership = { group_id: string; role: "admin" | "member" };
type Invitation = {
  id: string;
  group_id: string;
  invited_user_id: string;
  status: string;
  created_at: string;
};

type IncomingInvitation = Invitation & { groupName: string };
type PendingJoinRequest = {
  request_id: string;
  group_id: string;
  group_name: string;
  requester_id: string;
  requester_name: string;
  requested_at: string;
};

const burgundy = "#873b50";

export default function GroupsPage() {
  const router = useRouter();
  const [lang, setLang] = useState<"en" | "ar">("en");
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupSearch, setGroupSearch] = useState("");


const [groupSort, setGroupSort] = useState<
  | "name_asc"
  | "name_desc"
  | "unread_desc"
  | "unread_asc"
  | "favorites_first"
>("name_asc");


const [favoriteGroupIds, setFavoriteGroupIds] = useState<string[]>([]);

const [pinnedGroupIds, setPinnedGroupIds] = useState<string[]>([]);

const [updatingPinIds, setUpdatingPinIds] = useState<string[]>([]);

const [leavingGroupIds, setLeavingGroupIds] = useState<string[]>([]);

  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [invitations, setInvitations] = useState<IncomingInvitation[]>([]);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [joinRequests, setJoinRequests] = useState<PendingJoinRequest[]>([]);

const [joinRequestFilter, setJoinRequestFilter] = useState<
  "all" | "new" | "seen"
>("all");

const [joinRequestSearch, setJoinRequestSearch] = useState("");

const [joinRequestSort, setJoinRequestSort] = useState<
  "newest" | "oldest" | "member_asc" | "group_asc"
>("newest");

const [pendingRequestCount, setPendingRequestCount] = useState(0);

const knownRequestIds = useRef<Set<string> | null>(null);
const [newRequestIds, setNewRequestIds] = useState<string[]>([]);

const [reviewingId, setReviewingId] = useState<string | null>(null);

const [reviewAction, setReviewAction] = useState<
  "approve" | "decline" | null
>(null);

const [declineRequestId, setDeclineRequestId] = useState<string | null>(null);

const declineCancelButtonRef = useRef<HTMLButtonElement>(null);

const declineTriggerButtonRef = useRef<HTMLButtonElement | null>(null);

const groupsHeadingRef = useRef<HTMLHeadingElement>(null);

const initializedNotificationUserId = useRef<string | null>(null);

const activeNotificationUserId = useRef<string | null>(null);

const isRefreshingJoinRequests = useRef(false);

const getJoinRequestStorageKey = (userId: string) =>
  `memories:group-join-requests:${userId}`;

const markJoinRequestAsSeen = (requestId: string) => {
  const userId = activeNotificationUserId.current;

  if (!userId) return;

  try {
    const storageKey = getJoinRequestStorageKey(userId);

    const savedValue = window.localStorage.getItem(storageKey);

    const savedIds: string[] = savedValue
      ? JSON.parse(savedValue)
      : [];

    const updatedIds = [...new Set([...savedIds, requestId])];

    window.localStorage.setItem(
      storageKey,
      JSON.stringify(updatedIds)
    );

    setNewRequestIds((previous) =>
      previous.filter((id) => id !== requestId)
    );
  } catch (error) {
    console.error("Unable to mark join request as seen:", error);
  }
};

useEffect(() => {
  if (declineRequestId !== null) {
    declineCancelButtonRef.current?.focus();
  }
}, [declineRequestId]);

  const [loading, setLoading] = useState(true);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [currentUserId, setCurrentUserId] = useState("");
  const [error, setError] = useState("");
  const ar = lang === "ar";
  const toggleLanguage = () => {
  setLang((current) => (current === "en" ? "ar" : "en"));
};

  const loadGroups = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const supabase = createClient();
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) {
        router.replace("/login");
        return;
      }

const { data: favoriteRows, error: favoritesError } = await supabase
  .from("chat_group_favorites")
  .select("group_id")
  .eq("user_id", auth.user.id);

if (favoritesError) {
  console.error("Error loading group favorites:", favoritesError.message);
} else {
  setFavoriteGroupIds(
    (favoriteRows ?? []).map((row) => row.group_id)
  );
}

const { data: pinnedRows, error: pinsError } = await supabase
  .from("chat_group_pins")
  .select("group_id")
  .eq("user_id", auth.user.id);

if (pinsError) {
  console.error("Error loading pinned groups:", pinsError.message);
  setPinnedGroupIds([]);
} else {
  setPinnedGroupIds(
    (pinnedRows ?? []).map((row) => row.group_id)
  );
}



const userId = auth.user.id;

if (initializedNotificationUserId.current !== userId) {
  activeNotificationUserId.current = userId;
  initializedNotificationUserId.current = userId;

  knownRequestIds.current = null;
  setNewRequestIds([]);
}

setCurrentUserId(userId);

      const { data: profile } = await supabase
        .from("profiles")
        .select("locale")
        .eq("id", userId)
        .maybeSingle();
      setLang(profile?.locale === "ar" ? "ar" : "en");

      const [membershipResult, invitationResult] = await Promise.all([
        supabase.from("chat_group_members")
          .select("group_id, role")
          .eq("user_id", userId),
        supabase.from("chat_group_invitations")
          .select("id, group_id, invited_user_id, status, created_at")
          .eq("invited_user_id", userId)
          .eq("status", "pending")
          .order("created_at", { ascending: false }),
      ]);

      if (membershipResult.error) throw membershipResult.error;
      if (invitationResult.error) throw invitationResult.error;

      const rows = (membershipResult.data ?? []) as Membership[];
setMemberships(rows);

const { data: requestData, error: requestError } =
  await supabase.rpc("get_pending_chat_group_join_requests");

if (requestError) throw requestError;



const initialRequests =
  (requestData ?? []) as PendingJoinRequest[];

const initialIds = new Set(
  initialRequests.map((request) => request.request_id)
);

if (activeNotificationUserId.current === userId) {
  const storageKey = getJoinRequestStorageKey(userId);

  try {
    const saved = window.localStorage.getItem(storageKey);

    if (saved !== null) {
      const parsed: unknown = JSON.parse(saved);

      if (
        Array.isArray(parsed) &&
        parsed.every((id) => typeof id === "string")
      ) {
        const seenIds = new Set<string>(parsed);

        setNewRequestIds(
          [...initialIds].filter((id) => !seenIds.has(id))
        );
      } else {
        setNewRequestIds([]);
      }
    } else {
      setNewRequestIds([]);
    }
  } catch (error) {
    console.error("Unable to read join request history:", error);
    setNewRequestIds([]);
  }



  knownRequestIds.current = initialIds;

  // Initialize storage only if this administrator has no saved history.
  // Do not overwrite existing history with newly detected requests.
  try {
    if (window.localStorage.getItem(storageKey) === null) {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify([...initialIds])
      );
    }
  } catch (error) {
    console.error("Unable to initialize join request history:", error);
  }

}

setJoinRequests(initialRequests);



const { data: pendingCount, error: pendingCountError } =
  await supabase.rpc("get_my_pending_group_join_request_count");

if (pendingCountError) throw pendingCountError;

setPendingRequestCount(Number(pendingCount ?? 0));


const groupIds = [...new Set(rows.map((row) => row.group_id))];
      const pending = (invitationResult.data ?? []) as Invitation[];
      const invitedGroupIds = [...new Set(pending.map((item) => item.group_id))];
      const allGroupIds = [...new Set([...groupIds, ...invitedGroupIds])];

      let groupRecords: Group[] = [];
      if (allGroupIds.length > 0) {
        const { data: groupData, error: groupsError } = await supabase
  .from("chat_groups")
  .select("id, name, description, created_by, owner_id")
  .in("id", allGroupIds)
  .order("name", { ascending: true });

if (groupsError) throw groupsError;

groupRecords = (groupData ?? []) as Group[];
      }

      const groupMap = new Map(groupRecords.map((group) => [group.id, group]));
      setGroups(groupRecords.filter((group) => groupIds.includes(group.id)));
      setInvitations(pending.map((item) => ({
        ...item,
        groupName: groupMap.get(item.group_id)?.name ?? (profile?.locale === "ar" ? "مجموعة" : "Group"),
      })));
      if (groupIds.length === 0) setUnreadCounts({});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load groups and invitations.");
    } finally {
      setLoading(false);
    }
  }, [router]);



const reviewJoinRequest = async (
  requestId: string,
  approve: boolean
): Promise<boolean> => {
  if (reviewingId !== null) return false;

  setReviewingId(requestId);
  setReviewAction(approve ? "approve" : "decline");
  setError("");

  try {
    const supabase = createClient();

    const { error: reviewError } = await supabase.rpc(
      "review_chat_group_join_request",
      {
        p_request_id: requestId,
        p_approve: approve,
      }
    );

    if (reviewError) throw reviewError;

    setNewRequestIds((current) =>
      current.filter((id) => id !== requestId)
    );


knownRequestIds.current?.delete(requestId);

// Mark the reviewed request as handled in persistent history.
const userId = activeNotificationUserId.current;

if (userId) {
  try {
    const storageKey = getJoinRequestStorageKey(userId);
    const saved = window.localStorage.getItem(storageKey);

    const parsed: unknown = saved ? JSON.parse(saved) : [];

    const seenIds = new Set<string>(
      Array.isArray(parsed)
        ? parsed.filter(
            (id): id is string => typeof id === "string"
          )
        : []
    );

    seenIds.add(requestId);

    window.localStorage.setItem(
      storageKey,
      JSON.stringify([...seenIds])
    );
  } catch (storageError) {
    console.error(
      "Unable to update join request history:",
      storageError
    );
  }
}

await loadGroups();


    return true;
  } catch (err) {
    setError(
      err instanceof Error
        ? err.message
        : ar
          ? "تعذرت مراجعة طلب الانضمام."
          : "Unable to review join request."
    );

    return false;
  } finally {
    setReviewingId(null);
    setReviewAction(null);
  }



};

  const respondToInvitation = async (invitationId: string, accept: boolean) => {
    if (respondingId) return;
    setRespondingId(invitationId);
    setError("");
    try {
      const supabase = createClient();
      const { error: responseError } = await supabase.rpc("respond_to_group_invitation", {
        p_invitation_id: invitationId,
        p_accept: accept,
      });
      if (responseError) throw responseError;
      await loadGroups();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to respond to invitation.");
    } finally {
      setRespondingId(null);
    }
  };



const refreshJoinRequests = useCallback(async () => {
  if (isRefreshingJoinRequests.current) return;

  isRefreshingJoinRequests.current = true;

  try {
    const userId = activeNotificationUserId.current;


  if (!userId) return;

  const supabase = createClient();

  const [requestsResult, countResult] = await Promise.all([

    supabase.rpc("get_pending_chat_group_join_requests"),
    supabase.rpc("get_my_pending_group_join_request_count"),
  ]);

if (activeNotificationUserId.current !== userId) {
  return;
}

  if (requestsResult.error || countResult.error) {
    console.error(
      "Join request refresh:",
      requestsResult.error?.message ?? countResult.error?.message
    );
    return;
  }


const latestRequests =
  (requestsResult.data ?? []) as PendingJoinRequest[];

const latestIds = new Set(
  latestRequests.map((request) => request.request_id)
);

if (knownRequestIds.current === null) {
  knownRequestIds.current = latestIds;
} else {
  const newIds = latestRequests
    .filter(
      (request) =>
        !knownRequestIds.current?.has(request.request_id)
    )
    .map((request) => request.request_id);

  if (newIds.length > 0) {
    setNewRequestIds((previous) => [
      ...new Set([...previous, ...newIds]),
    ]);
  }


  knownRequestIds.current = latestIds;

  // Keep notifications only for requests that are still pending.
  setNewRequestIds((previous) =>
    previous.filter((id) => latestIds.has(id))
  );

  // Preserve the existing saved history.
  // Newly detected requests remain absent until reviewed.
  try {
    const storageKey = getJoinRequestStorageKey(userId);
    const saved = window.localStorage.getItem(storageKey);

    if (saved === null) {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify([...latestIds])
      );
    }
  } catch (error) {
    console.error("Unable to access join request history:", error);
  }

}

setJoinRequests(latestRequests);



    setPendingRequestCount(Number(countResult.data ?? 0));
  } catch (error) {
    console.error("Unexpected join request refresh error:", error);
  } finally {
    isRefreshingJoinRequests.current = false;
  }
}, []);


  const refreshUnread = useCallback(async (userId: string, groupIds: string[]) => {
    if (!groupIds.length) { setUnreadCounts({}); return; }
    const supabase = createClient();
    const { data: states, error: stateError } = await supabase
      .from("chat_group_read_states")
      .select("group_id, last_read_at")
      .eq("user_id", userId)
      .in("group_id", groupIds);
    if (stateError) { console.error("Read states:", stateError.message); return; }
    const existing = new Map((states ?? []).map((r) => [r.group_id as string, r.last_read_at as string]));
    const missing = groupIds.filter((id) => !existing.has(id));
    if (missing.length) {
      const initialized = await supabase.from("chat_group_read_states")
        .upsert(missing.map((id) => ({ group_id: id, user_id: userId })),
          { onConflict: "group_id,user_id", ignoreDuplicates: true });
      if (initialized.error) { console.error("Initialize read states:", initialized.error.message); return; }
      const refreshed = await supabase.from("chat_group_read_states")
        .select("group_id, last_read_at").eq("user_id", userId).in("group_id", groupIds);
      if (refreshed.error) return;
      for (const row of refreshed.data ?? []) existing.set(row.group_id, row.last_read_at);
    }
    const counts = await Promise.all(groupIds.map(async (id) => {
      const lastRead = existing.get(id);
      if (!lastRead) return [id, 0] as const;
      const { count, error: countError } = await supabase.from("chat_group_messages")
        .select("id", { count: "exact", head: true })
        .eq("group_id", id).neq("sender_id", userId).gt("created_at", lastRead);
      if (countError) { console.error("Unread count:", countError.message); return [id, 0] as const; }
      return [id, count ?? 0] as const;
    }));
    setUnreadCounts(Object.fromEntries(counts));
  }, []);

  useEffect(() => {
    void loadGroups();
  }, [loadGroups]);

useEffect(() => {
  if (!currentUserId) return;

  const timer = window.setInterval(() => {
    void refreshJoinRequests();
  }, 10000);

  const onFocus = () => {
    void refreshJoinRequests();
  };

  window.addEventListener("focus", onFocus);

  return () => {
    window.clearInterval(timer);
    window.removeEventListener("focus", onFocus);
  };
}, [currentUserId, refreshJoinRequests]);


  useEffect(() => {
    if (!currentUserId || !memberships.length) return;
    const ids = [...new Set(memberships.map((m) => m.group_id))];
    void refreshUnread(currentUserId, ids);
    const timer = window.setInterval(() => { void refreshUnread(currentUserId, ids); }, 5000);
    const onFocus = () => { void refreshUnread(currentUserId, ids); };
    window.addEventListener("focus", onFocus);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", onFocus); };
  }, [currentUserId, memberships, refreshUnread]);

const joinRequestCounts = {
  all: joinRequests.length,
  new: joinRequests.filter((request) =>
    newRequestIds.includes(request.request_id)
  ).length,
  seen: joinRequests.filter(
    (request) => !newRequestIds.includes(request.request_id)
  ).length,
};


const filteredJoinRequests = joinRequests.filter((request) => {
  const isNew = newRequestIds.includes(request.request_id);

  const matchesFilter =
    joinRequestFilter === "all" ||
    (joinRequestFilter === "new" && isNew) ||
    (joinRequestFilter === "seen" && !isNew);

  const query = joinRequestSearch.trim().toLowerCase();

  const matchesSearch =
    !query ||
    request.requester_name.toLowerCase().includes(query) ||
    request.group_name.toLowerCase().includes(query);

  return matchesFilter && matchesSearch;
});

const sortedJoinRequests = [...filteredJoinRequests].sort((a, b) => {
  if (joinRequestSort === "newest") {
    return (
      new Date(b.requested_at).getTime() -
      new Date(a.requested_at).getTime()
    );
  }

  if (joinRequestSort === "oldest") {
    return (
      new Date(a.requested_at).getTime() -
      new Date(b.requested_at).getTime()
    );
  }

  if (joinRequestSort === "member_asc") {
    return a.requester_name.localeCompare(b.requester_name);
  }

  if (joinRequestSort === "group_asc") {
    return a.group_name.localeCompare(b.group_name);
  }

  return 0;
});


const filteredGroups = groups.filter((group) => {
  const query = groupSearch.trim().toLowerCase();

  if (!query) return true;

  return (
    group.name.toLowerCase().includes(query) ||
    (group.description ?? "").toLowerCase().includes(query)
  );
});

const sortedGroups = [...filteredGroups].sort((a, b) => {

  const aPinned = pinnedGroupIds.includes(a.id);
  const bPinned = pinnedGroupIds.includes(b.id);

  if (aPinned !== bPinned) {
    return aPinned ? -1 : 1;
  }

  if (groupSort === "favorites_first") {
    const aFavorite = favoriteGroupIds.includes(a.id);
    const bFavorite = favoriteGroupIds.includes(b.id);

    if (aFavorite !== bFavorite) {
      return aFavorite ? -1 : 1;
    }

    return a.name.localeCompare(b.name);
  }

  if (groupSort === "name_asc") {
    return a.name.localeCompare(b.name);
  }

  if (groupSort === "name_desc") {
    return b.name.localeCompare(a.name);
  }

  const unreadA = unreadCounts[a.id] ?? 0;
  const unreadB = unreadCounts[b.id] ?? 0;

  if (groupSort === "unread_desc") {
    return unreadB - unreadA || a.name.localeCompare(b.name);
  }

  return unreadA - unreadB || a.name.localeCompare(b.name);
});

  return (
    <main
      dir={ar ? "rtl" : "ltr"}
      style={{ minHeight: "100vh", background: "#f8f5f0", padding: "28px 16px", fontFamily: "Arial, sans-serif" }}
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
        <Link href="/dashboard" style={{ color: burgundy, fontWeight: 700, textDecoration: "none" }}>
          {ar ? "العودة إلى لوحة التحكم" : "← Back to Dashboard"}

        </Link>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, margin: "22px 0" }}>
          <div>

<div
  style={{
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 8,
  }}
>
  <h1
ref={groupsHeadingRef}
tabIndex={-1}
style={{ color: burgundy, margin: 0 }}>
    {ar ? "مجموعاتي" : "My Groups"}
  </h1>

  {pendingRequestCount > 0 && (
    <span
      role="status"
      style={{
        background: "#b42318",
        color: "#ffffff",
        padding: "6px 12px",
        borderRadius: 999,
        fontSize: 13,
        fontWeight: 700,
        whiteSpace: "nowrap",
      }}
    >
      {pendingRequestCount}{" "}
      {ar ? "طلبات معلقة" : "pending"}
    </span>
  )}
</div>

            <Link
  href="/dashboard/groups/discover"
  style={{
    display: "inline-block",
    marginTop: 12,
    marginBottom: 20,
    padding: "11px 18px",
    background: "#873b50",
    color: "#ffffff",
    borderRadius: 9,
    textDecoration: "none",
    fontWeight: 700,
  }}
>
  {lang === "ar"
    ? "اكتشف المجموعات"
    : "Discover Groups"}
</Link>
            <p style={{ color: "#655e61", margin: 0 }}>
              {ar ? "تواصل مع زملائك داخل مجموعاتك." : "Stay connected with classmates in your groups."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadGroups()}
            disabled={loading || respondingId !== null}
            style={{ border: `1px solid ${burgundy}`, background: "white", color: burgundy, padding: "10px 14px", borderRadius: 9, cursor: loading ? "wait" : "pointer" }}
          >
            {ar ? "تحديث" : "Refresh"}
          </button>
        </div>

{pendingRequestCount > 0 && (
  <section
    aria-label={
      ar
        ? "ملخص إدارة طلبات الانضمام"
        : "Group administration summary"
    }
    style={{
      background: "#ffffff",
      border: "1px solid #e6d5dc",
      borderRadius: 12,
      padding: 20,
      marginBottom: 22,
    }}
  >
    <h2
      style={{
        color: burgundy,
        fontSize: 19,
        margin: "0 0 16px",
      }}
    >
      {ar ? "ملخص إدارة المجموعات" : "Group Administration"}
    </h2>

    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        gap: 12,
        marginBottom: 16,
      }}
    >
      <div
        style={{
          background: "#f8f5f0",
          padding: 16,
          borderRadius: 10,
        }}
      >
        <div style={{ color: "#655e61", fontSize: 13 }}>
          {ar ? "الطلبات المعلقة" : "Pending Requests"}
        </div>
        <div
          style={{
            color: burgundy,
            fontSize: 28,
            fontWeight: 700,
            marginTop: 6,
          }}
        >
          {pendingRequestCount}
        </div>
      </div>

      <div
        style={{
          background: "#f8f5f0",
          padding: 16,
          borderRadius: 10,
        }}
      >
        <div style={{ color: "#655e61", fontSize: 13 }}>
          {ar ? "الطلبات الجديدة" : "New Requests"}
        </div>
        <div
          style={{
            color: "#b42318",
            fontSize: 28,
            fontWeight: 700,
            marginTop: 6,
          }}
        >
          {newRequestIds.length}
        </div>
      </div>
    </div>

    <button
      type="button"
      onClick={() => {
        document
          .getElementById("pending-join-requests")
          ?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
      }}
      style={{
        background: burgundy,
        color: "#ffffff",
        border: "none",
        borderRadius: 9,
        padding: "11px 16px",
        cursor: "pointer",
        fontWeight: 700,
        fontSize: 14,
      }}
    >
      {ar ? "عرض طلبات الانضمام" : "View Pending Requests"}
    </button>
  </section>
)}

<div style={{ marginBottom: 22 }}>
  <input
    type="search"
    value={groupSearch}
    onChange={(e) => setGroupSearch(e.target.value)}
    placeholder={
      ar
        ? "ابحث عن مجموعة بالاسم أو الوصف..."
        : "Search groups by name or description..."
    }
    aria-label={ar ? "البحث في مجموعاتي" : "Search My Groups"}
    style={{
      width: "100%",
      padding: "13px 16px",
      border: "1px solid #e3d6da",
      borderRadius: 10,
      background: "#ffffff",
      color: "#29232a",
      fontSize: 15,
      outlineColor: burgundy,
      boxSizing: "border-box",
    }}
  />
</div>

<div style={{ marginBottom: 22 }}>
  <label
    htmlFor="group-sort"
    style={{
      display: "block",
      marginBottom: 8,
      color: burgundy,
      fontWeight: 700,
      fontSize: 14,
    }}
  >
    {ar ? "ترتيب المجموعات" : "Sort Groups"}
  </label>

  <select
    id="group-sort"
    value={groupSort}
    onChange={(e) =>
      setGroupSort(
        e.target.value as
          | "name_asc"
          | "name_desc"
          | "unread_desc"
          | "unread_asc"
          | "favorites_first"
      )
    }
    style={{
      width: "100%",
      padding: "12px 14px",
      border: "1px solid #e3d6da",
      borderRadius: 10,
      background: "#ffffff",
      color: "#29232a",
      fontSize: 15,
      boxSizing: "border-box",
    }}
  >
    <option value="name_asc">
      {ar ? "الاسم: أ - ي" : "Name: A–Z"}
    </option>
    <option value="name_desc">
      {ar ? "الاسم: ي - أ" : "Name: Z–A"}
    </option>
    <option value="unread_desc">
      {ar ? "الرسائل غير المقروءة: الأكثر أولاً" : "Most Unread First"}
    </option>
    <option value="unread_asc">
      {ar ? "الرسائل غير المقروءة: الأقل أولاً" : "Fewest Unread First"}
    </option>

<option value="favorites_first">
  {ar ? "المفضلة أولاً" : "Favorites First"}
</option>

  </select>

</div>


        {error && <p role="alert" style={{ color: "#b42318", background: "white", borderRadius: 10, padding: 14 }}>{error}</p>}

        {loading ? (
          <p>{ar ? "جارٍ تحميل المجموعات والدعوات..." : "Loading groups and invitations..."}</p>
        ) : (
          <>

{newRequestIds.length > 0 && (
  <div
    role="status"
    aria-live="polite"
    style={{
      background: "#fff1f2",
      border: "1px solid #fecdd3",
      color: "#9f1239",
      borderRadius: 12,
      padding: 16,
      marginBottom: 20,
      fontWeight: 700,
    }}
  >
    🔔{" "}
    {ar
      ? `لديك ${newRequestIds.length} طلب انضمام جديد`
      : `You have ${newRequestIds.length} new join request${
          newRequestIds.length === 1 ? "" : "s"
        }`}

<button
  type="button"
  onClick={() => {
    document
      .getElementById("pending-join-requests")
      ?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
  }}
  style={{
    display: "block",
    marginTop: 12,
    padding: "10px 16px",
    background: "#873b50",
    color: "white",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 14,
  }}
>
  {ar ? "عرض الطلبات" : "View Requests"}
</button>

  </div>
)}


{joinRequests.length > 0 && (
  <section
    id="pending-join-requests"
    style={{ marginBottom: 24, scrollMarginTop: 24 }}
  >

    <h2
      style={{
        color: burgundy,
        fontSize: 21,
        marginBottom: 12,
      }}
    >
      {ar ? "طلبات الانضمام المعلقة" : "Pending Join Requests"}
    </h2>

<div
  role="group"
  aria-label={
    ar ? "تصفية طلبات الانضمام" : "Filter join requests"
  }
  style={{
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  }}
>
  {(["all", "new", "seen"] as const).map((filter) => {
    const active = joinRequestFilter === filter;

    const label =
      filter === "all"
        ? ar ? "الكل" : "All"
        : filter === "new"
        ? ar ? "الجديدة" : "New"
        : ar ? "تمت مشاهدتها" : "Seen";

{" (" + joinRequestCounts[filter] + ")"}

    return (
      <button
        key={filter}
        type="button"
        aria-pressed={active}
        onClick={() => setJoinRequestFilter(filter)}
        style={{
          padding: "9px 16px",
          borderRadius: 8,
          border: `1px solid ${burgundy}`,
          background: active ? burgundy : "#ffffff",
          color: active ? "#ffffff" : burgundy,
          fontWeight: 700,
          fontSize: 14,
          cursor: "pointer",

        }}
      >
        {label}

      </button>
    );
  })}
</div>

<div style={{ marginBottom: 16 }}>
  <input
    type="search"
    value={joinRequestSearch}
    onChange={(e) => setJoinRequestSearch(e.target.value)}
    placeholder={
      ar
        ? "ابحث باسم العضو أو المجموعة..."
        : "Search by member or group name..."
    }
    aria-label={
      ar
        ? "البحث في طلبات الانضمام"
        : "Search pending join requests"
    }
    style={{
      width: "100%",
      padding: "12px 16px",
      border: "1px solid #e6d5dc",
      borderRadius: 9,
      background: "#ffffff",
      color: "#29232a",
      fontSize: 15,
      outlineColor: burgundy,
      boxSizing: "border-box",
    }}
  />
</div>

<div style={{ marginBottom: 16 }}>
  <label
    htmlFor="join-request-sort"
    style={{
      display: "block",
      marginBottom: 8,
      color: burgundy,
      fontWeight: 700,
      fontSize: 14,
    }}
  >
    {ar ? "ترتيب طلبات الانضمام" : "Sort Join Requests"}
  </label>

  <select
    id="join-request-sort"
    value={joinRequestSort}
    onChange={(e) =>
      setJoinRequestSort(
        e.target.value as
          | "newest"
          | "oldest"
          | "member_asc"
          | "group_asc"
      )
    }
    style={{
      width: "100%",
      padding: "12px 14px",
      border: "1px solid #e6d5dc",
      borderRadius: 9,
      background: "#ffffff",
      color: "#29232a",
      fontSize: 15,
      outlineColor: burgundy,
      boxSizing: "border-box",
    }}
  >
    <option value="newest">
      {ar ? "الأحدث أولاً" : "Newest First"}
    </option>
    <option value="oldest">
      {ar ? "الأقدم أولاً" : "Oldest First"}
    </option>
    <option value="member_asc">
      {ar ? "اسم العضو: أ - ي" : "Member Name A–Z"}
    </option>
    <option value="group_asc">
      {ar ? "اسم المجموعة: أ - ي" : "Group Name A–Z"}
    </option>
  </select>
</div>

    <div style={{ display: "grid", gap: 12 }}>

{filteredJoinRequests.length === 0 && (
  <p
    role="status"
    style={{
      background: "#ffffff",
      border: "1px solid #e6d5dc",
      borderRadius: 9,
      padding: 20,
      color: "#655e61",
      textAlign: "center",
      margin: 0,
    }}
  >

{joinRequestSearch.trim()
  ? ar
    ? "لا توجد طلبات انضمام تطابق بحثك."
    : "No join requests match your search."
  : joinRequestFilter === "new"
  ? ar
    ? "لا توجد طلبات انضمام جديدة."
    : "No new join requests to display."
  : joinRequestFilter === "seen"
  ? ar
    ? "لا توجد طلبات انضمام تمت مشاهدتها."
    : "No seen join requests to display."
  : ar
  ? "لا توجد طلبات انضمام معلقة."
  : "No pending join requests to display."}

  </p>
)}


{sortedJoinRequests.map((request) => (


        <div
          key={request.request_id}
          style={{
            background: "white",
          border: newRequestIds.includes(request.request_id)
          ? "2px solid #b42318"
          : "1px solid #e6d5dc",

            padding: 20,
          }}
        >
          <h3
            style={{
              color: burgundy,
              margin: "0 0 8px",
              fontSize: 18,
            }}
          >
            {request.requester_name}
          </h3>

          <p style={{ color: "#655e61", margin: "0 0 8px" }}>
            {ar ? "طلب الانضمام إلى:" : "Requested to join:"}{" "}
            <strong>{request.group_name}</strong>
          </p>

{newRequestIds.includes(request.request_id) && (
  <button
    type="button"
    onClick={() => markJoinRequestAsSeen(request.request_id)}
    style={{
      background: "white",
      color: burgundy,
      border: `1px solid ${burgundy}`,
      borderRadius: 8,
      padding: "8px 12px",
      cursor: "pointer",
      fontSize: 13,
      fontWeight: 600,
      marginBottom: 12,
    }}
  >
    {ar ? "تحديد كمقروء" : "Mark as Seen"}
  </button>
)}

          <p
            style={{
              color: "#777",
              fontSize: 13,
              marginBottom: 16,
            }}
          >
            {new Date(request.requested_at).toLocaleString(
              ar ? "ar-JO" : "en-GB"
            )}
          </p>

          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              disabled={reviewingId !== null}
              onClick={() =>
                void reviewJoinRequest(request.request_id, true)
              }
              style={{
                background: burgundy,
                color: "white",
                border: 0,
                borderRadius: 9,
                padding: "10px 18px",
                fontWeight: 700,
                cursor: reviewingId ? "wait" : "pointer",
              }}
            >

{reviewingId === request.request_id &&
reviewAction === "approve"
  ? ar
    ? "جارٍ الموافقة..."
    : "Approving..."
  : ar
    ? "موافقة"
    : "Approve"}

            </button>

            <button
              type="button"
              disabled={reviewingId !== null}



onClick={(event) => {
  declineTriggerButtonRef.current = event.currentTarget;
  setError("");
  setDeclineRequestId(request.request_id);
}}



              style={{
                background: "white",
                color: burgundy,
                border: `1px solid ${burgundy}`,
                borderRadius: 9,
                padding: "10px 18px",
                fontWeight: 700,
                cursor: reviewingId ? "wait" : "pointer",
              }}
            >


{reviewingId === request.request_id &&
reviewAction === "decline"
  ? ar
    ? "جارٍ الرفض..."
    : "Declining..."
  : ar
    ? "رفض"
    : "Decline"}


            </button>
          </div>
        </div>
      ))}
    </div>
  </section>
)}

{declineRequestId !== null && (
  <div
    role="presentation"


onKeyDown={(event) => {
  if (event.key === "Escape" && reviewingId === null) {
    event.preventDefault();
    setDeclineRequestId(null);

    requestAnimationFrame(() => {
      declineTriggerButtonRef.current?.focus();
    });
  }
}}


    style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0, 0, 0, 0.55)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
      zIndex: 1000,
    }}
  >
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="decline-dialog-title"
      aria-describedby="decline-dialog-description"
      style={{
        background: "white",
        borderRadius: 16,
        padding: 28,
        width: "100%",
        maxWidth: 440,
        boxShadow: "0 12px 40px rgba(0,0,0,0.2)",
        direction: ar ? "rtl" : "ltr",
      }}
    >
      <h2
        id="decline-dialog-title"
        style={{
          color: burgundy,
          marginTop: 0,
        }}
      >
        {ar ? "تأكيد رفض الطلب" : "Confirm Decline"}
      </h2>

      <p
        id="decline-dialog-description"
        style={{
          color: "#655e61",
          lineHeight: 1.7,
        }}
      >
        {ar
          ? "هل أنت متأكد من رغبتك في رفض طلب الانضمام؟"
          : "Are you sure you want to decline this join request?"}
      </p>

      {error && (
        <p
          role="alert"
          style={{
            background: "#fff1f2",
            border: "1px solid #fecdd3",
            color: "#b42318",
            borderRadius: 10,
            padding: "12px 14px",
            lineHeight: 1.6,
            marginTop: 16,
          }}
        >
          {error}
        </p>
      )}

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: 12,
          marginTop: 24,
          flexWrap: "wrap",
        }}
      >
        <button
        ref={declineCancelButtonRef}
          type="button"
          disabled={reviewingId !== null}

onClick={() => {
  setDeclineRequestId(null);

  requestAnimationFrame(() => {
    declineTriggerButtonRef.current?.focus();
  });
}}
          style={{
            padding: "10px 18px",
            borderRadius: 9,
            background: "white",
            border: "1px solid #ddd",
            cursor: "pointer",
          }}
        >
          {ar ? "إلغاء" : "Cancel"}
        </button>

        <button
          type="button"
          disabled={reviewingId !== null}
          onClick={async () => {
  const requestId = declineRequestId;
  if (!requestId) return;

  const success = await reviewJoinRequest(requestId, false);


if (success) {
  setDeclineRequestId(null);

  requestAnimationFrame(() => {
    groupsHeadingRef.current?.focus();
  });
}

}}
          style={{
            padding: "10px 18px",
            borderRadius: 9,
            background: burgundy,
            color: "white",
            border: 0,
            fontWeight: 700,
            cursor: reviewingId !== null ? "wait" : "pointer",
          }}
        >
          {reviewingId === declineRequestId
            ? ar
              ? "جارٍ الرفض..."
              : "Declining..."
            : ar
              ? "تأكيد الرفض"
              : "Confirm Decline"}
        </button>
      </div>
    </div>
  </div>
)}

            {invitations.length > 0 && (
              <section style={{ marginBottom: 24 }}>
                <h2 style={{ color: burgundy, fontSize: 21, marginBottom: 12 }}>
                  {ar ? "دعوات المجموعات الواردة" : "Incoming Group Invitations"}
                </h2>
                <div style={{ display: "grid", gap: 12 }}>
                  {invitations.map((invitation) => (
                    <div key={invitation.id} style={{ background: "white", border: "1px solid #e6d5dc", borderRadius: 14, padding: 20 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 14 }}>
                        <div>
                          <h3 style={{ color: burgundy, margin: "0 0 6px", fontSize: 18 }}>{invitation.groupName}</h3>
                          <p style={{ color: "#655e61", margin: 0, fontSize: 14 }}>
                            {ar ? "لديك دعوة للانضمام إلى هذه المجموعة." : "You've been invited to join this group."}
                          </p>
                        </div>
                        <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
                          <button
                            type="button"
                            disabled={respondingId !== null}
                            onClick={() => void respondToInvitation(invitation.id, true)}
                            style={{ background: burgundy, color: "white", border: `1px solid ${burgundy}`, borderRadius: 9, padding: "10px 16px", fontWeight: 700, cursor: respondingId ? "wait" : "pointer" }}
                          >
                            {respondingId === invitation.id ? (ar ? "جارٍ المعالجة..." : "Processing...") : (ar ? "قبول" : "Accept")}
                          </button>
                          <button
                            type="button"
                            disabled={respondingId !== null}
                            onClick={() => void respondToInvitation(invitation.id, false)}
                            style={{ background: "white", color: burgundy, border: `1px solid ${burgundy}`, borderRadius: 9, padding: "10px 16px", fontWeight: 700, cursor: respondingId ? "wait" : "pointer" }}
                          >
                            {ar ? "رفض" : "Decline"}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {groups.length === 0 ? (
              <section style={{ background: "white", borderRadius: 14, padding: 24 }}>
                <h2 style={{ color: burgundy, marginTop: 0 }}>{ar ? "لا توجد مجموعات بعد" : "No groups yet"}</h2>
                <p style={{ marginBottom: 0, color: "#655e61" }}>
                  {ar ? "ستظهر هنا المجموعات التي تنضم إليها بعد قبول دعوتك." : "Groups you join will appear here after your invitation is accepted."}
                </p>
              </section>

) : filteredGroups.length === 0 ? (
  <section
    style={{
      background: "white",
      border: "1px solid #eee5e8",
      borderRadius: 14,
      padding: 24,
      textAlign: "center",
      color: "#655e61",
    }}
  >
    <p style={{ margin: 0 }}>
      {ar
        ? "لم يتم العثور على مجموعات مطابقة. جرّب البحث بكلمات أخرى."
        : "No matching groups found. Try another search."}
    </p>
  </section>
) : (

              <div style={{ display: "grid", gap: 14 }}>


{sortedGroups.map((group) => {


                  const role = memberships.find((item) => item.group_id === group.id)?.role;
                  return (
                    <section key={group.id} style={{ background: "white", borderRadius: 14, padding: 22, border: "1px solid #eee5e8" }}>
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                        <div style={{ flex: 1, minWidth: 180 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                            <h2 style={{ margin: 0, fontSize: 20, color: burgundy }}>{group.name}</h2>

<button
  type="button"

onClick={async () => {
  const isFavorite = favoriteGroupIds.includes(group.id);
  const supabase = createClient();

  const { data: auth, error: authError } =
    await supabase.auth.getUser();

  if (authError || !auth.user) {
    setError(
      ar
        ? "يرجى تسجيل الدخول مجدداً."
        : "Please sign in again."
    );
    return;
  }

  const result = isFavorite
    ? await supabase
        .from("chat_group_favorites")
        .delete()
        .eq("user_id", auth.user.id)
        .eq("group_id", group.id)
    : await supabase
        .from("chat_group_favorites")
        .insert({
          user_id: auth.user.id,
          group_id: group.id,
        });

  if (result.error) {
    console.error("Favorite update failed:", result.error);
    setError(
      ar
        ? "تعذر تحديث المفضلة. يرجى المحاولة مجدداً."
        : "Could not update favorites. Please try again."
    );
    return;
  }

  setError("");

  setFavoriteGroupIds((current) =>
    isFavorite
      ? current.filter((id) => id !== group.id)
      : current.includes(group.id)
        ? current
        : [...current, group.id]
  );
}}

  aria-label={
    favoriteGroupIds.includes(group.id)
      ? ar
        ? "إزالة من المفضلة"
        : "Remove from favorites"
      : ar
        ? "إضافة إلى المفضلة"
        : "Add to favorites"
  }
  title={
    favoriteGroupIds.includes(group.id)
      ? ar
        ? "إزالة من المفضلة"
        : "Remove from favorites"
      : ar
        ? "إضافة إلى المفضلة"
        : "Add to favorites"
  }
  style={{
    marginInlineStart: 12,
    border: "none",
    background: "transparent",
    cursor: "pointer",
    fontSize: 24,
    color: favoriteGroupIds.includes(group.id)
      ? "#d6a12b"
      : "#a9a2a5",
  }}
>
  {favoriteGroupIds.includes(group.id) ? "★" : "☆"}
</button>

<button
  type="button"


disabled={updatingPinIds.includes(group.id)}

onClick={async () => {
  if (updatingPinIds.includes(group.id)) return;

  const isPinned = pinnedGroupIds.includes(group.id);

  if (!isPinned && pinnedGroupIds.length >= 3) {
    setError(
      ar
        ? "يمكنك تثبيت 3 مجموعات كحد أقصى."
        : "You can pin a maximum of 3 groups."
    );
    return;
  }

  setUpdatingPinIds((current) => [...current, group.id]);

  try {
    const supabase = createClient();

    const { data: auth, error: authError } =
      await supabase.auth.getUser();

    if (authError || !auth.user) {
      setError(
        ar
          ? "يرجى تسجيل الدخول مجدداً."
          : "Please sign in again."
      );
      return;
    }

    const result = isPinned
      ? await supabase
          .from("chat_group_pins")
          .delete()
          .eq("user_id", auth.user.id)
          .eq("group_id", group.id)
      : await supabase
          .from("chat_group_pins")
          .insert({
            user_id: auth.user.id,
            group_id: group.id,
          });

    if (result.error) {
      console.error("Pin update failed:", result.error);
      setError(
        ar
          ? "تعذر تحديث المجموعات المثبتة. الحد الأقصى 3 مجموعات."
          : "Could not update pinned groups. Maximum 3 groups allowed."
      );
      return;
    }

    setError("");

    setPinnedGroupIds((current) =>
      isPinned
        ? current.filter((id) => id !== group.id)
        : current.includes(group.id)
          ? current
          : [...current, group.id]
    );
  } finally {
    setUpdatingPinIds((current) =>
      current.filter((id) => id !== group.id)
    );
  }
}}


  title={
    pinnedGroupIds.includes(group.id)
      ? ar ? "إلغاء التثبيت" : "Unpin group"
      : ar ? "تثبيت المجموعة" : "Pin group"
  }
  aria-label={
    pinnedGroupIds.includes(group.id)
      ? ar ? "إلغاء تثبيت المجموعة" : "Unpin group"
      : ar ? "تثبيت المجموعة" : "Pin group"
  }
  aria-pressed={pinnedGroupIds.includes(group.id)}
  style={{
    marginInlineStart: 10,
    border: "none",
    background: "transparent",
    cursor: "pointer",
    fontSize: 22,
    opacity: pinnedGroupIds.includes(group.id) ? 1 : 0.35,
  }}
>
  📌
</button>


                            {(unreadCounts[group.id] ?? 0) > 0 && (
                              <span aria-label={`${unreadCounts[group.id]} unread messages`}
                                style={{ background: burgundy, color: "white", borderRadius: 999, padding: "4px 9px", fontSize: 12, fontWeight: 700 }}>
                                {unreadCounts[group.id] > 99 ? "99+" : unreadCounts[group.id]} {ar ? "غير مقروء" : "unread"}
                              </span>
                            )}
                          </div>
                          {group.description && <p style={{ margin: "0 0 10px", color: "#655e61", whiteSpace: "pre-wrap" }}>{group.description}</p>}
                          <span style={{ fontSize: 12, color: "#776a70" }}>
                            {role === "admin" ? (ar ? "مشرف" : "Admin") : (ar ? "عضو" : "Member")}
                          </span>
                        </div>
                        <Link
                          href={`/dashboard/groups/${encodeURIComponent(group.id)}`}
                          style={{ display: "inline-block", background: burgundy, color: "white", borderRadius: 9, padding: "11px 16px", textDecoration: "none", fontWeight: 700 }}
                        >
                          {ar ? "فتح المحادثة" : "Open Conversation"}
                        </Link>


<button
  type="button"
  disabled={
    leavingGroupIds.includes(group.id) ||
    group.owner_id === currentUserId
  }
  title={
    group.owner_id === currentUserId
      ? ar
        ? "يجب نقل ملكية المجموعة إلى مشرف آخر قبل مغادرتها."
        : "Transfer group ownership to another administrator before leaving."
      : undefined
  }



onClick={async () => {
  const confirmed = window.confirm(
    ar
      ? `هل أنت متأكد من رغبتك في مغادرة مجموعة "${group.name}"؟`
      : `Are you sure you want to leave "${group.name}"?`
  );


if (!confirmed) return;

if (leavingGroupIds.includes(group.id)) return;

setLeavingGroupIds((current) => [...current, group.id]);

try {

    const supabase = createClient();

    const { error: leaveError } = await supabase.rpc(
      "leave_chat_group",
      { p_group_id: group.id }
    );

    if (leaveError) {
      console.error("Leave group failed:", leaveError);


setError(
  leaveError.message.includes("Group owner cannot leave")
    ? ar
      ? "لا يمكنك مغادرة المجموعة ما دمت مالكها. يرجى نقل الملكية إلى مشرف آخر أولاً."
      : "You cannot leave this group while you are its owner. Transfer ownership to another administrator first."
    : leaveError.message.includes("last administrator")
      ? ar
        ? "أنت آخر مشرف في المجموعة. يجب تعيين مشرف آخر قبل المغادرة."
        : "You are the last administrator. Assign another administrator before leaving."
      : ar
        ? "تعذرت مغادرة المجموعة. يرجى المحاولة مجدداً."
        : "Could not leave the group. Please try again."
);

      return;
    }

    setError("");
    setGroups((current) =>
      current.filter((item) => item.id !== group.id)
    );
    setMemberships((current) =>
      current.filter((item) => item.group_id !== group.id)
    );
    setFavoriteGroupIds((current) =>
      current.filter((id) => id !== group.id)
    );
    setPinnedGroupIds((current) =>
      current.filter((id) => id !== group.id)
    );

} catch (err) {
  console.error("Unexpected leave group error:", err);

  setError(
    ar
      ? "حدث خطأ أثناء مغادرة المجموعة."
      : "An error occurred while leaving the group."
  );
} finally {
  setLeavingGroupIds((current) =>
    current.filter((id) => id !== group.id)
  );
}

}}


  style={{
    marginTop: 10,
    padding: "9px 14px",
    border: "1px solid #b42318",
    borderRadius: 8,
    background: "white",
    color: "#b42318",
    fontWeight: 600,
    fontSize: 14,
    cursor: "pointer",
  }}
>
  {ar ? "مغادرة المجموعة" : "Leave Group"}
</button>

                      </div>
                    </section>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
