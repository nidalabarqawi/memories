"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Group = { id: string; name: string; description: string | null; created_by: string };
type Member = { user_id: string; role: "admin" | "member" };
type Connection = { requester_id: string; recipient_id: string };
type Invitation = { id: string; invited_user_id: string; status: string };
type GroupMessage = { id: string; group_id: string; sender_id: string; body: string; created_at: string };
type ProfileResult = { display_name?: string | null };
type GroupPhoto = { id: string; message_id: string; storage_path: string };
type PhotoDisplay = { id: string; url: string };
type VoiceMetadata = { message_id: string; storage_path: string; duration_seconds: number };
type VoiceDisplay = { url: string; duration: number };
type MessageReceipt = { message_id: string; user_id: string; delivered_at: string | null; read_at: string | null };

const burgundy = "#873b50";
const panel: React.CSSProperties = { background: "white", padding: 22, borderRadius: 14, marginBottom: 24 };

export default function GroupDetailsPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const router = useRouter();
  const [lang, setLang] = useState<"en" | "ar">("en");
  const [userId, setUserId] = useState("");
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [selectedClassmate, setSelectedClassmate] = useState("");
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [receipts, setReceipts] = useState<MessageReceipt[]>([]);
  const [infoMessageId, setInfoMessageId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [selectedPhotos, setSelectedPhotos] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [photosByMessage, setPhotosByMessage] = useState<Record<string, PhotoDisplay[]>>({});
  const [expandedPhoto, setExpandedPhoto] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState("");
  const photoInputRef = useRef<HTMLInputElement>(null);

const photoUrlCacheRef = useRef<
  Map<string, { url: string; expiresAt: number }>
>(new Map());

const voiceUrlCacheRef = useRef<
  Map<string, { url: string; expiresAt: number }>
>(new Map());

  const [voiceByMessage, setVoiceByMessage] = useState<Record<string, VoiceDisplay>>({});
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordedVoice, setRecordedVoice] = useState<Blob | null>(null);
  const [voiceDuration, setVoiceDuration] = useState(0);
  const [voicePreviewUrl, setVoicePreviewUrl] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordStartedRef = useRef(0);
  const discardRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesContentRef = useRef<HTMLDivElement>(null);
  const ar = lang === "ar";
  const isMember = members.some((m) => m.user_id === userId);
  const isAdmin = members.some((m) => m.user_id === userId && m.role === "admin");

  
const loadPhotos = useCallback(async () => {
  const supabase = createClient();

  const { data, error: photoError } = await supabase
    .from("chat_group_attachments")
    .select("id, message_id, storage_path");

  if (photoError) {
    console.error("Group photo metadata:", photoError.message);
    return;
  }

  const next: Record<string, PhotoDisplay[]> = {};

  await Promise.all(
    ((data ?? []) as GroupPhoto[]).map(async (photo) => {
      const cacheKey = photo.storage_path;
      const cached = photoUrlCacheRef.current.get(cacheKey);

      let url: string;

      if (cached && cached.expiresAt > Date.now()) {
        url = cached.url;
      } else {
        const { data: signed, error: signError } =
          await supabase.storage
            .from("group-chat-photos")
            .createSignedUrl(photo.storage_path, 3600);

        if (signError || !signed?.signedUrl) return;

        url = signed.signedUrl;

        photoUrlCacheRef.current.set(cacheKey, {
          url,
          expiresAt: Date.now() + 55 * 60 * 1000,
        });
      }

      (next[photo.message_id] ??= []).push({
        id: photo.id,
        url,
      });
    })
  );

  setPhotosByMessage(next);
}, []);


  
const loadVoices = useCallback(async () => {
  const supabase = createClient();

  const { data, error: readError } = await supabase
    .from("chat_group_voice_messages")
    .select("message_id, storage_path, duration_seconds");

  if (readError) {
    console.error("Group voice metadata:", readError.message);
    return;
  }

  const result: Record<string, VoiceDisplay> = {};

  await Promise.all(
    ((data ?? []) as VoiceMetadata[]).map(async (item) => {
      const cacheKey = item.storage_path;
      const cached = voiceUrlCacheRef.current.get(cacheKey);

      let url: string;

      if (cached && cached.expiresAt > Date.now()) {
        url = cached.url;
      } else {
        const { data: signed, error: signError } =
          await supabase.storage
            .from("group-chat-voice")
            .createSignedUrl(item.storage_path, 3600);

        if (signError || !signed?.signedUrl) return;

        url = signed.signedUrl;

        voiceUrlCacheRef.current.set(cacheKey, {
          url,
          expiresAt: Date.now() + 55 * 60 * 1000,
        });
      }

      result[item.message_id] = {
        url,
        duration: item.duration_seconds,
      };
    })
  );

  setVoiceByMessage(result);
}, []);

  useEffect(() => {
    if (!recordedVoice) { setVoicePreviewUrl(null); return; }
    const url = URL.createObjectURL(recordedVoice);
    setVoicePreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [recordedVoice]);

  useEffect(() => () => {
    discardRef.current = true;
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  useEffect(() => {
    const urls = selectedPhotos.map((file) => URL.createObjectURL(file));
    setPreviews(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [selectedPhotos]);

  function choosePhotos(files: FileList | null) {
    if (!files) return;
    const incoming = Array.from(files);
    const all = [...selectedPhotos, ...incoming];
    if (all.length > 5) {
      setError(ar ? "الحد الأقصى 5 صور لكل رسالة." : "Maximum 5 photos per message.");
      return;
    }
    if (all.some((file) => !["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024 || file.size === 0)) {
      setError(ar ? "اختر صور JPG أو PNG أو WebP بحجم لا يتجاوز 5 ميغابايت لكل صورة." : "Choose JPG, PNG or WebP images up to 5 MB each.");
      return;
    }
    setError("");
    setSelectedPhotos(all);
  }

  const loadMessages = useCallback(async () => {
    const supabase = createClient();
    const { data, error: readError } = await supabase
      .from("chat_group_messages")
      .select("id, group_id, sender_id, body, created_at")
      .eq("group_id", groupId)
      .order("created_at", { ascending: true })
      .limit(500);
    if (readError) {
      setError(readError.message);
      return;
    }
    const loadedMessages = (data ?? []) as GroupMessage[];
    setMessages(loadedMessages);
    // Receipts are recorded by each recipient's own authenticated session.
    // A fetched message is delivered; it is read only when this tab is visible.
    const { data: receiptAuth } = await supabase.auth.getUser();
    if (receiptAuth.user && loadedMessages.length > 0) {
      const currentUser = receiptAuth.user.id;
      const messageIds = loadedMessages.map((message) => message.id);
      const { data: existing, error: receiptError } = await supabase
        .from("chat_group_message_receipts")
        .select("message_id, user_id, delivered_at, read_at")
        .in("message_id", messageIds);
      if (receiptError) {
        console.error("Load group receipts:", receiptError.message);
      } else {
        const existingRows = (existing ?? []) as MessageReceipt[];
        setReceipts(existingRows);
        const ownReceipts = new Map(existingRows.filter((r) => r.user_id === currentUser)
          .map((r) => [r.message_id, r]));
        const visible = document.visibilityState === "visible";
        const now = new Date().toISOString();
        const pending = loadedMessages.filter((m) => m.sender_id !== currentUser);
        const missing = pending.filter((m) => !ownReceipts.has(m.id));
        const unread = visible ? pending.filter((m) => {
          const r = ownReceipts.get(m.id);
          return r && !r.read_at;
        }) : [];
        if (missing.length) {
          const { error } = await supabase.from("chat_group_message_receipts").upsert(
            missing.map((m) => ({ message_id: m.id, user_id: currentUser,
              delivered_at: now, read_at: visible ? now : null })),
            { onConflict: "message_id,user_id", ignoreDuplicates: true }
          );
          if (error) console.error("Create group receipts:", error.message);
        }
        if (unread.length) {
          const { error } = await supabase.from("chat_group_message_receipts")
            .update({ read_at: now })
            .eq("user_id", currentUser)
            .in("message_id", unread.map((m) => m.id))
            .is("read_at", null);
          if (error) console.error("Mark message receipts read:", error.message);
        }
        if (missing.length || unread.length) {
          const { data: updated, error } = await supabase
            .from("chat_group_message_receipts")
            .select("message_id, user_id, delivered_at, read_at")
            .in("message_id", messageIds);
          if (!error) setReceipts((updated ?? []) as MessageReceipt[]);
        }
      }
    }
    // Mark the conversation read only while it is visible to the user.
    if (document.visibilityState === "visible") {
      const { data: auth } = await supabase.auth.getUser();
      if (auth.user) {
        const { error: markError } = await supabase.from("chat_group_read_states")
          .upsert({ group_id: groupId, user_id: auth.user.id, last_read_at: new Date().toISOString() },
            { onConflict: "group_id,user_id" });
        if (markError) console.error("Mark group read:", markError.message);
      }
    }
    void loadPhotos();
    void loadVoices();
  }, [groupId, loadPhotos, loadVoices]);

  const loadData = useCallback(async () => {
    const supabase = createClient();
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) {
      router.replace("/login");
      return;
    }
    const currentUserId = auth.user.id;
    setUserId(currentUserId);
    const { data: profile } = await supabase.from("profiles").select("locale").eq("id", currentUserId).maybeSingle();
    setLang(profile?.locale === "ar" ? "ar" : "en");

    const { data: groupData, error: groupError } = await supabase
      .from("chat_groups").select("id, name, description, created_by").eq("id", groupId).maybeSingle();
    if (groupError || !groupData) {
      setError(groupError?.message || "Group not found or access denied.");
      setLoading(false);
      return;
    }
    setGroup(groupData as Group);

    const { data: memberData, error: memberError } = await supabase
      .from("chat_group_members").select("user_id, role").eq("group_id", groupId);
    if (memberError) {
      setError(memberError.message);
      setLoading(false);
      return;
    }
    const memberRows = (memberData ?? []) as Member[];
    setMembers(memberRows);
    if (!memberRows.some((m) => m.user_id === currentUserId)) {
      setError("You are not a member of this group.");
      setLoading(false);
      return;
    }

    const { data: connectionData, error: connectionError } = await supabase
      .from("connections").select("requester_id, recipient_id")
      .eq("status", "accepted")
      .or(`requester_id.eq.${currentUserId},recipient_id.eq.${currentUserId}`);
    if (connectionError) setError(connectionError.message);
    const connectionRows = (connectionData ?? []) as Connection[];
    setConnections(connectionRows);

    const admin = memberRows.some((m) => m.user_id === currentUserId && m.role === "admin");
    if (admin) {
      const { data: inviteData, error: inviteError } = await supabase
        .from("chat_group_invitations").select("id, invited_user_id, status").eq("group_id", groupId);
      if (inviteError) setError(inviteError.message);
      setInvitations((inviteData ?? []) as Invitation[]);
    } else {
      setInvitations([]);
    }

    const connectedIds = connectionRows.map((c) => c.requester_id === currentUserId ? c.recipient_id : c.requester_id);
    const ids = Array.from(new Set([...memberRows.map((m) => m.user_id), ...connectedIds]));
    const pairs = await Promise.all(ids.map(async (id) => {
      if (id === currentUserId) return [id, "You"] as const;
      const { data, error: profileError } = await supabase.rpc("get_classmate_profile", { p_classmate_id: id });
      if (profileError) return [id, id.slice(0, 8)] as const;
      const row = (Array.isArray(data) ? data[0] : data) as ProfileResult | null;
      return [id, row?.display_name?.trim() || id.slice(0, 8)] as const;
    }));
    setNames(Object.fromEntries(pairs));
    await loadMessages();
    setLoading(false);
  }, [groupId, loadMessages, router]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!isMember) return;
    const supabase = createClient();
    const channel = supabase.channel(`group-chat-${groupId}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "chat_group_messages", filter: `group_id=eq.${groupId}`,
      }, () => { void loadMessages(); })
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR") console.error("Group chat realtime subscription failed");
      });
    // Fallback for projects where this table is not yet in the realtime publication.
    
const poll = window.setInterval(() => {
  if (document.visibilityState === "visible") {
    void loadMessages();
  }
}, 30000);

    return () => { window.clearInterval(poll); void supabase.removeChannel(channel); };
  }, [groupId, isMember, loadMessages]);

  // Scroll only the conversation panel, never the browser page.
  // Observe the inner content so photo/audio layout changes are included.
  useLayoutEffect(() => {
    const container = messagesContainerRef.current;
    const content = messagesContentRef.current;
    if (!container || !content) return;

    const scrollToLatest = () => {
      container.scrollTop = container.scrollHeight;
    };

    scrollToLatest();
    const frame = requestAnimationFrame(scrollToLatest);
    const observer = new ResizeObserver(scrollToLatest);
    observer.observe(content);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [loading, messages.length, photosByMessage, voiceByMessage]);

  const connectedClassmateIds = Array.from(new Set(connections.map((c) =>
    c.requester_id === userId ? c.recipient_id : c.requester_id
  ))).filter((id) => id !== userId &&
    !members.some((m) => m.user_id === id) &&
    !invitations.some((i) => i.invited_user_id === id && i.status === "pending"));

  async function inviteClassmate() {
    if (!selectedClassmate || busy || !isAdmin) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const supabase = createClient();
      const { error: inviteError } = await supabase.rpc("invite_connected_classmate", {
        p_group_id: groupId, p_classmate_id: selectedClassmate,
      });
      if (inviteError) { setError(inviteError.message); return; }
      setNotice(ar ? "تم إرسال الدعوة بنجاح." : "Invitation sent successfully.");
      setSelectedClassmate("");
      await loadData();
    } finally { setBusy(false); }
  }

  async function startRecording() {
    if (sending || recording || recordedVoice || !isMember) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError(ar ? "المتصفح لا يدعم تسجيل الصوت." : "Voice recording is not supported in this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = ["audio/webm", "audio/mp4", "audio/ogg", "audio/mpeg"]
        .find((type) => MediaRecorder.isTypeSupported(type));
      if (!mime) {
        stream.getTracks().forEach((track) => track.stop());
        throw new Error("No supported audio recording format is available.");
      }
      const recorder = new MediaRecorder(stream, { mimeType: mime });
      const chunks: Blob[] = [];
      discardRef.current = false;
      recorderRef.current = recorder;
      streamRef.current = stream;
      recordStartedRef.current = Date.now();
      setRecordingSeconds(0);
      setError("");
      recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      recorder.onerror = () => setError(ar ? "حدث خطأ أثناء التسجيل." : "Recording error.");
      recorder.onstop = () => {
        if (recordTimerRef.current) clearInterval(recordTimerRef.current);
        recordTimerRef.current = null;
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        recorderRef.current = null;
        setRecording(false);
        if (discardRef.current) return;
        const duration = Math.min(120, Math.max(1, Math.ceil((Date.now() - recordStartedRef.current) / 1000)));
        const audio = new Blob(chunks, { type: mime });
        if (!audio.size || audio.size > 10 * 1024 * 1024) {
          setError(ar ? "التسجيل فارغ أو أكبر من 10 ميغابايت." : "Recording is empty or exceeds 10 MB.");
          return;
        }
        setVoiceDuration(duration);
        setRecordedVoice(audio);
      };
      recorder.start(250);
      setRecording(true);
      recordTimerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - recordStartedRef.current) / 1000);
        setRecordingSeconds(Math.min(120, elapsed));
        if (elapsed >= 120 && recorder.state === "recording") recorder.stop();
      }, 250);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Microphone access failed.");
    }
  }

  function stopRecording(discard = false) {
    discardRef.current = discard;
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    if (discard) { setRecordedVoice(null); setVoiceDuration(0); }
  }

  async function sendVoice() {
    if (!recordedVoice || recording || sending || !isMember) return;
    const audio = recordedVoice;
    setSending(true);
    setError("");
    setUploadStatus(ar ? "جارٍ إرسال الرسالة الصوتية..." : "Sending voice message...");
    try {
      const supabase = createClient();
      const { data, error: messageError } = await supabase.from("chat_group_messages")
        .insert({ group_id: groupId, sender_id: userId, body: "🎤 Voice message" })
        .select("id, group_id, sender_id, body, created_at").single();
      if (messageError || !data) throw new Error(messageError?.message || "Could not create voice message.");
      setMessages((previous) => previous.some((m) => m.id === data.id) ? previous : [...previous, data as GroupMessage]);
      const ext = audio.type === "audio/mp4" ? "m4a" : audio.type === "audio/ogg" ? "ogg" : audio.type === "audio/mpeg" ? "mp3" : "webm";
      const path = `${data.id}/${userId}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("group-chat-voice")
        .upload(path, audio, { contentType: audio.type, upsert: false });
      if (uploadError) throw new Error(uploadError.message);
      const { error: metadataError } = await supabase.from("chat_group_voice_messages")
        .insert({ message_id: data.id, storage_path: path, content_type: audio.type, duration_seconds: voiceDuration });
      if (metadataError) throw new Error(metadataError.message);
      setRecordedVoice(null);
      setVoiceDuration(0);
      await loadVoices();
      await loadMessages();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send voice message.");
    } finally {
      setSending(false);
      setUploadStatus("");
    }
  }

  async function sendMessage() {
    const body = draft.trim();
    const files = [...selectedPhotos];
    if ((!body && files.length === 0) || body.length > 5000 || !isMember || sending || recording || recordedVoice) return;
    setSending(true); setError(""); setUploadStatus("");
    try {
      const supabase = createClient();
      const { data, error: sendError } = await supabase.from("chat_group_messages")
        .insert({ group_id: groupId, sender_id: userId, body: body || "📷 Photos" })
        .select("id, group_id, sender_id, body, created_at").single();
      if (sendError || !data) { setError(sendError?.message || "Message creation failed"); return; }
      setMessages((previous) => previous.some((m) => m.id === data.id)
        ? previous : [...previous, data as GroupMessage]);
      setDraft("");
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setUploadStatus(ar ? `جارٍ رفع الصورة ${i + 1} من ${files.length}` : `Uploading photo ${i + 1} of ${files.length}`);
        const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
        const path = `${data.id}/${userId}/${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await supabase.storage.from("group-chat-photos")
          .upload(path, file, { contentType: file.type, upsert: false });
        if (uploadError) {
          setError(`${ar ? "فشل رفع الصورة" : "Photo upload failed"} ${i + 1}: ${uploadError.message}`);
          setSelectedPhotos(files.slice(i));
          return;
        }
        const { error: metadataError } = await supabase.from("chat_group_attachments")
          .insert({ message_id: data.id, storage_path: path, content_type: file.type, file_size: file.size });
        if (metadataError) {
          setError(`${ar ? "فشل حفظ مرفق الصورة" : "Photo attachment failed"} ${i + 1}: ${metadataError.message}`);
          setSelectedPhotos(files.slice(i + 1));
          return;
        }
      }
      setSelectedPhotos([]);
      if (photoInputRef.current) photoInputRef.current.value = "";
      await loadPhotos();
      await loadMessages();
    } finally { setSending(false); setUploadStatus(""); }
  }

  return (
    <main dir={ar ? "rtl" : "ltr"} style={{ minHeight: "100vh", background: "#f8f5f0", padding: "28px 16px", fontFamily: "Arial, sans-serif" }}>
      <div style={{ maxWidth: 850, margin: "auto" }}>
        <Link href="/dashboard/groups" style={{ color: burgundy, fontWeight: 700 }}>
          {ar ? "العودة إلى المجموعات" : "← Back to Groups"}
        </Link>
        {error && <p role="alert" style={{ color: "#b42318" }}>{error}</p>}
        {notice && <p role="status" style={{ color: "#167347" }}>{notice}</p>}
        {loading ? <p>{ar ? "جارٍ التحميل..." : "Loading..."}</p> : !group || !isMember ? (
          <p>{ar ? "المجموعة غير متاحة." : "Group unavailable."}</p>
        ) : <>
          <h1 style={{ color: burgundy, marginBottom: 5 }}>{group.name}</h1>
          {group.description && <p style={{ marginTop: 0 }}>{group.description}</p>}
<Link
  href={`/dashboard/groups/${encodeURIComponent(groupId)}/members`}
  style={{
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    background: "#873b50",
    color: "#ffffff",
    padding: "10px 16px",
    borderRadius: 9,
    textDecoration: "none",
    fontWeight: 700,
    marginBottom: 16,
  }}
>
  {ar ? "عرض الأعضاء" : "View Members"}
</Link>
{isAdmin && (
  <Link
    href={`/dashboard/groups/${encodeURIComponent(groupId)}/settings`}
    style={{
      display: "inline-block",
      background: "#ffffff",
      color: burgundy,
      border: `1px solid ${burgundy}`,
      borderRadius: 9,
      padding: "10px 14px",
      textDecoration: "none",
      fontWeight: 700,
      marginInlineStart: 10,
      marginTop: 10,
    }}
  >
    {ar ? "إعدادات المجموعة" : "Group Settings"}
  </Link>
)}
          <section style={panel}>
            <h2>{ar ? "محادثة المجموعة" : "Group Conversation"}</h2>
            <div ref={messagesContainerRef} aria-label={ar ? "رسائل المجموعة" : "Group messages"}
              style={{ height: 420, overflowY: "auto", overflowAnchor: "none", border: "1px solid #eee5e8", borderRadius: 12, padding: 14, background: "#fcfafb" }}>
              <div ref={messagesContentRef}>
              {messages.length === 0 && <p style={{ color: "#777" }}>
                {ar ? "لا توجد رسائل بعد. ابدأ المحادثة!" : "No messages yet. Start the conversation!"}
              </p>}
              {messages.map((message) => {
                const mine = message.sender_id === userId;
                return <div key={message.id} style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start", marginBottom: 12 }}>
                  <div style={{ background: mine ? burgundy : "#f0e8ec", color: mine ? "white" : "#292524", borderRadius: 12, padding: "10px 13px", maxWidth: "85%", overflowWrap: "anywhere" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 5 }}>
                      {mine ? (ar ? "أنت" : "You") : (names[message.sender_id] || message.sender_id.slice(0, 8))}
                    </div>
                     {(message.body !== "🎤 Voice message" || !voiceByMessage[message.id]) &&
                       <div style={{ whiteSpace: "pre-wrap" }}>{message.body}</div>}
                     {voiceByMessage[message.id] && <div style={{ marginTop: 8 }}>
                       <audio controls preload="none" src={voiceByMessage[message.id].url}
                         style={{ width: "100%", maxWidth: 280 }} />
                       <div style={{ fontSize: 11 }}>{ar ? "رسالة صوتية" : "Voice message"} · {voiceByMessage[message.id].duration}s</div>
                     </div>}
                    {(photosByMessage[message.id] ?? []).length > 0 && (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 8, marginTop: 10 }}>
                        {photosByMessage[message.id].map((photo) => (
                          <button key={photo.id} type="button" onClick={() => setExpandedPhoto(photo.url)}
                            aria-label={ar ? "فتح الصورة" : "Open photo"}
                            style={{ padding: 0, border: 0, background: "transparent", cursor: "pointer" }}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={photo.url} alt={ar ? "صورة المجموعة" : "Group attachment"}
                              style={{ width: "100%", height: 120, objectFit: "cover", borderRadius: 8 }} />
                          </button>
                        ))}
                      </div>
                    )}
                    <time dateTime={message.created_at} style={{ display: "block", fontSize: 11, opacity: 0.8, marginTop: 7 }}>
                      {new Date(message.created_at).toLocaleString(ar ? "ar-JO" : "en-GB")}
                    </time>
                    {mine && (() => {
                      const recipients = members.filter((m) => m.user_id !== userId);
                      const relevant = receipts.filter((r) => r.message_id === message.id);
                      const delivered = relevant.filter((r) => recipients.some((m) => m.user_id === r.user_id) && !!r.delivered_at);
                      const read = relevant.filter((r) => recipients.some((m) => m.user_id === r.user_id) && !!r.read_at);
                      const allRead = recipients.length > 0 && read.length === recipients.length;
                      const allDelivered = recipients.length > 0 && delivered.length === recipients.length;
                      const label = allRead ? (ar ? "قرأها الجميع" : "Read by all")
                        : allDelivered ? (ar ? "وصلت للجميع" : "Delivered to all")
                        : (ar ? "تم الإرسال" : "Sent");
                      const symbol = allRead || allDelivered ? "✓✓" : "✓";
                      return <button type="button" title={ar ? "عرض تفاصيل الرسالة" : "View message info"} aria-label={ar ? "عرض تفاصيل قراءة الرسالة" : "View message read details"}
                        onClick={() => setInfoMessageId(message.id)}
                        style={{ display: "block", fontSize: 11, marginTop: 4, opacity: 0.95, color: "inherit", background: "transparent", border: 0, padding: 0, cursor: "pointer", textAlign: "start" }}>
                        <span style={{ color: allRead ? "#9de8ff" : "inherit", fontWeight: 700 }}>{symbol}</span>
                        {" "}{label}{recipients.length > 0 && read.length > 0 && !allRead ? ` · ${read.length}/${recipients.length} ${ar ? "قرأوا" : "read"}` : ""}
                      </button>;
                    })()}
                  </div>
                </div>;
              })}
              </div>
            </div>
            <input ref={photoInputRef} type="file" accept="image/jpeg,image/png,image/webp"
              multiple style={{ display: "none" }}
              onChange={(e) => { choosePhotos(e.target.files); e.target.value = ""; }} />
            {previews.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 12 }}>
                {previews.map((url, index) => (
                  <div key={url} style={{ position: "relative" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={`Selected photo ${index + 1}`}
                      style={{ width: 90, height: 90, objectFit: "cover", borderRadius: 8 }} />
                    <button type="button" disabled={sending} aria-label={ar ? "إزالة الصورة" : "Remove photo"}
                      onClick={() => setSelectedPhotos((prev) => prev.filter((_, i) => i !== index))}
                      style={{ position: "absolute", top: -7, right: -7, borderRadius: "50%", border: 0,
                        background: burgundy, color: "white", width: 24, height: 24, cursor: "pointer" }}>×</button>
                  </div>
                ))}
              </div>
            )}
             {recording && <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
               <strong style={{ color: burgundy }}>🔴 {ar ? "جارٍ التسجيل" : "Recording"} {recordingSeconds}s / 120s</strong>
               <button type="button" onClick={() => stopRecording(false)}>{ar ? "إيقاف" : "Stop"}</button>
               <button type="button" onClick={() => stopRecording(true)}>{ar ? "إلغاء" : "Cancel"}</button>
             </div>}
             {recordedVoice && !recording && <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginTop: 12 }}>
               {voicePreviewUrl && (
                 <audio
                   controls
                   src={voicePreviewUrl}
                   style={{ maxWidth: "100%" }}
                 />
               )}
               <span>{voiceDuration}s</span>
               <button type="button" disabled={sending} onClick={() => void sendVoice()}
                 style={{ background: burgundy, color: "white", border: 0, borderRadius: 8, padding: "10px 14px" }}>
                 {ar ? "إرسال الصوت" : "Send voice"}
               </button>
               <button type="button" disabled={sending} onClick={() => { setRecordedVoice(null); setVoiceDuration(0); }}>
                 {ar ? "حذف" : "Discard"}
               </button>
             </div>}
             {uploadStatus && <p role="status" style={{ color: burgundy }}>{uploadStatus}</p>}
            <div style={{ display: "flex", gap: 10, marginTop: 12, alignItems: "stretch" }}>
              <button type="button" disabled={sending || recording || !!recordedVoice || selectedPhotos.length >= 5}
                onClick={() => photoInputRef.current?.click()}
                aria-label={ar ? "إضافة صور" : "Add photos"}
                style={{ border: "1px solid #d9c8cf", background: "white", color: burgundy,
                  borderRadius: 10, padding: "12px 16px", cursor: "pointer", fontSize: 22 }}>📷</button>
               <button type="button" disabled={sending || recording || !!recordedVoice}
                 onClick={() => void startRecording()}
                 aria-label={ar ? "تسجيل رسالة صوتية" : "Record voice message"}
                 style={{ border: "1px solid #d9c8cf", background: "white", color: burgundy,
                   borderRadius: 10, padding: "12px 16px", cursor: "pointer", fontSize: 22 }}>🎤</button>
               <textarea value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={5000} rows={2}
                placeholder={ar ? "اكتب رسالة للمجموعة..." : "Write a message to the group..."}
                style={{ flex: 1, minWidth: 0, padding: 12, borderRadius: 10, border: "1px solid #ddd", fontFamily: "inherit", resize: "vertical" }} />
              <button type="button" onClick={() => void sendMessage()} disabled={sending || recording || !!recordedVoice || (!draft.trim() && selectedPhotos.length === 0)}
                style={{ background: burgundy, color: "white", border: 0, borderRadius: 10, padding: "12px 18px", fontWeight: 700, cursor: "pointer" }}>
                {sending ? "..." : ar ? "إرسال" : "Send"}
              </button>
            </div>
          </section>

          <section style={panel}>
            <h2>{ar ? "أعضاء المجموعة" : "Group Members"}</h2>
            {members.map((member) => <div key={member.user_id} style={{ padding: 12, borderBottom: "1px solid #eee" }}>
              <strong>{member.user_id === userId ? (ar ? "أنت" : "You") : (names[member.user_id] || member.user_id.slice(0, 8))}</strong>
              {" — "}{member.role === "admin" ? (ar ? "مشرف" : "Admin") : (ar ? "عضو" : "Member")}
            </div>)}
          </section>

          {isAdmin && <section style={panel}>
            <h2>{ar ? "دعوة زميل إلى المجموعة" : "Invite a Classmate"}</h2>
            <select value={selectedClassmate} onChange={(e) => setSelectedClassmate(e.target.value)}
              style={{ width: "100%", padding: 12, borderRadius: 8, border: "1px solid #ddd", marginBottom: 12 }}>
              <option value="">{ar ? "اختر زميلاً متصلاً" : "Select a connected classmate"}</option>
              {connectedClassmateIds.map((id) => <option key={id} value={id}>{names[id] || id.slice(0, 8)}</option>)}
            </select>
            <button type="button" onClick={() => void inviteClassmate()} disabled={busy || !selectedClassmate}
              style={{ background: burgundy, color: "white", border: 0, borderRadius: 8, padding: "12px 22px", cursor: "pointer" }}>
              {ar ? "إرسال الدعوة" : "Send Invitation"}
            </button>
          </section>}

          {isAdmin && <section style={panel}>
            <h2>{ar ? "دعوات المجموعة" : "Group Invitations"}</h2>
            {invitations.length === 0 ? <p>{ar ? "لا توجد دعوات." : "No invitations yet."}</p> :
              invitations.map((invitation) => <div key={invitation.id} style={{ padding: 12, borderBottom: "1px solid #eee" }}>
                {names[invitation.invited_user_id] || invitation.invited_user_id.slice(0, 8)}{" — "}{invitation.status}
              </div>)}
          </section>}
        </>}
        {infoMessageId && (() => {
          const selectedMessage = messages.find((message) => message.id === infoMessageId);
          if (!selectedMessage || selectedMessage.sender_id !== userId) return null;
          const recipients = members.filter((member) => member.user_id !== userId);
          const receiptMap = new Map(receipts.filter((receipt) => receipt.message_id === infoMessageId)
            .map((receipt) => [receipt.user_id, receipt]));
          const formatTime = (value: string) => new Date(value).toLocaleString(ar ? "ar-JO" : "en-GB");
          const read = recipients.filter((member) => !!receiptMap.get(member.user_id)?.read_at);
          const delivered = recipients.filter((member) => !receiptMap.get(member.user_id)?.read_at && !!receiptMap.get(member.user_id)?.delivered_at);
          const pending = recipients.filter((member) => !receiptMap.get(member.user_id)?.delivered_at && !receiptMap.get(member.user_id)?.read_at);
          const displayName = (member: Member) => names[member.user_id] || member.user_id.slice(0, 8);
          return <div role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setInfoMessageId(null); }}
            style={{ position: "fixed", inset: 0, zIndex: 1100, background: "rgba(0,0,0,.55)", display: "flex", justifyContent: "center", alignItems: "center", padding: 16 }}>
            <section role="dialog" aria-modal="true" aria-label={ar ? "معلومات الرسالة" : "Message Info"}
              dir={ar ? "rtl" : "ltr"} style={{ width: "100%", maxWidth: 480, maxHeight: "85vh", overflowY: "auto", background: "white", borderRadius: 14, padding: 22, color: "#292524" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <h2 style={{ color: burgundy, margin: 0 }}>{ar ? "معلومات الرسالة" : "Message Info"}</h2>
                <button type="button" onClick={() => setInfoMessageId(null)} aria-label={ar ? "إغلاق" : "Close"}
                  style={{ border: 0, background: "transparent", fontSize: 26, cursor: "pointer" }}>×</button>
              </div>
              <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", background: "#f8f5f0", borderRadius: 9, padding: 12, marginBottom: 4 }}>
                {selectedMessage.body}
              </p>
              <p style={{ fontSize: 12, color: "#776a70", marginTop: 4 }}>{ar ? "أُرسلت في" : "Sent"}: {formatTime(selectedMessage.created_at)}</p>
              {recipients.length === 0 && <p>{ar ? "لا يوجد مستلمون آخرون حالياً." : "No other current group members."}</p>}
              {[
                { title: ar ? "تمت القراءة" : "Read by", rows: read, key: "read_at" as const },
                { title: ar ? "تم التسليم ولم تُقرأ" : "Delivered, not yet read", rows: delivered, key: "delivered_at" as const },
                { title: ar ? "لم يتم تأكيد التسليم" : "Not yet acknowledged", rows: pending, key: null },
              ].map((section) => <div key={section.title} style={{ marginTop: 18 }}>
                <h3 style={{ fontSize: 15, color: burgundy, marginBottom: 8 }}>{section.title} ({section.rows.length})</h3>
                {section.rows.length === 0 ? <p style={{ color: "#776a70", fontSize: 13, margin: 0 }}>{ar ? "لا يوجد" : "None"}</p> :
                  section.rows.map((member) => {
                    const receipt = receiptMap.get(member.user_id);
                    const timestamp = section.key ? receipt?.[section.key] : null;
                    return <div key={member.user_id} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "9px 0", borderBottom: "1px solid #eee5e8" }}>
                      <strong>{displayName(member)}</strong>
                      {timestamp && <span style={{ fontSize: 12, color: "#776a70" }}>{formatTime(timestamp)}</span>}
                    </div>;
                  })}
              </div>)}
              <p style={{ fontSize: 12, color: "#776a70", marginTop: 18 }}>
                {ar ? "تعرض القائمة الأعضاء الحاليين. التأكيدات تعتمد على تطبيق المستلم ولا تثبت أن الشخص شاهد المحتوى بنفسه." : "Shows current group members. App acknowledgements do not guarantee a person personally viewed the content."}
              </p>
            </section>
          </div>;
        })()}
        {expandedPhoto && <div role="dialog" aria-modal="true" aria-label={ar ? "عرض الصورة" : "Photo viewer"}
          onClick={() => setExpandedPhoto(null)}
          style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,.88)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <button type="button" onClick={() => setExpandedPhoto(null)} aria-label={ar ? "إغلاق" : "Close"}
            style={{ position: "absolute", top: 18, right: 24, color: "white", background: "transparent", border: 0, fontSize: 32, cursor: "pointer" }}>×</button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={expandedPhoto} alt={ar ? "الصورة بالحجم الكامل" : "Expanded group photo"}
            onClick={(e) => e.stopPropagation()} style={{ maxWidth: "95vw", maxHeight: "90vh", objectFit: "contain" }} />
        </div>}
      </div>
    </main>
  );
}
