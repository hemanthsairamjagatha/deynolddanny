import { useEffect, useState } from 'react';
import { PageHeader, Card, DataTable, Button, Badge, statusVariant, Modal, Textarea, Spinner, Tabs, EmptyState } from '../../components/ui';
import type { Column } from '../../components/ui';
import { reviews as reviewsApi } from '../../lib/api';

interface ReviewRow extends Record<string, unknown> {
  id: string;
  product_name?: string;
  product_id?: string;
  reviewer_name?: string;
  customer_email?: string;
  rating: number;
  title?: string;
  body?: string;
  status: string;
  is_featured?: number;
  admin_reply?: string | null;
  created_at: string;
}

const REVIEW_TABS = [
  { id: 'pending', label: 'Pending Moderation' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'all', label: 'All Reviews' },
];

export default function ReviewsPage() {
  const [tab, setTab] = useState('pending');
  const [list, setList] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyTarget, setReplyTarget] = useState<ReviewRow | null>(null);
  const [replyText, setReplyText] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await reviewsApi.list(tab === 'all' ? undefined : tab);
      const raw = res.data as unknown;
      const arr = Array.isArray(raw) ? raw : ((raw as { items?: ReviewRow[]; reviews?: ReviewRow[] })?.items ?? (raw as { reviews?: ReviewRow[] })?.reviews ?? []);
      setList(arr as ReviewRow[]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [tab]);

  async function moderate(id: string, status: 'approved' | 'rejected') {
    await reviewsApi.moderate(id, status);
    load();
  }

  async function toggleFeature(r: ReviewRow) {
    await reviewsApi.feature(r.id, !r.is_featured);
    load();
  }

  async function remove(id: string) {
    if (!confirm('Permanently delete this customer review?')) return;
    await reviewsApi.delete(id);
    load();
  }

  async function saveReply() {
    if (!replyTarget) return;
    setSaving(true);
    try {
      await reviewsApi.reply(replyTarget.id, replyText);
      setReplyTarget(null);
      load();
    } finally {
      setSaving(false);
    }
  }

  const stars = (n: number) => (
    <span className="text-gold-500 tracking-tight text-sm" aria-label={`${n} out of 5 stars`}>
      {'★'.repeat(Math.max(0, Math.min(5, n)))}{'☆'.repeat(Math.max(0, 5 - Math.min(5, n)))}
    </span>
  );

  const columns: Column<ReviewRow>[] = [
    {
      key: 'product', header: 'Product & Review', render: r => (
        <div className="max-w-xs">
          <p className="font-medium text-ink-900 truncate">{r.product_name ?? r.product_id ?? '—'}</p>
          {r.title && <p className="text-xs font-medium text-ink-700 mt-0.5 truncate">{r.title}</p>}
          {r.body && <p className="text-xs text-ink-500 line-clamp-2 mt-0.5">{r.body}</p>}
          {r.admin_reply && (
            <p className="text-xs text-gold-700 mt-1 italic">Atelier reply: {r.admin_reply}</p>
          )}
        </div>
      ),
    },
    {
      key: 'reviewer', header: 'Client', render: r => (
        <div className="text-xs">
          <p className="font-medium text-ink-900">{r.reviewer_name ?? 'Verified Client'}</p>
          <p className="text-ink-500">{r.customer_email ?? ''}</p>
        </div>
      ),
    },
    { key: 'rating', header: 'Rating', render: r => stars(Number(r.rating ?? 5)) },
    {
      key: 'status', header: 'Status', render: r => (
        <div className="flex flex-col gap-1 items-start">
          <Badge variant={statusVariant(r.status)}>{r.status}</Badge>
          {Boolean(r.is_featured) && <Badge variant="gold">Featured</Badge>}
        </div>
      ),
    },
    {
      key: 'created_at', header: 'Date', render: r => (
        <span className="text-xs text-ink-500">{new Date(r.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
      ),
    },
    {
      key: 'actions', header: '', render: r => (
        <div className="flex justify-end gap-1.5 flex-wrap">
          {r.status !== 'approved' && <Button size="sm" variant="primary" onClick={() => moderate(r.id, 'approved')}>Approve</Button>}
          {r.status !== 'rejected' && <Button size="sm" variant="ghost" onClick={() => moderate(r.id, 'rejected')}>Reject</Button>}
          <Button size="sm" variant="outline" onClick={() => toggleFeature(r)}>{r.is_featured ? 'Unfeature' : 'Feature'}</Button>
          <Button size="sm" variant="ghost" onClick={() => { setReplyTarget(r); setReplyText(r.admin_reply ?? ''); }}>Reply</Button>
          <Button size="sm" variant="danger" onClick={() => remove(r.id)}>Delete</Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customer Reviews"
        description="Moderate verified product reviews, highlight editorial testimonials, and publish official atelier responses."
      />
      <Tabs active={tab} onChange={setTab} tabs={REVIEW_TABS} />
      <Card padding={false}>
        {loading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : list.length === 0 ? (
          <EmptyState title="No reviews in this queue" description="Customer reviews matching this filter will appear here." />
        ) : (
          <DataTable columns={columns} data={list} />
        )}
      </Card>

      <Modal
        open={!!replyTarget}
        onClose={() => setReplyTarget(null)}
        title="Publish Atelier Reply"
        footer={
          <>
            <Button variant="ghost" onClick={() => setReplyTarget(null)}>Cancel</Button>
            <Button loading={saving} onClick={saveReply}>Publish Reply</Button>
          </>
        }
      >
        {replyTarget && (
          <div className="space-y-4">
            <div className="bg-ink-50 border border-ink-100 rounded-lg p-3 text-sm">
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-ink-900">{replyTarget.reviewer_name ?? 'Client'}</span>
                {stars(Number(replyTarget.rating ?? 5))}
              </div>
              <p className="text-ink-600 text-xs">{replyTarget.body}</p>
            </div>
            <Textarea
              label="Official Response"
              tooltip="Displayed publicly beneath the customer's review on the product detail page."
              rows={4}
              value={replyText}
              onChange={e => setReplyText(e.target.value)}
              placeholder="Thank you for sharing your impressions of our tailoring..."
            />
          </div>
        )}
      </Modal>
    </div>
  );
}
