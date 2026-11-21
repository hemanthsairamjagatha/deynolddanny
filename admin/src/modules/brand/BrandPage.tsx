import { useState, useEffect } from 'react';
import { brand as brandApi } from '../../lib/api';
import { PageHeader, Button, Input, Textarea, Card, Spinner, Badge, Modal } from '../../components/ui';
import { ImageUrlField } from '../../components/MediaPickerModal';

interface BrandSocialLink {
  platform: string;
  handle: string;
  url: string;
  visible: boolean;
}

interface BrandDraft {
  businessName: string;
  displayName: string;
  shortMark: string;
  editorialTagline: string;
  originBadgeText: string;
  houseStory: string;
  logoPrimaryUrl: string;
  logoInverseUrl: string;
  faviconUrl: string;
  ogDefaultImageUrl: string;
  conciergeEmail: string;
  privacyEmail: string;
  conciergePhone: string;
  atelierName: string;
  atelierAddress: string;
  atelierHours: string;
  gstin: string;
  cin: string;
  copyrightText: string;
  attributionText: string;
  attributionUrl: string;
  showAttribution: boolean;
  defaultMetaTitle: string;
  defaultMetaDescription: string;
  colors: Record<string, string>;
  typography: {
    displayFont: string;
    bodyFont: string;
    monoFont?: string;
  };
  socialLinks: BrandSocialLink[];
}

const DEFAULT_BRAND: BrandDraft = {
  businessName: 'DEYNOLD DANNY Atelier Pvt. Ltd.',
  displayName: 'DEYNOLD DANNY',
  shortMark: 'DD',
  editorialTagline: 'Autumn / Winter 2026 Architectural Tailoring',
  originBadgeText: 'MADE IN INDIA',
  houseStory: '',
  logoPrimaryUrl: '/logo.png',
  logoInverseUrl: '/logo.png',
  faviconUrl: '/favicon.svg',
  ogDefaultImageUrl: '/hero-banner.jpg',
  conciergeEmail: 'concierge@deynolddanny.com',
  privacyEmail: 'privacy@deynolddanny.com',
  conciergePhone: '+91 11 4820 9000',
  atelierName: 'DEYNOLD DANNY Flagship Atelier',
  atelierAddress: 'Sartorial House, New Delhi, India',
  atelierHours: 'Monday – Saturday: 10:00 – 19:00 IST',
  gstin: '',
  cin: '',
  copyrightText: '© 2026 DEYNOLD DANNY. All rights reserved.',
  attributionText: 'HANDCRAFTED BY PIXENOX SOLUTIONS',
  attributionUrl: 'https://www.pixenox.com',
  showAttribution: true,
  defaultMetaTitle: '',
  defaultMetaDescription: '',
  colors: { primary: '#001526', secondary: '#111111', accent: '#8C7355', headerBg: '#ffffff', footerBg: '#ffffff' },
  typography: { displayFont: 'Montserrat', bodyFont: 'Montserrat', monoFont: 'JetBrains Mono' },
  socialLinks: [],
};

function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-ink-700 block">{label}</label>
      <div className="flex gap-2">
        <input
          type="color"
          value={value || '#000000'}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-12 cursor-pointer rounded-lg border border-ink-200 p-0.5 bg-white"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#111111"
          className="flex-1 px-3 py-2 text-sm bg-white border border-ink-200 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-gold-400"
        />
      </div>
    </div>
  );
}

function FieldGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h3 className="text-xs font-bold text-ink-500 uppercase tracking-widest mb-4 pb-2 border-b border-ink-100">{title}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>
    </div>
  );
}

export default function BrandPage() {
  const [draft, setDraft] = useState<BrandDraft>(DEFAULT_BRAND);
  const [hasUnpublished, setHasUnpublished] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [revisions, setRevisions] = useState<Record<string, unknown>[]>([]);
  const [revModal, setRevModal] = useState(false);

  const load = () => {
    setLoading(true);
    brandApi
      .get()
      .then((res) => {
        if (res.success && res.data) {
          const d = res.data as { draft?: Partial<BrandDraft>; hasUnpublishedChanges?: boolean };
          const rawDraft = d.draft ?? (res.data as Partial<BrandDraft>);
          setDraft({
            ...DEFAULT_BRAND,
            ...rawDraft,
            colors: { ...DEFAULT_BRAND.colors, ...(rawDraft.colors ?? {}) },
            typography: { ...DEFAULT_BRAND.typography, ...(rawDraft.typography ?? {}) },
            socialLinks: Array.isArray(rawDraft.socialLinks) ? rawDraft.socialLinks : [],
          });
          setHasUnpublished(Boolean(d.hasUnpublishedChanges));
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));

    brandApi.revisions().then((res) => {
      if (res.success && res.data) {
        const raw = res.data as unknown;
        const arr = (Array.isArray(raw) ? raw : (raw as { items?: Record<string, unknown>[] }).items ?? []) as Record<string, unknown>[];
        setRevisions(arr);
      }
    });
  };

  useEffect(load, []);

  const setField = <K extends keyof BrandDraft>(k: K, v: BrandDraft[K]) => setDraft((s) => ({ ...s, [k]: v }));
  const setColor = (k: string, v: string) => setDraft((s) => ({ ...s, colors: { ...s.colors, [k]: v } }));

  const saveDraft = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await brandApi.update(draft as unknown as Record<string, unknown>);
      if (!res.success) {
        setError(res.error?.message ?? 'Failed to save brand draft.');
        return;
      }
      setNotice('Brand identity draft saved. Click "Publish Live" to update the storefront.');
      load();
    } finally {
      setSaving(false);
    }
  };

  const publishLive = async () => {
    setPublishing(true);
    setError('');
    try {
      const up = await brandApi.update(draft as unknown as Record<string, unknown>);
      if (!up.success) {
        setError(up.error?.message ?? 'Failed to save draft before publishing.');
        return;
      }
      const pub = await brandApi.publish();
      if (!pub.success) {
        setError(pub.error?.message ?? 'Failed to publish brand identity.');
        return;
      }
      setNotice('Brand identity published live to the storefront!');
      load();
    } finally {
      setPublishing(false);
    }
  };

  const restoreRevision = async (id: string) => {
    const res = await brandApi.restore(id);
    if (res.success) {
      setRevModal(false);
      setNotice('Revision restored to draft. Review and click Publish Live.');
      load();
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Brand Identity"
        description="Manage logos, colour tokens, typography, atelier contact details, GST/CIN credentials, social links, footer copyright, and default SEO."
        actions={
          <div className="flex items-center gap-2.5">
            {hasUnpublished && <Badge variant="warning">Unpublished Draft</Badge>}
            <Button variant="ghost" size="sm" onClick={() => setRevModal(true)}>
              Revision History
            </Button>
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

      <div className="max-w-4xl">
        <Card className="p-8">
          <FieldGroup title="House & Legal Identity">
            <Input label="Legal Business Name" value={draft.businessName} onChange={(e) => setField('businessName', e.target.value)} />
            <Input label="Storefront Display Name" value={draft.displayName} onChange={(e) => setField('displayName', e.target.value)} />
            <Input label="Monogram / Short Mark" value={draft.shortMark} onChange={(e) => setField('shortMark', e.target.value)} />
            <Input label="Origin Provenance Badge" value={draft.originBadgeText} onChange={(e) => setField('originBadgeText', e.target.value)} placeholder="MADE IN INDIA" />
            <div className="md:col-span-2">
              <Input label="Editorial Tagline" value={draft.editorialTagline} onChange={(e) => setField('editorialTagline', e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <Textarea label="House Story Summary" rows={2} value={draft.houseStory} onChange={(e) => setField('houseStory', e.target.value)} />
            </div>
          </FieldGroup>

          <FieldGroup title="Logos & Visual Assets">
            <div className="md:col-span-2">
              <ImageUrlField label="Primary Logo (Header & Drawer)" value={draft.logoPrimaryUrl} onChange={(url) => setField('logoPrimaryUrl', url)} tooltip="Shown centered in the storefront header and side drawer." />
            </div>
            <div className="md:col-span-2">
              <ImageUrlField label="Inverse / Dark-Background Logo" value={draft.logoInverseUrl} onChange={(url) => setField('logoInverseUrl', url)} />
            </div>
            <div className="md:col-span-2">
              <ImageUrlField label="Favicon Icon" value={draft.faviconUrl} onChange={(url) => setField('faviconUrl', url)} />
            </div>
            <div className="md:col-span-2">
              <ImageUrlField label="Default Social Share (OG) Image" value={draft.ogDefaultImageUrl} onChange={(url) => setField('ogDefaultImageUrl', url)} />
            </div>
          </FieldGroup>

          <FieldGroup title="Brand Palette & Surfaces">
            <ColorInput label="Primary Brand Colour" value={draft.colors.primary ?? '#001526'} onChange={(v) => setColor('primary', v)} />
            <ColorInput label="Accent / Gold Colour" value={draft.colors.accent ?? '#8C7355'} onChange={(v) => setColor('accent', v)} />
            <ColorInput label="Header Background" value={draft.colors.headerBg ?? '#ffffff'} onChange={(v) => setColor('headerBg', v)} />
            <ColorInput label="Footer Background" value={draft.colors.footerBg ?? '#ffffff'} onChange={(v) => setColor('footerBg', v)} />
          </FieldGroup>

          <FieldGroup title="Typography">
            <Input
              label="Display / Heading Font"
              value={draft.typography.displayFont}
              onChange={(e) => setField('typography', { ...draft.typography, displayFont: e.target.value })}
            />
            <Input
              label="Body Copy Font"
              value={draft.typography.bodyFont}
              onChange={(e) => setField('typography', { ...draft.typography, bodyFont: e.target.value })}
            />
          </FieldGroup>

          <FieldGroup title="Atelier Contact & Tax Credentials">
            <Input label="Client Concierge Email" type="email" value={draft.conciergeEmail} onChange={(e) => setField('conciergeEmail', e.target.value)} />
            <Input label="Privacy / Grievance Email" type="email" value={draft.privacyEmail} onChange={(e) => setField('privacyEmail', e.target.value)} />
            <Input label="Concierge Telephone" type="tel" value={draft.conciergePhone} onChange={(e) => setField('conciergePhone', e.target.value)} />
            <Input label="Atelier Hours" value={draft.atelierHours} onChange={(e) => setField('atelierHours', e.target.value)} />
            <Input label="Atelier Name" value={draft.atelierName} onChange={(e) => setField('atelierName', e.target.value)} />
            <Input label="Atelier Street Address" value={draft.atelierAddress} onChange={(e) => setField('atelierAddress', e.target.value)} />
            <Input label="GSTIN (Tax Invoices)" value={draft.gstin} onChange={(e) => setField('gstin', e.target.value)} />
            <Input label="CIN (Corporate Identity)" value={draft.cin} onChange={(e) => setField('cin', e.target.value)} />
          </FieldGroup>

          <div className="mb-8">
            <div className="flex items-center justify-between pb-2 mb-4 border-b border-ink-100">
              <h3 className="text-xs font-bold text-ink-500 uppercase tracking-widest">Social Channels</h3>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setField('socialLinks', [...draft.socialLinks, { platform: 'Instagram', handle: '@deynolddanny', url: 'https://instagram.com/deynolddanny', visible: true }])
                }
              >
                + Add Social Profile
              </Button>
            </div>
            <div className="space-y-2.5">
              {draft.socialLinks.map((s, idx) => (
                <div key={idx} className="grid grid-cols-1 sm:grid-cols-[120px_140px_1fr_auto] gap-2 items-center p-2.5 bg-ink-50 rounded-lg border border-ink-100">
                  <input
                    value={s.platform}
                    onChange={(e) => setField('socialLinks', draft.socialLinks.map((x, i) => (i === idx ? { ...x, platform: e.target.value } : x)))}
                    placeholder="Platform"
                    className="px-2.5 py-1.5 text-xs bg-white border border-ink-200 rounded-md"
                  />
                  <input
                    value={s.handle}
                    onChange={(e) => setField('socialLinks', draft.socialLinks.map((x, i) => (i === idx ? { ...x, handle: e.target.value } : x)))}
                    placeholder="@handle"
                    className="px-2.5 py-1.5 text-xs bg-white border border-ink-200 rounded-md"
                  />
                  <input
                    value={s.url}
                    onChange={(e) => setField('socialLinks', draft.socialLinks.map((x, i) => (i === idx ? { ...x, url: e.target.value } : x)))}
                    placeholder="https://..."
                    className="px-2.5 py-1.5 text-xs font-mono bg-white border border-ink-200 rounded-md"
                  />
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1 text-xs text-ink-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={s.visible !== false}
                        onChange={(e) => setField('socialLinks', draft.socialLinks.map((x, i) => (i === idx ? { ...x, visible: e.target.checked } : x)))}
                        className="accent-gold-500"
                      />
                      Show
                    </label>
                    <button
                      type="button"
                      onClick={() => setField('socialLinks', draft.socialLinks.filter((_, i) => i !== idx))}
                      className="text-xs text-red-600 hover:bg-red-50 px-1.5 py-1 rounded"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <FieldGroup title="Footer Copyright & Default SEO">
            <div className="md:col-span-2">
              <Input label="Footer Copyright Line" value={draft.copyrightText} onChange={(e) => setField('copyrightText', e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <Input label="Default Meta Title" value={draft.defaultMetaTitle} onChange={(e) => setField('defaultMetaTitle', e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <Textarea label="Default Meta Description" rows={3} value={draft.defaultMetaDescription} onChange={(e) => setField('defaultMetaDescription', e.target.value)} />
            </div>
          </FieldGroup>

          <div className="flex gap-3 pt-2">
            <Button onClick={saveDraft} loading={saving}>
              Save Draft
            </Button>
            <Button variant="secondary" onClick={publishLive} loading={publishing}>
              Publish Live
            </Button>
          </div>
        </Card>
      </div>

      {/* Revision History Modal */}
      <Modal open={revModal} onClose={() => setRevModal(false)} title="Brand Revision History">
        {revisions.length === 0 ? (
          <p className="text-sm text-ink-500 py-4 text-center">No revisions saved yet. Publish to record a snapshot.</p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {revisions.map((r, i) => (
              <div key={String(r.id ?? i)} className="flex items-center justify-between p-3 border border-ink-100 rounded-xl hover:bg-ink-50 transition-colors">
                <div>
                  <p className="text-sm font-medium text-ink-900">
                    v{String(r.versionNumber ?? revisions.length - i)} · <span className="capitalize text-ink-500">{String(r.action ?? 'snapshot').replace('_', ' ')}</span>
                  </p>
                  <p className="text-xs text-ink-500">{new Date(String(r.createdAt ?? r.created_at ?? '')).toLocaleString('en-IN')}</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => restoreRevision(String(r.id))}>
                  Restore
                </Button>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
