import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { cms } from '../../lib/api';
import { PageHeader, Button, Badge, statusVariant, Card, DataTable, Modal, Input, Select } from '../../components/ui';
import type { Column } from '../../components/ui';

interface NormalizedCmsPage {
  id: string;
  slug: string;
  routePath: string;
  title: string;
  pageType: string;
  status: string;
  sectionCount: number;
  isSystemRoute: boolean;
  updatedAt: string;
}

const PAGE_TYPES = [
  { value: 'custom', label: 'Custom / Editorial Page' },
  { value: 'legal', label: 'Legal / Policy Document' },
  { value: 'collection', label: 'Collection Page' },
  { value: 'category_template', label: 'Category Template' },
  { value: 'home', label: 'Homepage' },
  { value: 'pdp_global', label: 'Product Detail (Global)' },
  { value: 'contact', label: 'Contact / Concierge Page' },
  { value: 'utility', label: 'Utility Page' },
];

export default function StudioPage() {
  const navigate = useNavigate();
  const [pages, setPages] = useState<NormalizedCmsPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ title: '', slug: '', pageType: 'custom' });

  const load = () => {
    setLoading(true);
    cms.pages.list().then(res => {
      if (res.success && res.data) {
        const raw = res.data as unknown;
        const arr = (Array.isArray(raw) ? raw : (raw as { items?: Record<string, unknown>[] }).items ?? []) as Record<string, unknown>[];
        setPages(
          arr.map(p => ({
            id: String(p.id ?? ''),
            slug: String(p.slug ?? ''),
            routePath: String(p.routePath ?? p.route_path ?? `/${p.slug ?? ''}`),
            title: String(p.title ?? ''),
            pageType: String(p.pageType ?? p.page_type ?? 'custom'),
            status: String(p.status ?? 'draft'),
            sectionCount: Number(p.sectionCount ?? p.section_count ?? 0),
            isSystemRoute: Boolean(p.isSystemRoute ?? p.is_system_route),
            updatedAt: String(p.updatedAt ?? p.updated_at ?? ''),
          })),
        );
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(load, []);

  const autoSlug = (title: string) => title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const create = async () => {
    if (!form.title || !form.slug) return;
    setCreating(true);
    setError('');
    try {
      const res = await cms.pages.create({
        title: form.title.trim(),
        slug: form.slug.trim(),
        pageType: form.pageType,
      });
      if (!res.success) {
        setError(res.error?.message ?? 'Failed to create page');
        return;
      }
      setModal(false);
      setForm({ title: '', slug: '', pageType: 'custom' });
      load();
    } finally {
      setCreating(false);
    }
  };

  const publish = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await cms.pages.publish(id);
    load();
  };

  const deletePage = async (p: NormalizedCmsPage, e: React.MouseEvent) => {
    e.stopPropagation();
    if (p.isSystemRoute) return;
    if (!confirm(`Delete "${p.title}"? This cannot be undone.`)) return;
    await cms.pages.delete(p.id);
    load();
  };

  const cols: Column<NormalizedCmsPage>[] = [
    {
      key: 'title',
      header: 'Page',
      render: p => (
        <div>
          <span className="font-medium text-ink-900">{p.title}</span>
          {p.isSystemRoute && <span className="ml-2 text-[10px] uppercase tracking-wider text-gold-700 bg-gold-50 px-1.5 py-0.5 rounded">System</span>}
        </div>
      ),
    },
    { key: 'routePath', header: 'Route', render: p => <code className="text-xs bg-ink-100 px-2 py-0.5 rounded">{p.routePath}</code> },
    { key: 'pageType', header: 'Type', render: p => <span className="text-sm text-ink-600 capitalize">{p.pageType.replace('_', ' ')}</span> },
    { key: 'sectionCount', header: 'Sections', render: p => <span className="text-xs text-ink-500">{p.sectionCount}</span> },
    {
      key: 'status',
      header: 'Status',
      render: p => <Badge variant={statusVariant(p.status)}>{p.status}</Badge>,
    },
    {
      key: 'updatedAt',
      header: 'Last Modified',
      render: p => (
        <span className="text-xs text-ink-500">
          {p.updatedAt ? new Date(p.updatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: p => (
        <div className="flex items-center gap-2 justify-end">
          <Button size="sm" variant="primary" onClick={e => { e.stopPropagation(); navigate(`/studio/${p.id}`); }}>Edit Sections</Button>
          {p.status !== 'published' && (
            <Button size="sm" variant="secondary" onClick={e => publish(p.id, e)}>Publish</Button>
          )}
          {!p.isSystemRoute && (
            <Button size="sm" variant="ghost" onClick={e => deletePage(p, e)} className="text-red-500 hover:text-red-700 hover:bg-red-50">Delete</Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Visual Content Studio"
        description="Edit the homepage, About The House, Privacy Policy, Shipping & Returns, Terms & Conditions, Cookie Policy, and custom landing pages with live draft previews."
        actions={<Button onClick={() => setModal(true)}>+ New Page</Button>}
      />

      <Card padding={false}>
        <DataTable
          columns={cols}
          data={pages}
          loading={loading}
          onRowClick={p => navigate(`/studio/${p.id}`)}
          emptyTitle="No pages yet"
          emptyDescription="Create your first page to start building the storefront."
        />
      </Card>

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title="Create New Page"
        footer={
          <>
            <Button variant="outline" onClick={() => setModal(false)}>Cancel</Button>
            <Button loading={creating} onClick={create} disabled={!form.title || !form.slug}>Create Page</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Page Title"
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value, slug: autoSlug(e.target.value) }))}
            placeholder="e.g. Autumn / Winter Lookbook"
            tooltip="Human-readable title shown in the studio and used as default SEO page title."
          />
          <Input
            label="URL Slug"
            value={form.slug}
            onChange={e => setForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
            placeholder="e.g. aw26-lookbook"
            tooltip="URL-safe identifier (lowercase letters, numbers, hyphens)."
          />
          <Select
            label="Page Type"
            value={form.pageType}
            onChange={e => setForm(f => ({ ...f, pageType: e.target.value }))}
            options={PAGE_TYPES}
            tooltip="Determines the default route prefix and storefront template."
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      </Modal>
    </div>
  );
}
