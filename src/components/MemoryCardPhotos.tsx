
"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();


const PHOTO_CACHE_PREFIX = "memories-photo-url:";

function photoCacheKey(userId: string, storagePath: string) {
  return `${userId}:${storagePath}`;
}


type CachedPhotoUrl = {
  url: string;
  expiresAt: number;
};

function getCachedPhotoUrl(storagePath: string): string | null {
  try {
    const raw = sessionStorage.getItem(
      PHOTO_CACHE_PREFIX + storagePath
    );

    if (!raw) return null;

    const cached = JSON.parse(raw) as CachedPhotoUrl;

    if (
      typeof cached.url === "string" &&
      cached.expiresAt > Date.now()
    ) {
      return cached.url;
    }

    sessionStorage.removeItem(PHOTO_CACHE_PREFIX + storagePath);
  } catch {
    return null;
  }

  return null;
}

function setCachedPhotoUrl(storagePath: string, url: string) {
  try {
    sessionStorage.setItem(
      PHOTO_CACHE_PREFIX + storagePath,
      JSON.stringify({
        url,
        expiresAt: Date.now() + 55 * 60 * 1000,
      })
    );
  } catch {
    // Continue normally if session storage is unavailable.
  }
}

type Props = {
  memoryId: string;
  lang: "en" | "ar";
  sharedView?: boolean;
};

type Photo = {
  id: string;
  url: string;
};

export default function MemoryCardPhotos({
  memoryId,
  lang,
  sharedView = false,
}: Props) {
  const ar = lang === "ar";

  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeIndex, setActiveIndex] = useState<number | null>(
    null
  );

  const viewerOpen = activeIndex !== null;

  // Load photos from private Supabase Storage.
  useEffect(() => {
    let active = true;

    async function loadPhotos() {
      setLoading(true);
      setError("");

      try {
        const { data: authData, error: authError } =
          await supabase.auth.getUser();

        if (authError || !authData.user) {
          throw new Error(
            ar ? "يرجى تسجيل الدخول." : "Please sign in."
          );
        }

       const memoryQuery = supabase
  .from("memories")
  .select("id")
  .eq("id", memoryId);

if (sharedView) {
  memoryQuery.eq("visibility", "classmates");
} else {
  memoryQuery.eq("author_id", authData.user.id);
}

const { data: memory, error: memoryError } =
  await memoryQuery.single();

        if (memoryError || !memory) {
          throw new Error(
            ar
              ? "لا يمكن الوصول إلى صور هذه الذكرى."
              : "Cannot access photos for this memory."
          );
        }

        const { data: media, error: mediaError } =
          await supabase
            .from("memory_media")
            .select("id, storage_path")
            .eq("memory_id", memoryId)
            .order("created_at", { ascending: true });

        if (mediaError) throw mediaError;

        // For shared memories, the Storage folder belongs
// to the memory's author, not the current viewer.
const { data: memoryOwner, error: ownerError } =
  await supabase
    .from("memories")
    .select("author_id")
    .eq("id", memoryId)
    .single();

if (ownerError || !memoryOwner) {
  throw new Error("Could not verify memory owner.");
}

const prefix = `${memoryOwner.author_id}/${memoryId}/`;

        const validMedia = (media ?? []).filter(
          (item) =>
            item.storage_path.startsWith(prefix) &&
            item.storage_path.length > prefix.length
        );

        if (validMedia.length === 0) {
          if (active) setPhotos([]);
          return;
        }

        const results = await Promise.all(
          validMedia.map(async (item) => {
            
const cacheKey = photoCacheKey(
  authData.user.id,
  item.storage_path
);

let url = getCachedPhotoUrl(cacheKey);

if (!url) {
  const { data, error: urlError } =
    await supabase.storage
      .from("memory-photos")
      .createSignedUrl(item.storage_path, 3600);

  if (urlError || !data?.signedUrl) {
    throw new Error(
      urlError?.message ?? "Could not load photo."
    );
  }

  url = data.signedUrl;
  setCachedPhotoUrl(cacheKey, url);
}

return {
  id: item.id,
  url,
};

          })
        );

        if (active) setPhotos(results);
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : ar
                ? "تعذر تحميل الصور."
                : "Could not load photos."
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadPhotos();

    return () => {
      active = false;
    };
  }, [memoryId, ar, sharedView]);

  // Keyboard navigation and scroll locking.
  useEffect(() => {
    if (!viewerOpen) return;

    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setActiveIndex(null);
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();

        setActiveIndex((current) =>
          current === null
            ? null
            : (current + 1) % photos.length
        );
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();

        setActiveIndex((current) =>
          current === null
            ? null
            : (current - 1 + photos.length) % photos.length
        );
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [viewerOpen, photos.length]);

  function nextPhoto() {
    setActiveIndex((current) =>
      current === null
        ? null
        : (current + 1) % photos.length
    );
  }

  function previousPhoto() {
    setActiveIndex((current) =>
      current === null
        ? null
        : (current - 1 + photos.length) % photos.length
    );
  }

  if (loading) {
    return (
      <p style={{ color: "#756c70", fontSize: 13 }}>
        {ar ? "جارٍ تحميل الصور..." : "Loading photos..."}
      </p>
    );
  }

  if (error) {
    return (
      <p role="alert" style={{ color: "#b42318", fontSize: 13 }}>
        {error}
      </p>
    );
  }

  if (photos.length === 0) return null;

  const selectedPhoto =
    activeIndex !== null ? photos[activeIndex] : null;

  return (
    <>
      {/* Photos inside the memory card */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            photos.length === 1
              ? "1fr"
              : "repeat(auto-fit, minmax(130px, 1fr))",
          gap: 8,
          marginTop: 16,
          marginBottom: 16,
        }}
      >
        {photos.map((photo, index) => (
          <button
            key={photo.id}
            type="button"
            onClick={() => setActiveIndex(index)}
            aria-label={
              ar
                ? `عرض الصورة ${index + 1}`
                : `View photo ${index + 1}`
            }
            style={{
              display: "block",
              width: "100%",
              padding: 0,
              border: "none",
              borderRadius: 10,
              overflow: "hidden",
              background: "#f8f5f0",
              cursor: "zoom-in",
            }}
          >
            <img
              src={photo.url}
              alt={ar ? "صورة الذكرى" : "Memory photo"}
              loading="lazy"
              style={{
                display: "block",
                width: "100%",
                height: photos.length === 1 ? 300 : 160,
                objectFit: "cover",
              }}
            />
          </button>
        ))}
      </div>

      {/* Full-screen viewer rendered outside the card */}
      {viewerOpen &&
        selectedPhoto &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label={
              ar ? "عارض صور الذكرى" : "Memory photo viewer"
            }
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 9999,
              background: "rgba(0,0,0,0.96)",
              display: "flex",
              flexDirection: "column",
              color: "#fff",
            }}
          >
            {/* Header */}
            <div
              style={{
                height: 64,
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0 20px",
                gap: 12,
              }}
            >
              <strong
                style={{
                  fontSize: 18,
                  letterSpacing: 0.3,
                }}
              >
                Memories
              </strong>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 20,
                }}
              >
                <span
                  style={{
                    color: "#ddd",
                    fontSize: 14,
                    direction: "ltr",
                  }}
                >
                  {activeIndex! + 1} / {photos.length}
                </span>

                <button
                  type="button"
                  onClick={() => setActiveIndex(null)}
                  aria-label={ar ? "إغلاق" : "Close"}
                  style={{
                    background: "#333",
                    border: "none",
                    color: "#fff",
                    borderRadius: "50%",
                    width: 42,
                    height: 42,
                    fontSize: 25,
                    cursor: "pointer",
                  }}
                >
                  ×
                </button>
              </div>
            </div>

            {/* Main photo area */}
            <div
              style={{
                flex: 1,
                minHeight: 0,
                position: "relative",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "12px 58px",
              }}
            >
              <img
                key={selectedPhoto.id}
                src={selectedPhoto.url}
                alt={
                  ar
                    ? `الصورة ${activeIndex! + 1}`
                    : `Photo ${activeIndex! + 1}`
                }
                style={{
                  display: "block",
                  maxWidth: "100%",
                  maxHeight: "100%",
                  objectFit: "contain",
                }}
              />

              {photos.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={previousPhoto}
                    aria-label={
                      ar ? "الصورة السابقة" : "Previous photo"
                    }
                    style={{
                      position: "absolute",
                      left: 12,
                      top: "50%",
                      transform: "translateY(-50%)",
                      width: 42,
                      height: 42,
                      borderRadius: "50%",
                      border: "none",
                      background: "#333",
                      color: "#fff",
                      fontSize: 28,
                      cursor: "pointer",
                    }}
                  >
                    ‹
                  </button>

                  <button
                    type="button"
                    onClick={nextPhoto}
                    aria-label={
                      ar ? "الصورة التالية" : "Next photo"
                    }
                    style={{
                      position: "absolute",
                      right: 12,
                      top: "50%",
                      transform: "translateY(-50%)",
                      width: 42,
                      height: 42,
                      borderRadius: "50%",
                      border: "none",
                      background: "#333",
                      color: "#fff",
                      fontSize: 28,
                      cursor: "pointer",
                    }}
                  >
                    ›
                  </button>
                </>
              )}
            </div>

            {/* Footer */}
            <div
              style={{
                flexShrink: 0,
                minHeight: 48,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#aaa",
                fontSize: 13,
                padding: "8px 16px",
                textAlign: "center",
              }}
            >
              {ar
                ? "استخدم الأسهم للتنقل وEsc للإغلاق"
                : "Use arrow keys to navigate · Esc to close"}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
