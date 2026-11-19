import React, { useEffect, useState } from 'react';
import { PageHeader, Card, DataTable, Button, Badge, statusVariant, Modal, Textarea, Spinner, Tabs, InfoTooltip, EmptyState } from '../../components/ui';
import type { Column } from '../../components/ui';
import { returns as returnsApi } from '../../lib/api';

const RETURN_TABS = [
  { id: 'all', label: 'All Returns' },
  { id: 'pending', label: 'Pending Review' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'completed', label: 'Completed' },
];

export default function ReturnsPage() {
  const [tab, setTab] = useState('all');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any | null>(null);
  const [action, setAction] = useState<'approve' | 'reject' | 'complete'>('approve');
  const [note, setNote] = useState('');
  const [restock, setRestock] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await returnsApi.list(tab === 'all' ? undefined : tab);
      const raw = res.data as unknown as { returns?: any[] } | any[];
      setData(Array.isArray(raw) ? raw : (raw?.returns ?? []));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [tab]);

  function openReview(item: any, act: 'approve' | 'reject' | 'complete') {
    setSelected(item);
    setAction(act);
    setNote('');
    setRestock(act === 'approve' || act === 'complete');
  }

  async function handleReviewSubmit() {
    if (!selected) return;
    setSaving(true);
    try {
      await returnsApi.review(selected.id, action, note, restock);
      setSelected(null);
      load();
    } finally {
      setSaving(false);
    }
  }

  const columns: Column<any>[] = [
    {
      key: 'id',
      header: 'Return ID',
      render: r => <span className="font-mono font-semibold text-ink-900">#{r.id.slice(-6).toUpperCase()}</span>,
    },
    {
      key: 'order_id',
      header: 'Order',
      render: r => (
        <span className="font-mono text-xs text-ink-600 bg-ink-100 px-1.5 py-0.5 rounded">
          {r.order_display_id ? `#${r.order_display_id}` : r.order_id?.slice(-6).toUpperCase() || '—'}
        </span>
      ),
    },
    {
      key: 'reason',
      header: 'Reason',
      render: r => <span className="text-ink-700 max-w-[220px] truncate block">{r.reason || 'Not specified'}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: r => <Badge variant={statusVariant(r.status)}>{r.status}</Badge>,
    },
    {
      key: 'created_at',
      header: 'Requested On',
      render: r => (
        <span className="text-ink-500 text-sm">
          {new Date(r.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: r => (
        <div className="flex gap-2 justify-end">
          {r.status === 'pending' && (
            <>
              <Button size="sm" variant="primary" onClick={() => openReview(r, 'approve')}>Approve</Button>
              <Button size="sm" variant="danger" onClick={() => openReview(r, 'reject')}>Reject</Button>
            </>
          )}
          {r.status === 'approved' && (
            <Button size="sm" variant="secondary" onClick={() => openReview(r, 'complete')}>Mark Received & Restock</Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Returns & Exchanges"
        description="Inspect customer return requests, approve shipments, and manage reverse inventory restocks."
      />

      <Tabs active={tab} onChange={setTab} tabs={RETURN_TABS} />

      <Card>
        {loading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : data.length === 0 ? (
          <EmptyState
            title="No returns found"
            description={tab === 'all' ? 'Customer returns will be listed here.' : `No returns matching status '${tab}'.`}
          />
        ) : (
          <DataTable columns={columns} data={data} />
        )}
      </Card>

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={
          action === 'approve' ? 'Approve Return Request' :
          action === 'reject' ? 'Reject Return Request' :
          'Complete Return & Restock'
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-ink-600">
            {action === 'approve' && 'Approving will send reverse pickup instructions and return shipping details to the customer.'}
            {action === 'reject' && 'Rejecting will decline this return request and inform the customer via email.'}
            {action === 'complete' && 'Marking as completed confirms the returned item was inspected and delivered back to the atelier.'}
          </p>

          {(action === 'approve' || action === 'complete') && (
            <div className="p-3 bg-ink-50 border border-ink-100 rounded-md">
              <label className="flex items-center gap-2 cursor-pointer text-sm text-ink-900 font-medium">
                <input
                  type="checkbox"
                  checked={restock}
                  onChange={e => setRestock(e.target.checked)}
                  className="rounded text-gold-600 focus:ring-gold-500"
                />
                Restock inventory automatically
                <InfoTooltip content="When enabled, returns items directly to available stock matrix for this product variant." />
              </label>
            </div>
          )}

          <div>
            <label className="label-sm flex items-center gap-1">
              Inspection / Administrative Note
              <InfoTooltip content="Internal notes and rationale recorded in the audit trail." />
            </label>
            <Textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="e.g. Garment unworn with original tags attached."
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setSelected(null)}>Cancel</Button>
            <Button
              variant={action === 'reject' ? 'danger' : 'primary'}
              loading={saving}
              onClick={handleReviewSubmit}
            >
              Confirm {action.toUpperCase()}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
