"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Language = "en" | "ar";

type Connection = {
  id: string;
  requester_id: string;
  recipient_id: string;
};

type ProfileRow = { display_name: string | null };

type Conversation = {
  userId: string;
  name: string;
  unread: number;
  latestBody: string | null;
  latestAt: string | null;
  latestSenderId: string | null;
};

export default function MessagesPage() {
  const router = useRouter();
  const [lang, setLang] = useState<Language>("en");
  const [userId, setUserId] = useState("");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingLanguage, setSavingLanguage] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const conversationsRef = useRef<Conversation[]>([]);
  const ar = lang === "ar";
  const filteredConversations = conversations.filter((person) => {
    const query = search.trim().toLocaleLowerCase();
    return !query || person.name.toLocaleLowerCase().includes(query) ||
      (person.latestBody ?? "").toLocaleLowerCase().includes(query);
  });

  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  const refreshUnread = useCallback(async (currentUserId: string) => {
    const supabase = createClient();
    const people = conversationsRef.current;
    if (!people.length) return;

    const updated = await Promise.all(
      people.map(async (person) => {
        const [countResult, latestResult] = await Promise.all([
          supabase.from("messages")
            .select("id", { count: "exact", head: true })
            .eq("sender_id", person.userId)
            .eq("recipient_id", currentUserId)
            .eq("is_read", false),
          supabase.from("messages")
            .select("body, created_at, sender_id")
            .or(`and(sender_id.eq.${currentUserId},recipient_id.eq.${person.userId}),and(sender_id.eq.${person.userId},recipient_id.eq.${currentUserId})`)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);
        if (countResult.error) console.error("Unread count error:", countResult.error.message);
        if (latestResult.error) console.error("Latest message error:", latestResult.error.message);
        return {
          userId: person.userId,
          unread: countResult.error ? person.unread : (countResult.count ?? 0),
          latestBody: latestResult.error ? person.latestBody : (latestResult.data?.body ?? null),
          latestAt: latestResult.error ? person.latestAt : (latestResult.data?.created_at ?? null),
          latestSenderId: latestResult.error ? person.latestSenderId : (latestResult.data?.sender_id ?? null),
        };
      })
    );

    const byId = new Map(updated.map((item) => [item.userId, item]));
    setConversations((current) => {
      const next = current.map((person) => ({ ...person, ...byId.get(person.userId) }));
      next.sort((a, b) => (b.latestAt ?? "").localeCompare(a.latestAt ?? "") || a.name.localeCompare(b.name));
      conversationsRef.current = next;
      return next;
    });
  }, []);

  useEffect(() => {
    let active = true;
    const supabase = createClient();

    async function load() {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (!active) return;
      if (authError || !auth.user) {
        router.replace("/login");
        return;
      }

      const currentUserId = auth.user.id;
      setUserId(currentUserId);

      const { data: profile } = await supabase
        .from("profiles")
        .select("locale")
        .eq("id", currentUserId)
        .single();
      if (!active) return;
      setLang(profile?.locale === "ar" ? "ar" : "en");

      const { data: connections, error: connectionError } = await supabase
        .from("connections")
        .select("id, requester_id, recipient_id")
        .eq("status", "accepted")
        .or(`requester_id.eq.${currentUserId},recipient_id.eq.${currentUserId}`);
      if (!active) return;
      if (connectionError) {
        setError(connectionError.message);
        setLoading(false);
        return;
      }

      const people = await Promise.all(
        ((connections ?? []) as Connection[]).map(async (item) => {
          const classmateId =
            item.requester_id === currentUserId
              ? item.recipient_id
              : item.requester_id;

          const [{ data: classmate }, countResult, latestResult] =
            await Promise.all([
              supabase.rpc("get_classmate_profile", {
                p_classmate_id: classmateId,
              }),
              supabase.from("messages")
                .select("id", { count: "exact", head: true })
                .eq("sender_id", classmateId)
                .eq("recipient_id", currentUserId)
                .eq("is_read", false),
              supabase.from("messages")
                .select("body, created_at, sender_id")
                .or(`and(sender_id.eq.${currentUserId},recipient_id.eq.${classmateId}),and(sender_id.eq.${classmateId},recipient_id.eq.${currentUserId})`)
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle(),
            ]);

          const row = Array.isArray(classmate)
            ? (classmate[0] as ProfileRow | undefined)
            : (classmate as ProfileRow | null);
          if (countResult.error) console.error(countResult.error.message);
          if (latestResult.error) console.error(latestResult.error.message);

          return {
            userId: classmateId,
            name: row?.display_name || "Classmate",
            unread: countResult.count ?? 0,
            latestBody: latestResult.data?.body ?? null,
            latestAt: latestResult.data?.created_at ?? null,
            latestSenderId: latestResult.data?.sender_id ?? null,
          };
        })
      );
      if (!active) return;
      people.sort((a, b) => (b.latestAt ?? "").localeCompare(a.latestAt ?? "") || a.name.localeCompare(b.name));
      conversationsRef.current = people;
      setConversations(people);
      setLoading(false);
    }

    void load();
    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    let active = true;
    const channel = supabase
      .channel(`conversations-unread-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `recipient_id=eq.${userId}`,
        },
        () => {
          if (active) void refreshUnread(userId);
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `sender_id=eq.${userId}` },
        () => { if (active) void refreshUnread(userId); }
      )
      .subscribe((status) => {
        if (active && status === "SUBSCRIBED") void refreshUnread(userId);
        if (status === "CHANNEL_ERROR") {
          console.error("Conversations Realtime channel error");
        }
      });

    function refreshOnFocus() {
      if (active) void refreshUnread(userId);
    }
    function refreshOnVisibility() {
      if (document.visibilityState === "visible") refreshOnFocus();
    }
    window.addEventListener("focus", refreshOnFocus);
    document.addEventListener("visibilitychange", refreshOnVisibility);

    return () => {
      active = false;
      window.removeEventListener("focus", refreshOnFocus);
      document.removeEventListener("visibilitychange", refreshOnVisibility);
      void supabase.removeChannel(channel);
    };
  }, [userId, refreshUnread]);

  async function changeLanguage() {
    if (!userId || savingLanguage) return;
    const next: Language = ar ? "en" : "ar";
    const previous = lang;
    setLang(next);
    setSavingLanguage(true);
    setError("");

    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ locale: next })
      .eq("id", userId);

    if (updateError) {
      setLang(previous);
      setError(updateError.message);
    }
    setSavingLanguage(false);
  }

  return (
    <main
      dir={ar ? "rtl" : "ltr"}
      style={{
        minHeight: "100vh",
        background: "#f8f5f0",
        padding: "35px 16px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <h1 style={{ color: "#873b50", margin: 0 }}>
            {ar ? "محادثاتي" : "My Conversations"}
          </h1>
          <button
            type="button"
            onClick={() => void changeLanguage()}
            disabled={loading || savingLanguage || !userId}
            style={{
              background: "#fff",
              color: "#873b50",
              border: "1px solid #e3d6da",
              borderRadius: 9,
              padding: "10px 16px",
              fontWeight: 700,
              cursor: savingLanguage ? "wait" : "pointer",
            }}
          >
            {savingLanguage ? "..." : ar ? "English" : "العربية"}
          </button>
        </div>

        <p style={{ color: "#777", lineHeight: 1.6 }}>
          {ar
            ? "تواصل مع زملاء الدراسة الذين قبلوا طلبات التواصل."
            : "Chat privately with classmates you're connected with."}
        </p>

        {error && (
          <p role="alert" style={{ color: "#b42318" }}>
            {error}
          </p>
        )}

        <div style={{ marginTop: 22, marginBottom: 8 }}>
          <label htmlFor="conversation-search" style={{ display: "block", color: "#873b50", fontWeight: 700, marginBottom: 8 }}>
            {ar ? "البحث في المحادثات" : "Search conversations"}
          </label>
          <input
            id="conversation-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={ar ? "ابحث باسم الزميل أو في آخر رسالة..." : "Search classmate or latest message..."}
            dir={ar ? "rtl" : "ltr"}
            style={{ width: "100%", boxSizing: "border-box", padding: "13px 15px", border: "1px solid #e3d6da", borderRadius: 12, background: "#fff", color: "#292524", fontSize: 15, outlineColor: "#873b50" }}
          />
        </div>

        {loading ? (
          <p>{ar ? "جارٍ التحميل..." : "Loading conversations..."}</p>
        ) : conversations.length === 0 ? (
          <section
            style={{
              background: "#fff",
              borderRadius: 16,
              padding: 28,
              marginTop: 25,
            }}
          >
            <p>
              {ar
                ? "لا توجد اتصالات بعد. ابحث عن زملائك أولاً."
                : "No connected classmates yet. Find your classmates first."}
            </p>
            <Link href="/dashboard/classmates" style={{ color: "#873b50" }}>
              {ar ? "ابحث عن زملائك" : "Find Classmates"}
            </Link>
          </section>
        ) : filteredConversations.length === 0 ? (
          <section style={{ background: "#fff", borderRadius: 16, padding: 28, marginTop: 25, color: "#777" }}>
            {ar ? "لا توجد محادثات تطابق بحثك." : "No conversations match your search."}
          </section>
        ) : (
          <div style={{ display: "grid", gap: 12, marginTop: 25 }}>
            {filteredConversations.map((person) => (
              <Link
                key={person.userId}
                href={`/dashboard/messages/${encodeURIComponent(person.userId)}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 16,
                  padding: 20,
                  background: "#fff",
                  borderRadius: 14,
                  border: "1px solid #eee5e8",
                  textDecoration: "none",
                  color: "#292524",
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <strong style={{ color: "#873b50" }}>{person.name}</strong>
                  <p style={{ color: "#777", margin: "7px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {person.latestBody
                      ? `${person.latestSenderId === userId ? (ar ? "أنت: " : "You: ") : ""}${person.latestBody}`
                      : (ar ? "ابدأ المحادثة" : "Start a conversation")}
                  </p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, flexShrink: 0 }}>
                  {person.latestAt && (
                    <time dateTime={person.latestAt} style={{ fontSize: 12, color: "#777" }}>
                      {new Date(person.latestAt).toLocaleString(ar ? "ar-JO" : "en-GB", {
                        day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                      })}
                    </time>
                  )}
                  {person.unread > 0 && (
                    <span
                      aria-label={ar ? `${person.unread} رسائل غير مقروءة` : `${person.unread} unread messages`}
                      style={{ background: "#b42338", color: "#fff", borderRadius: 20, padding: "5px 10px", fontSize: 12, fontWeight: 700 }}
                    >
                      {person.unread}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}

        <p style={{ textAlign: "center", marginTop: 30 }}>
          <Link href="/dashboard" style={{ color: "#873b50" }}>
            {ar ? "العودة إلى لوحة التحكم" : "Back to dashboard"}
          </Link>
        </p>
      </div>
    </main>
  );
}
