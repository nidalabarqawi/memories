"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Language = "en" | "ar";

type Message = {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  is_read: boolean;
  created_at: string;
};

type PhotoAttachment = { message_id: string; storage_path: string };

type PhotoView = { url: string; path: string };
type VoiceAttachment = { message_id: string; storage_path: string; duration_seconds: number };
type VoiceView = { url: string; path: string; duration: number };

type Connection = {
  requester_id: string;
  recipient_id: string;
};

type ProfileRow = {
  display_name: string | null;
};

export default function PrivateChatPage() {
  const router = useRouter();
  const params = useParams<{ classmateId: string }>();
  const classmateId = params.classmateId;

  const [lang, setLang] = useState<Language>("en");
  const [userId, setUserId] = useState("");
  const [classmateName, setClassmateName] = useState("Classmate");
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [selectedPhotos, setSelectedPhotos] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [photoUrls, setPhotoUrls] = useState<Record<string, PhotoView[]>>({});
  const photoUrlsRef = useRef<Record<string, PhotoView[]>>({});
  const [uploadProgress, setUploadProgress] = useState("");
  const [voiceUrls, setVoiceUrls] = useState<Record<string, VoiceView>>({});
  const voiceUrlsRef = useRef<Record<string, VoiceView>>({});
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordedVoice, setRecordedVoice] = useState<Blob | null>(null);
  const [voicePreviewUrl, setVoicePreviewUrl] = useState<string | null>(null);
  const [voiceDuration, setVoiceDuration] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recordingStartRef = useRef(0);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelRecordingRef = useRef(false);
  const [expandedPhoto, setExpandedPhoto] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [savingLanguage, setSavingLanguage] = useState(false);
  const [error, setError] = useState("");

  const ar = lang === "ar";
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const urls = selectedPhotos.map((photo) => URL.createObjectURL(photo));
    setPreviewUrls(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [selectedPhotos]);

  useEffect(() => {
    if (!recordedVoice) { setVoicePreviewUrl(null); return; }
    const url = URL.createObjectURL(recordedVoice);
    setVoicePreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [recordedVoice]);

  useEffect(() => () => {
    cancelRecordingRef.current = true;
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  useEffect(() => {
    const area = scrollRef.current;
    if (area) area.scrollTop = area.scrollHeight;
  }, [messages]);

  useEffect(() => {
    let active = true;
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let photoPoll: ReturnType<typeof setInterval> | null = null;
    let photosBusy = false;
    let voiceBusy = false;

    async function refreshVoices() {
      if (!active || voiceBusy) return;
      voiceBusy = true;
      try {
        const { data: attachments, error: attachmentError } = await supabase
          .from("message_voice_attachments")
          .select("message_id, storage_path, duration_seconds");
        if (attachmentError) {
          console.error("Chat voice metadata:", attachmentError.message);
          return;
        }
        const next: Record<string, VoiceView> = {};
        await Promise.all(((attachments ?? []) as VoiceAttachment[]).map(async (item) => {
          const cached = voiceUrlsRef.current[item.message_id];
          if (cached?.path === item.storage_path) {
            next[item.message_id] = cached;
            return;
          }
          const { data, error } = await supabase.storage.from("chat-voice")
            .createSignedUrl(item.storage_path, 3600);
          if (!error && data?.signedUrl) {
            next[item.message_id] = { url: data.signedUrl, path: item.storage_path, duration: item.duration_seconds };
          }
        }));
        if (active) {
          voiceUrlsRef.current = next;
          setVoiceUrls(next);
        }
      } finally { voiceBusy = false; }
    }

    async function refreshPhotos() {
      if (!active || photosBusy) return;
      photosBusy = true;
      try {
        const { data: attachments, error: attachmentError } = await supabase
          .from("message_attachments")
          .select("message_id, storage_path");
        if (attachmentError) {
          console.error("Chat photo metadata:", attachmentError.message);
          return;
        }
        const rows = (attachments ?? []) as PhotoAttachment[];
        const next: Record<string, PhotoView[]> = {};
        await Promise.all(rows.map(async (item) => {
          const cached = photoUrlsRef.current[item.message_id]?.find(
            (photo) => photo.path === item.storage_path
          );
          let view = cached;
          if (!view) {
            const { data, error } = await supabase.storage.from("chat-photos")
              .createSignedUrl(item.storage_path, 3600);
            if (!error && data?.signedUrl) {
              view = { url: data.signedUrl, path: item.storage_path };
            }
          }
          if (view) (next[item.message_id] ??= []).push(view);
        }));
        if (active) {
          photoUrlsRef.current = next;
          setPhotoUrls(next);
        }
      } finally {
        photosBusy = false;
      }
    }

    async function initialize() {
      const { data: auth, error: authError } =
        await supabase.auth.getUser();

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

      if (!classmateId || classmateId === currentUserId) {
        setError("Invalid classmate.");
        setLoading(false);
        return;
      }

      const { data: connection, error: connectionError } =
        await supabase
          .from("connections")
          .select("requester_id, recipient_id")
          .eq("status", "accepted")
          .or(
            `and(requester_id.eq.${currentUserId},recipient_id.eq.${classmateId}),and(requester_id.eq.${classmateId},recipient_id.eq.${currentUserId})`
          )
          .limit(1)
          .maybeSingle();

      if (!active) return;

      if (connectionError || !connection) {
        setError(
          "You can only message classmates you're connected with."
        );
        setLoading(false);
        return;
      }

      setConnected(true);

      const { data: classmate } = await supabase.rpc(
        "get_classmate_profile",
        { p_classmate_id: classmateId }
      );

      const row = Array.isArray(classmate)
        ? (classmate[0] as ProfileRow | undefined)
        : (classmate as ProfileRow | null);

      if (!active) return;

      setClassmateName(row?.display_name || "Classmate");

      async function refreshConversation() {
        const { data: history, error: historyError } = await supabase
          .from("messages")
          .select("id, sender_id, recipient_id, body, is_read, created_at")
          .or(
            `and(sender_id.eq.${currentUserId},recipient_id.eq.${classmateId}),and(sender_id.eq.${classmateId},recipient_id.eq.${currentUserId})`
          )
          .order("created_at", { ascending: true });

        if (!active) return;
        if (historyError) {
          setError(historyError.message);
          return;
        }

        const rows = (history ?? []) as Message[];
        setMessages(rows);
        void refreshPhotos();
        void refreshVoices();

        const unreadIds = rows
          .filter((message) =>
            message.recipient_id === currentUserId && !message.is_read
          )
          .map((message) => message.id);

        if (unreadIds.length > 0) {
          const { error: readError } = await supabase
            .from("messages")
            .update({ is_read: true })
            .in("id", unreadIds)
            .eq("recipient_id", currentUserId);
          if (readError && active) {
            console.error("Could not mark messages as read:", readError.message);
          }
        }
      }

      // Subscribe before loading history so messages sent during setup
      // are not missed. Refreshing from the database also deduplicates rows.
      channel = supabase
        .channel(`private-chat-${currentUserId}-${classmateId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter: `recipient_id=eq.${currentUserId}`,
          },
          (payload) => {
            const incoming = payload.new as Message;
            if (incoming.sender_id === classmateId) {
              void refreshConversation();
            }
          }
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "messages",
            filter: `sender_id=eq.${currentUserId}`,
          },
          (payload) => {
            const changed = payload.new as Message;
            if (changed.recipient_id === classmateId) {
              setMessages((current) => current.map((message) =>
                message.id === changed.id ? changed : message
              ));
            }
          }
        )
        .subscribe((status) => {
          if (status === "SUBSCRIBED") void refreshConversation();
          if (status === "CHANNEL_ERROR") {
            console.error("Private chat Realtime channel error");
          }
        });

      await refreshConversation();
      // Attachment metadata is written after the message, so periodically
      // check for newly attached photos without requiring another migration.
      photoPoll = setInterval(() => { void refreshPhotos(); void refreshVoices(); }, 5000);
      if (active) setLoading(false);
    }

    void initialize();

    return () => {
      active = false;
      if (photoPoll) clearInterval(photoPoll);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [classmateId, router]);

  async function changeLanguage(next: Language) {
    if (savingLanguage || next === lang) return;
    const previous = lang;
    setLang(next);
    setSavingLanguage(true);
    const supabase = createClient();
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) {
      setLang(previous);
      setError("Please sign in again to save your language preference.");
      setSavingLanguage(false);
      return;
    }
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ locale: next })
      .eq("id", auth.user.id);
    if (updateError) {
      setLang(previous);
      setError(updateError.message);
    } else {
      setError("");
    }
    setSavingLanguage(false);
  }

  function choosePhotos(files: FileList | null) {
    if (!files) return;
    const incoming = Array.from(files);
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (incoming.some((file) => !allowed.includes(file.type))) {
      setError(ar ? "اختر صور JPG أو PNG أو WebP فقط." : "Choose JPG, PNG, or WebP photos only.");
      return;
    }
    if (incoming.some((file) => file.size > 5 * 1024 * 1024)) {
      setError(ar ? "الحد الأقصى لكل صورة 5 ميغابايت." : "Each photo must be 5 MB or less.");
      return;
    }
    if (selectedPhotos.length + incoming.length > 5) {
      setError(ar ? "يمكن إرفاق خمس صور كحد أقصى." : "You can attach up to five photos.");
      return;
    }
    setSelectedPhotos((current) => [...current, ...incoming]);
    setError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }


  async function startRecording() {
    if (sending || recording || !connected || recordedVoice) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError(ar ? "المتصفح لا يدعم تسجيل الصوت." : "Your browser does not support voice recording.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const types = ["audio/webm", "audio/mp4", "audio/ogg", "audio/mpeg"];
      const mime = types.find((type) => MediaRecorder.isTypeSupported(type));
      if (!mime) {
        stream.getTracks().forEach((track) => track.stop());
        throw new Error("This browser cannot record a supported audio format.");
      }
      const recorder = new MediaRecorder(stream, { mimeType: mime });
      const chunks: Blob[] = [];
      cancelRecordingRef.current = false;
      recorderRef.current = recorder;
      streamRef.current = stream;
      recordingStartRef.current = Date.now();
      setRecordingSeconds(0);
      setError("");
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      recorder.onerror = () => {
        setError(ar ? "حدث خطأ أثناء التسجيل." : "An error occurred while recording.");
      };
      recorder.onstop = () => {
        if (recordTimerRef.current) clearInterval(recordTimerRef.current);
        recordTimerRef.current = null;
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        recorderRef.current = null;
        setRecording(false);
        if (cancelRecordingRef.current) return;
        const duration = Math.min(120, Math.max(1, Math.ceil((Date.now() - recordingStartRef.current) / 1000)));
        const blob = new Blob(chunks, { type: mime });
        if (!blob.size) { setError("No audio was recorded."); return; }
        if (blob.size > 10 * 1024 * 1024) {
          setError(ar ? "التسجيل أكبر من 10 ميغابايت." : "Recording exceeds 10 MB.");
          return;
        }
        setVoiceDuration(duration);
        setRecordedVoice(blob);
      };
      recorder.start(250);
      setRecording(true);
      recordTimerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - recordingStartRef.current) / 1000);
        setRecordingSeconds(Math.min(120, elapsed));
        if (elapsed >= 120 && recorder.state === "recording") recorder.stop();
      }, 250);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Microphone access failed.");
    }
  }

  function stopRecording(discard = false) {
    cancelRecordingRef.current = discard;
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    if (discard) {
      setRecordedVoice(null);
      setVoiceDuration(0);
    }
  }

  async function sendVoice() {
    if (!connected || !userId || sending || !recordedVoice || recording) return;
    const audio = recordedVoice;
    const duration = voiceDuration;
    setSending(true);
    setError("");
    setUploadProgress(ar ? "جارٍ إرسال الرسالة الصوتية..." : "Sending voice message...");
    try {
      const supabase = createClient();
      const { data, error: sendError } = await supabase.from("messages")
        .insert({ sender_id: userId, recipient_id: classmateId, body: "🎤 Voice message" })
        .select("id, sender_id, recipient_id, body, is_read, created_at").single();
      if (sendError || !data) throw new Error(sendError?.message || "Message could not be saved.");
      setMessages((current) => current.some((m) => m.id === data.id) ? current : [...current, data]);
      const ext = audio.type === "audio/mp4" ? "m4a" : audio.type === "audio/ogg" ? "ogg" : audio.type === "audio/mpeg" ? "mp3" : "webm";
      const path = `${data.id}/${userId}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("chat-voice")
        .upload(path, audio, { contentType: audio.type, upsert: false });
      if (uploadError) throw new Error(uploadError.message);
      const { error: metadataError } = await supabase.from("message_voice_attachments")
        .insert({ message_id: data.id, storage_path: path, content_type: audio.type, file_size: audio.size, duration_seconds: duration });
      if (metadataError) throw new Error(metadataError.message);
      const { data: signed, error: signError } = await supabase.storage.from("chat-voice")
        .createSignedUrl(path, 3600);
      if (signError || !signed?.signedUrl) throw new Error("Voice uploaded, but could not be displayed.");
      const next = { ...voiceUrlsRef.current, [data.id]: { url: signed.signedUrl, path, duration } };
      voiceUrlsRef.current = next;
      setVoiceUrls(next);
      setRecordedVoice(null);
      setVoiceDuration(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send voice message.");
    } finally {
      setSending(false);
      setUploadProgress("");
    }
  }

  async function sendMessage() {
    if (!connected || !userId || sending || recording || recordedVoice) return;
    const body = draft.trim();
    const photos = [...selectedPhotos];
    if ((!body && photos.length === 0) || body.length > 5000) return;

    setSending(true);
    setError("");
    setUploadProgress("");
    try {
      const supabase = createClient();
      const { data, error: sendError } = await supabase
        .from("messages")
        .insert({ sender_id: userId, recipient_id: classmateId, body: body || "📷 Photo" })
        .select("id, sender_id, recipient_id, body, is_read, created_at")
        .single();
      if (sendError || !data) throw new Error(sendError?.message || "Message could not be saved.");

      setMessages((current) => current.some((m) => m.id === data.id) ? current : [...current, data]);
      setDraft("");
      setSelectedPhotos([]);
      if (photos.length === 0) return;

      const completed: PhotoView[] = [];
      for (let index = 0; index < photos.length; index++) {
        const photo = photos[index];
        setUploadProgress(ar
          ? `جارٍ رفع الصورة ${index + 1} من ${photos.length}`
          : `Uploading photo ${index + 1} of ${photos.length}`);
        const ext = photo.type === "image/png" ? "png" : photo.type === "image/webp" ? "webp" : "jpg";
        const path = `${data.id}/${userId}/${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await supabase.storage.from("chat-photos")
          .upload(path, photo, { contentType: photo.type, upsert: false });
        if (uploadError) throw new Error(`Photo ${index + 1}: ${uploadError.message}`);
        const { error: metadataError } = await supabase.from("message_attachments")
          .insert({ message_id: data.id, storage_path: path, content_type: photo.type, file_size: photo.size });
        if (metadataError) throw new Error(`Photo ${index + 1}: ${metadataError.message}`);
        const { data: signed, error: signError } = await supabase.storage.from("chat-photos")
          .createSignedUrl(path, 3600);
        if (signError || !signed?.signedUrl) throw new Error(`Photo ${index + 1}: Unable to display uploaded photo.`);
        completed.push({ path, url: signed.signedUrl });
        const next = { ...photoUrlsRef.current, [data.id]: [...completed] };
        photoUrlsRef.current = next;
        setPhotoUrls(next);
      }
      setSelectedPhotos([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the message.");
      // A message may already exist if an attachment failed.
      // Check the conversation before sending the same photos again.
    } finally {
      setSending(false);
      setUploadProgress("");
    }
  }

  return (
    <main
      dir={ar ? "rtl" : "ltr"}
      style={{
        minHeight: "100vh",
        background: "#f8f5f0",
        padding: "25px 14px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <Link
            href="/dashboard/messages"
            style={{ color: "#873b50", fontWeight: 700 }}
          >
            {ar ? "محادثاتي →" : "← My Conversations"}
          </Link>
          <button
            type="button"
            onClick={() => void changeLanguage(ar ? "en" : "ar")}
            disabled={savingLanguage}
            aria-label={ar ? "Switch to English" : "التبديل إلى العربية"}
            style={{
              background: "#fff", color: "#873b50", border: "1px solid #e3d6da",
              borderRadius: 9, padding: "10px 15px", cursor: savingLanguage ? "wait" : "pointer",
              fontWeight: 700,
            }}
          >
            {savingLanguage ? "..." : ar ? "English" : "العربية"}
          </button>
        </div>

        <h1 style={{ color: "#873b50" }}>
          {ar ? "محادثة مع " : "Chat with "}
          {classmateName}
        </h1>

        {error && (
          <p role="alert" style={{ color: "#b42318" }}>
            {error}
          </p>
        )}

        {loading ? (
          <p>{ar ? "جارٍ التحميل..." : "Loading..."}</p>
        ) : !connected ? (
          <p>
            {ar
              ? "يمكنك مراسلة زملائك المتصلين فقط."
              : "You can only message connected classmates."}
          </p>
        ) : (
          <section
            style={{
              background: "#fff",
              borderRadius: 16,
              border: "1px solid #eee5e8",
              overflow: "hidden",
            }}
          >
            <div
              ref={scrollRef}
              style={{
                minHeight: 350,
                maxHeight: 500,
                overflowY: "auto",
                padding: 20,
              }}
            >
              {messages.length === 0 ? (
                <p style={{ color: "#777" }}>
                  {ar
                    ? "لا توجد رسائل بعد. ابدأ المحادثة!"
                    : "No messages yet. Start the conversation!"}
                </p>
              ) : (
                messages.map((message) => {
                  const mine = message.sender_id === userId;

                  return (
                    <div
                      key={message.id}
                      style={{
                        display: "flex",
                        justifyContent: mine
                          ? "flex-end"
                          : "flex-start",
                        marginBottom: 12,
                      }}
                    >
                      <div
                        style={{
                          maxWidth: "80%",
                          padding: "12px 15px",
                          borderRadius: 14,
                          background: mine ? "#873b50" : "#f3edf0",
                          color: mine ? "#fff" : "#292524",
                          whiteSpace: "pre-wrap",
                          overflowWrap: "anywhere",
                        }}
                      >
                        {(photoUrls[message.id]?.length ?? 0) > 0 && (
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 6, marginBottom: 7 }}>
                            {photoUrls[message.id].map((photo) => (
                              <button key={photo.path} type="button" onClick={() => setExpandedPhoto(photo.url)}
                                aria-label={ar ? "عرض الصورة بالحجم الكبير" : "View larger photo"}
                                style={{ display: "block", padding: 0, border: 0, background: "transparent", cursor: "zoom-in" }}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={photo.url} alt={ar ? "صورة في المحادثة" : "Shared chat photo"}
                                  style={{ width: "100%", height: 145, objectFit: "cover", borderRadius: 9 }} />
                              </button>
                            ))}
                          </div>
                        )}
                        {voiceUrls[message.id] && (
                          <div style={{ marginBottom: 8, minWidth: 210 }}>
                            <audio controls preload="none" src={voiceUrls[message.id].url}
                              aria-label={ar ? "رسالة صوتية" : "Voice message"}
                              style={{ width: "100%", maxWidth: 310 }} />
                            <div style={{ fontSize: 12 }}>
                              {ar ? "رسالة صوتية" : "Voice message"} · {voiceUrls[message.id].duration}s
                            </div>
                          </div>
                        )}
                        {((message.body !== "📷 Photo" || !photoUrls[message.id]?.length) &&
                          (message.body !== "🎤 Voice message" || !voiceUrls[message.id])) && <div>{message.body}</div>}
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "flex-end",
                            gap: 8,
                            fontSize: 11,
                            opacity: 0.85,
                            marginTop: 6,
                          }}
                        >
                          <time dateTime={message.created_at}>
                            {new Date(message.created_at).toLocaleString(
                              ar ? "ar-JO" : "en-GB"
                            )}
                          </time>
                          {mine && (
                            <span
                              title={message.is_read
                                ? (ar ? "تمت القراءة" : "Read")
                                : (ar ? "تم الإرسال" : "Sent")}
                              aria-label={message.is_read
                                ? (ar ? "تمت القراءة" : "Read")
                                : (ar ? "تم الإرسال" : "Sent")}
                              style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
                            >
                              <span aria-hidden="true" style={{ fontSize: 15, lineHeight: 1 }}>
                                {message.is_read ? "✓✓" : "✓"}
                              </span>
                              <span>{message.is_read
                                ? (ar ? "تمت القراءة" : "Read")
                                : (ar ? "تم الإرسال" : "Sent")}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {selectedPhotos.length > 0 && (
              <div style={{ padding: "12px 15px", borderTop: "1px solid #eee" }}>
                <div style={{ marginBottom: 8, color: "#873b50", fontWeight: 700 }}>
                  {ar ? `الصور المحددة: ${selectedPhotos.length} من 5` : `Selected photos: ${selectedPhotos.length} of 5`}
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {selectedPhotos.map((photo, index) => (
                    <div key={`${photo.name}-${index}`} style={{ position: "relative" }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={previewUrls[index]} alt={photo.name} style={{ width: 90, height: 75, objectFit: "cover", borderRadius: 8 }} />
                      <button type="button" disabled={sending}
                        onClick={() => setSelectedPhotos((current) => current.filter((_, i) => i !== index))}
                        aria-label={ar ? "إزالة الصورة" : "Remove photo"}
                        style={{ position: "absolute", top: 2, right: 2, background: "#873b50", color: "white", border: 0, borderRadius: "50%", cursor: "pointer" }}>×</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {uploadProgress && <p role="status" style={{ padding: "0 15px", color: "#873b50" }}>{uploadProgress}</p>}
            {(recording || recordedVoice) && (
              <div style={{ padding: 14, borderTop: "1px solid #eee", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                {recording ? (
                  <>
                    <strong style={{ color: "#873b50" }}>🔴 {ar ? "جارٍ التسجيل" : "Recording"} {Math.floor(recordingSeconds / 60)}:{String(recordingSeconds % 60).padStart(2, "0")}</strong>
                    <button type="button" onClick={() => stopRecording(false)}>{ar ? "إيقاف" : "Stop"}</button>
                    <button type="button" onClick={() => stopRecording(true)}>{ar ? "إلغاء" : "Cancel"}</button>
                  </>
                ) : (
                  <>
                    {voicePreviewUrl && <audio controls src={voicePreviewUrl} style={{ maxWidth: "100%" }} />}
                    <span>{voiceDuration}s</span>
                    <button type="button" disabled={sending} onClick={() => { setRecordedVoice(null); setVoiceDuration(0); }}>{ar ? "حذف" : "Discard"}</button>
                    <button type="button" disabled={sending} onClick={() => void sendVoice()}
                      style={{ background: "#873b50", color: "white", border: 0, borderRadius: 8, padding: "10px 16px" }}>
                      {ar ? "إرسال الصوت" : "Send voice"}
                    </button>
                  </>
                )}
              </div>
            )}
            <div
              style={{
                padding: 15,
                borderTop: "1px solid #eee",
                display: "flex",
                gap: 10,
              }}
            >
              <input ref={fileInputRef} type="file" multiple accept="image/jpeg,image/png,image/webp" style={{ display: "none" }}
                onChange={(event) => choosePhotos(event.target.files)} />
              <button type="button" onClick={() => fileInputRef.current?.click()} disabled={sending || recording || !!recordedVoice}
                title={ar ? "إرفاق صورة" : "Attach photo"} aria-label={ar ? "إرفاق صورة" : "Attach photo"}
                style={{ background: "#f3edf0", border: "1px solid #e3d6da", borderRadius: 10, padding: "10px 14px", color: "#873b50", cursor: "pointer", fontSize: 22 }}>
                📷
              </button>
              <button type="button" onClick={() => void startRecording()}
                disabled={sending || recording || !!recordedVoice || selectedPhotos.length > 0}
                title={ar ? "تسجيل رسالة صوتية" : "Record voice message"}
                aria-label={ar ? "تسجيل رسالة صوتية" : "Record voice message"}
                style={{ background: "#f3edf0", border: "1px solid #e3d6da", borderRadius: 10, padding: "10px 12px", color: "#873b50", cursor: "pointer", fontSize: 21 }}>
                🎤
              </button>
              <textarea
                value={draft}
                onChange={(event) =>
                  setDraft(event.target.value)
                }
                maxLength={5000}
                rows={2}
                placeholder={
                  ar ? "اكتب رسالتك..." : "Write a message..."
                }
                style={{
                  flex: 1,
                  padding: 12,
                  borderRadius: 10,
                  border: "1px solid #ddd",
                  fontFamily: "inherit",
                  resize: "vertical",
                }}
              />

              <button
                type="button"
                onClick={sendMessage}
                disabled={sending || recording || !!recordedVoice || (!draft.trim() && selectedPhotos.length === 0)}
                style={{
                  background: "#873b50",
                  color: "#fff",
                  border: 0,
                  borderRadius: 10,
                  padding: "12px 18px",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                {sending
                  ? "..."
                  : ar
                    ? "إرسال"
                    : "Send"}
              </button>
            </div>
          </section>
        )}
        {expandedPhoto && (
          <div role="dialog" aria-modal="true" aria-label={ar ? "عرض الصورة" : "Photo viewer"}
            onClick={() => setExpandedPhoto(null)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20, cursor: "zoom-out" }}>
            <button type="button" onClick={() => setExpandedPhoto(null)}
              style={{ position: "absolute", top: 20, right: 25, color: "#fff", background: "transparent", border: 0, fontSize: 30, cursor: "pointer" }} aria-label={ar ? "إغلاق" : "Close"}>×</button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={expandedPhoto} alt={ar ? "الصورة بالحجم الكبير" : "Expanded chat photo"}
              onClick={(event) => event.stopPropagation()}
              style={{ maxWidth: "95vw", maxHeight: "90vh", objectFit: "contain" }} />
          </div>
        )}
      </div>
    </main>
  );
}