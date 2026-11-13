
"use client";

import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

type Props = {
  memoryId: string;
  lang: "en" | "ar";
  onUploaded?: () => void;
};

const MAX_SIZE = 5 * 1024 * 1024;

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export default function MemoryPhotoUploader({
  memoryId,
  lang,
  onUploaded,
}: Props) {
  const ar = lang === "ar";

  const inputRef = useRef<HTMLInputElement>(null);
  const busyRef = useRef(false);

  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    return () => {
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    };
  }, []);

  async function handleFileChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    if (busyRef.current) return;

    setError("");
    setSuccess("");

    const file = event.target.files?.[0];

    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError(
        ar
          ? "يرجى اختيار صورة JPG أو PNG أو WebP."
          : "Please select a JPG, PNG, or WebP image."
      );
      event.target.value = "";
      return;
    }

    if (file.size > MAX_SIZE || file.size === 0) {
      setError(
        ar
          ? "يجب أن يكون حجم الصورة أكبر من صفر وألا يتجاوز 5 ميجابايت."
          : "Photo must be larger than zero and no more than 5 MB."
      );
      event.target.value = "";
      return;
    }

    busyRef.current = true;
    setUploading(true);

    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);

    try {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError || !authData.user) {
        throw new Error(
          ar ? "يرجى تسجيل الدخول." : "Please sign in."
        );
      }

      const userId = authData.user.id;

      const { data: memory, error: memoryError } =
        await supabase
          .from("memories")
          .select("id")
          .eq("id", memoryId)
          .eq("author_id", userId)
          .in("visibility", ["private", "classmates"])
          .single();

      if (memoryError || !memory) {
        throw new Error(
          ar
            ? "لم يتم العثور على ذكرى خاصة تملكها."
            : "No private memory owned by you was found."
        );
      }

      const storagePath =
        `${userId}/${memoryId}/` +
        `${crypto.randomUUID()}.${EXTENSIONS[file.type]}`;

      const { error: uploadError } =
        await supabase.storage
          .from("memory-photos")
          .upload(storagePath, file, {
            contentType: file.type,
            upsert: false,
          });

      if (uploadError) throw uploadError;

      const { error: metadataError } =
        await supabase
          .from("memory_media")
          .insert({
            memory_id: memoryId,
            storage_path: storagePath,
          });

      if (metadataError) {
        const { error: cleanupError } =
          await supabase.storage
            .from("memory-photos")
            .remove([storagePath]);

        if (cleanupError) {
          throw new Error(
            `${metadataError.message}. ` +
            `Cleanup failed: ${cleanupError.message}`
          );
        }

        throw metadataError;
      }

      setSuccess(
        ar
          ? "تم رفع الصورة وحفظها تلقائياً."
          : "Photo uploaded automatically."
      );

      onUploaded?.();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : ar
            ? "حدث خطأ أثناء رفع الصورة."
            : "An error occurred while uploading."
      );
    } finally {
      URL.revokeObjectURL(objectUrl);
      setPreview(null);
      setUploading(false);
      busyRef.current = false;

      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  }

  return (
    <section
      dir={ar ? "rtl" : "ltr"}
      style={{
        marginTop: 24,
        padding: 20,
        background: "#f8f5f0",
        borderRadius: 12,
        border: "1px solid #eadfe2",
      }}
    >
      <h3 style={{ color: "#873b50", marginTop: 0 }}>
        {ar ? "إضافة صورة للذكرى" : "Add a Photo"}
      </h3>

      <p style={{ color: "#756c70", fontSize: 14 }}>
        {ar
          ? "اختر صورة وسيبدأ رفعها تلقائياً. JPG أو PNG أو WebP، بحد أقصى 5 ميجابايت."
          : "Choose a photo to upload automatically. JPG, PNG, or WebP, up to 5 MB."}
      </p>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(event) => void handleFileChange(event)}
        disabled={uploading}
        aria-label={ar ? "اختيار صورة" : "Choose photo"}
      />

      {preview && (
        <div style={{ marginTop: 16 }}>
          <img
            src={preview}
            alt={ar ? "معاينة الصورة" : "Photo preview"}
            style={{
              maxWidth: "100%",
              maxHeight: 280,
              objectFit: "contain",
              borderRadius: 10,
            }}
          />
        </div>
      )}

      {uploading && (
        <p role="status" style={{ color: "#873b50" }}>
          {ar
            ? "جارٍ رفع الصورة تلقائياً..."
            : "Uploading photo automatically..."}
        </p>
      )}

      {error && (
        <p role="alert" style={{ color: "#b42318" }}>
          {error}
        </p>
      )}

      {success && (
        <p role="status" style={{ color: "#247348" }}>
          {success}
        </p>
      )}
    </section>
  );
}

