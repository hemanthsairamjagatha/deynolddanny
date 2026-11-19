import { useState, useEffect } from 'react';
import { brand as brandApi } from '../../lib/api';
import type { BrandSettings } from '../../lib/types';
import { PageHeader, Button, Input, Textarea, Card, Spinner, Badge, Modal } from '../../components/ui';

const FIELD_TOOLTIPS: Partial<Record<keyof BrandSettings, string>> = {
  businessName: 'Legal business name used in invoices, GST documents and official communications.',
  displayName: 'Public-facing brand name shown in the storefront header and customer emails.',
  tagline: 'Short brand tagline displayed in social shares and the footer area.',
  logoUrl: 'Primary logo URL. Recommended format: SVG or 2× PNG for retina displays.',
  logoAltUrl: 'Alternate (light/dark) logo URL used on contrasting backgrounds.',
  faviconUrl: 'Browser tab icon URL. Must be 32×32 or 64×64 PNG or ICO.',
  primaryColor: 'Primary brand color used for key CTAs and highlights. Use a hex value.',
  accentColor: 'Accent color for secondary elements, hover states and decorative details.',
  bodyFont: 'Sans-serif font for body text. Must be loaded via Google Fonts or self-hosted.',
  displayFont: 'Serif or display font for headings, hero titles and editorial text.',
  email: 'Public contact email shown in the storefront footer and customer-facing emails.',
  phone: 'Customer service phone number displayed in the footer and contact page.',
  gstNumber: 'GST registration number included on tax invoices.',
  instagramUrl: 'Full Instagram profile URL including https://. Leave blank to hide the icon.',
  twitterUrl: 'Full X/Twitter profile URL. Leave blank to hide the icon.',
  pinterestUrl: 'Full Pinterest profile URL. Leave blank to hide the icon.',
  youtubeUrl: 'Full YouTube channel URL. Leave blank to hide the icon.',
  footerTagline: 'Short line displayed beneath the logo in the site footer.',
  copyrightText: 'Copyright notice in the footer. Use {{year}} for the current year.',
  metaTitle: 'Default SEO title for pages that do not set their own. Max 60 characters.',
  metaDescription: 'Default meta description. Used for social shares and search engine snippets. Max 160 characters.',
};

function ColorInput({ label, value, onChange, tooltip }: { label: string; value: string; onChange: (v: string) => void; tooltip?: string }) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-sm font-medium text-ink-700">
        {label}
        {tooltip && (
          <span className="w-4 h-4 rounded-full bg-ink-200 text-ink-500 text-xs flex items-center justify-center cursor-help font-semibold" title={tooltip}>i</span>
        )}
      </label>
      <div className="flex gap-2">
        <input type="color" value={value || '#000000'} onChange={e => onChange(e.target.value)}
          className="h-9 w-12 cursor-pointer rounded-lg border border-ink-200 p-0.5 bg-white" />
        <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder="#1a1a1a"
          className="flex-1 px-3 py-2 text-sm bg-white border border-ink-200 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-gold-400" />
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
  const [settings, setSettings] = useState<Partial<BrandSettings>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [revisions, setRevisions] = useState<Record<string, unknown>[]>([]);
  const [revModal, setRevModal] = useState(false);

  useEffect(() => {
    brandApi.get().then(res => {
      if (res.success && res.data) setSettings(res.data);
      setLoading(false);
    }).catch(() => setLoading(false));
    brandApi.revisions().then(res => { if (res.success && res.data) setRevisions(res.data); });
  }, []);

  const set = (k: keyof BrandSettings, v: string) => setSettings(s => ({ ...s, [k]: v }));

  const save = async () => {
    setSaving(true);
    await brandApi.update(settings);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const publish = async () => {
    setPublishing(true);
    await brandApi.publish();
    setPublishing(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const restoreRevision = async (id: string) => {
    const res = await brandApi.restore(id);
    if (res.success && res.data) { setSettings(res.data); setRevModal(false); }
  };

  if (loading) return <div className="flex justify-center py-20"><Spinner /></div>;

  const inp = (k: keyof BrandSettings, label: string, type = 'text', wide = false) => (
    <div className={wide ? 'md:col-span-2' : ''}>
      <Input label={label} type={type} value={(settings[k] as string) ?? ''} onChange={e => set(k, e.target.value)} tooltip={FIELD_TOOLTIPS[k]} />
    </div>
  );

  return (
    <div>
      <PageHeader
        title="Brand Identity"
        description="Manage the brand, visual identity and contact information for Deynold Danny."
        actions={
          <div className="flex items-center gap-3">
            {saved && <span className="text-sm text-emerald-600 font-medium">✓ Saved</span>}
            <button onClick={() => setRevModal(true)} className="text-sm text-ink-500 hover:text-ink-800 transition-colors">Revision History</button>
            <Button variant="outline" onClick={save} loading={saving}>Save Draft</Button>
            <Button variant="secondary" onClick={publish} loading={publishing} tooltip="Publishes brand settings to the live storefront immediately.">Publish Live</Button>
          </div>
        }
      />

      <div className="max-w-3xl">
        <Card className="p-8">
          <FieldGroup title="Business Identity">
            {inp('businessName', 'Business Name')}
            {inp('displayName', 'Display Name')}
            {inp('tagline', 'Tagline', 'text', true)}
          </FieldGroup>

          <FieldGroup title="Visual Assets">
            {inp('logoUrl', 'Primary Logo URL')}
            {inp('logoAltUrl', 'Alternate Logo URL')}
            {inp('faviconUrl', 'Favicon URL')}
            {settings.logoUrl && (
              <div className="md:col-span-2 p-3 border border-ink-100 rounded-lg bg-ink-50 flex items-center gap-4">
                <img src={settings.logoUrl} alt="Logo preview" className="h-10 object-contain max-w-xs" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                <p className="text-xs text-ink-500">Logo preview</p>
              </div>
            )}
          </FieldGroup>

          <FieldGroup title="Brand Colours">
            <ColorInput label="Primary Colour" value={(settings.primaryColor as string) ?? ''} onChange={v => set('primaryColor', v)} tooltip={FIELD_TOOLTIPS.primaryColor} />
            <ColorInput label="Accent Colour" value={(settings.accentColor as string) ?? ''} onChange={v => set('accentColor', v)} tooltip={FIELD_TOOLTIPS.accentColor} />
          </FieldGroup>

          <FieldGroup title="Typography">
            {inp('bodyFont', 'Body Font')}
            {inp('displayFont', 'Display Font')}
          </FieldGroup>

          <FieldGroup title="Contact Information">
            {inp('email', 'Contact Email', 'email')}
            {inp('phone', 'Phone Number', 'tel')}
            {inp('address', 'Street Address', 'text', true)}
            {inp('city', 'City')}
            {inp('state', 'State')}
            {inp('pincode', 'PIN Code')}
            {inp('country', 'Country')}
            {inp('gstNumber', 'GST Number')}
          </FieldGroup>

          <FieldGroup title="Social Media">
            {inp('instagramUrl', 'Instagram URL')}
            {inp('twitterUrl', 'X / Twitter URL')}
            {inp('pinterestUrl', 'Pinterest URL')}
            {inp('youtubeUrl', 'YouTube URL')}
          </FieldGroup>

          <FieldGroup title="Footer & SEO">
            {inp('footerTagline', 'Footer Tagline')}
            {inp('copyrightText', 'Copyright Text')}
            {inp('metaTitle', 'Default Meta Title', 'text', true)}
            <div className="md:col-span-2">
              <Textarea label="Default Meta Description" value={(settings.metaDescription as string) ?? ''} onChange={e => set('metaDescription', e.target.value)} rows={3} tooltip={FIELD_TOOLTIPS.metaDescription} />
            </div>
          </FieldGroup>

          <div className="flex gap-3 pt-2">
            <Button onClick={save} loading={saving}>Save Draft</Button>
            <Button variant="secondary" onClick={publish} loading={publishing}>Publish Live</Button>
          </div>
        </Card>
      </div>

      {/* Revision History Modal */}
      <Modal open={revModal} onClose={() => setRevModal(false)} title="Revision History">
        {revisions.length === 0 ? (
          <p className="text-sm text-ink-500 py-4 text-center">No revisions saved yet. Publish to create a revision.</p>
        ) : (
          <div className="space-y-2">
            {revisions.map((r, i) => (
              <div key={i} className="flex items-center justify-between p-3 border border-ink-100 rounded-xl hover:bg-ink-50 transition-colors">
                <div>
                  <p className="text-sm font-medium text-ink-900">Revision {revisions.length - i}</p>
                  <p className="text-xs text-ink-500">{new Date(r.created_at as string).toLocaleString('en-IN')}</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => restoreRevision(r.id as string)}>Restore</Button>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
