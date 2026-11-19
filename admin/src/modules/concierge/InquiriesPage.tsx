import { useEffect, useState } from 'react';
import { PageHeader, Card, DataTable, Button, Badge, statusVariant, Modal, Textarea, Select, Spinner, Tabs, EmptyState } from '../../components/ui';
import type { Column } from '../../components/ui';
import { inquiries as inquiriesApi } from '../../lib/api';

interface InquiryRow extends Record<string, unknown> {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  subject?: string | null;
  message: string;
  status: string;
  internal_note?: string | null;
  created_at: string;
}

const INQUIRY_TABS = [
  { id: 'open', label: 'Open' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'resolved', label: 'Resolved' },
  { id: 'all', label: 'All Inquiries' },
];

export default function InquiriesPage() {
  const [tab, setTab] = useState('open');
  const [list, setList] = useState<InquiryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyTarget, setReplyTarget] = useState<InquiryRow | null>(null);
  const [replyBody, setReplyBody] = useState('');
  const [manageTarget, setManageTarget] = useState<InquiryRow | null>(null);
  const [manageForm, setManageForm] = useState({ status: 'in_progress', internal_note: '' });
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await inquiriesApi.list(tab === 'all' ? undefined : tab);
      const raw = res.data as unknown;
      const arr = Array.isArray(raw) ? raw : (raw as { inquiries?: InquiryRow[] })?.inquiries ?? [];
      setList(arr as InquiryRow[]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [tab]);

  async function handleReply() {
    if (!replyTarget || !replyBody.trim()) return;
    setSaving(true);
    try {
      await inquiriesApi.reply(replyTarget.id, replyBody);
      setReplyTarget(null);
      setReplyBody('');
      load();
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate() {
    if (!manageTarget) return;
    setSaving(true);
    try {
      await inquiriesApi.update(manageTarget.id, manageForm);
      setManageTarget(null);
      load();
    } finally {
      setSaving(false);
    }
  }

  const columns: Column<InquiryRow>[] = [
    {
      key: 'client', header: 'Client', render: r => (
        <div>
          <p className="font-medium text-ink-900">{r.name}</p>
          <p className="text-xs text-ink-500">{r.email}{r.phone ? ` · ${r.phone}` : ''}</p>
        </div>
      ),
    },
    {
      key: 'subject', header: 'Inquiry', render: r => (
        <div className="max-w-sm">
          <p className="font-medium text-ink-800 truncate">{r.subject || 'Concierge Request'}</p>
          <p className="text-xs text-ink-500 line-clamp-2 mt-0.5">{r.message}</p>
        </div>
      ),
    },
    { key: 'status', header: 'Status', render: r => <Badge variant={statusVariant(r.status)}>{r.status.replace('_', ' ')}</Badge> },
    {
      key: 'created_at', header: 'Received', render: r => (
        <span className="text-xs text-ink-500">{new Date(r.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
      ),
    },
    {
      key: 'actions', header: '', render: r => (
        <div className="flex justify-end gap-1.5">
          <Button size="sm" variant="primary" onClick={() => { setReplyTarget(r); setReplyBody(''); }}>Reply</Button>
          <Button size="sm" variant="outline" onClick={() => { setManageTarget(r); setManageForm({ status: r.status, internal_note: r.internal_note ?? '' }); }}>Status</Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Concierge Desk"
        description="Respond to client inquiries submitted through the storefront contact form, track resolution status, and log private notes."
      />
      <Tabs active={tab} onChange={setTab} tabs={INQUIRY_TABS} />
      <Card padding={false}>
        {loading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : list.length === 0 ? (
          <EmptyState title="Inbox clear" description="No concierge messages in this queue." />
        ) : (
          <DataTable columns={columns} data={list} />
        )}
      </Card>

      <Modal
        open={!!replyTarget}
        onClose={() => setReplyTarget(null)}
        title={`Reply to ${replyTarget?.name ?? ''}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setReplyTarget(null)}>Cancel</Button>
            <Button loading={saving} disabled={!replyBody.trim()} onClick={handleReply}>Send Email Reply</Button>
          </>
        }
      >
        {replyTarget && (
          <div className="space-y-4">
            <div className="bg-ink-50 border border-ink-100 rounded-lg p-3.5 text-xs space-y-1">
              <p className="font-semibold text-ink-900">{replyTarget.subject || 'Concierge Message'}</p>
              <p className="text-ink-600 whitespace-pre-wrap">{replyTarget.message}</p>
            </div>
            <Textarea
              label="Message to Client"
              tooltip="Dispatched directly to the client's email via the configured transactional mailer."
              rows={6}
              value={replyBody}
              onChange={e => setReplyBody(e.target.value)}
              placeholder="Dear Client, thank you for reaching out to Deynold Danny Concierge..."
            />
          </div>
        )}
      </Modal>

      <Modal
        open={!!manageTarget}
        onClose={() => setManageTarget(null)}
        title="Update Inquiry Status"
        footer={
          <>
            <Button variant="ghost" onClick={() => setManageTarget(null)}>Cancel</Button>
            <Button loading={saving} onClick={handleUpdate}>Save Status</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select
            label="Workflow Status"
            tooltip="Track whether this request is open, actively handled, or resolved."
            value={manageForm.status}
            onChange={e => setManageForm(f => ({ ...f, status: e.target.value }))}
            options={[
              { value: 'open', label: 'Open' },
              { value: 'in_progress', label: 'In Progress' },
              { value: 'resolved', label: 'Resolved' },
            ]}
          />
          <Textarea
            label="Internal Concierge Note"
            tooltip="Private notes visible only to admin staff — never shown to the customer."
            rows={4}
            value={manageForm.internal_note}
            onChange={e => setManageForm(f => ({ ...f, internal_note: e.target.value }))}
            placeholder="Sizing advice sent, client requested bespoke length..."
          />
        </div>
      </Modal>
    </div>
  );
}
