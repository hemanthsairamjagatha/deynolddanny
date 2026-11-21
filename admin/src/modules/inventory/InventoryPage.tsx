import { useEffect, useMemo, useState } from 'react';
import { PageHeader, Card, DataTable, Modal, Button, Select, Input, Badge, Spinner, Tabs, InfoTooltip, EmptyState, SearchBar } from '../../components/ui';
import type { Column } from '../../components/ui';
import { inventory } from '../../lib/api';

interface StockRow {
  variant_id: string;
  product_name: string;
  sku: string;
  color: string;
  size: string;
  stock: number;
  reserved: number;
  net_available: number;
}

interface Movement {
  id: string;
  variant_id: string;
  product_name: string;
  sku: string;
  delta: number;
  reason: string;
  notes: string;
  created_at: string;
}

interface RestockSub {
  id: string;
  product_title: string;
  sku: string;
  size: string;
  color_name: string;
  variant_id: string;
  email: string;
  status: string;
  created_at: string;
}

export default function InventoryPage() {
  const [tab, setTab] = useState('matrix');
  const [matrix, setMatrix] = useState<StockRow[]>([]);
  const [lowStock, setLowStock] = useState<StockRow[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [restockSubs, setRestockSubs] = useState<RestockSub[]>([]);
  const [search, setSearch] = useState('');
  const [threshold, setThreshold] = useState(5);
  const [movementVariantFilter, setMovementVariantFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [adjustTarget, setAdjustTarget] = useState<StockRow | null>(null);
  const [adjForm, setAdjForm] = useState({ delta: '', reason: 'adjustment' });
  const [adjSaving, setAdjSaving] = useState(false);
  const [notifyingVariant, setNotifyingVariant] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function loadAll(nextThreshold = threshold, nextVariantId = movementVariantFilter) {
    setLoading(true);
    try {
      const [mRes, lRes, mvRes, rsRes] = await Promise.all([
        inventory.matrix(),
        inventory.lowStock(nextThreshold),
        inventory.movements(nextVariantId || undefined),
        inventory.restockSubscriptions(),
      ]);
      const toArr = (raw: unknown, key: string): Record<string, unknown>[] =>
        (Array.isArray(raw) ? raw : ((raw as Record<string, unknown[]>)?.[key] ?? (raw as Record<string, unknown[]>)?.items ?? [])) as Record<string, unknown>[];

      const mapStock = (r: Record<string, unknown>): StockRow => {
        const stock = Number(r.stock ?? 0);
        const reserved = Number(r.reservedStock ?? r.reserved_stock ?? r.reserved ?? 0);
        return {
          variant_id: String(r.variantId ?? r.variant_id ?? r.id ?? ''),
          product_name: String(r.productTitle ?? r.product_name ?? r.title ?? '—'),
          sku: String(r.sku ?? ''),
          color: String(r.colorName ?? r.color_name ?? r.color ?? ''),
          size: String(r.size ?? ''),
          stock,
          reserved,
          net_available: Math.max(0, stock - reserved),
        };
      };

      const mapMovement = (r: Record<string, unknown>): Movement => ({
        id: String(r.id ?? ''),
        variant_id: String(r.variant_id ?? ''),
        product_name: String(r.product_title ?? r.product_name ?? '—'),
        sku: String(r.sku ?? ''),
        delta: Number(r.qty_delta ?? r.delta ?? 0),
        reason: String(r.movement_type ?? r.reason ?? 'adjustment'),
        notes: String(r.notes ?? ''),
        created_at: String(r.created_at ?? ''),
      });

      const mapRestock = (r: Record<string, unknown>): RestockSub => ({
        id: String(r.id ?? ''),
        product_title: String(r.product_title ?? '—'),
        sku: String(r.sku ?? ''),
        size: String(r.size ?? ''),
        color_name: String(r.color_name ?? ''),
        variant_id: String(r.variant_id ?? ''),
        email: String(r.email ?? ''),
        status: String(r.status ?? 'active'),
        created_at: String(r.created_at ?? ''),
      });

      setMatrix(toArr(mRes.data, 'inventory').map(mapStock));
      setLowStock(toArr(lRes.data, 'items').map(mapStock));
      setMovements(toArr(mvRes.data, 'movements').map(mapMovement));
      setRestockSubs(toArr(rsRes.data, 'items').map(mapRestock));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll(threshold, movementVariantFilter);
  }, [threshold, movementVariantFilter]);

  async function handleAdjust() {
    if (!adjustTarget) return;
    setAdjSaving(true);
    setError('');
    setNotice('');
    try {
      const res = await inventory.adjust(adjustTarget.variant_id, Number(adjForm.delta), adjForm.reason);
      if (!res.success) {
        setError(res.error?.message ?? 'Stock adjustment failed.');
        return;
      }
      setNotice(`Stock adjusted for ${adjustTarget.sku}.`);
      setAdjustTarget(null);
      loadAll(threshold, movementVariantFilter);
    } finally {
      setAdjSaving(false);
    }
  }

  async function handleNotifyWaitlist(variantId: string, sku: string) {
    setNotifyingVariant(variantId);
    setError('');
    setNotice('');
    try {
      const res = await inventory.notifyRestock(variantId);
      if (!res.success) {
        setError(res.error?.message ?? 'Failed to notify waitlist subscribers.');
        return;
      }
      setNotice(`Marked ${res.data?.notifiedCount ?? 0} waitlist subscriber(s) notified for ${sku}.`);
      loadAll(threshold, movementVariantFilter);
    } finally {
      setNotifyingVariant(null);
    }
  }

  const filterStock = (rows: StockRow[]) => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.product_name.toLowerCase().includes(q) ||
        r.sku.toLowerCase().includes(q) ||
        r.color.toLowerCase().includes(q) ||
        r.size.toLowerCase().includes(q),
    );
  };

  const filteredMatrix = useMemo(() => filterStock(matrix), [matrix, search]);
  const filteredLowStock = useMemo(() => filterStock(lowStock), [lowStock, search]);

  const netBadge = (net: number) => {
    if (net <= 0) return <Badge variant="danger">Out of Stock (0)</Badge>;
    if (net <= threshold) return <Badge variant="warning">{net} left</Badge>;
    return <span className="text-emerald-700 font-semibold">{net}</span>;
  };

  const matrixCols: Column<StockRow>[] = [
    { key: 'product_name', header: 'Product', render: (r) => <span className="font-medium text-ink-900 max-w-[220px] truncate block">{r.product_name}</span> },
    { key: 'sku', header: 'SKU', render: (r) => <code className="text-xs text-ink-500 bg-ink-100 px-1.5 py-0.5 rounded">{r.sku}</code> },
    { key: 'color', header: 'Colour', render: (r) => <span className="text-ink-600">{r.color || '—'}</span> },
    { key: 'size', header: 'Size', render: (r) => <span className="text-ink-600">{r.size || '—'}</span> },
    { key: 'stock', header: 'Physical', render: (r) => <span className="text-ink-700 font-medium">{r.stock}</span> },
    { key: 'reserved', header: 'Reserved', render: (r) => <span className="text-ink-500">{r.reserved}</span> },
    { key: 'net_available', header: 'Net Available', render: (r) => netBadge(r.net_available) },
    {
      key: 'actions',
      header: '',
      render: (r) => (
        <Button size="sm" variant="ghost" onClick={() => { setAdjustTarget(r); setAdjForm({ delta: '', reason: 'restock' }); }}>
          Adjust
        </Button>
      ),
    },
  ];

  const movementCols: Column<Movement>[] = [
    { key: 'product_name', header: 'Product', render: (r) => <span className="font-medium text-ink-900">{r.product_name}</span> },
    { key: 'sku', header: 'SKU', render: (r) => <code className="text-xs text-ink-500 bg-ink-100 px-1.5 py-0.5 rounded">{r.sku}</code> },
    {
      key: 'delta',
      header: 'Change',
      render: (r) => (
        <span className={`font-semibold ${r.delta > 0 ? 'text-emerald-600' : 'text-red-600'}`}>{r.delta > 0 ? `+${r.delta}` : r.delta}</span>
      ),
    },
    {
      key: 'reason',
      header: 'Reason / Notes',
      render: (r) => (
        <div>
          <Badge variant="default">{r.reason}</Badge>
          {r.notes && <p className="text-xs text-ink-500 mt-0.5">{r.notes}</p>}
        </div>
      ),
    },
    { key: 'created_at', header: 'Date', render: (r) => <span className="text-ink-500 text-sm">{new Date(r.created_at).toLocaleString('en-IN')}</span> },
  ];

  const restockCols: Column<RestockSub>[] = [
    { key: 'product_title', header: 'Product', render: (r) => <span className="font-medium text-ink-900">{r.product_title}</span> },
    { key: 'sku', header: 'Variant', render: (r) => <span className="text-xs text-ink-600">{r.sku} · {r.color_name || '—'} / {r.size || '—'}</span> },
    { key: 'email', header: 'Customer Email', render: (r) => <span className="text-ink-800">{r.email}</span> },
    { key: 'status', header: 'Status', render: (r) => <Badge variant={r.status === 'active' ? 'warning' : 'success'}>{r.status}</Badge> },
    {
      key: 'actions',
      header: '',
      render: (r) => (
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="outline"
            loading={notifyingVariant === r.variant_id}
            onClick={() => handleNotifyWaitlist(r.variant_id, r.sku)}
          >
            Mark Notified
          </Button>
        </div>
      ),
    },
  ];

  const stockRows = tab === 'matrix' ? filteredMatrix : filteredLowStock;

  return (
    <div className="space-y-6">
      <PageHeader title="Inventory" description="Monitor physical, reserved, and net available stock across every SKU, adjust quantities, and manage restock waitlists." />
      {notice && <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm px-4 py-3 rounded-xl">{notice}</div>}
      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">{error}</div>}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          active={tab}
          onChange={setTab}
          tabs={[
            { id: 'matrix', label: 'Stock Matrix', count: matrix.length },
            { id: 'lowstock', label: 'Low Stock', count: lowStock.length },
            { id: 'movements', label: 'Movements', count: movements.length },
            { id: 'restock', label: 'Restock Waitlist', count: restockSubs.length },
          ]}
        />
        <div className="flex flex-wrap items-center gap-2">
          {(tab === 'matrix' || tab === 'lowstock') && (
            <SearchBar value={search} onChange={setSearch} placeholder="Filter by product, SKU, colour, size…" className="w-64" />
          )}
          {tab === 'lowstock' && (
            <Select
              value={String(threshold)}
              onChange={(e) => setThreshold(Number(e.target.value))}
              options={[
                { value: '3', label: 'Threshold: ≤ 3 units' },
                { value: '5', label: 'Threshold: ≤ 5 units' },
                { value: '10', label: 'Threshold: ≤ 10 units' },
                { value: '20', label: 'Threshold: ≤ 20 units' },
              ]}
              className="w-44"
            />
          )}
          {tab === 'movements' && (
            <Select
              value={movementVariantFilter}
              onChange={(e) => setMovementVariantFilter(e.target.value)}
              options={[
                { value: '', label: 'All Variants' },
                ...matrix.map((m) => ({ value: m.variant_id, label: `${m.sku} (${m.product_name})` })),
              ]}
              className="w-64"
            />
          )}
        </div>
      </div>

      <Card padding={false}>
        {loading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : tab === 'movements' ? (
          movements.length === 0 ? (
            <EmptyState title="No movements yet" description="Stock adjustments, orders, and returns will appear here." />
          ) : (
            <DataTable columns={movementCols} data={movements} />
          )
        ) : tab === 'restock' ? (
          restockSubs.length === 0 ? (
            <EmptyState title="No active restock requests" description="Customer back-in-stock signups will appear here." />
          ) : (
            <DataTable columns={restockCols} data={restockSubs} />
          )
        ) : stockRows.length === 0 ? (
          <EmptyState
            title={tab === 'lowstock' ? `No SKUs at or below ${threshold} units` : 'No inventory data'}
            description="Adjust your filter or add product variants to manage stock."
          />
        ) : (
          <DataTable columns={matrixCols} data={stockRows} />
        )}
      </Card>

      <Modal open={!!adjustTarget} onClose={() => setAdjustTarget(null)} title={`Adjust Stock — ${adjustTarget?.product_name ?? ''}`}>
        <div className="space-y-4">
          <p className="text-sm text-ink-500">
            Physical: <strong className="text-ink-900">{adjustTarget?.stock ?? 0}</strong> · Reserved: {adjustTarget?.reserved ?? 0} · Net Available:{' '}
            <strong className="text-emerald-700">{adjustTarget?.net_available ?? 0}</strong>
          </p>
          <div>
            <label className="label-sm flex items-center gap-1">Quantity Change <InfoTooltip content="Positive number to add stock (+10 = restock), negative to remove (-5 = write-off)." /></label>
            <Input type="number" value={adjForm.delta} onChange={(e) => setAdjForm((f) => ({ ...f, delta: e.target.value }))} placeholder="+10 or -5" />
          </div>
          <div>
            <label className="label-sm flex items-center gap-1">Reason <InfoTooltip content="Reason for the stock adjustment. Stored in the movement log for auditing." /></label>
            <Select value={adjForm.reason} onChange={(e) => setAdjForm((f) => ({ ...f, reason: e.target.value }))}>
              <option value="restock">Restock</option>
              <option value="sale">Sale correction</option>
              <option value="return">Customer return</option>
              <option value="adjustment">Manual adjustment</option>
              <option value="correction">Stock correction</option>
            </Select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setAdjustTarget(null)}>Cancel</Button>
            <Button loading={adjSaving} onClick={handleAdjust} disabled={!adjForm.delta}>Apply Adjustment</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
