import { useState, useEffect } from 'react';
import { navigation as navApi } from '../../lib/api';
import { PageHeader, Button, Badge, Card, Tabs, Spinner, Input, Textarea } from '../../components/ui';
import { ImageUrlField } from '../../components/MediaPickerModal';

interface NavMenuRecord {
  id: string;
  menuKey: string;
  title: string;
  draft: unknown;
  published: unknown;
  hasUnpublishedChanges: boolean;
  publishedAt?: string | null;
  updatedAt?: string | null;
}

interface AnnouncementMessage {
  id: string;
  text: string;
  ctaLabel?: string;
  ctaUrl?: string;
  active: boolean;
}

interface AnnouncementDraft {
  enabled: boolean;
  dismissible: boolean;
  bgColor: string;
  textColor: string;
  autoRotateSeconds: number;
  messages: AnnouncementMessage[];
}

interface HeaderNavLink {
  id: string;
  label: string;
  href: string;
  badge?: string | null;
  visible: boolean;
  megaMenu?: {
    enabled: boolean;
    columns: Array<{ title: string; links: Array<{ label: string; href: string }> }>;
    featuredCard?: { title: string; subtitle: string; image: string; href: string };
  };
}

interface DrawerDraft {
  collections: Array<{ label: string; href: string }>;
  services: Array<{ label: string; href: string }>;
}

interface FooterLink {
  label: string;
  href: string;
  action?: 'link' | 'search' | 'cookie-preferences';
}

interface FooterColumn {
  id: string;
  title: string;
  links: FooterLink[];
}

interface FooterDraft {
  columns: FooterColumn[];
  newsletter: {
    enabled: boolean;
    heading: string;
    description: string;
    placeholder: string;
    buttonLabel: string;
    successMessage: string;
  };
}

interface CookieDraft {
  enabled: boolean;
  title: string;
  description: string;
  acceptAllLabel: string;
  essentialOnlyLabel: string;
  policyLabel: string;
  policyUrl: string;
}

const MENU_TABS = [
  { id: 'header_primary', label: 'Header Nav' },
  { id: 'footer_columns', label: 'Footer & Newsletter' },
  { id: 'announcement_bar', label: 'Announcement Bar' },
  { id: 'header_drawer', label: 'Side / Mobile Drawer' },
  { id: 'cookie_banner', label: 'Cookie Banner' },
];

const QUICK_ROUTES = [
  { label: 'Homepage', href: '/' },
  { label: 'All Categories', href: '/categories' },
  { label: 'Suits', href: '/categories/suits' },
  { label: 'Tailoring', href: '/categories/tailoring' },
  { label: 'Shirts', href: '/categories/shirts' },
  { label: 'Trousers', href: '/categories/trousers' },
  { label: 'Coats & Outerwear', href: '/categories/coats' },
  { label: 'Sweaters & Knitwear', href: '/categories/sweaters' },
  { label: 'Footwear', href: '/categories/footwear' },
  { label: 'Accessories', href: '/categories/accessories' },
  { label: 'About The House', href: '/about' },
  { label: 'Contact Concierge', href: '/contact' },
  { label: 'Track Order', href: '/orders/track' },
  { label: 'Client Account', href: '/account' },
  { label: 'Wishlist', href: '/wishlist' },
  { label: 'Privacy Policy', href: '/legal/privacy-policy' },
  { label: 'Shipping & Returns', href: '/legal/shipping-returns' },
  { label: 'Terms & Conditions', href: '/legal/terms' },
  { label: 'Cookie Policy', href: '/legal/cookie-policy' },
  { label: 'Open Search Dialog', href: '#search' },
  { label: 'Open Cookie Preferences', href: '#cookie-preferences' },
];

function moveItem<T>(arr: T[], idx: number, dir: -1 | 1): T[] {
  const target = idx + dir;
  if (target < 0 || target >= arr.length) return arr;
  const copy = [...arr];
  [copy[idx], copy[target]] = [copy[target], copy[idx]];
  return copy;
}

export default function NavigationPage() {
  const [menus, setMenus] = useState<NavMenuRecord[]>([]);
  const [drafts, setDrafts] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [activeKey, setActiveKey] = useState('header_primary');
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [showAdvancedJson, setShowAdvancedJson] = useState(false);
  const [expandedMega, setExpandedMega] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    navApi
      .list()
      .then((res) => {
        if (res.success && res.data) {
          const raw = res.data as unknown;
          const items = (Array.isArray(raw) ? raw : (raw as { items?: Record<string, unknown>[] }).items ?? []) as Record<string, unknown>[];
          const normalized: NavMenuRecord[] = items.map((m) => ({
            id: String(m.id ?? ''),
            menuKey: String(m.menuKey ?? m.menu_key ?? ''),
            title: String(m.title ?? ''),
            draft: m.draft ?? m.items_json ?? {},
            published: m.published ?? m.items_json ?? {},
            hasUnpublishedChanges: Boolean(m.hasUnpublishedChanges),
            publishedAt: m.publishedAt ? String(m.publishedAt) : null,
            updatedAt: m.updatedAt ? String(m.updatedAt) : null,
          }));
          setMenus(normalized);
          const initDrafts: Record<string, unknown> = {};
          for (const m of normalized) {
            initDrafts[m.menuKey] = m.draft;
          }
          setDrafts(initDrafts);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(load, []);

  const activeMenu = menus.find((m) => m.menuKey === activeKey);
  const setDraftFor = (key: string, val: unknown) => {
    setDrafts((prev) => ({ ...prev, [key]: val }));
  };

  const saveDraft = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await navApi.update(activeKey, drafts[activeKey]);
      if (!res.success) {
        setError(res.error?.message ?? 'Failed to save draft.');
        return;
      }
      setNotice(`Draft saved for ${MENU_TABS.find((t) => t.id === activeKey)?.label}. Click "Publish Live" to push to the storefront.`);
      load();
    } finally {
      setSaving(false);
    }
  };

  const publishLive = async () => {
    setPublishing(true);
    setError('');
    try {
      const up = await navApi.update(activeKey, drafts[activeKey]);
      if (!up.success) {
        setError(up.error?.message ?? 'Failed to save draft before publishing.');
        return;
      }
      const pub = await navApi.publish(activeKey);
      if (!pub.success) {
        setError(pub.error?.message ?? 'Failed to publish menu.');
        return;
      }
      setNotice(`Published live! Your ${MENU_TABS.find((t) => t.id === activeKey)?.label} changes are now live on the storefront.`);
      load();
    } finally {
      setPublishing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    );
  }

  // ─── 1. HEADER PRIMARY NAV EDITOR ──────────────────────────────────────────
  const renderHeaderEditor = () => {
    const raw = drafts.header_primary;
    const links: HeaderNavLink[] = Array.isArray(raw) ? (raw as HeaderNavLink[]) : [];
    const updateLinks = (next: HeaderNavLink[]) => setDraftFor('header_primary', next);

    const addLink = () => {
      updateLinks([
        ...links,
        {
          id: `hn_${Date.now().toString(36)}`,
          label: 'NEW LINK',
          href: '/categories',
          badge: null,
          visible: true,
          megaMenu: { enabled: false, columns: [] },
        },
      ]);
    };

    return (
      <div className="space-y-6">
        {/* Live Preview Bar */}
        <div className="p-5 bg-white border border-ink-200 rounded-xl">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-400 mb-3">Live Header Navigation Preview</p>
          <div className="border-t border-b border-ink-200 py-3 flex flex-wrap items-center justify-center gap-6">
            {links
              .filter((l) => l.visible !== false)
              .map((l) => (
                <span key={l.id} className="text-xs tracking-[0.14em] uppercase text-ink-900 flex items-center gap-1.5">
                  {l.label || 'Untitled'}
                  {l.badge && (
                    <span className="text-[9px] px-1.5 py-0.5 bg-ink-900 text-white rounded-sm tracking-wider">{l.badge}</span>
                  )}
                </span>
              ))}
            {links.filter((l) => l.visible !== false).length === 0 && (
              <span className="text-xs text-ink-400 italic">No visible links</span>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-ink-900">Top Navigation Links ({links.length})</h3>
            <p className="text-xs text-ink-500">Add, rename, reorder, hide, or configure dropdown mega-menus for your desktop header bar.</p>
          </div>
          <Button size="sm" onClick={addLink}>
            + Add Header Link
          </Button>
        </div>

        <div className="space-y-3">
          {links.map((item, idx) => (
            <div key={item.id || idx} className={`p-4 border rounded-xl bg-white space-y-3 ${item.visible === false ? 'opacity-60 border-dashed border-ink-300' : 'border-ink-200'}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-ink-400">#{idx + 1}</span>
                  <label className="flex items-center gap-1.5 text-xs font-medium text-ink-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={item.visible !== false}
                      onChange={(e) => updateLinks(links.map((l, i) => (i === idx ? { ...l, visible: e.target.checked } : l)))}
                      className="accent-gold-500"
                    />
                    Visible
                  </label>
                </div>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="ghost" disabled={idx === 0} onClick={() => updateLinks(moveItem(links, idx, -1))}>
                    ↑
                  </Button>
                  <Button size="sm" variant="ghost" disabled={idx === links.length - 1} onClick={() => updateLinks(moveItem(links, idx, 1))}>
                    ↓
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setExpandedMega(expandedMega === item.id ? null : item.id)}
                  >
                    {expandedMega === item.id ? 'Hide Mega Menu' : 'Mega Menu'}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-600 hover:bg-red-50"
                    onClick={() => updateLinks(links.filter((_, i) => i !== idx))}
                  >
                    Delete
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Input
                  label="Link Label"
                  value={item.label}
                  onChange={(e) => updateLinks(links.map((l, i) => (i === idx ? { ...l, label: e.target.value } : l)))}
                  placeholder="e.g. Tailoring"
                />
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-ink-700 block">Destination URL</label>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={item.href}
                      onChange={(e) => updateLinks(links.map((l, i) => (i === idx ? { ...l, href: e.target.value } : l)))}
                      placeholder="/categories/suits"
                      className="flex-1 min-w-0 px-3 py-2 text-sm bg-white border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-400"
                    />
                    <select
                      aria-label="Quick pick route"
                      value=""
                      onChange={(e) => {
                        if (!e.target.value) return;
                        updateLinks(links.map((l, i) => (i === idx ? { ...l, href: e.target.value } : l)));
                      }}
                      className="w-24 px-2 py-2 text-xs bg-ink-50 border border-ink-200 rounded-lg text-ink-600"
                    >
                      <option value="">Presets…</option>
                      {QUICK_ROUTES.map((r) => (
                        <option key={r.href} value={r.href}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <Input
                  label="Optional Badge"
                  value={item.badge ?? ''}
                  onChange={(e) => updateLinks(links.map((l, i) => (i === idx ? { ...l, badge: e.target.value || null } : l)))}
                  placeholder="e.g. NEW (leave empty for none)"
                />
              </div>

              {/* Collapsible Mega Menu Editor */}
              {expandedMega === item.id && (
                <div className="mt-3 pt-3 border-t border-ink-100 bg-ink-50/50 rounded-lg p-4 space-y-4">
                  <label className="flex items-center gap-2 text-xs font-semibold text-ink-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(item.megaMenu?.enabled)}
                      onChange={(e) =>
                        updateLinks(
                          links.map((l, i) =>
                            i === idx
                              ? {
                                  ...l,
                                  megaMenu: {
                                    enabled: e.target.checked,
                                    columns: l.megaMenu?.columns ?? [],
                                    featuredCard: l.megaMenu?.featuredCard,
                                  },
                                }
                              : l,
                          ),
                        )
                      }
                      className="accent-gold-500"
                    />
                    Enable Dropdown Mega Menu for &ldquo;{item.label}&rdquo;
                  </label>

                  {item.megaMenu?.enabled && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <Input
                          label="Featured Card Title"
                          value={item.megaMenu.featuredCard?.title ?? ''}
                          onChange={(e) =>
                            updateLinks(
                              links.map((l, i) =>
                                i === idx
                                  ? {
                                      ...l,
                                      megaMenu: {
                                        ...l.megaMenu!,
                                        featuredCard: {
                                          title: e.target.value,
                                          subtitle: l.megaMenu?.featuredCard?.subtitle ?? '',
                                          image: l.megaMenu?.featuredCard?.image ?? '/hero-banner.jpg',
                                          href: l.megaMenu?.featuredCard?.href ?? '/categories',
                                        },
                                      },
                                    }
                                  : l,
                              ),
                            )
                          }
                        />
                        <Input
                          label="Featured Card Link"
                          value={item.megaMenu.featuredCard?.href ?? ''}
                          onChange={(e) =>
                            updateLinks(
                              links.map((l, i) =>
                                i === idx
                                  ? {
                                      ...l,
                                      megaMenu: {
                                        ...l.megaMenu!,
                                        featuredCard: {
                                          title: l.megaMenu?.featuredCard?.title ?? '',
                                          subtitle: l.megaMenu?.featuredCard?.subtitle ?? '',
                                          image: l.megaMenu?.featuredCard?.image ?? '/hero-banner.jpg',
                                          href: e.target.value,
                                        },
                                      },
                                    }
                                  : l,
                              ),
                            )
                          }
                        />
                        <div className="md:col-span-2">
                          <ImageUrlField
                            label="Featured Card Image"
                            value={item.megaMenu.featuredCard?.image ?? ''}
                            onChange={(url) =>
                              updateLinks(
                                links.map((l, i) =>
                                  i === idx
                                    ? {
                                        ...l,
                                        megaMenu: {
                                          ...l.megaMenu!,
                                          featuredCard: {
                                            title: l.megaMenu?.featuredCard?.title ?? '',
                                            subtitle: l.megaMenu?.featuredCard?.subtitle ?? '',
                                            image: url,
                                            href: l.megaMenu?.featuredCard?.href ?? '/categories',
                                          },
                                        },
                                      }
                                    : l,
                                ),
                              )
                            }
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ─── 2. FOOTER COLUMNS & NEWSLETTER EDITOR ─────────────────────────────────
  const renderFooterEditor = () => {
    const raw = (drafts.footer_columns ?? {}) as Partial<FooterDraft>;
    const columns: FooterColumn[] = Array.isArray(raw.columns) ? raw.columns : [];
    const newsletter = raw.newsletter ?? {
      enabled: true,
      heading: 'Newsletter',
      description: 'Never miss any news and be the first to know about sale and offers',
      placeholder: 'Email',
      buttonLabel: 'Subscribe',
      successMessage: 'Thank you for subscribing to DEYNOLD DANNY.',
    };

    const updateFooter = (patch: Partial<FooterDraft>) => {
      setDraftFor('footer_columns', { columns, newsletter, ...patch });
    };

    const addColumn = () => {
      updateFooter({
        columns: [
          ...columns,
          {
            id: `fc_${Date.now().toString(36)}`,
            title: 'NEW COLUMN',
            links: [{ label: 'New Link', href: '/about' }],
          },
        ],
      });
    };

    return (
      <div className="space-y-8">
        {/* Footer Columns */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-ink-900">Footer Link Columns ({columns.length})</h3>
              <p className="text-xs text-ink-500">
                Add columns, edit headings, and manage every footer link. Use <code className="text-[11px]">#search</code> for the Search popup or{' '}
                <code className="text-[11px]">#cookie-preferences</code> for the DPDP Cookie Settings modal.
              </p>
            </div>
            <Button size="sm" onClick={addColumn}>
              + Add Footer Column
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {columns.map((col, colIdx) => (
              <div key={col.id || colIdx} className="p-4 border border-ink-200 rounded-xl bg-white space-y-4">
                <div className="flex items-center justify-between gap-2 pb-2 border-b border-ink-100">
                  <input
                    type="text"
                    value={col.title}
                    onChange={(e) =>
                      updateFooter({
                        columns: columns.map((c, i) => (i === colIdx ? { ...c, title: e.target.value } : c)),
                      })
                    }
                    placeholder="COLUMN HEADING"
                    className="flex-1 text-xs font-bold uppercase tracking-[0.15em] text-ink-900 bg-ink-50 px-2.5 py-1.5 rounded-lg border border-ink-200 focus:outline-none focus:ring-2 focus:ring-gold-400"
                  />
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="ghost" disabled={colIdx === 0} onClick={() => updateFooter({ columns: moveItem(columns, colIdx, -1) })}>
                      ←
                    </Button>
                    <Button size="sm" variant="ghost" disabled={colIdx === columns.length - 1} onClick={() => updateFooter({ columns: moveItem(columns, colIdx, 1) })}>
                      →
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-600 hover:bg-red-50"
                      onClick={() => updateFooter({ columns: columns.filter((_, i) => i !== colIdx) })}
                    >
                      Delete
                    </Button>
                  </div>
                </div>

                <div className="space-y-2.5">
                  {(col.links ?? []).map((link, linkIdx) => (
                    <div key={linkIdx} className="p-2.5 bg-ink-50/70 border border-ink-100 rounded-lg space-y-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={link.label}
                          onChange={(e) =>
                            updateFooter({
                              columns: columns.map((c, ci) =>
                                ci === colIdx
                                  ? { ...c, links: c.links.map((l, li) => (li === linkIdx ? { ...l, label: e.target.value } : l)) }
                                  : c,
                              ),
                            })
                          }
                          placeholder="Link label (e.g. PRIVACY POLICY)"
                          className="flex-1 px-2.5 py-1.5 text-xs bg-white border border-ink-200 rounded-md focus:outline-none focus:ring-2 focus:ring-gold-400"
                        />
                        <button
                          type="button"
                          disabled={linkIdx === 0}
                          onClick={() =>
                            updateFooter({
                              columns: columns.map((c, ci) => (ci === colIdx ? { ...c, links: moveItem(c.links, linkIdx, -1) } : c)),
                            })
                          }
                          className="px-1.5 py-1 text-xs text-ink-500 hover:bg-ink-200 rounded disabled:opacity-30"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          disabled={linkIdx === col.links.length - 1}
                          onClick={() =>
                            updateFooter({
                              columns: columns.map((c, ci) => (ci === colIdx ? { ...c, links: moveItem(c.links, linkIdx, 1) } : c)),
                            })
                          }
                          className="px-1.5 py-1 text-xs text-ink-500 hover:bg-ink-200 rounded disabled:opacity-30"
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            updateFooter({
                              columns: columns.map((c, ci) =>
                                ci === colIdx ? { ...c, links: c.links.filter((_, li) => li !== linkIdx) } : c,
                              ),
                            })
                          }
                          className="px-1.5 py-1 text-xs text-red-600 hover:bg-red-50 rounded"
                        >
                          ✕
                        </button>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={link.href}
                          onChange={(e) =>
                            updateFooter({
                              columns: columns.map((c, ci) =>
                                ci === colIdx
                                  ? { ...c, links: c.links.map((l, li) => (li === linkIdx ? { ...l, href: e.target.value } : l)) }
                                  : c,
                              ),
                            })
                          }
                          placeholder="/legal/privacy-policy"
                          className="flex-1 px-2.5 py-1.5 text-xs font-mono bg-white border border-ink-200 rounded-md focus:outline-none focus:ring-2 focus:ring-gold-400"
                        />
                        <select
                          aria-label="Quick pick route"
                          value=""
                          onChange={(e) => {
                            if (!e.target.value) return;
                            const chosen = QUICK_ROUTES.find((r) => r.href === e.target.value);
                            updateFooter({
                              columns: columns.map((c, ci) =>
                                ci === colIdx
                                  ? {
                                      ...c,
                                      links: c.links.map((l, li) =>
                                        li === linkIdx
                                          ? {
                                              ...l,
                                              href: e.target.value,
                                              label: l.label === 'New Link' && chosen ? chosen.label.toUpperCase() : l.label,
                                            }
                                          : l,
                                      ),
                                    }
                                  : c,
                              ),
                            });
                          }}
                          className="w-24 px-1.5 py-1.5 text-[11px] bg-white border border-ink-200 rounded-md text-ink-600"
                        >
                          <option value="">Presets…</option>
                          {QUICK_ROUTES.map((r) => (
                            <option key={r.href} value={r.href}>
                              {r.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full justify-center border-dashed"
                    onClick={() =>
                      updateFooter({
                        columns: columns.map((c, ci) =>
                          ci === colIdx ? { ...c, links: [...c.links, { label: 'New Link', href: '/about' }] } : c,
                        ),
                      })
                    }
                  >
                    + Add Link to &ldquo;{col.title || 'Column'}&rdquo;
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer Newsletter Block */}
        <div className="p-5 border border-ink-200 rounded-xl bg-white space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-ink-900">Footer Newsletter Signup Block</h3>
              <p className="text-xs text-ink-500">Customize the newsletter headline, invitation copy, placeholder, and confirmation text.</p>
            </div>
            <label className="flex items-center gap-2 text-xs font-semibold text-ink-800 cursor-pointer">
              <input
                type="checkbox"
                checked={newsletter.enabled !== false}
                onChange={(e) => updateFooter({ newsletter: { ...newsletter, enabled: e.target.checked } })}
                className="accent-gold-500"
              />
              Show Newsletter Block
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Newsletter Heading"
              value={newsletter.heading}
              onChange={(e) => updateFooter({ newsletter: { ...newsletter, heading: e.target.value } })}
            />
            <Input
              label="Input Placeholder"
              value={newsletter.placeholder}
              onChange={(e) => updateFooter({ newsletter: { ...newsletter, placeholder: e.target.value } })}
            />
            <div className="md:col-span-2">
              <Textarea
                label="Description Copy"
                rows={2}
                value={newsletter.description}
                onChange={(e) => updateFooter({ newsletter: { ...newsletter, description: e.target.value } })}
              />
            </div>
            <Input
              label="Confirmation Message"
              value={newsletter.successMessage}
              onChange={(e) => updateFooter({ newsletter: { ...newsletter, successMessage: e.target.value } })}
            />
          </div>
        </div>
      </div>
    );
  };

  // ─── 3. ANNOUNCEMENT BAR EDITOR ────────────────────────────────────────────
  const renderAnnouncementEditor = () => {
    const raw = (drafts.announcement_bar ?? {}) as Partial<AnnouncementDraft>;
    const bar: AnnouncementDraft = {
      enabled: raw.enabled !== false,
      dismissible: raw.dismissible !== false,
      bgColor: raw.bgColor || '#111111',
      textColor: raw.textColor || '#ffffff',
      autoRotateSeconds: Number(raw.autoRotateSeconds ?? 6),
      messages: Array.isArray(raw.messages) ? raw.messages : [],
    };
    const updateBar = (patch: Partial<AnnouncementDraft>) => setDraftFor('announcement_bar', { ...bar, ...patch });

    const previewMsg = bar.messages.find((m) => m.active !== false);

    return (
      <div className="space-y-6">
        {/* Live Strip Preview */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-400 mb-2">Live Announcement Bar Preview</p>
          <div
            className="w-full py-2.5 px-4 text-center text-[11px] tracking-[0.18em] uppercase rounded-lg border border-ink-200"
            style={{ backgroundColor: bar.bgColor, color: bar.textColor, opacity: bar.enabled ? 1 : 0.4 }}
          >
            {bar.enabled
              ? previewMsg
                ? `${previewMsg.text}${previewMsg.ctaLabel ? ` — ${previewMsg.ctaLabel}` : ''}`
                : 'Add an active message below to display the announcement bar'
              : 'Announcement Bar is currently disabled'}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 border border-ink-200 rounded-xl bg-white">
          <label className="flex items-center gap-2 text-sm font-medium text-ink-800 cursor-pointer">
            <input type="checkbox" checked={bar.enabled} onChange={(e) => updateBar({ enabled: e.target.checked })} className="accent-gold-500" />
            Enabled Globally
          </label>
          <label className="flex items-center gap-2 text-sm font-medium text-ink-800 cursor-pointer">
            <input type="checkbox" checked={bar.dismissible} onChange={(e) => updateBar({ dismissible: e.target.checked })} className="accent-gold-500" />
            Allow Close (✕)
          </label>
          <div className="flex items-center gap-2">
            <input type="color" value={bar.bgColor} onChange={(e) => updateBar({ bgColor: e.target.value })} className="w-8 h-8 rounded border cursor-pointer" />
            <div className="flex-1">
              <p className="text-[11px] text-ink-500">Background</p>
              <p className="text-xs font-mono text-ink-800">{bar.bgColor}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="color" value={bar.textColor} onChange={(e) => updateBar({ textColor: e.target.value })} className="w-8 h-8 rounded border cursor-pointer" />
            <div className="flex-1">
              <p className="text-[11px] text-ink-500">Text Colour</p>
              <p className="text-xs font-mono text-ink-800">{bar.textColor}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-ink-900">Rotating Announcement Messages ({bar.messages.length})</h3>
          <Button
            size="sm"
            onClick={() =>
              updateBar({
                messages: [
                  ...bar.messages,
                  { id: `ann_${Date.now().toString(36)}`, text: 'COMPLIMENTARY EXPRESS SHIPPING ON ORDERS OVER ₹10,000', ctaLabel: 'SHOP NOW', ctaUrl: '/categories', active: true },
                ],
              })
            }
          >
            + Add Message
          </Button>
        </div>

        <div className="space-y-3">
          {bar.messages.map((m, idx) => (
            <div key={m.id || idx} className="p-4 border border-ink-200 rounded-xl bg-white space-y-3">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-xs font-medium text-ink-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={m.active !== false}
                    onChange={(e) => updateBar({ messages: bar.messages.map((x, i) => (i === idx ? { ...x, active: e.target.checked } : x)) })}
                    className="accent-gold-500"
                  />
                  Active
                </label>
                <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50" onClick={() => updateBar({ messages: bar.messages.filter((_, i) => i !== idx) })}>
                  Remove
                </Button>
              </div>
              <Input
                label="Message Text"
                value={m.text}
                onChange={(e) => updateBar({ messages: bar.messages.map((x, i) => (i === idx ? { ...x, text: e.target.value } : x)) })}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="CTA Label (Optional)"
                  value={m.ctaLabel ?? ''}
                  onChange={(e) => updateBar({ messages: bar.messages.map((x, i) => (i === idx ? { ...x, ctaLabel: e.target.value } : x)) })}
                  placeholder="e.g. DISCOVER"
                />
                <Input
                  label="CTA URL (Optional)"
                  value={m.ctaUrl ?? ''}
                  onChange={(e) => updateBar({ messages: bar.messages.map((x, i) => (i === idx ? { ...x, ctaUrl: e.target.value } : x)) })}
                  placeholder="/categories/suits"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ─── 4. SIDE / MOBILE DRAWER EDITOR ────────────────────────────────────────
  const renderDrawerEditor = () => {
    const raw = (drafts.header_drawer ?? {}) as Partial<DrawerDraft>;
    const drawer: DrawerDraft = {
      collections: Array.isArray(raw.collections) ? raw.collections : [],
      services: Array.isArray(raw.services) ? raw.services : [],
    };
    const updateDrawer = (patch: Partial<DrawerDraft>) => setDraftFor('header_drawer', { ...drawer, ...patch });

    const renderGroup = (title: string, key: 'collections' | 'services') => {
      const list = drawer[key];
      return (
        <div className="p-4 border border-ink-200 rounded-xl bg-white space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-ink-100">
            <h3 className="text-sm font-semibold text-ink-900">
              {title} ({list.length})
            </h3>
            <Button size="sm" variant="outline" onClick={() => updateDrawer({ [key]: [...list, { label: 'New Item', href: '/categories' }] })}>
              + Add Link
            </Button>
          </div>
          {list.map((item, idx) => (
            <div key={idx} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 items-center">
              <input
                type="text"
                value={item.label}
                onChange={(e) => updateDrawer({ [key]: list.map((x, i) => (i === idx ? { ...x, label: e.target.value } : x)) })}
                placeholder="Label"
                className="px-3 py-1.5 text-sm bg-white border border-ink-200 rounded-lg"
              />
              <input
                type="text"
                value={item.href}
                onChange={(e) => updateDrawer({ [key]: list.map((x, i) => (i === idx ? { ...x, href: e.target.value } : x)) })}
                placeholder="/categories/..."
                className="px-3 py-1.5 text-xs font-mono bg-white border border-ink-200 rounded-lg"
              />
              <div className="flex items-center gap-1">
                <button type="button" disabled={idx === 0} onClick={() => updateDrawer({ [key]: moveItem(list, idx, -1) })} className="px-2 py-1 text-xs hover:bg-ink-100 rounded disabled:opacity-30">
                  ↑
                </button>
                <button type="button" disabled={idx === list.length - 1} onClick={() => updateDrawer({ [key]: moveItem(list, idx, 1) })} className="px-2 py-1 text-xs hover:bg-ink-100 rounded disabled:opacity-30">
                  ↓
                </button>
                <button type="button" onClick={() => updateDrawer({ [key]: list.filter((_, i) => i !== idx) })} className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded">
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      );
    };

    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {renderGroup('The Collections (Main Links)', 'collections')}
        {renderGroup('Client Services (Utility Links)', 'services')}
      </div>
    );
  };

  // ─── 5. COOKIE BANNER EDITOR ───────────────────────────────────────────────
  const renderCookieEditor = () => {
    const raw = (drafts.cookie_banner ?? {}) as Partial<CookieDraft>;
    const cookie: CookieDraft = {
      enabled: raw.enabled !== false,
      title: raw.title ?? 'Client Privacy & Cookie Governance',
      description: raw.description ?? '',
      acceptAllLabel: raw.acceptAllLabel ?? 'Accept All',
      essentialOnlyLabel: raw.essentialOnlyLabel ?? 'Essential Only',
      policyLabel: raw.policyLabel ?? 'Privacy Policy',
      policyUrl: raw.policyUrl ?? '/legal/privacy-policy',
    };
    const updateCookie = (patch: Partial<CookieDraft>) => setDraftFor('cookie_banner', { ...cookie, ...patch });

    return (
      <div className="p-5 border border-ink-200 rounded-xl bg-white space-y-4 max-w-2xl">
        <label className="flex items-center gap-2 text-sm font-semibold text-ink-900 cursor-pointer">
          <input type="checkbox" checked={cookie.enabled} onChange={(e) => updateCookie({ enabled: e.target.checked })} className="accent-gold-500" />
          Show Cookie Governance Banner to First-Time Visitors
        </label>
        <Input label="Banner Title" value={cookie.title} onChange={(e) => updateCookie({ title: e.target.value })} />
        <Textarea label="Privacy Notice Description" rows={3} value={cookie.description} onChange={(e) => updateCookie({ description: e.target.value })} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Accept All Button" value={cookie.acceptAllLabel} onChange={(e) => updateCookie({ acceptAllLabel: e.target.value })} />
          <Input label="Essential Only Button" value={cookie.essentialOnlyLabel} onChange={(e) => updateCookie({ essentialOnlyLabel: e.target.value })} />
          <Input label="Policy Link Label" value={cookie.policyLabel} onChange={(e) => updateCookie({ policyLabel: e.target.value })} />
          <Input label="Policy URL" value={cookie.policyUrl} onChange={(e) => updateCookie({ policyUrl: e.target.value })} />
        </div>
      </div>
    );
  };

  return (
    <div>
      <PageHeader
        title="Navigation, Header & Footer"
        description="Visually manage your desktop header menu, side drawer, announcement bar, footer columns, newsletter signup, and cookie banner — zero code required."
        actions={
          <div className="flex items-center gap-2.5">
            {activeMenu?.hasUnpublishedChanges && <Badge variant="warning">Unpublished Draft</Badge>}
            <Button variant="outline" size="sm" onClick={saveDraft} loading={saving}>
              Save Draft
            </Button>
            <Button variant="secondary" size="sm" onClick={publishLive} loading={publishing}>
              Publish Live
            </Button>
          </div>
        }
      />

      {notice && (
        <div className="mb-5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm px-4 py-3 rounded-xl flex justify-between items-center">
          <span>{notice}</span>
          <button onClick={() => setNotice('')} className="text-xs underline">
            Dismiss
          </button>
        </div>
      )}
      {error && (
        <div className="mb-5 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-xs underline">
            Dismiss
          </button>
        </div>
      )}

      <Tabs tabs={MENU_TABS} active={activeKey} onChange={setActiveKey} />

      <Card className="p-6">
        {activeKey === 'header_primary' && renderHeaderEditor()}
        {activeKey === 'footer_columns' && renderFooterEditor()}
        {activeKey === 'announcement_bar' && renderAnnouncementEditor()}
        {activeKey === 'header_drawer' && renderDrawerEditor()}
        {activeKey === 'cookie_banner' && renderCookieEditor()}

        {/* Optional collapsible power-user JSON view */}
        <div className="mt-8 pt-4 border-t border-ink-100">
          <button
            type="button"
            onClick={() => setShowAdvancedJson((v) => !v)}
            className="text-xs text-ink-400 hover:text-ink-700 transition-colors"
          >
            {showAdvancedJson ? '▾ Hide Raw JSON Inspector' : '▸ Show Raw JSON Inspector (Advanced)'}
          </button>
          {showAdvancedJson && (
            <pre className="mt-2 p-3 bg-ink-950 text-emerald-300 text-xs font-mono rounded-xl overflow-x-auto max-h-72">
              {JSON.stringify(drafts[activeKey] ?? {}, null, 2)}
            </pre>
          )}
        </div>
      </Card>
    </div>
  );
}
