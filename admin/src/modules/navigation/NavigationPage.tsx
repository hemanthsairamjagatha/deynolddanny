import { useState, useEffect } from 'react';
import { navigation as navApi } from '../../lib/api';
import type { NavMenu } from '../../lib/types';
import { PageHeader, Button, Badge, statusVariant, Card, Tabs, Spinner, InfoTooltip } from '../../components/ui';

const MENU_TABS = [
  { id: 'announcement', label: 'Announcement Bar' },
  { id: 'header', label: 'Header Nav' },
  { id: 'drawer', label: 'Mobile Drawer' },
  { id: 'footer', label: 'Footer Nav' },
  { id: 'cookie', label: 'Cookie Policy' },
];

export default function NavigationPage() {
  const [menus, setMenus] = useState<NavMenu[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeKey, setActiveKey] = useState('announcement');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [jsonErrors, setJsonErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [saved, setSaved] = useState('');

  useEffect(() => {
    navApi.list().then(res => {
      if (res.success && res.data) {
        setMenus(res.data);
        const initial: Record<string, string> = {};
        for (const m of res.data) {
          initial[m.menu_key] = JSON.stringify(m.items_json ?? [], null, 2);
        }
        setDrafts(initial);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const activeMenu = menus.find(m => m.menu_key === activeKey);

  const handleChange = (key: string, val: string) => {
    setDrafts(d => ({ ...d, [key]: val }));
    try {
      JSON.parse(val);
      setJsonErrors(e => ({ ...e, [key]: '' }));
    } catch (err: unknown) {
      setJsonErrors(e => ({ ...e, [key]: err instanceof Error ? err.message : 'Invalid JSON' }));
    }
  };

  const saveDraft = async () => {
    const val = drafts[activeKey] ?? '[]';
    if (jsonErrors[activeKey]) return;
    setSaving(true);
    await navApi.update(activeKey, JSON.parse(val));
    setSaved(activeKey);
    setTimeout(() => setSaved(''), 3000);
    setSaving(false);
  };

  const publish = async () => {
    if (jsonErrors[activeKey]) return;
    setPublishing(true);
    await navApi.update(activeKey, JSON.parse(drafts[activeKey] ?? '[]'));
    await navApi.publish(activeKey);
    setSaved(activeKey + '_pub');
    setTimeout(() => setSaved(''), 3000);
    setPublishing(false);
  };

  if (loading) return <div className="flex justify-center py-20"><Spinner /></div>;

  return (
    <div>
      <PageHeader
        title="Navigation Menus"
        description="Manage the announcement bar, header, mobile drawer, and footer navigation."
      />

      <Tabs tabs={MENU_TABS} active={activeKey} onChange={setActiveKey} />

      <div className="max-w-3xl">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <h2 className="text-base font-semibold text-ink-900">{MENU_TABS.find(t => t.id === activeKey)?.label}</h2>
              {activeMenu && <Badge variant={statusVariant(activeMenu.status)}>{activeMenu.status}</Badge>}
            </div>
            <div className="flex items-center gap-3">
              {saved === activeKey && <span className="text-sm text-emerald-600 font-medium">✓ Draft saved</span>}
              {saved === activeKey + '_pub' && <span className="text-sm text-emerald-600 font-medium">✓ Published live</span>}
              <Button variant="outline" size="sm" onClick={saveDraft} loading={saving}>Save Draft</Button>
              <Button variant="secondary" size="sm" onClick={publish} loading={publishing}>
                Publish Live
                <InfoTooltip text="Publishes this navigation menu to the live storefront immediately. Visitors will see the updated menu within seconds." />
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-sm font-medium text-ink-700">
              Menu Items (JSON)
              <InfoTooltip text='Edit navigation items as JSON. Each item: { "id": "unique-id", "label": "Link Text", "url": "/path", "children": [] }' />
            </label>
            <textarea
              value={drafts[activeKey] ?? '[]'}
              onChange={e => handleChange(activeKey, e.target.value)}
              rows={18}
              className={`w-full px-3 py-3 text-xs font-mono bg-ink-950 text-emerald-300 border rounded-xl focus:outline-none focus:ring-2 focus:ring-gold-400 resize-y ${jsonErrors[activeKey] ? 'border-red-400' : 'border-ink-800'}`}
              spellCheck={false}
            />
            {jsonErrors[activeKey] && (
              <p className="text-xs text-red-600 font-mono bg-red-50 px-3 py-2 rounded-lg">{jsonErrors[activeKey]}</p>
            )}
          </div>

          <div className="mt-4 p-3 bg-ink-50 rounded-xl">
            <p className="text-xs text-ink-500 font-medium mb-1">JSON Structure Reference</p>
            <pre className="text-xs text-ink-600 font-mono leading-relaxed">{`[
  { "id": "home", "label": "Home", "url": "/" },
  { "id": "collections", "label": "Collections", "url": "/collections",
    "children": [
      { "id": "new", "label": "New Arrivals", "url": "/collections/new" }
    ]
  }
]`}</pre>
          </div>
        </Card>
      </div>
    </div>
  );
}
