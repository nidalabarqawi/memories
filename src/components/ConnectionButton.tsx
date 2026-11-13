
"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Connection = {
  id: string;
  requester_id: string;
  recipient_id: string;
  status: "pending" | "accepted" | "declined";
};

type Props = {
  classmateId: string;
  locale: "en" | "ar";
};

const supabase = createClient();

export default function ConnectionButton({
  classmateId,
  locale,
}: Props) {
  const [userId, setUserId] = useState("");
  const [connection, setConnection] =
    useState<Connection | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const ar = locale === "ar";

  const loadConnection = useCallback(async () => {
    setLoading(true);
    setError("");

    const { data: auth, error: authError } =
      await supabase.auth.getUser();

    if (authError || !auth.user) {
      setError(
        ar
          ? "يرجى تسجيل الدخول."
          : "Please sign in."
      );
      setLoading(false);
      return;
    }

    setUserId(auth.user.id);

    const { data, error: queryError } =
      await supabase
        .from("connections")
        .select(
          "id,requester_id,recipient_id,status"
        )
        .or(
          `and(requester_id.eq.${auth.user.id},recipient_id.eq.${classmateId}),and(requester_id.eq.${classmateId},recipient_id.eq.${auth.user.id})`
        )
        .maybeSingle();

    if (queryError) {
      setError(queryError.message);
    } else {
      setConnection(data as Connection | null);
    }

    setLoading(false);
  }, [classmateId, ar]);

  useEffect(() => {
    void loadConnection();
  }, [loadConnection]);

  async function sendRequest() {
    if (busy) return;

    setBusy(true);
    setError("");
    setMessage("");

    const { error: rpcError } =
      await supabase.rpc(
        "send_connection_request",
        {
          p_recipient_id: classmateId,
        }
      );

    if (rpcError) {
      setError(rpcError.message);
    } else {
      setMessage(
        ar
          ? "تم إرسال طلب التواصل بنجاح."
          : "Connection request sent successfully."
      );

      await loadConnection();
    }

    setBusy(false);
  }

  const isSender =
    connection?.requester_id === userId;

  let label = ar
    ? "إرسال طلب تواصل"
    : "Connect";

  let disabled = busy || loading;

  if (connection?.status === "pending") {
    label = isSender
      ? ar
        ? "تم إرسال الطلب"
        : "Request Sent"
      : ar
        ? "طلب تواصل وارد"
        : "Incoming Request";

    disabled = true;
  }

  if (connection?.status === "accepted") {
    label = ar
      ? "متصلان"
      : "Connected";

    disabled = true;
  }

  if (connection?.status === "declined") {
    label = ar
      ? "تم رفض الطلب"
      : "Request Declined";

    disabled = true;
  }

  return (
    <div style={{ marginTop: 24 }}>
      <button
        type="button"
        onClick={sendRequest}
        disabled={disabled}
        style={{
          background: disabled
            ? "#e9dfe2"
            : "#873b50",
          color: disabled
            ? "#66575d"
            : "#fff",
          border: "none",
          borderRadius: 10,
          padding: "12px 22px",
          fontSize: 15,
          fontWeight: 600,
          cursor: disabled
            ? "not-allowed"
            : "pointer",
        }}
      >
        {loading
          ? ar
            ? "جارٍ التحميل..."
            : "Loading..."
          : busy
            ? ar
              ? "جارٍ الإرسال..."
              : "Sending..."
            : label}
      </button>

      {message && (
        <p
          role="status"
          style={{ color: "#26734d" }}
        >
          {message}
        </p>
      )}

      {error && (
        <p
          role="alert"
          style={{ color: "#b42318" }}
        >
          {error}
        </p>
      )}
    </div>
  );
}
