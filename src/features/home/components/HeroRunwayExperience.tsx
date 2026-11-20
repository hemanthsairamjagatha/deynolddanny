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

const DEFAULT_RUNWAY_LOOKS: RunwayLook[] = [
  {
    code: 'LOOK 01',
    title: 'The Monolith Overcoat Ensemble',
    subtitle: 'Obsidian Virgin Wool · Ivory Silk · Camel Cashmere',
    image: '/images/hero-runway-1.jpg',
    ctaLabel: 'Shop Outerwear',
    ctaUrl: '/categories/overcoats',
    focalX: 66,
    focalY: 28,
    startScale: 1.0,
    endScale: 1.075,
  },
  {
    code: 'LOOK 02',
    title: 'Brushed Camel Cashmere Walk',
    subtitle: 'Single-Breasted Cashmere Overcoat · Espresso Ribbed Knit',
    image: '/images/hero-runway-2.jpg',
    ctaLabel: 'Shop Cashmere & Knit',
    ctaUrl: '/categories/knitwear',
    focalX: 64,
    focalY: 24,
    startScale: 1.0,
    endScale: 1.08,
  },
  {
    code: 'LOOK 03',
    title: 'Architectural Bespoke Tailoring',
    subtitle: 'Sculpted Obsidian Wool & Ivory Double-Breasted Suiting',
    image: '/images/hero-runway-1.jpg',
    ctaLabel: 'Explore Tailoring',
    ctaUrl: '/categories/tailoring',
    focalX: 76,
    focalY: 20,
    startScale: 1.12,
    endScale: 1.2,
  },
];

const LOOK_DURATION_MS = 6500;

export const HeroRunwayExperience: React.FC = () => {
  const [cms, setCms] = useState<HeroCmsPayload>({});
  const [activeIdx, setActiveIdx] = useState(0);
  const [prevIdx, setPrevIdx] = useState<number | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0, tx: 0, ty: 0 });
  const [cycleKey, setCycleKey] = useState(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);

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
    if (window.__ddHeroCms) {
      setCms(window.__ddHeroCms);
      setVideoFailed(false);
    }
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<HeroCmsPayload>).detail;
      if (detail && typeof detail === 'object') {
        setCms(detail);
        setVideoFailed(false);
      }
    };
    window.addEventListener('dd:hero-cms-update', handler);
    return () => window.removeEventListener('dd:hero-cms-update', handler);
  }, []);

  // Build effective runway looks list
  const looks: RunwayLook[] = React.useMemo(() => {
    if (Array.isArray(cms.runwayLooks) && cms.runwayLooks.length > 0) {
      const valid = cms.runwayLooks.filter((l) => l && typeof l.image === 'string' && l.image.trim());
      if (valid.length > 0) return valid;
    }
    // If Admin explicitly set a custom single hero image other than default, make it Look 01
    const customHero = (cms.desktopImage || cms.imageUrl || '').trim();
    if (customHero && customHero !== '/hero-banner.jpg' && customHero !== '/images/hero-runway-1.jpg') {
      return [
        {
          code: 'LOOK 01',
          title: cms.tagline || cms.description || 'Signature Tailoring',
          subtitle: cms.eyebrow || 'DEYNOLD DANNY Menswear Atelier',
          image: customHero,
          ctaLabel: cms.ctaLabel || 'Discover Collection',
          ctaUrl: cms.ctaUrl || '/categories',
          focalX: typeof cms.focalX === 'number' ? cms.focalX : 60,
          focalY: typeof cms.focalY === 'number' ? cms.focalY : 28,
          startScale: 1.0,
          endScale: 1.07,
        },
        ...DEFAULT_RUNWAY_LOOKS.slice(1),
      ];
    }
    return DEFAULT_RUNWAY_LOOKS;
  }, [cms]);

  const safeIdx = activeIdx % Math.max(1, looks.length);
  const currentLook = looks[safeIdx] ?? DEFAULT_RUNWAY_LOOKS[0];

  const videoUrl = typeof cms.videoUrl === 'string' && cms.videoUrl.trim() ? cms.videoUrl.trim() : '';
  const showVideo = Boolean(videoUrl) && !videoFailed && !reducedMotion;

  const goToLook = useCallback(
    (nextIndex: number) => {
      const normalized = ((nextIndex % looks.length) + looks.length) % looks.length;
      setPrevIdx(safeIdx);
      setActiveIdx(normalized);
      setCycleKey((k) => k + 1);
    },
    [looks.length, safeIdx],
  );

  // Auto-advance runway choreography
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

  // Sync video play/pause
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !showVideo) return;
    if (isPaused) {
      v.pause();
    } else {
      v.play().catch(() => {});
    }
  }, [isPaused, showVideo]);

  // Subtle 3D mouse depth parallax on desktop pointers
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (reducedMotion || !stageRef.current) return;
    const rect = stageRef.current.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width - 0.5; // -0.5 to 0.5
    const ny = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({
      rx: Number((-ny * 1.8).toFixed(2)),
      ry: Number((nx * 2.4).toFixed(2)),
      tx: Number((-nx * 14).toFixed(1)),
      ty: Number((-ny * 8).toFixed(1)),
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
    typeof cms.overlayOpacity === 'number' ? Math.max(0, Math.min(75, cms.overlayOpacity)) / 100 : 0.16;
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
          <video
            ref={videoRef}
            src={videoUrl}
            poster={currentLook.image || '/hero-banner.jpg'}
            autoPlay
            muted
            loop
            playsInline
            onError={() => setVideoFailed(true)}
            className="dd-runway-media"
          />
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
                className={`dd-runway-slide ${isActive ? 'is-active' : ''} ${isExiting ? 'is-exiting' : ''} ${
                  isPaused ? 'is-paused' : ''
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

      {/* Left-Side Front-Row Editorial Typography & Dynamic Look HUD */}
      <div className="dd-runway-overlay">
        <div className="dd-runway-eyebrow-row">
          <span className="dd-runway-live-dot" aria-hidden="true" />
          <span className="hero-headline-sub">{eyebrow}</span>
        </div>

        <h1 className="hero-headline">
          <span className="hero-headline-main">{headline}</span>
        </h1>

        <p className="hero-tagline">{tagline}</p>

        {/* Active Runway Look Callout Card */}
        {!showVideo && (
          <div className="dd-runway-look-meta" key={`meta-${safeIdx}`}>
            <span className="dd-runway-look-code">{currentLook.code}</span>
            <span className="dd-runway-look-divider" aria-hidden="true" />
            <div>
              <p className="dd-runway-look-title">{currentLook.title}</p>
              <p className="dd-runway-look-sub">{currentLook.subtitle}</p>
            </div>
          </div>
        )}

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
        {!showVideo && looks.length > 1 && (
          <div className="dd-runway-steps" role="tablist" aria-label="Select runway look">
            {looks.map((look, idx) => {
              const active = idx === safeIdx;
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
                    <span
                      key={active ? `prog-${idx}-${cycleKey}` : `prog-idle-${idx}`}
                      className={`dd-runway-step-fill ${active && !isPaused && !reducedMotion ? 'is-animating' : ''} ${
                        active && (isPaused || reducedMotion) ? 'is-static-full' : ''
                      }`}
                      style={{ animationDuration: `${LOOK_DURATION_MS}ms` }}
                    />
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <div className="dd-runway-action-btns">
          {!showVideo && looks.length > 1 && (
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
            aria-label={isPaused ? 'Play runway showcase' : 'Pause runway showcase'}
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
