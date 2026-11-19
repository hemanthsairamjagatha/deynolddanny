// src/lib/storefront/live-cms.ts
// Lightweight runtime hydration bridge for published Deynold Danny Commerce OS
// brand tokens, announcement bars, and CMS page sections (plus signed draft preview).

interface PublishedBundle {
  brand?: Record<string, unknown>;
  navigation?: Record<string, unknown>;
  homepage?: {
    sections?: Array<{
      sectionType?: string;
      section_type?: string;
      props?: Record<string, unknown>;
      config_json?: Record<string, unknown>;
    }>;
  };
}

function safeUrl(val: unknown): string | null {
  if (typeof val !== 'string') return null;
  const trimmed = val.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('/') || trimmed.startsWith('https://') || trimmed.startsWith('http://')) {
    return trimmed;
  }
  return null;
}

function applyBrand(brand: Record<string, unknown> | undefined) {
  if (!brand || typeof brand !== 'object') return;
  const root = document.documentElement;
  if (typeof brand.primaryColor === 'string' && brand.primaryColor.trim()) {
    root.style.setProperty('--color-primary', brand.primaryColor.trim());
  }
  if (typeof brand.accentColor === 'string' && brand.accentColor.trim()) {
    root.style.setProperty('--color-accent', brand.accentColor.trim());
  }

  const logoUrl = safeUrl(brand.logoUrl);
  if (logoUrl) {
    document.querySelectorAll<HTMLImageElement>('img.brand-logo-img, img.drawer-brand-img').forEach((img) => {
      img.src = logoUrl;
      if (typeof brand.displayName === 'string' && brand.displayName.trim()) {
        img.alt = brand.displayName.trim();
      }
    });
  }

  const faviconUrl = safeUrl(brand.faviconUrl);
  if (faviconUrl) {
    const iconLink = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (iconLink) iconLink.href = faviconUrl;
  }

  if (typeof brand.copyrightText === 'string' && brand.copyrightText.trim()) {
    const el = document.querySelector<HTMLElement>('.footer-copyright-text');
    if (el) el.textContent = brand.copyrightText.trim();
  }
}

function applyAnnouncement(navigation: Record<string, unknown> | undefined) {
  if (!navigation || typeof navigation !== 'object') return;
  const bar = navigation.announcement_bar as
    | { enabled?: boolean; text?: string; linkUrl?: string; bgColor?: string; textColor?: string }
    | undefined;
  if (!bar || !bar.enabled || !bar.text?.trim()) return;
  if (document.getElementById('dd-live-announcement-bar')) return;

  const header = document.getElementById('header');
  if (!header || !header.parentElement) return;

  const strip = document.createElement('div');
  strip.id = 'dd-live-announcement-bar';
  strip.setAttribute('role', 'region');
  strip.setAttribute('aria-label', 'Store announcement');
  strip.style.cssText = `
    width: 100%;
    text-align: center;
    padding: 8px 16px;
    font-size: 11px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    background-color: ${typeof bar.bgColor === 'string' && bar.bgColor ? bar.bgColor : '#111111'};
    color: ${typeof bar.textColor === 'string' && bar.textColor ? bar.textColor : '#ffffff'};
  `;

  const linkUrl = safeUrl(bar.linkUrl);
  if (linkUrl) {
    const a = document.createElement('a');
    a.href = linkUrl;
    a.textContent = bar.text.trim();
    a.style.cssText = 'color: inherit; text-decoration: none;';
    strip.appendChild(a);
  } else {
    strip.textContent = bar.text.trim();
  }

  header.parentElement.insertBefore(strip, header);
}

function applyHomepageSections(
  sections:
    | Array<{
        sectionType?: string;
        section_type?: string;
        props?: Record<string, unknown>;
        config_json?: Record<string, unknown>;
      }>
    | undefined,
) {
  if (!Array.isArray(sections) || window.location.pathname !== '/') return;
  const hero = sections.find((s) => (s.sectionType ?? s.section_type) === 'hero_banner');
  if (!hero) return;
  const props = hero.props ?? hero.config_json ?? {};

  const isMobile = window.matchMedia('(max-width: 640px)').matches;
  const imgUrl = safeUrl(isMobile ? (props.mobileImage || props.desktopImage || props.imageUrl) : (props.desktopImage || props.imageUrl));
  const imgEl = document.querySelector<HTMLImageElement>('#hero .hero-banner-img');
  if (imgEl) {
    if (imgUrl) imgEl.src = imgUrl;
    const fx = Number(props.focalX ?? props.focal_x);
    const fy = Number(props.focalY ?? props.focal_y);
    if (!Number.isNaN(fx) && !Number.isNaN(fy) && (props.focalX !== undefined || props.focal_x !== undefined)) {
      imgEl.style.objectPosition = `${Math.max(0, Math.min(100, fx))}% ${Math.max(0, Math.min(100, fy))}%`;
    }
  }

  if (typeof props.eyebrow === 'string' && props.eyebrow.trim()) {
    const sub = document.querySelector<HTMLElement>('#hero .hero-headline-sub');
    if (sub) sub.textContent = props.eyebrow.trim();
  }
  if (typeof props.headline === 'string' && props.headline.trim()) {
    const main = document.querySelector<HTMLElement>('#hero .hero-headline-main');
    if (main) main.textContent = props.headline.trim();
  }
  if (typeof props.tagline === 'string' && props.tagline.trim()) {
    const tag = document.querySelector<HTMLElement>('#hero .hero-tagline');
    if (tag) tag.textContent = props.tagline.trim();
  }
}

function mountPreviewBanner() {
  if (document.getElementById('dd-preview-banner')) return;
  const banner = document.createElement('div');
  banner.id = 'dd-preview-banner';
  banner.style.cssText = `
    position: fixed;
    bottom: 16px;
    right: 16px;
    z-index: 9999;
    background: #141311;
    color: #f6f4ef;
    border: 1px solid #c5a572;
    border-radius: 999px;
    padding: 10px 18px;
    font-size: 11px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    box-shadow: 0 12px 32px rgba(0,0,0,0.35);
    display: flex;
    align-items: center;
    gap: 12px;
  `;

  const label = document.createElement('span');
  label.textContent = 'Draft Preview Mode';
  const exit = document.createElement('a');
  exit.href = window.location.pathname;
  exit.textContent = 'Exit';
  exit.style.cssText = 'color: #c5a572; text-decoration: underline; font-weight: 600;';

  banner.appendChild(label);
  banner.appendChild(exit);
  document.body.appendChild(banner);
}

export async function hydrateLiveStorefront(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const params = new URLSearchParams(window.location.search);
    const previewToken = params.get('dd_preview');

    if (previewToken) {
      const res = await fetch(`/api/storefront/preview?token=${encodeURIComponent(previewToken)}`, {
        credentials: 'omit',
      });
      if (!res.ok) return;
      const json = (await res.json()) as {
        success?: boolean;
        data?: {
          brand?: Record<string, unknown>;
          navigation?: Record<string, unknown>;
          sections?: PublishedBundle['homepage'] extends { sections?: infer S } ? S : never;
        };
      };
      if (json.success && json.data) {
        mountPreviewBanner();
        applyBrand(json.data.brand);
        applyAnnouncement(json.data.navigation);
        applyHomepageSections(json.data.sections);
      }
      return;
    }

    const res = await fetch('/api/storefront/published', { credentials: 'omit' });
    if (!res.ok) return;
    const json = (await res.json()) as { success?: boolean; data?: PublishedBundle };
    if (!json.success || !json.data) return;

    applyBrand(json.data.brand);
    applyAnnouncement(json.data.navigation);
    applyHomepageSections(json.data.homepage?.sections);
  } catch {
    // Silent fail-safe: static pre-rendered luxury storefront remains untouched.
  }
}
