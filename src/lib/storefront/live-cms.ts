// src/lib/storefront/live-cms.ts
// Complete runtime hydration bridge for published Deynold Danny Commerce OS:
// Brand tokens & logos, Announcement Bar, Header Navigation, Side Drawer,
// Footer Columns & Newsletter, Homepage Hero / Carousels / Category Grid / Editorial Duo / Custom Sections,
// and Legal / About CMS pages (plus signed Draft Preview mode).

interface CmsSectionPayload {
  id?: string;
  sectionKey?: string;
  sectionType?: string;
  section_type?: string;
  title?: string;
  sortOrder?: number;
  props?: Record<string, unknown>;
  config_json?: Record<string, unknown>;
}

interface PublishedBundle {
  brand?: Record<string, unknown>;
  navigation?: Record<string, unknown>;
  homepageSections?: CmsSectionPayload[];
  homepage?: {
    sections?: CmsSectionPayload[];
  };
}

function safeUrl(val: unknown): string | null {
  if (typeof val !== 'string') return null;
  const trimmed = val.trim();
  if (!trimmed) return null;
  if (
    trimmed.startsWith('/') ||
    trimmed.startsWith('#') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('http://')
  ) {
    return trimmed;
  }
  return null;
}

// ─── 1. BRAND IDENTITY & DESIGN TOKENS ───────────────────────────────────────
function applyBrand(brand: Record<string, unknown> | undefined) {
  if (!brand || typeof brand !== 'object') return;
  const root = document.documentElement;
  const colors = (brand.colors && typeof brand.colors === 'object' ? brand.colors : {}) as Record<string, unknown>;

  const primary = colors.primary ?? brand.primaryColor;
  if (typeof primary === 'string' && primary.trim()) {
    root.style.setProperty('--color-primary', primary.trim());
  }
  const accent = colors.accent ?? brand.accentColor;
  if (typeof accent === 'string' && accent.trim()) {
    root.style.setProperty('--color-accent', accent.trim());
  }
  if (typeof colors.headerBg === 'string' && colors.headerBg.trim()) {
    const header = document.getElementById('header');
    if (header) header.style.backgroundColor = colors.headerBg.trim();
  }
  if (typeof colors.footerBg === 'string' && colors.footerBg.trim()) {
    const footer = document.getElementById('footer');
    if (footer) footer.style.backgroundColor = colors.footerBg.trim();
  }

  const logoUrl = safeUrl(brand.logoPrimaryUrl ?? brand.logoUrl);
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

  const copyrightText = typeof brand.copyrightText === 'string' ? brand.copyrightText.trim() : '';
  if (copyrightText) {
    const el = document.querySelector<HTMLElement>('.footer-copyright-text');
    if (el) {
      el.textContent = '';
      const year = String(new Date().getFullYear());
      const resolvedCopy = copyrightText.replace(/\{\{\s*year\s*\}\}/gi, year);
      el.appendChild(document.createTextNode(resolvedCopy));

      const showAttr = brand.showAttribution !== false;
      const attrText = typeof brand.attributionText === 'string' ? brand.attributionText.trim() : '';
      const attrUrl = safeUrl(brand.attributionUrl);
      if (showAttr && attrText) {
        el.appendChild(document.createTextNode(' · '));
        if (attrUrl) {
          const a = document.createElement('a');
          a.href = attrUrl;
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          a.className = 'footer-pixenox-link';
          a.textContent = attrText;
          el.appendChild(a);
        } else {
          el.appendChild(document.createTextNode(attrText));
        }
      }
    }
  }
}

// ─── 2. ANNOUNCEMENT BAR ─────────────────────────────────────────────────────
function applyAnnouncement(navigation: Record<string, unknown> | undefined) {
  if (!navigation || typeof navigation !== 'object') return;
  const bar = navigation.announcement_bar as
    | {
        enabled?: boolean;
        dismissible?: boolean;
        text?: string;
        linkUrl?: string;
        bgColor?: string;
        textColor?: string;
        autoRotateSeconds?: number;
        messages?: Array<{ id?: string; text?: string; ctaLabel?: string; ctaUrl?: string; active?: boolean }>;
      }
    | undefined;

  const existing = document.getElementById('dd-live-announcement-bar');
  if (!bar || !bar.enabled) {
    existing?.remove();
    return;
  }

  const activeMessages: Array<{ text: string; ctaLabel?: string; ctaUrl?: string }> = [];
  if (Array.isArray(bar.messages) && bar.messages.length > 0) {
    for (const m of bar.messages) {
      if (m && m.active !== false && typeof m.text === 'string' && m.text.trim()) {
        activeMessages.push({
          text: m.text.trim(),
          ctaLabel: typeof m.ctaLabel === 'string' ? m.ctaLabel.trim() : undefined,
          ctaUrl: safeUrl(m.ctaUrl) ?? undefined,
        });
      }
    }
  } else if (typeof bar.text === 'string' && bar.text.trim()) {
    activeMessages.push({ text: bar.text.trim(), ctaUrl: safeUrl(bar.linkUrl) ?? undefined });
  }

  if (activeMessages.length === 0) {
    existing?.remove();
    return;
  }

  try {
    if (bar.dismissible !== false && window.sessionStorage.getItem('dd_announcement_dismissed') === '1') {
      return;
    }
  } catch {
    // Ignore storage restriction
  }

  if (existing) existing.remove();
  const header = document.getElementById('header');
  if (!header || !header.parentElement) return;

  const strip = document.createElement('div');
  strip.id = 'dd-live-announcement-bar';
  strip.setAttribute('role', 'region');
  strip.setAttribute('aria-label', 'Store announcement');
  strip.style.cssText = `
    position: relative;
    width: 100%;
    text-align: center;
    padding: 9px 36px;
    font-size: 11px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    line-height: 1.4;
    background-color: ${typeof bar.bgColor === 'string' && bar.bgColor ? bar.bgColor : '#111111'};
    color: ${typeof bar.textColor === 'string' && bar.textColor ? bar.textColor : '#ffffff'};
  `;

  const msgWrap = document.createElement('span');
  strip.appendChild(msgWrap);

  let idx = 0;
  const renderMsg = () => {
    const item = activeMessages[idx];
    msgWrap.textContent = '';
    msgWrap.appendChild(document.createTextNode(item.text));
    if (item.ctaUrl) {
      msgWrap.appendChild(document.createTextNode(' '));
      const a = document.createElement('a');
      a.href = item.ctaUrl;
      a.textContent = item.ctaLabel || 'DISCOVER';
      a.style.cssText = 'color: inherit; text-decoration: underline; margin-left: 8px; font-weight: 600;';
      msgWrap.appendChild(a);
    }
  };
  renderMsg();

  let timer: number | undefined;
  if (activeMessages.length > 1) {
    const intervalMs = Math.max(3, Number(bar.autoRotateSeconds ?? 6)) * 1000;
    timer = window.setInterval(() => {
      idx = (idx + 1) % activeMessages.length;
      renderMsg();
    }, intervalMs);
  }

  if (bar.dismissible !== false) {
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', 'Dismiss announcement');
    closeBtn.textContent = '×';
    closeBtn.style.cssText = `
      position: absolute;
      right: 12px;
      top: 50%;
      transform: translateY(-50%);
      background: transparent;
      border: none;
      color: inherit;
      font-size: 16px;
      cursor: pointer;
      opacity: 0.75;
      padding: 4px 6px;
    `;
    closeBtn.addEventListener('click', () => {
      if (timer) window.clearInterval(timer);
      strip.remove();
      try {
        window.sessionStorage.setItem('dd_announcement_dismissed', '1');
      } catch {
        // Ignore
      }
    });
    strip.appendChild(closeBtn);
  }

  header.parentElement.insertBefore(strip, header);
}

// ─── 3. HEADER PRIMARY NAVIGATION ────────────────────────────────────────────
function applyHeaderNavigation(navigation: Record<string, unknown> | undefined) {
  if (!navigation || typeof navigation !== 'object') return;
  const raw = navigation.header_primary;
  if (!Array.isArray(raw) || raw.length === 0) return;

  const visible = raw.filter(
    (item): item is { label: string; href: string; badge?: string | null; visible?: boolean } =>
      Boolean(item && typeof item === 'object' && (item as { visible?: boolean }).visible !== false && typeof (item as { label?: string }).label === 'string'),
  );
  if (visible.length === 0) return;

  const list = document.querySelector<HTMLUListElement>('#header .nav-tier-list');
  if (!list) return;

  list.textContent = '';
  for (const item of visible) {
    const href = safeUrl(item.href) ?? '/';
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = href;
    a.className = 'nav-tier-link';
    a.textContent = item.label.trim();

    if (typeof item.badge === 'string' && item.badge.trim()) {
      const badge = document.createElement('span');
      badge.textContent = item.badge.trim();
      badge.style.cssText =
        'margin-left: 6px; font-size: 9px; letter-spacing: 0.12em; padding: 2px 5px; background: #111111; color: #ffffff; vertical-align: middle;';
      a.appendChild(badge);
    }

    li.appendChild(a);
    list.appendChild(li);
  }
}

// ─── 4. SIDE / MOBILE NAVIGATION DRAWER ──────────────────────────────────────
function applyDrawerNavigation(navigation: Record<string, unknown> | undefined) {
  if (!navigation || typeof navigation !== 'object') return;
  const drawerData = navigation.header_drawer as
    | {
        collections?: Array<{ label?: string; href?: string }>;
        services?: Array<{ label?: string; href?: string }>;
      }
    | undefined;
  if (!drawerData || typeof drawerData !== 'object') return;

  const closeDrawer = () => {
    const toggle = document.getElementById('nav-toggle') as HTMLInputElement | null;
    if (toggle) toggle.checked = false;
  };

  if (Array.isArray(drawerData.collections) && drawerData.collections.length > 0) {
    const mainWrap = document.querySelector<HTMLElement>('#side-drawer .drawer-links-main');
    if (mainWrap) {
      mainWrap.textContent = '';
      for (const item of drawerData.collections) {
        if (!item?.label?.trim()) continue;
        const a = document.createElement('a');
        a.href = safeUrl(item.href) ?? '/categories';
        a.className = 'drawer-link-serif';
        const span = document.createElement('span');
        span.textContent = item.label.trim();
        a.appendChild(span);
        a.insertAdjacentHTML(
          'beforeend',
          '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>',
        );
        a.addEventListener('click', closeDrawer);
        mainWrap.appendChild(a);
      }
    }
  }

  if (Array.isArray(drawerData.services) && drawerData.services.length > 0) {
    const subWrap = document.querySelector<HTMLElement>('#side-drawer .drawer-links-sub');
    if (subWrap) {
      subWrap.textContent = '';
      for (const item of drawerData.services) {
        if (!item?.label?.trim()) continue;
        const a = document.createElement('a');
        a.href = safeUrl(item.href) ?? '/contact';
        a.className = 'drawer-link-sans';
        a.textContent = item.label.trim();
        a.addEventListener('click', closeDrawer);
        subWrap.appendChild(a);
      }
    }
  }
}

// ─── 5. FOOTER COLUMNS & NEWSLETTER ──────────────────────────────────────────
function applyFooterNavigation(navigation: Record<string, unknown> | undefined) {
  if (!navigation || typeof navigation !== 'object') return;
  const footerData = navigation.footer_columns as
    | {
        columns?: Array<{ id?: string; title?: string; links?: Array<{ label?: string; href?: string }> }>;
        newsletter?: {
          enabled?: boolean;
          heading?: string;
          description?: string;
          placeholder?: string;
        };
      }
    | undefined;
  if (!footerData || typeof footerData !== 'object') return;

  const grid = document.querySelector<HTMLElement>('#footer .footer-top-grid');
  const newsletterCol = document.querySelector<HTMLElement>('#footer .footer-col-newsletter');

  if (grid && Array.isArray(footerData.columns) && footerData.columns.length > 0) {
    // Remove existing static nav columns while preserving the Newsletter column
    grid.querySelectorAll('.footer-col-nav').forEach((el) => el.remove());

    for (const col of footerData.columns) {
      if (!col || (!col.title && (!Array.isArray(col.links) || col.links.length === 0))) continue;
      const colDiv = document.createElement('div');
      colDiv.className = 'footer-col footer-col-nav';

      if (col.title?.trim()) {
        const h4 = document.createElement('h4');
        h4.className = 'footer-col-title';
        h4.textContent = col.title.trim();
        colDiv.appendChild(h4);
      }

      const ul = document.createElement('ul');
      ul.className = 'footer-link-list';

      for (const link of col.links ?? []) {
        if (!link?.label?.trim()) continue;
        const li = document.createElement('li');
        const href = (link.href ?? '').trim();

        if (href === '#search') {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'footer-link footer-search-trigger';
          btn.textContent = link.label.trim();
          btn.addEventListener('click', () => window.dispatchEvent(new CustomEvent('open-search-modal')));
          li.appendChild(btn);
        } else if (href === '#cookie-preferences') {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'footer-link footer-consent-trigger';
          btn.textContent = link.label.trim();
          btn.addEventListener('click', () => window.dispatchEvent(new CustomEvent('dd:open-consent-preferences')));
          li.appendChild(btn);
        } else {
          const a = document.createElement('a');
          a.href = safeUrl(href) ?? '/';
          a.className = 'footer-link';
          a.textContent = link.label.trim();
          li.appendChild(a);
        }
        ul.appendChild(li);
      }

      colDiv.appendChild(ul);
      if (newsletterCol) {
        grid.insertBefore(colDiv, newsletterCol);
      } else {
        grid.appendChild(colDiv);
      }
    }
  }

  if (footerData.newsletter && newsletterCol) {
    const nl = footerData.newsletter;
    newsletterCol.style.display = nl.enabled === false ? 'none' : '';
    if (typeof nl.heading === 'string' && nl.heading.trim()) {
      const h = newsletterCol.querySelector<HTMLElement>('.footer-heading-newsletter');
      if (h) h.textContent = nl.heading.trim();
    }
    if (typeof nl.description === 'string' && nl.description.trim()) {
      const p = newsletterCol.querySelector<HTMLElement>('.footer-text-newsletter');
      if (p) p.textContent = nl.description.trim();
    }
    if (typeof nl.placeholder === 'string' && nl.placeholder.trim()) {
      const inp = newsletterCol.querySelector<HTMLInputElement>('#newsletter-email');
      if (inp) inp.placeholder = nl.placeholder.trim();
    }
  }
}

// ─── 6. HOMEPAGE HERO, CAROUSELS, CATEGORY GRID & EDITORIAL DUO ──────────────
function applyHomepageSections(sections: CmsSectionPayload[] | undefined) {
  if (!Array.isArray(sections) || window.location.pathname !== '/') return;

  // A. Primary Hero Banner (3D Runway Showcase + Native Looping Video Support)
  const hero = sections.find((s) => (s.sectionType ?? s.section_type) === 'hero_banner');
  if (hero) {
    const props = hero.props ?? hero.config_json ?? {};
    const sanitizedHero: Record<string, unknown> = {
      ...props,
      desktopImage: safeUrl(props.desktopImage) ?? undefined,
      mobileImage: safeUrl(props.mobileImage) ?? undefined,
      imageUrl: safeUrl(props.imageUrl) ?? undefined,
      videoUrl: safeUrl(props.videoUrl) ?? undefined,
      ctaUrl: safeUrl(props.ctaUrl) ?? undefined,
      secondaryCtaUrl: safeUrl(props.secondaryCtaUrl) ?? undefined,
      runwayLooks: Array.isArray(props.runwayLooks)
        ? (props.runwayLooks as Array<Record<string, unknown>>)
            .map((l) => ({
              ...l,
              image: safeUrl(l.image) ?? '',
              ctaUrl: safeUrl(l.ctaUrl) ?? '/categories',
            }))
            .filter((l) => Boolean(l.image))
        : undefined,
    };

    // Hydrate React HeroRunwayExperience cleanly via window cache + CustomEvent
    (window as unknown as { __ddHeroCms?: Record<string, unknown> }).__ddHeroCms = sanitizedHero;
    window.dispatchEvent(new CustomEvent('dd:hero-cms-update', { detail: sanitizedHero }));
  }

  // B. Product Carousels headings & View All links
  const carousels = sections.filter((s) => (s.sectionType ?? s.section_type) === 'product_carousel');
  carousels.forEach((car, index) => {
    const props = car.props ?? car.config_json ?? {};
    const targetId =
      props.sectionId === 'mastery' || index === 0
        ? 'thread-of-mastery'
        : props.sectionId === 'new-collection' || index === 1
          ? 'new-arrival'
          : null;
    if (!targetId) return;
    const secEl = document.getElementById(targetId);
    if (!secEl) return;
    if (typeof props.title === 'string' && props.title.trim()) {
      const h2 = secEl.querySelector<HTMLElement>('h2');
      if (h2) h2.textContent = props.title.trim();
    }
    const ctaUrl = safeUrl(props.ctaUrl);
    if (ctaUrl) {
      const link = secEl.querySelector<HTMLAnchorElement>('a[href*="/categories"], a[href*="/collections"]');
      if (link) {
        link.href = ctaUrl;
        if (typeof props.ctaLabel === 'string' && props.ctaLabel.trim()) {
          link.textContent = props.ctaLabel.trim();
        }
      }
    }
  });

  // C. Category Editorial Grid
  const catGrid = sections.find((s) => (s.sectionType ?? s.section_type) === 'category_grid');
  if (catGrid) {
    const props = catGrid.props ?? catGrid.config_json ?? {};
    const items = Array.isArray(props.items)
      ? (props.items as Array<{
          title?: string;
          subtitle?: string;
          href?: string;
          desktopImage?: string;
          mobileImage?: string;
          focalX?: number;
          focalY?: number;
        }>)
      : [];
    const gridEl = document.querySelector<HTMLElement>('#categories .editorial-categories-grid');
    if (gridEl && items.length > 0) {
      const isMobile = window.matchMedia('(max-width: 640px)').matches;
      gridEl.textContent = '';
      for (const item of items) {
        if (!item?.title?.trim()) continue;
        const a = document.createElement('a');
        a.href = safeUrl(item.href) ?? '/categories';
        a.className = 'editorial-category-card';
        a.setAttribute('aria-label', item.title.trim());

        const wrap = document.createElement('div');
        wrap.className = 'category-image-wrap';

        const img = document.createElement('img');
        img.src = safeUrl(isMobile ? item.mobileImage || item.desktopImage : item.desktopImage) ?? '/images/category-abiti.jpg';
        img.alt = item.subtitle?.trim() || item.title.trim();
        img.className = 'category-bg-img';
        img.loading = 'lazy';
        if (item.focalX !== undefined && item.focalY !== undefined) {
          img.style.objectPosition = `${item.focalX}% ${item.focalY}%`;
        }
        wrap.appendChild(img);

        const grad = document.createElement('div');
        grad.className = 'category-gradient-overlay';
        grad.setAttribute('aria-hidden', 'true');
        wrap.appendChild(grad);
        a.appendChild(wrap);

        const overlay = document.createElement('div');
        overlay.className = 'category-content-overlay image-text image-text-left';
        const h2 = document.createElement('h2');
        h2.className = 'category-headline image-text-title';
        h2.textContent = item.title.trim();
        overlay.appendChild(h2);
        a.appendChild(overlay);

        gridEl.appendChild(a);
      }
    }
  }

  // D. Editorial Duo & Additional Custom Sections (e.g., extra campaign hero or promo strip)
  const mainContent = document.getElementById('main-content');
  if (mainContent) {
    mainContent.querySelectorAll('.dd-dynamic-cms-section').forEach((el) => el.remove());

    const editorialDuo = sections.find((s) => (s.sectionType ?? s.section_type) === 'editorial_duo');
    if (editorialDuo) {
      const props = editorialDuo.props ?? editorialDuo.config_json ?? {};
      const panels = Array.isArray(props.items)
        ? (props.items as Array<{
            eyebrow?: string;
            title?: string;
            description?: string;
            ctaLabel?: string;
            href?: string;
            desktopImage?: string;
          }>)
        : [];
      if (panels.length > 0) {
        const sec = document.createElement('section');
        sec.id = 'editorial-duo';
        sec.className = 'dd-dynamic-cms-section';
        sec.style.cssText = 'max-width: 1440px; margin: 48px auto; padding: 0 24px;';

        const grid = document.createElement('div');
        grid.style.cssText = 'display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px;';

        for (const p of panels) {
          const card = document.createElement('a');
          card.href = safeUrl(p.href) ?? '/categories';
          card.style.cssText =
            'position: relative; display: block; aspect-ratio: 4/5; overflow: hidden; background: #111; color: #fff; text-decoration: none;';

          const img = document.createElement('img');
          img.src = safeUrl(p.desktopImage) ?? '/images/category-scarpe.jpg';
          img.alt = p.title ?? '';
          img.loading = 'lazy';
          img.style.cssText = 'width: 100%; height: 100%; object-fit: cover; transition: transform 0.7s ease;';
          card.appendChild(img);

          const scrim = document.createElement('div');
          scrim.style.cssText =
            'position: absolute; inset: 0; background: linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.12) 55%, transparent 100%);';
          card.appendChild(scrim);

          const body = document.createElement('div');
          body.style.cssText = 'position: absolute; bottom: 28px; left: 28px; right: 28px; z-index: 2;';
          if (p.eyebrow) {
            const eb = document.createElement('p');
            eb.textContent = p.eyebrow;
            eb.style.cssText = 'font-size: 10px; letter-spacing: 0.24em; text-transform: uppercase; opacity: 0.85; margin: 0 0 6px;';
            body.appendChild(eb);
          }
          if (p.title) {
            const h3 = document.createElement('h3');
            h3.textContent = p.title;
            h3.style.cssText = 'font-size: 24px; font-weight: 400; letter-spacing: 0.04em; margin: 0 0 8px;';
            body.appendChild(h3);
          }
          if (p.description) {
            const d = document.createElement('p');
            d.textContent = p.description;
            d.style.cssText = 'font-size: 13px; line-height: 1.5; opacity: 0.9; margin: 0 0 14px; max-width: 420px;';
            body.appendChild(d);
          }
          if (p.ctaLabel) {
            const cta = document.createElement('span');
            cta.textContent = p.ctaLabel;
            cta.style.cssText =
              'display: inline-block; font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; border-bottom: 1px solid #ffffff; padding-bottom: 3px;';
            body.appendChild(cta);
          }
          card.appendChild(body);
          grid.appendChild(card);
        }

        sec.appendChild(grid);
        const latestNews = document.getElementById('latest-news');
        if (latestNews) {
          mainContent.insertBefore(sec, latestNews);
        } else {
          mainContent.appendChild(sec);
        }
      }
    }

    // Any extra promotional announcement strips added inside Homepage
    const promoStrips = sections.filter((s) => (s.sectionType ?? s.section_type) === 'announcement');
    for (const ps of promoStrips) {
      const props = ps.props ?? ps.config_json ?? {};
      if (typeof props.text !== 'string' || !props.text.trim()) continue;
      const div = document.createElement('div');
      div.className = 'dd-dynamic-cms-section';
      div.style.cssText = `
        width: 100%;
        padding: 18px 24px;
        text-align: center;
        font-size: 12px;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        background: ${typeof props.bgColor === 'string' && props.bgColor ? props.bgColor : '#111111'};
        color: ${typeof props.textColor === 'string' && props.textColor ? props.textColor : '#ffffff'};
      `;
      const linkUrl = safeUrl(props.linkUrl);
      if (linkUrl) {
        const a = document.createElement('a');
        a.href = linkUrl;
        a.textContent = props.text.trim();
        a.style.cssText = 'color: inherit; text-decoration: none;';
        div.appendChild(a);
      } else {
        div.textContent = props.text.trim();
      }
      mainContent.appendChild(div);
    }
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

// ─── 7. LEGAL & EDITORIAL CMS DOCUMENT PAGES ─────────────────────────────────
function applyLegalDocument(sections: CmsSectionPayload[] | undefined) {
  const container = document.querySelector<HTMLElement>('[data-cms-page]');
  if (!container || !Array.isArray(sections)) return;
  const docSec = sections.find((s) => (s.sectionType ?? s.section_type) === 'legal_document');
  if (!docSec) return;
  const props = docSec.props ?? docSec.config_json ?? {};

  if (typeof props.eyebrow === 'string' && props.eyebrow.trim()) {
    const el = container.querySelector<HTMLElement>('[data-cms-eyebrow]');
    if (el) el.textContent = props.eyebrow.trim();
  }
  if (typeof props.heading === 'string' && props.heading.trim()) {
    const el = container.querySelector<HTMLElement>('[data-cms-heading]');
    if (el) el.textContent = props.heading.trim();
  }
  if (typeof props.effectiveDate === 'string' && props.effectiveDate.trim()) {
    const el = container.querySelector<HTMLElement>('[data-cms-effective]');
    if (el) el.textContent = props.effectiveDate.trim();
  }

  const clausesEl = container.querySelector<HTMLElement>('[data-cms-clauses]');
  const clauses = props.sections as Array<{ heading?: string; body?: string; id?: string }> | undefined;
  if (clausesEl && Array.isArray(clauses) && clauses.length > 0) {
    clausesEl.innerHTML = '';
    for (const c of clauses) {
      if (!c || (!c.heading && !c.body)) continue;
      const sec = document.createElement('section');
      sec.className = 'space-y-2.5 scroll-mt-28';
      if (typeof c.id === 'string' && c.id) sec.id = c.id;
      else if (typeof c.heading === 'string' && /return|refund|cancel/i.test(c.heading) && !document.getElementById('returns')) {
        sec.id = 'returns';
      } else if (typeof c.heading === 'string' && /shipping|dispatch|delivery/i.test(c.heading) && !document.getElementById('shipping')) {
        sec.id = 'shipping';
      }

      if (typeof c.heading === 'string' && c.heading.trim()) {
        const h2 = document.createElement('h2');
        h2.className = 'text-base font-serif text-neutral-900 uppercase tracking-wide font-medium';
        h2.textContent = c.heading.trim();
        sec.appendChild(h2);
      }
      if (typeof c.body === 'string' && c.body.trim()) {
        const p = document.createElement('p');
        p.textContent = c.body.trim();
        sec.appendChild(p);
      }
      clausesEl.appendChild(sec);
    }
  }
}

export async function hydrateLiveStorefront(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const params = new URLSearchParams(window.location.search);
    const previewToken = params.get('dd_preview');
    const cmsPageSlug = document.querySelector<HTMLElement>('[data-cms-page]')?.dataset.cmsPage;

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
          sections?: CmsSectionPayload[];
        };
      };
      if (json.success && json.data) {
        mountPreviewBanner();
        applyBrand(json.data.brand);
        applyAnnouncement(json.data.navigation);
        applyHeaderNavigation(json.data.navigation);
        applyDrawerNavigation(json.data.navigation);
        applyFooterNavigation(json.data.navigation);
        applyHomepageSections(json.data.sections);
        applyLegalDocument(json.data.sections);
      }
      return;
    }

    const res = await fetch('/api/storefront/published', { credentials: 'omit' });
    if (res.ok) {
      const json = (await res.json()) as { success?: boolean; data?: PublishedBundle };
      if (json.success && json.data) {
        applyBrand(json.data.brand);
        applyAnnouncement(json.data.navigation);
        applyHeaderNavigation(json.data.navigation);
        applyDrawerNavigation(json.data.navigation);
        applyFooterNavigation(json.data.navigation);
        // Support BOTH top-level homepageSections (canonical) and nested homepage.sections
        const homeSecs = json.data.homepageSections ?? json.data.homepage?.sections;
        applyHomepageSections(homeSecs);
      }
    }

    if (cmsPageSlug) {
      const pageRes = await fetch(`/api/storefront/pages/${encodeURIComponent(cmsPageSlug)}`, {
        credentials: 'omit',
      });
      if (pageRes.ok) {
        const pageJson = (await pageRes.json()) as {
          success?: boolean;
          data?: {
            sections?: CmsSectionPayload[];
          };
        };
        if (pageJson.success && pageJson.data?.sections) {
          applyLegalDocument(pageJson.data.sections);
        }
      }
    }
  } catch {
    // Silent fail-safe: static pre-rendered luxury storefront remains untouched.
  }
}
