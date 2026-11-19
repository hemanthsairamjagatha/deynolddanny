import { useEffect, useState } from 'react';
import { PageHeader, Card, DataTable, Button, Badge, statusVariant, Modal, Input, Textarea, Spinner, Tabs, EmptyState } from '../../components/ui';
import type { Column } from '../../components/ui';
import { templates as templatesApi } from '../../lib/api';

interface EmailTemplate {
  templateKey: string;
  name: string;
  description: string;
  subjectTemplate: string;
  htmlTemplate?: string;
  variables: string[];
  isActive: boolean;
  updatedAt?: string;
}

interface OutboxRow {
  id: string;
  recipient: string;
  emailType: string;
  status: string;
  sentAt?: string;
  createdAt?: string;
  lastError?: string | null;
}

export default function TemplatesPage() {
  const [tab, setTab] = useState('templates');
  const [list, setList] = useState<EmailTemplate[]>([]);
  const [outbox, setOutbox] = useState<OutboxRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<EmailTemplate | null>(null);
  const [editForm, setEditForm] = useState({ subjectTemplate: '', htmlTemplate: '', isActive: true });
  const [testTarget, setTestTarget] = useState<EmailTemplate | null>(null);
  const [testForm, setTestForm] = useState({ targetEmail: '', varsJson: '{\n  "orderNumber": "DD-TEST-1042",\n  "totalFormatted": "₹ 72,500.00"\n}' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function load() {
    setLoading(true);
    try {
      const [tRes, oRes] = await Promise.all([templatesApi.list(), templatesApi.outbox()]);
      const rawT = (tRes.data as { items?: Record<string, unknown>[] } | undefined)?.items ?? [];
      setList(
        rawT.map((r) => ({
          templateKey: String(r.templateKey ?? r.template_key ?? ''),
          name: String(r.name ?? ''),
          description: String(r.description ?? ''),
          subjectTemplate: String(r.subjectTemplate ?? r.subject_template ?? ''),
          variables: Array.isArray(r.variables) ? (r.variables as string[]) : [],
          isActive: Boolean(r.isActive ?? true),
          updatedAt: r.updatedAt ? String(r.updatedAt) : undefined,
        })),
      );

      const rawO = (oRes.data as { items?: Record<string, unknown>[] } | undefined)?.items ?? [];
      setOutbox(
        rawO.map((r) => ({
          id: String(r.id ?? ''),
          recipient: String(r.recipient ?? r.to_email ?? '—'),
          emailType: String(r.email_type ?? r.subject ?? '—'),
          status: String(r.status ?? 'pending'),
          sentAt: r.sent_at ? String(r.sent_at) : undefined,
          createdAt: r.created_at ? String(r.created_at) : undefined,
          lastError: r.last_error ? String(r.last_error) : null,
        })),
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function openEdit(t: EmailTemplate) {
    setError('');
    const res = await templatesApi.get(t.templateKey);
    const full = (res.data ?? {}) as Record<string, unknown>;
    setEditing(t);
    setEditForm({
      subjectTemplate: String(full.subjectTemplate ?? t.subjectTemplate ?? ''),
      htmlTemplate: String(full.htmlTemplate ?? ''),
      isActive: Boolean(full.isActive ?? t.isActive),
    });
  }

  async function saveEdit() {
    if (!editing) return;
    setSaving(true);
    setError('');
    try {
      const res = await templatesApi.update(editing.templateKey, editForm);
      if (!res.success) {
        setError(res.error?.message ?? 'Save failed');
        return;
      }
      setEditing(null);
      setNotice('Email template saved live.');
      load();
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
      setError('Sample variables must be valid JSON.');
      return;
    }
    setSaving(true);
    try {
      const res = await templatesApi.testSend(testTarget.templateKey, testForm.targetEmail.trim(), vars);
      if (!res.success) {
        setError(res.error?.message ?? 'Test send failed.');
        return;
      }
      setTestTarget(null);
      setNotice(`Test email dispatched via Resend to ${testForm.targetEmail}.`);
      load();
    } finally {
      setSaving(false);
    }
  }

  const tplCols: Column<EmailTemplate>[] = [
    {
      key: 'name',
      header: 'Template',
      render: (r) => (
        <div>
          <p className="font-medium text-ink-900">{r.name}</p>
          <p className="text-xs text-ink-500">{r.description}</p>
        </div>
      ),
    },
    { key: 'subjectTemplate', header: 'Subject Line', render: (r) => <span className="text-sm text-ink-700">{r.subjectTemplate}</span> },
    {
      key: 'updatedAt',
      header: 'Last Modified',
      render: (r) => <span className="text-xs text-ink-500">{r.updatedAt ? new Date(r.updatedAt).toLocaleDateString('en-IN') : '—'}</span>,
    },
    {
      key: 'actions',
      header: '',
      render: (r) => (
        <div className="flex justify-end gap-1.5">
          <Button size="sm" variant="outline" onClick={() => { setTestTarget(r); setError(''); }}>
            Test Send
          </Button>
          <Button size="sm" variant="primary" onClick={() => openEdit(r)}>
            Edit Template
          </Button>
        </div>
      ),
    },
  ];

  const outboxCols: Column<OutboxRow>[] = [
    { key: 'recipient', header: 'Recipient', render: (r) => <span className="font-medium text-ink-900">{r.recipient}</span> },
    { key: 'emailType', header: 'Type', render: (r) => <span className="text-xs font-mono text-ink-600">{r.emailType}</span> },
    { key: 'status', header: 'Status', render: (r) => <Badge variant={statusVariant(r.status)}>{r.status}</Badge> },
    {
      key: 'createdAt',
      header: 'Timestamp',
      render: (r) => <span className="text-xs text-ink-500">{r.sentAt || r.createdAt ? new Date(r.sentAt ?? r.createdAt ?? '').toLocaleString('en-IN') : '—'}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Email Templates & Outbox"
        description="Edit transactional emails sent via Resend (OTP codes, order confirmations, Shiprocket dispatch AWB notices, restock alerts) and run live test dispatches."
      />
      {notice && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm px-4 py-3 rounded-xl flex justify-between items-center">
          <span>{notice}</span>
          <button onClick={() => setNotice('')} className="text-xs underline">
            Dismiss
          </button>
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
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : tab === 'templates' ? (
          list.length === 0 ? (
            <EmptyState title="No email templates found" description="Seeded transactional templates will appear here." />
          ) : (
            <DataTable columns={tplCols} data={list} />
          )
        ) : outbox.length === 0 ? (
          <EmptyState title="Outbox is empty" description="Recently sent transactional emails will be logged here." />
        ) : (
          <DataTable columns={outboxCols} data={outbox} />
        )}
      </Card>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={`Edit Template — ${editing?.name ?? ''}`}
        wide
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button loading={saving} onClick={saveEdit}>
              Save Template
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {editing && editing.variables.length > 0 && (
            <div className="p-3 bg-ink-50 rounded-lg border border-ink-200 text-xs text-ink-600">
              <span className="font-semibold text-ink-800">Available Variables: </span>
              {editing.variables.map((v) => `{{${v}}}`).join(', ')}
            </div>
          )}
          <Input label="Subject Line" value={editForm.subjectTemplate} onChange={(e) => setEditForm((f) => ({ ...f, subjectTemplate: e.target.value }))} />
          <Textarea label="HTML Body" rows={14} className="font-mono text-xs" value={editForm.htmlTemplate} onChange={(e) => setEditForm((f) => ({ ...f, htmlTemplate: e.target.value }))} />
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      </Modal>

      <Modal
        open={!!testTarget}
        onClose={() => setTestTarget(null)}
        title={`Send Live Test Email — ${testTarget?.name ?? ''}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setTestTarget(null)}>
              Cancel
            </Button>
            <Button loading={saving} disabled={!testForm.targetEmail} onClick={sendTest}>
              Send Test Email
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Recipient Email"
            type="email"
            value={testForm.targetEmail}
            onChange={(e) => setTestForm((f) => ({ ...f, targetEmail: e.target.value }))}
            placeholder="vemudanny@gmail.com"
          />
          <Textarea label="Sample Variables (JSON)" rows={5} className="font-mono text-xs" value={testForm.varsJson} onChange={(e) => setTestForm((f) => ({ ...f, varsJson: e.target.value }))} />
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      </Modal>
    </div>
  );
}
