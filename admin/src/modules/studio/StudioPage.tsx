import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { cms } from '../../lib/api';
import type { CmsPage } from '../../lib/types';
import { PageHeader, Button, Badge, statusVariant, Card, DataTable, Modal, Input, Select, Spinner } from '../../components/ui';
import type { Column } from '../../components/ui';

const PAGE_TYPES = [
  { value: 'home', label: 'Homepage' },
  { value: 'category', label: 'Category Page' },
  { value: 'collection', label: 'Collection Page' },
  { value: 'pdp_global', label: 'Product Detail (Global)' },
  { value: 'landing', label: 'Landing Page' },
  { value: 'legal', label: 'Legal / Info Page' },
  { value: 'contact', label: 'Contact Page' },
];

export default function StudioPage() {
  const navigate = useNavigate();
  const [pages, setPages] = useState<CmsPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: '', slug: '', page_type: 'landing' });

  const load = () => {
    setLoading(true);
    cms.pages.list().then(res => {
      if (res.success && res.data) setPages(res.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(load, []);

  const autoSlug = (title: string) => title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const create = async () => {
    if (!form.title || !form.slug) return;
    setCreating(true);
    await cms.pages.create(form);
    setModal(false);
    setForm({ title: '', slug: '', page_type: 'landing' });
    load();
    setCreating(false);
  };

  const publish = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await cms.pages.publish(id);
    load();
  };

  const deletePage = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Delete this page? This cannot be undone.')) return;
    await cms.pages.delete(id);
    load();
  };

  const cols: Column<CmsPage>[] = [
    { key: 'title', header: 'Page Title', render: p => <span className="font-medium text-ink-900">{p.title}</span> },
    { key: 'slug', header: 'Slug', render: p => <code className="text-xs bg-ink-100 px-2 py-0.5 rounded">/{p.slug}</code> },
    { key: 'page_type', header: 'Type', render: p => <span className="text-sm text-ink-600 capitalize">{p.page_type.replace('_', ' ')}</span> },
    {
      key: 'status', header: 'Status',
      render: p => <Badge variant={statusVariant(p.status)}>{p.status}</Badge>
    },
    {
      key: 'updated_at', header: 'Last Modified',
      render: p => <span className="text-xs text-ink-500">{new Date(p.updated_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
    },
    {
      key: 'actions', header: '',
      render: p => (
        <div className="flex items-center gap-2 justify-end">
          <Button size="sm" variant="ghost" onClick={e => { e.stopPropagation(); navigate(`/studio/${p.id}`); }}>Edit</Button>
          {p.status === 'draft' && (
            <Button size="sm" variant="secondary" onClick={e => publish(p.id, e)}>Publish</Button>
          )}
          <Button size="sm" variant="ghost" onClick={e => deletePage(p.id, e)} className="text-red-500 hover:text-red-700 hover:bg-red-50">Delete</Button>
        </div>
      )
    },
  ];

  return (
    <div>
      <PageHeader
        title="Visual Content Studio"
        description="Manage every page and section of the Deynold Danny storefront."
        actions={<Button onClick={() => setModal(true)}>+ New Page</Button>}
      />

      <Card padding={false}>
        <DataTable
          columns={cols}
          data={pages}
          loading={loading}
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
            <Button loading={creating} onClick={create}>Create Page</Button>
          </>
        }
      >
        <Input
          label="Page Title"
          value={form.title}
          onChange={e => setForm(f => ({ ...f, title: e.target.value, slug: autoSlug(e.target.value) }))}
          placeholder="e.g. Summer Collection"
          tooltip="Human-readable name for this page, shown in the studio list."
        />
        <Input
          label="URL Slug"
          value={form.slug}
          onChange={e => setForm(f => ({ ...f, slug: e.target.value }))}
          placeholder="e.g. summer-collection"
          tooltip="The URL path for this page, e.g. /summer-collection. Use lowercase letters and hyphens."
        />
        <Select
          label="Page Type"
          value={form.page_type}
          onChange={e => setForm(f => ({ ...f, page_type: e.target.value }))}
          options={PAGE_TYPES}
          tooltip="Controls which section types are available and how the page is rendered."
        />
      </Modal>
    </div>
  );
}
