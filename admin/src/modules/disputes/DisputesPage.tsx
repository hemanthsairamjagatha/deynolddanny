import React, { useEffect, useState } from 'react';
import { PageHeader, Card, DataTable, Button, Badge, statusVariant, Modal, Textarea, Input, Spinner, Tabs, InfoTooltip, EmptyState } from '../../components/ui';
import type { Column } from '../../components/ui';
import { disputes as disputesApi } from '../../lib/api';

const DISPUTE_TABS = [
  { id: 'all', label: 'All Disputes' },
  { id: 'open', label: 'Open' },
  { id: 'under_review', label: 'Under Review' },
  { id: 'resolved', label: 'Resolved' },
];

export default function DisputesPage() {
  const [tab, setTab] = useState('all');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any | null>(null);
  const [resolution, setResolution] = useState('');
  const [refundRupees, setRefundRupees] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await disputesApi.list(tab === 'all' ? undefined : tab);
      const raw = res.data as unknown as { items?: any[]; disputes?: any[] } | any[];
      setData(Array.isArray(raw) ? raw : (raw?.items ?? raw?.disputes ?? []));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [tab]);

  function openResolve(item: any) {
    setSelected(item);
    setResolution('');
    setRefundRupees('');
  }

  async function handleResolveSubmit() {
    if (!selected) return;
    setSaving(true);
    try {
      const refundPaise = refundRupees ? Math.round(Number(refundRupees) * 100) : undefined;
      await disputesApi.resolve(selected.id, resolution, refundPaise);
      setSelected(null);
      load();
    } finally {
      setSaving(false);
    }
  }

  const columns: Column<any>[] = [
    {
      key: 'id',
      header: 'Dispute ID',
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
      key: 'type',
      header: 'Type / Category',
      render: r => <span className="text-ink-900 font-medium">{r.type || 'Payment / Delivery'}</span>,
    },
    {
      key: 'reason',
      header: 'Summary',
      render: r => <span className="text-ink-600 max-w-[200px] truncate block">{r.reason || r.description || '—'}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: r => <Badge variant={statusVariant(r.status)}>{r.status}</Badge>,
    },
    {
      key: 'created_at',
      header: 'Opened',
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
        <div className="flex justify-end">
          {!['resolved', 'closed', 'won', 'lost'].includes(String(r.status).toLowerCase()) ? (
            <Button size="sm" variant="primary" onClick={() => openResolve(r)}>Resolve</Button>
          ) : (
            <span className="text-xs text-ink-400 italic capitalize">{r.status}</span>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Disputes & Chargebacks"
        description="Investigate payment provider chargebacks, fulfillment claims, and customer escalation tickets."
      />

      <Tabs active={tab} onChange={setTab} tabs={DISPUTE_TABS} />

      <Card>
        {loading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : data.length === 0 ? (
          <EmptyState
            title="No disputes recorded"
            description="All payment and fulfillment accounts are currently in good standing."
          />
        ) : (
          <DataTable columns={columns} data={data} />
        )}
      </Card>

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={`Resolve Dispute #${selected?.id.slice(-6).toUpperCase()}`}
      >
        <div className="space-y-4">
          <p className="text-sm text-ink-600">
            Document how this dispute was settled. If issuing a financial concession or goodwill gesture, provide the refund amount.
          </p>

          <div>
            <label className="label-sm flex items-center gap-1">
              Resolution Summary
              <InfoTooltip content="Comprehensive statement of resolution, including gateway communication or courier findings." />
            </label>
            <Textarea
              value={resolution}
              onChange={e => setResolution(e.target.value)}
              placeholder="e.g. Courier proof of delivery confirmed; merchant evidence uploaded to gateway."
              rows={4}
            />
          </div>

          <div>
            <label className="label-sm flex items-center gap-1">
              Dispute Concession / Refund (₹)
              <InfoTooltip content="Leave blank if resolving without refund. Otherwise enter amount in Rupees." />
            </label>
            <Input
              type="number"
              value={refundRupees}
              onChange={e => setRefundRupees(e.target.value)}
              placeholder="0.00"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setSelected(null)}>Cancel</Button>
            <Button
              variant="primary"
              loading={saving}
              disabled={!resolution.trim()}
              onClick={handleResolveSubmit}
            >
              Resolve & Close Ticket
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
