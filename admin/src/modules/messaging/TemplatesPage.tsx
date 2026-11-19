import { useEffect, useState } from 'react';
import { PageHeader, Card, DataTable, Button, Badge, statusVariant, Modal, Input, Textarea, Spinner, Tabs, EmptyState } from '../../components/ui';
import type { Column } from '../../components/ui';
import { templates as templatesApi } from '../../lib/api';

interface EmailTemplate extends Record<string, unknown> {
  id: string;
  template_key?: string;
  name?: string;
  subject: string;
  html_body: string;
  variables_doc?: string | null;
  updated_at?: string;
}

interface OutboxRow extends Record<string, unknown> {
  id: string;
  to_email?: string;
  recipient?: string;
  subject: string;
  status: string;
  sent_at?: string;
  created_at?: string;
}

export default function TemplatesPage() {
  const [tab, setTab] = useState('templates');
  const [list, setList] = useState<EmailTemplate[]>([]);
  const [outbox, setOutbox] = useState<OutboxRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<EmailTemplate | null>(null);
  const [editForm, setEditForm] = useState({ subject: '', html_body: '', variables_doc: '' });
  const [testTarget, setTestTarget] = useState<EmailTemplate | null>(null);
  const [testForm, setTestForm] = useState({ toEmail: '', varsJson: '{\n  "customerName": "Aarav Mehta",\n  "orderNumber": "DD-1042"\n}' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function load() {
    setLoading(true);
    try {
      const [tRes, oRes] = await Promise.all([templatesApi.list(), templatesApi.outbox(1)]);
      const rawT = tRes.data as unknown;
      const rawO = oRes.data as unknown;
      setList((Array.isArray(rawT) ? rawT : (rawT as { templates?: EmailTemplate[] })?.templates ?? []) as EmailTemplate[]);
      setOutbox((Array.isArray(rawO) ? rawO : (rawO as { outbox?: OutboxRow[]; emails?: OutboxRow[] })?.outbox ?? (rawO as { emails?: OutboxRow[] })?.emails ?? []) as OutboxRow[]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function openEdit(t: EmailTemplate) {
    setEditing(t);
    setEditForm({ subject: t.subject ?? '', html_body: t.html_body ?? '', variables_doc: t.variables_doc ?? '' });
    setError('');
  }

  async function saveEdit() {
    if (!editing) return;
    setSaving(true);
    setError('');
    try {
      await templatesApi.update(editing.id, editForm);
      setEditing(null);
      setNotice('Template saved successfully.');
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function sendTest() {
    if (!testTarget) return;
    setError('');
    let vars: Record<string, string> = {};
    try {
      vars = JSON.parse(testForm.varsJson || '{}');
    } catch {
      setError('Variables must be valid JSON.');
      return;
    }
    setSaving(true);
    try {
      await templatesApi.testSend(testTarget.id, testForm.toEmail, vars);
      setTestTarget(null);
      setNotice(`Test email queued for ${testForm.toEmail}.`);
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Test send failed');
    } finally {
      setSaving(false);
    }
  }

  const tplCols: Column<EmailTemplate>[] = [
    {
      key: 'name', header: 'Template', render: r => (
        <div>
          <p className="font-medium text-ink-900">{r.name ?? r.template_key ?? r.id}</p>
          {r.template_key && <code className="text-xs text-ink-500">{r.template_key}</code>}
        </div>
      ),
    },
    { key: 'subject', header: 'Subject Line', render: r => <span className="text-ink-700">{r.subject}</span> },
    {
      key: 'updated_at', header: 'Last Modified', render: r => (
        <span className="text-xs text-ink-500">{r.updated_at ? new Date(r.updated_at).toLocaleDateString('en-IN') : '—'}</span>
      ),
    },
    {
      key: 'actions', header: '', render: r => (
        <div className="flex justify-end gap-1.5">
          <Button size="sm" variant="outline" onClick={() => { setTestTarget(r); setError(''); }}>Test Send</Button>
          <Button size="sm" variant="primary" onClick={() => openEdit(r)}>Edit Template</Button>
        </div>
      ),
    },
  ];

  const outboxCols: Column<OutboxRow>[] = [
    { key: 'to', header: 'Recipient', render: r => <span className="font-medium text-ink-900">{r.to_email ?? r.recipient ?? '—'}</span> },
    { key: 'subject', header: 'Subject', render: r => <span className="text-ink-700">{r.subject}</span> },
    { key: 'status', header: 'Status', render: r => <Badge variant={statusVariant(r.status)}>{r.status}</Badge> },
    {
      key: 'sent_at', header: 'Timestamp', render: r => (
        <span className="text-xs text-ink-500">{new Date(r.sent_at ?? r.created_at ?? '').toLocaleString('en-IN')}</span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Email & Notifications"
        description="Edit transactional email layouts, subject lines, and dynamic merge variables, and inspect the dispatch outbox."
      />
      {notice && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm px-4 py-3 rounded-xl flex justify-between items-center">
          <span>{notice}</span>
          <button onClick={() => setNotice('')} className="text-xs underline">Dismiss</button>
        </div>
      )}
      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'templates', label: 'Templates', count: list.length },
          { id: 'outbox', label: 'Dispatch Outbox', count: outbox.length },
        ]}
      />
      <Card padding={false}>
        {loading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : tab === 'templates' ? (
          list.length === 0 ? <EmptyState title="No email templates found" description="Seeded transactional templates will appear here." /> : <DataTable columns={tplCols} data={list} />
        ) : (
          outbox.length === 0 ? <EmptyState title="Outbox is empty" description="Recently sent transactional emails will be logged here." /> : <DataTable columns={outboxCols} data={outbox} />
        )}
      </Card>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={`Edit Template — ${editing?.name ?? editing?.template_key ?? ''}`}
        wide
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            <Button loading={saving} onClick={saveEdit}>Save Template</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Subject Line"
            tooltip="Supports {{variable}} interpolation such as {{orderNumber}} or {{customerName}}."
            value={editForm.subject}
            onChange={e => setEditForm(f => ({ ...f, subject: e.target.value }))}
          />
          <Textarea
            label="HTML Body"
            tooltip="Responsive HTML markup sent via Resend. Use {{variable}} tokens for dynamic content."
            rows={14}
            className="font-mono text-xs"
            value={editForm.html_body}
            onChange={e => setEditForm(f => ({ ...f, html_body: e.target.value }))}
          />
          <Textarea
            label="Available Variables Reference"
            tooltip="Documentation notes for editors listing supported merge variables for this template."
            rows={3}
            value={editForm.variables_doc}
            onChange={e => setEditForm(f => ({ ...f, variables_doc: e.target.value }))}
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      </Modal>

      <Modal
        open={!!testTarget}
        onClose={() => setTestTarget(null)}
        title={`Test Dispatch — ${testTarget?.name ?? testTarget?.template_key ?? ''}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setTestTarget(null)}>Cancel</Button>
            <Button loading={saving} disabled={!testForm.toEmail} onClick={sendTest}>Send Test Email</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Recipient Email"
            tooltip="Address where the preview email will be delivered."
            type="email"
            value={testForm.toEmail}
            onChange={e => setTestForm(f => ({ ...f, toEmail: e.target.value }))}
            placeholder="founder@deynolddanny.com"
          />
          <Textarea
            label="Sample Variables (JSON)"
            tooltip="JSON key-value pairs substituted into {{variable}} placeholders during this test send."
            rows={6}
            className="font-mono text-xs"
            value={testForm.varsJson}
            onChange={e => setTestForm(f => ({ ...f, varsJson: e.target.value }))}
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      </Modal>
    </div>
  );
}
