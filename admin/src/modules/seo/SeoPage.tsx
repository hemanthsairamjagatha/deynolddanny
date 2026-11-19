import { useEffect, useState } from 'react';
import { PageHeader, Card, DataTable, Button, Badge, Modal, Input, Select, Textarea, Spinner, EmptyState } from '../../components/ui';
import type { Column } from '../../components/ui';
import { seo as seoApi } from '../../lib/api';

interface RedirectRow extends Record<string, unknown> {
  id: string;
  source_path: string;
  target_path: string;
  status_code: number;
  hit_count?: number;
  is_active?: number;
  note?: string | null;
}

const emptyForm = { source_path: '', target_path: '', status_code: '301', note: '' };

export default function SeoPage() {
  const [list, setList] = useState<RedirectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<RedirectRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    try {
      const res = await seoApi.redirects.list();
      const raw = res.data as unknown;
      setList((Array.isArray(raw) ? raw : (raw as { redirects?: RedirectRow[] })?.redirects ?? []) as RedirectRow[]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setError('');
    setModalOpen(true);
  }

  function openEdit(r: RedirectRow) {
    setEditing(r);
    setForm({
      source_path: r.source_path,
      target_path: r.target_path,
      status_code: String(r.status_code ?? 301),
      note: r.note ?? '',
    });
    setError('');
    setModalOpen(true);
  }

  async function handleSave() {
    setError('');
    if (!form.source_path.startsWith('/')) {
      setError('Source path must start with / (e.g. /old-collection).');
      return;
    }
    if (!form.target_path.trim()) {
      setError('Target path or URL is required.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        source_path: form.source_path.trim(),
        target_path: form.target_path.trim(),
        status_code: Number(form.status_code),
        note: form.note.trim() || undefined,
      };
      if (editing) await seoApi.redirects.update(editing.id, payload);
      else await seoApi.redirects.create(payload);
      setModalOpen(false);
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save redirect');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(r: RedirectRow) {
    await seoApi.redirects.update(r.id, { is_active: r.is_active ? 0 : 1 });
    load();
  }

  async function remove(r: RedirectRow) {
    if (!confirm(`Delete redirect from ${r.source_path}?`)) return;
    await seoApi.redirects.delete(r.id);
    load();
  }

  const columns: Column<RedirectRow>[] = [
    { key: 'source_path', header: 'Source Path', render: r => <code className="text-xs font-mono text-ink-900 bg-ink-100 px-2 py-0.5 rounded">{r.source_path}</code> },
    { key: 'target_path', header: 'Destination', render: r => <code className="text-xs font-mono text-ink-600">{r.target_path}</code> },
    {
      key: 'status_code', header: 'Type', render: r => (
        <Badge variant={Number(r.status_code) === 301 ? 'gold' : 'info'}>{r.status_code}</Badge>
      ),
    },
    { key: 'hit_count', header: 'Hits', render: r => <span className="text-ink-600">{r.hit_count ?? 0}</span> },
    { key: 'is_active', header: 'State', render: r => <Badge variant={r.is_active !== 0 ? 'success' : 'default'}>{r.is_active !== 0 ? 'Active' : 'Paused'}</Badge> },
    {
      key: 'actions', header: '', render: r => (
        <div className="flex justify-end gap-1.5">
          <Button size="sm" variant="ghost" onClick={() => toggleActive(r)}>{r.is_active !== 0 ? 'Pause' : 'Enable'}</Button>
          <Button size="sm" variant="ghost" onClick={() => openEdit(r)}>Edit</Button>
          <Button size="sm" variant="danger" onClick={() => remove(r)}>Delete</Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="SEO & URL Redirects"
        description="Preserve search equity when restructuring collections, product slugs, or seasonal campaigns."
        actions={<Button onClick={openCreate}>+ Add Redirect</Button>}
      />
      <Card padding={false}>
        {loading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : list.length === 0 ? (
          <EmptyState
            title="No URL redirects configured"
            description="Add a 301 or 302 redirect whenever you rename a product or retire a campaign URL."
            action={<Button onClick={openCreate}>Add Redirect</Button>}
          />
        ) : (
          <DataTable columns={columns} data={list} />
        )}
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit URL Redirect' : 'Create URL Redirect'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button loading={saving} onClick={handleSave}>{editing ? 'Save Changes' : 'Create Redirect'}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Source Path"
            tooltip="Incoming relative path to intercept, e.g. /winter-2025. Must begin with /."
            value={form.source_path}
            onChange={e => setForm(f => ({ ...f, source_path: e.target.value }))}
            placeholder="/old-page"
          />
          <Input
            label="Target Destination"
            tooltip="Destination relative path (e.g. /categories/trousers) or full external HTTPS URL."
            value={form.target_path}
            onChange={e => setForm(f => ({ ...f, target_path: e.target.value }))}
            placeholder="/categories/trousers"
          />
          <Select
            label="HTTP Status Code"
            tooltip="301 Permanent passes full search ranking equity; 302 Temporary is ideal for short-lived campaigns."
            value={form.status_code}
            onChange={e => setForm(f => ({ ...f, status_code: e.target.value }))}
            options={[
              { value: '301', label: '301 — Permanent Redirect' },
              { value: '302', label: '302 — Temporary Redirect' },
            ]}
          />
          <Textarea
            label="Internal Note"
            tooltip="Optional note documenting why this redirect exists for future editors."
            rows={2}
            value={form.note}
            onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
            placeholder="Migrated legacy lookbook URL after autumn rebrand"
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      </Modal>
    </div>
  );
}
