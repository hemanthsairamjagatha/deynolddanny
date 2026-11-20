import React, { useState, useEffect, useRef, useCallback } from 'react';

export interface RunwayLook {
  code: string;
  title: string;
  subtitle: string;
  image: string;
  ctaLabel?: string;
  ctaUrl?: string;
  focalX?: number;
  focalY?: number;
  startScale?: number;
  endScale?: number;
  /** Video start time in seconds when synced to the live runway film */
  videoStartSec?: number;
}

export interface HeroCmsPayload {
  eyebrow?: string;
  headline?: string;
  description?: string;
  tagline?: string;
  desktopImage?: string;
  mobileImage?: string;
  imageUrl?: string;
  videoUrl?: string;
  focalX?: number;
  focalY?: number;
  overlayOpacity?: number;
  overlayColor?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  secondaryCtaLabel?: string;
  secondaryCtaUrl?: string;
  runwayLooks?: RunwayLook[];
}

declare global {
  interface Window {
    __ddHeroCms?: HeroCmsPayload;
  }
}

const DEFAULT_VIDEO_URL = '/hero-runway.mp4?v=2';
const CROSSFADE_LEAD_SEC = 0.45; // Crisp 450ms dual-deck overlap on matched Start==End loop eliminates browser <video loop> blink

const DEFAULT_RUNWAY_LOOKS: RunwayLook[] = [
  {
    code: 'LOOK 01',
    title: 'The Monolith Obsidian Overcoat',
    subtitle: 'Double-Breasted Virgin Wool · Open-Collar Ivory Silk',
    image: '/images/hero-runway-1.jpg',
    ctaLabel: 'Shop Outerwear',
    ctaUrl: '/categories/overcoats',
    focalX: 66,
    focalY: 28,
    startScale: 1.0,
    endScale: 1.075,
    videoStartSec: 0,
  },
  {
    code: 'LOOK 02',
    title: 'Bordeaux Velvet Atelier Jacket',
    subtitle: 'Deep Burgundy Evening Tailoring · Black Ribbed Cashmere',
    image: '/images/hero-runway-2.jpg',
    ctaLabel: 'Shop Evening & Knit',
    ctaUrl: '/categories/knitwear',
    focalX: 64,
    focalY: 24,
    startScale: 1.0,
    endScale: 1.08,
    videoStartSec: 2.7,
  },
  {
    code: 'LOOK 03',
    title: 'Architectural Ivory Bespoke Suit',
    subtitle: 'Sculpted Double-Breasted Suiting · Cognac Calfskin',
    image: '/images/hero-runway-1.jpg',
    ctaLabel: 'Explore Tailoring',
    ctaUrl: '/categories/tailoring',
    focalX: 76,
    focalY: 20,
    startScale: 1.12,
    endScale: 1.2,
    videoStartSec: 5.4,
  },
];

const LOOK_DURATION_MS = 6500;

export const HeroRunwayExperience: React.FC = () => {
  const [cms, setCms] = useState<HeroCmsPayload>({ videoUrl: DEFAULT_VIDEO_URL });
  const [activeIdx, setActiveIdx] = useState(0);
  const [prevIdx, setPrevIdx] = useState<number | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const [activeDeck, setActiveDeck] = useState<0 | 1>(0);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0, tx: 0, ty: 0 });
  const [cycleKey, setCycleKey] = useState(0);

  // Dual-video seamless crossfade decks (zero end-of-loop blink)
  const videoARef = useRef<HTMLVideoElement | null>(null);
  const videoBRef = useRef<HTMLVideoElement | null>(null);
  const activeDeckRef = useRef<0 | 1>(0);
  const switchingRef = useRef(false);
  const stageRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    activeDeckRef.current = activeDeck;
  }, [activeDeck]);

  // Respect prefers-reduced-motion
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);

  // Hydrate live CMS hero config from live-cms.ts (supports videoUrl, runwayLooks, copy & CTAs)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const applyPayload = (detail: HeroCmsPayload) => {
      setCms({
        ...detail,
        videoUrl:
          typeof detail.videoUrl === 'string' && detail.videoUrl.trim()
            ? detail.videoUrl.trim()
            : detail.videoUrl === ''
              ? ''
              : DEFAULT_VIDEO_URL,
      });
      setVideoFailed(false);
    };

    if (window.__ddHeroCms) {
      applyPayload(window.__ddHeroCms);
    }
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<HeroCmsPayload>).detail;
      if (detail && typeof detail === 'object') {
        applyPayload(detail);
      }
    };
    window.addEventListener('dd:hero-cms-update', handler);
    return () => window.removeEventListener('dd:hero-cms-update', handler);
  }, []);

  // Build effective runway looks list
  const looks: RunwayLook[] = React.useMemo(() => {
    if (Array.isArray(cms.runwayLooks) && cms.runwayLooks.length > 0) {
      const valid = cms.runwayLooks.filter((l) => l && typeof l.image === 'string' && l.image.trim());
      if (valid.length > 0) {
        return valid.map((l, i) => ({
          ...l,
          videoStartSec: l.videoStartSec ?? DEFAULT_RUNWAY_LOOKS[i]?.videoStartSec ?? i * 2.7,
        }));
      }
    }
    return DEFAULT_RUNWAY_LOOKS;
  }, [cms]);

  const safeIdx = activeIdx % Math.max(1, looks.length);
  const currentLook = looks[safeIdx] ?? DEFAULT_RUNWAY_LOOKS[0];

  const videoUrl = typeof cms.videoUrl === 'string' ? cms.videoUrl.trim() : DEFAULT_VIDEO_URL;
  const showVideo = Boolean(videoUrl) && !videoFailed && !reducedMotion;

  const getDeck = (idx: 0 | 1) => (idx === 0 ? videoARef.current : videoBRef.current);

  const goToLook = useCallback(
    (nextIndex: number) => {
      const normalized = ((nextIndex % looks.length) + looks.length) % looks.length;
      setPrevIdx(safeIdx);
      setActiveIdx(normalized);
      setCycleKey((k) => k + 1);

      // Seek active video deck smoothly to that look's runway entrance
      const v = getDeck(activeDeckRef.current);
      if (v && showVideo && Number.isFinite(v.duration) && v.duration > 0) {
        const targetSec =
          looks[normalized]?.videoStartSec ?? (normalized / looks.length) * v.duration;
        v.currentTime = Math.min(Math.max(0, targetSec), Math.max(0, v.duration - 0.35));
      }
    },
    [looks, safeIdx, showVideo],
  );

  // Dual-deck zero-blink seamless crossfade loop + real-time Look HUD sync
  useEffect(() => {
    if (!showVideo || isPaused) return;
    let rafId = 0;

    const tick = () => {
      const currIdx = activeDeckRef.current;
      const nextIdx: 0 | 1 = currIdx === 0 ? 1 : 0;
      const currVid = getDeck(currIdx);
      const nextVid = getDeck(nextIdx);

      if (currVid && Number.isFinite(currVid.duration) && currVid.duration > 0) {
        const t = currVid.currentTime;
        const dur = currVid.duration;
        const effectiveDur = Math.max(1, dur - CROSSFADE_LEAD_SEC);
        const pct = Math.min(1, Math.max(0, t / effectiveDur));
        setVideoProgress(pct);

        let matched = 0;
        for (let i = looks.length - 1; i >= 0; i--) {
          const start = looks[i].videoStartSec ?? (i / looks.length) * effectiveDur;
          if (t >= start) {
            matched = i;
            break;
          }
        }
        setActiveIdx((prev) => (prev === matched ? prev : matched));

        // Pre-roll standby deck and crossfade smoothly BEFORE end-of-file so browser NEVER blinks
        if (!switchingRef.current && nextVid && dur > CROSSFADE_LEAD_SEC + 1 && dur - t <= CROSSFADE_LEAD_SEC) {
          switchingRef.current = true;
          nextVid.muted = true;
          nextVid.currentTime = 0;
          nextVid
            .play()
            .then(() => {
              activeDeckRef.current = nextIdx;
              setActiveDeck(nextIdx);
              window.setTimeout(() => {
                currVid.pause();
                currVid.currentTime = 0;
                switchingRef.current = false;
              }, Math.round(CROSSFADE_LEAD_SEC * 1000) + 120);
            })
            .catch(() => {
              switchingRef.current = false;
            });
        }
      }

      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [showVideo, isPaused, looks]);

  // Auto-advance still runway choreography when video mode is off / unavailable
  useEffect(() => {
    if (isPaused || reducedMotion || showVideo || looks.length <= 1) return;
    const timer = window.setInterval(() => {
      setActiveIdx((curr) => {
        setPrevIdx(curr);
        setCycleKey((k) => k + 1);
        return (curr + 1) % looks.length;
      });
    }, LOOK_DURATION_MS);
    return () => window.clearInterval(timer);
  }, [isPaused, reducedMotion, showVideo, looks.length]);

  // Clear exiting frame after transition completes
  useEffect(() => {
    if (prevIdx === null) return;
    const t = window.setTimeout(() => setPrevIdx(null), 1300);
    return () => window.clearTimeout(t);
  }, [prevIdx, activeIdx]);

  // Sync play/pause across both decks cleanly
  useEffect(() => {
    if (!showVideo) return;
    const currVid = getDeck(activeDeckRef.current);
    const otherVid = getDeck(activeDeckRef.current === 0 ? 1 : 0);
    if (currVid) {
      currVid.muted = true;
      if (isPaused) {
        currVid.pause();
      } else {
        currVid.play().catch(() => { });
      }
    }
    if (otherVid && isPaused) {
      otherVid.pause();
    }
  }, [isPaused, showVideo, videoUrl]);

  // Subtle 3D mouse depth parallax on desktop pointers
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (reducedMotion || !stageRef.current) return;
    const rect = stageRef.current.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width - 0.5;
    const ny = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({
      rx: Number((-ny * 1.4).toFixed(2)),
      ry: Number((nx * 1.8).toFixed(2)),
      tx: Number((-nx * 10).toFixed(1)),
      ty: Number((-ny * 6).toFixed(1)),
    });
  };

  const handleMouseLeave = () => {
    setTilt({ rx: 0, ry: 0, tx: 0, ty: 0 });
  };

  const eyebrow = cms.eyebrow?.trim() || 'AUTUMN / WINTER 2026 · MENSWEAR RUNWAY';
  const headline = cms.headline?.trim() || 'DEYNOLD DANNY';
  const tagline = cms.description?.trim() || cms.tagline?.trim() || 'Architectural Bespoke Tailoring & Cashmere';
  const primaryCtaLabel = currentLook.ctaLabel || cms.ctaLabel?.trim() || 'Shop This Look';
  const primaryCtaUrl = currentLook.ctaUrl || cms.ctaUrl?.trim() || '/categories/overcoats';
  const secondaryCtaLabel = cms.secondaryCtaLabel?.trim() || 'Explore Collection';
  const secondaryCtaUrl = cms.secondaryCtaUrl?.trim() || '/categories';
  const overlayOpacity =
    typeof cms.overlayOpacity === 'number' ? Math.max(0, Math.min(75, cms.overlayOpacity)) / 100 : 0.14;
  const overlayColor = cms.overlayColor || '#000000';

  return (
    <div
      ref={stageRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="dd-runway-stage"
      role="region"
      aria-roledescription="carousel"
      aria-label="DEYNOLD DANNY Menswear Runway Showcase"
    >
      {/* 3D Perspective Runway Plane */}
      <div
        className="dd-runway-3d-plane"
        style={
          reducedMotion
            ? undefined
            : {
              transform: `perspective(1400px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg) translate3d(${tilt.tx}px, ${tilt.ty}px, 0)`,
            }
        }
      >
        {showVideo ? (
          <>
            <video
              ref={videoARef}
              src={videoUrl}
              poster={cms.desktopImage || '/images/hero-runway-1.jpg'}
              autoPlay
              muted
              playsInline
              preload="auto"
              onError={() => setVideoFailed(true)}
              className={`dd-runway-media dd-runway-video-crop dd-runway-video-deck ${activeDeck === 0 ? 'is-deck-active' : ''}`}
            />
            <video
              ref={videoBRef}
              src={videoUrl}
              muted
              playsInline
              preload="auto"
              aria-hidden="true"
              className={`dd-runway-media dd-runway-video-crop dd-runway-video-deck ${activeDeck === 1 ? 'is-deck-active' : ''}`}
            />
          </>
        ) : (
          looks.map((look, idx) => {
            const isActive = idx === safeIdx;
            const isExiting = idx === prevIdx && idx !== safeIdx;
            const fx = look.focalX ?? 64;
            const fy = look.focalY ?? 26;
            const s0 = look.startScale ?? 1.0;
            const s1 = look.endScale ?? 1.08;

            return (
              <div
                key={`${look.code}-${idx}`}
                aria-hidden={!isActive}
                className={`dd-runway-slide ${isActive ? 'is-active' : ''} ${isExiting ? 'is-exiting' : ''} ${isPaused ? 'is-paused' : ''
                  }`}
                style={
                  {
                    '--runway-s0': String(s0),
                    '--runway-s1': String(s1),
                    '--runway-duration': `${LOOK_DURATION_MS}ms`,
                  } as React.CSSProperties
                }
              >
                <img
                  key={isActive ? `active-${idx}-${cycleKey}` : `idle-${idx}`}
                  src={look.image}
                  alt={`${headline} — ${look.title}`}
                  className="dd-runway-img"
                  style={{ objectPosition: `${fx}% ${fy}%` }}
                  loading={idx === 0 ? 'eager' : 'lazy'}
                  decoding={idx === 0 ? 'sync' : 'async'}
                  fetchPriority={idx === 0 ? 'high' : 'auto'}
                />
              </div>
            );
          })
        )}

        {/* Ambient Volumetric Golden Light Sweep */}
        {!reducedMotion && <div className="dd-runway-light-sweep" aria-hidden="true" />}

        {/* Editorial Left-Weighted Scrim for Uncompromising Readability */}
        <div className="dd-runway-scrim" aria-hidden="true" />
        <div
          className="dd-hero-scrim"
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: overlayColor,
            opacity: overlayOpacity,
            pointerEvents: 'none',
            zIndex: 2,
          }}
          aria-hidden="true"
        />
      </div>

      {/* Left-Side Front-Row Editorial Typography & Live-Synced Runway Look HUD */}
      <div className="dd-runway-overlay">
        <div className="dd-runway-eyebrow-row">
          <span className="dd-runway-live-dot" aria-hidden="true" />
          <span className="hero-headline-sub">{eyebrow}</span>
        </div>

        <h1 className="hero-headline">
          <span className="hero-headline-main">{headline}</span>
        </h1>

        <p className="hero-tagline">{tagline}</p>

        {/* Live-Synced Active Runway Look Callout */}
        <div className="dd-runway-look-meta" key={`meta-${safeIdx}`}>
          <span className="dd-runway-look-code">{currentLook.code}</span>
          <span className="dd-runway-look-divider" aria-hidden="true" />
          <div>
            <p className="dd-runway-look-title">{currentLook.title}</p>
            <p className="dd-runway-look-sub">{currentLook.subtitle}</p>
          </div>
        </div>

        {/* Primary & Secondary Luxury CTAs */}
        <div className="dd-runway-cta-row">
          <a href={primaryCtaUrl} className="dd-runway-cta-primary">
            <span>{primaryCtaLabel}</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m-6-6l6 6-6 6" />
            </svg>
          </a>
          <a href={secondaryCtaUrl} className="dd-runway-cta-secondary">
            {secondaryCtaLabel}
          </a>
        </div>
      </div>

      {/* Bottom-Right Interactive Runway Show Controls */}
      <div className="dd-runway-controls">
        {looks.length > 1 && (
          <div className="dd-runway-steps" role="tablist" aria-label="Select runway look">
            {looks.map((look, idx) => {
              const active = idx === safeIdx;
              const segStart = idx / looks.length;
              const segSize = 1 / looks.length;
              const segFill = showVideo
                ? Math.min(1, Math.max(0, (videoProgress - segStart) / segSize))
                : 0;
              return (
                <button
                  key={`${look.code}-${idx}`}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => goToLook(idx)}
                  className={`dd-runway-step-btn ${active ? 'is-active' : ''}`}
                >
                  <span className="dd-runway-step-num">{String(idx + 1).padStart(2, '0')}</span>
                  <span className="dd-runway-step-track">
                    {showVideo ? (
                      <span
                        className="dd-runway-step-fill"
                        style={{ transform: `scaleX(${segFill})`, transition: 'transform 0.1s linear' }}
                      />
                    ) : (
                      <span
                        key={active ? `prog-${idx}-${cycleKey}` : `prog-idle-${idx}`}
                        className={`dd-runway-step-fill ${active && !isPaused && !reducedMotion ? 'is-animating' : ''} ${active && (isPaused || reducedMotion) ? 'is-static-full' : ''
                          }`}
                        style={{ animationDuration: `${LOOK_DURATION_MS}ms` }}
                      />
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <div className="dd-runway-action-btns">
          {looks.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => goToLook(safeIdx - 1)}
                aria-label="Previous runway look"
                className="dd-runway-icon-btn"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => goToLook(safeIdx + 1)}
                aria-label="Next runway look"
                className="dd-runway-icon-btn"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => setIsPaused((p) => !p)}
            aria-label={isPaused ? 'Play runway film' : 'Pause runway film'}
            aria-pressed={isPaused}
            className="dd-runway-icon-btn"
          >
            {isPaused ? (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="6 4 20 12 6 20 6 4" />
              </svg>
            ) : (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16" />
                <rect x="14" y="4" width="4" height="16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Bottom-Center Subtle Scroll Cue */}
      <a href="#thread-of-mastery" className="dd-runway-scroll-cue" aria-label="Scroll to collection">
        <span>SCROLL</span>
        <span className="dd-runway-scroll-line" aria-hidden="true" />
      </a>
    </div>
  );
};
