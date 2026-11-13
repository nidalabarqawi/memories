
"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

type Photo = {
  id: string;
  storage_path: string;
  url: string;
};

type Props = {
  memoryId: string;
  lang: "en" | "ar";
  refreshKey?: number;
};

export default function MemoryPhotoGallery({
  memoryId,
  lang,
  refreshKey = 0,
}: Props) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const ar = lang === "ar";

  const loadPhotos = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const { data: auth, error: authError } =
        await supabase.auth.getUser();

      if (authError || !auth.user) {
        throw new Error(
          ar ? "يرجى تسجيل الدخول." : "Please sign in."
        );
      }

      const { data: memory, error: memoryError } =
        await supabase
          .from("memories")
          .select("id")
          .eq("id", memoryId)
          .eq("author_id", auth.user.id)
          .single();

      if (memoryError || !memory) {
        throw new Error(
          ar
            ? "لا يمكنك الوصول إلى صور هذه الذكرى."
            : "You cannot access this memory's photos."
        );
      }

      const { data, error: dbError } =
        await supabase
          .from("memory_media")
          .select("id, storage_path")
          .eq("memory_id", memoryId)
          .order("created_at", { ascending: false });

      if (dbError) throw dbError;

      const records = data ?? [];

      if (records.length === 0) {
        setPhotos([]);
        return;
      }

      const expectedPrefix =
        `${auth.user.id}/${memoryId}/`;

      const results = await Promise.all(
        records.map(async (item) => {
          if (!item.storage_path.startsWith(expectedPrefix)) {
            throw new Error(
              ar
                ? "مسار تخزين الصورة غير صحيح."
                : "Invalid photo storage path."
            );
          }

          const { data: signed, error: signError } =
            await supabase.storage
              .from("memory-photos")
              .createSignedUrl(item.storage_path, 300);

          if (signError || !signed?.signedUrl) {
            throw new Error(
              signError?.message ??
                (ar
                  ? "تعذر إنشاء رابط الصورة."
                  : "Could not generate photo URL.")
            );
          }

          return {
            id: item.id,
            storage_path: item.storage_path,
            url: signed.signedUrl,
          };
        })
      );

      setPhotos(results);
    } catch (err) {
      setPhotos([]);
      setError(
        err instanceof Error
          ? err.message
          : ar
            ? "تعذر تحميل الصور."
            : "Could not load photos."
      );
    } finally {
      setLoading(false);
    }
  }, [memoryId, ar]);

  useEffect(() => {
    void loadPhotos();
  }, [loadPhotos, refreshKey]);

  async function deletePhoto(photo: Photo) {
    if (deletingId !== null) return;

    const confirmed = window.confirm(
      ar
        ? "هل أنت متأكد من حذف هذه الصورة نهائياً؟"
        : "Are you sure you want to permanently delete this photo?"
    );

    if (!confirmed) return;

    setDeletingId(photo.id);
    setError("");

    try {
      const { data: auth, error: authError } =
        await supabase.auth.getUser();

      if (authError || !auth.user) {
        throw new Error(
          ar ? "يرجى تسجيل الدخول." : "Please sign in."
        );
      }

      const userId = auth.user.id;

      // Confirm ownership of private or shared memory.
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
            ? "لا تملك صلاحية حذف هذه الصورة."
            : "You do not have permission to delete this photo."
        );
      }

      const { data: metadata, error: metadataError } =
        await supabase
          .from("memory_media")
          .select("id, storage_path")
          .eq("id", photo.id)
          .eq("memory_id", memoryId)
          .single();

      if (metadataError || !metadata) {
        throw new Error(
          ar
            ? "لم يتم العثور على سجل الصورة."
            : "Photo record not found."
        );
      }

      const expectedPrefix = `${userId}/${memoryId}/`;

      if (!metadata.storage_path.startsWith(expectedPrefix)) {
        throw new Error(
          ar
            ? "مسار تخزين الصورة غير صحيح."
            : "Invalid photo storage path."
        );
      }

      // Delete the file from Storage first.
      const { error: storageError } =
        await supabase.storage
          .from("memory-photos")
          .remove([metadata.storage_path]);

      if (storageError) throw storageError;

      // Then remove the metadata record.
      const { data: deleted, error: dbError } =
        await supabase
          .from("memory_media")
          .delete()
          .eq("id", photo.id)
          .eq("memory_id", memoryId)
          .select("id");

      if (dbError || !deleted?.length) {
        throw new Error(
          dbError?.message ??
            (ar
              ? "تم حذف الملف، لكن تعذر حذف سجل الصورة."
              : "File deleted, but its database record remains.")
        );
      }

      setPhotos((current) =>
        current.filter((item) => item.id !== photo.id)
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : ar
            ? "حدث خطأ أثناء حذف الصورة."
            : "An error occurred while deleting the photo."
      );

      // Refresh to show the actual database state.
      await loadPhotos();
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section
      dir={ar ? "rtl" : "ltr"}
      style={{ marginTop: 28 }}
    >
      <h3 style={{ color: "#873b50" }}>
        {ar ? "صور الذكرى" : "Memory Photos"}
      </h3>

      {loading && (
        <p>
          {ar ? "جارٍ تحميل الصور..." : "Loading photos..."}
        </p>
      )}

      {error && (
        <p role="alert" style={{ color: "#b42318" }}>
          {error}
        </p>
      )}

      {!loading && !error && photos.length === 0 && (
        <p style={{ color: "#756c70" }}>
          {ar ? "لا توجد صور بعد." : "No photos yet."}
        </p>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fill, minmax(160px, 1fr))",
          gap: 14,
        }}
      >
        {photos.map((photo) => (
          <div
            key={photo.id}
            style={{
              borderRadius: 12,
              overflow: "hidden",
              border: "1px solid #eadfe2",
              background: "#fff",
            }}
          >
            <img
              src={photo.url}
              alt={
                ar
                  ? "صورة من الذكرى"
                  : "Memory photograph"
              }
              style={{
                width: "100%",
                height: 190,
                objectFit: "cover",
                display: "block",
              }}
            />

            <button
              type="button"
              disabled={deletingId !== null}
              onClick={() => void deletePhoto(photo)}
              style={{
                width: "100%",
                padding: 11,
                background: "#fff",
                color: "#b42318",
                border: "none",
                borderTop: "1px solid #eadfe2",
                fontWeight: 600,
                cursor:
                  deletingId !== null
                    ? "wait"
                    : "pointer",
              }}
            >
              {deletingId === photo.id
                ? ar
                  ? "جارٍ الحذف..."
                  : "Deleting..."
                : ar
                  ? "حذف الصورة"
                  : "Delete Photo"}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
