
import { useState, useEffect, useRef, useCallback } from "react";
import { ContentItem, DisplaySettings } from "@/lib/types";
import { cn } from "@/lib/utils";
import { getVideoBlobUrl, isIndexedDBSupported } from "@/hooks/useVideoCache";

interface ContentRendererProps {
  content: ContentItem[];
  settings: DisplaySettings;
  isPlaying: boolean;
  onContentChange?: (index: number) => void;
}

export function ContentRenderer({
  content,
  settings,
  isPlaying,
  onContentChange,
}: ContentRendererProps) {

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const isTransitioningRef = useRef(false);
  const currentUrlRef = useRef<string>("");

  const [displayOrder, setDisplayOrder] = useState<number[]>(() =>
    content.map((_, i) => i)
  );

  const cachedUrlsRef = useRef<Map<string, string>>(new Map());

  const resolvedSrcRef = useRef<string>("");
  const [resolvedSrc, setResolvedSrc] = useState<string>("");

  const videoRef = useRef<HTMLVideoElement>(null);

  const lastCurrentTimeRef = useRef<number>(-1);
  const stallCountRef = useRef<number>(0);

  const WATCHDOG_INTERVAL_MS = 5000;
  const MAX_STALL_BEFORE_SKIP = 3;

  // -------------------------
  // Resolve video src (CACHE)
  // -------------------------

  useEffect(() => {
    if (content.length === 0) return;

    const order =
      displayOrder.length > 0 ? displayOrder : content.map((_, i) => i);

    const safeIndex =
      ((currentIndex % order.length) + order.length) % order.length;

    const contentIdx = order[safeIndex];
    const current = content[contentIdx];

    if (!current || current.type !== "video") return;

    let cancelled = false;

    // SESSION CACHE
    const sessionCached = cachedUrlsRef.current.get(current.url);

    if (sessionCached) {
      resolvedSrcRef.current = sessionCached;
      setResolvedSrc(sessionCached);

      console.log(
        "[ContentRenderer] session cache",
        current.url.split("/").pop()
      );

      return;
    }

    // NO INDEXEDDB
    if (!isIndexedDBSupported()) {
      resolvedSrcRef.current = current.url;
      setResolvedSrc(current.url);
      return;
    }

    const updatedAt = current.uploadedAt?.toISOString();

    getVideoBlobUrl(current.url, updatedAt)
      .then((blobUrl) => {
        if (cancelled) return;

        if (blobUrl && blobUrl !== current.url) {
          cachedUrlsRef.current.set(current.url, blobUrl);

          resolvedSrcRef.current = blobUrl;
          setResolvedSrc(blobUrl);

          console.log(
            "[ContentRenderer] indexedDB",
            current.url.split("/").pop()
          );
        } else {
          resolvedSrcRef.current = current.url;
          setResolvedSrc(current.url);

          console.log(
            "[ContentRenderer] network",
            current.url.split("/").pop()
          );
        }
      })
      .catch(() => {
        resolvedSrcRef.current = current.url;
        setResolvedSrc(current.url);
      });

    return () => {
      cancelled = true;
    };

  }, [currentIndex, content, displayOrder]);

  // -------------------------
  // Display order
  // -------------------------

  useEffect(() => {
    if (content.length === 0) return;

    let order = content.map((_, i) => i);

    if (settings.playbackOrder === "shuffle") {
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
    }

    const currentUrl = currentUrlRef.current;

    let newCurrentIndex = 0;

    if (currentUrl) {
      const found = order.findIndex((idx) => content[idx]?.url === currentUrl);
      if (found !== -1) newCurrentIndex = found;
    }

    setDisplayOrder(order);
    setCurrentIndex(newCurrentIndex);

  }, [content, settings.playbackOrder]);

  // -------------------------
  // Next slide
  // -------------------------

  const goToNext = useCallback(() => {

    const orderLen = displayOrder.length || content.length;

    if (orderLen <= 1 || !isPlaying) return;

    if (isTransitioningRef.current) return;

    isTransitioningRef.current = true;

    setIsTransitioning(true);

    setTimeout(() => {

      setCurrentIndex((prev) => {
        const next = (prev + 1) % orderLen;
        onContentChange?.(next);
        return next;
      });

      setIsTransitioning(false);

      setTimeout(() => {
        isTransitioningRef.current = false;
      }, 50);

    }, settings.transitionDuration);

  }, [content.length, displayOrder.length, settings.transitionDuration, isPlaying]);

  // -------------------------
  // Auto advance
  // -------------------------

  useEffect(() => {

    if (content.length === 0 || !isPlaying) return;

    const order =
      displayOrder.length > 0 ? displayOrder : content.map((_, i) => i);

    const safeIndex =
      ((currentIndex % order.length) + order.length) % order.length;

    const contentIdx = order[safeIndex];
    const current = content[contentIdx];

    if (!current) return;

    currentUrlRef.current = current.url;

    const isVideo = current.type === "video";

    const baseDuration =
      (current.duration || settings.slideDuration) * 1000;

    const timerDuration = isVideo ? baseDuration + 2000 : baseDuration;

    const timer = setTimeout(goToNext, timerDuration);

    return () => clearTimeout(timer);

  }, [currentIndex, content, displayOrder, settings.slideDuration, goToNext, isPlaying]);

  // -------------------------
  // Watchdog
  // -------------------------

  useEffect(() => {

    const video = videoRef.current;

    if (!video || !isPlaying) return;

    lastCurrentTimeRef.current = -1;
    stallCountRef.current = 0;

    const id = setInterval(() => {

      if (!video) return;

      if (video.ended) return;

      const timeStuck =
        lastCurrentTimeRef.current === video.currentTime && !video.paused;

      const lowReady =
        !video.paused && !video.ended && video.readyState < 3;

      const stalled = timeStuck || lowReady;

      lastCurrentTimeRef.current = video.currentTime;

      if (!stalled) {
        stallCountRef.current = 0;
        return;
      }

      stallCountRef.current++;

      if (stallCountRef.current >= MAX_STALL_BEFORE_SKIP) {
        stallCountRef.current = 0;
        goToNext();
        return;
      }

      const src = video.src;

      video.src = "";
      video.load();

      video.src = src;
      video.currentTime = 0;

      video.play().catch(() => {});

    }, WATCHDOG_INTERVAL_MS);

    return () => clearInterval(id);

  }, [currentIndex, isPlaying, goToNext]);

  // -------------------------
  // Render
  // -------------------------

  if (content.length === 0) return null;

  const effectiveOrder =
    displayOrder.length > 0 ? displayOrder : content.map((_, i) => i);

  const contentIdx = effectiveOrder[currentIndex] ?? 0;
  const currentContent = content[contentIdx];

  return (
    <div className="absolute inset-0 overflow-hidden bg-black">

      {currentContent.type === "image" ? (
        <img
          src={currentContent.url}
          className="w-full h-full object-cover"
        />
      ) : (
        <video
          key={currentContent.id}
          ref={videoRef}
          src={resolvedSrc || currentContent.url}
          className="w-full h-full object-cover"
          autoPlay
          muted
          playsInline
          controls={false}
          onEnded={goToNext}
        />
      )}

    </div>
  );
}