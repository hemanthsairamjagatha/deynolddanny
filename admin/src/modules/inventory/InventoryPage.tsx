import React, { useEffect, useState } from 'react';
import { PageHeader, Card, DataTable, Modal, Button, Select, Input, Badge, Spinner, Tabs, InfoTooltip, EmptyState } from '../../components/ui';
import type { Column } from '../../components/ui';
import { inventory } from '../../lib/api';

interface StockRow { variant_id: string; product_name: string; sku: string; color: string; size: string; stock: number; reserved: number; }
interface Movement { id: string; product_name: string; sku: string; delta: number; reason: string; created_at: string; }

export default function InventoryPage() {
  const [tab, setTab] = useState('matrix');
  const [matrix, setMatrix] = useState<StockRow[]>([]);
  const [lowStock, setLowStock] = useState<StockRow[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [adjustTarget, setAdjustTarget] = useState<StockRow | null>(null);
  const [adjForm, setAdjForm] = useState({ delta: '', reason: 'adjustment' });
  const [adjSaving, setAdjSaving] = useState(false);

  async function loadAll() {
    setLoading(true);
    try {
      const [mRes, lRes, mvRes] = await Promise.all([inventory.matrix(), inventory.lowStock(), inventory.movements()]);
      const toArr = <T,>(raw: unknown, key: string): T[] =>
        Array.isArray(raw) ? (raw as T[]) : ((raw as Record<string, T[]>)?.[key] ?? (raw as Record<string, T[]>)?.items ?? []);
      setMatrix(toArr<StockRow>(mRes.data, 'inventory'));
      setLowStock(toArr<StockRow>(lRes.data, 'items'));
      setMovements(toArr<Movement>(mvRes.data, 'movements'));
    } finally { setLoading(false); }
  }
  useEffect(() => { loadAll(); }, []);

  async function handleAdjust() {
    if (!adjustTarget) return;
    setAdjSaving(true);
    try {
      await inventory.adjust(adjustTarget.variant_id, Number(adjForm.delta), adjForm.reason);
      setAdjustTarget(null);
      loadAll();
    } finally { setAdjSaving(false); }
  }

  const stockBadge = (stock: number) => {
    if (stock === 0) return <Badge variant="danger">Out of Stock</Badge>;
    if (stock <= 5) return <Badge variant="warning">{stock}</Badge>;
    return <span className="text-ink-700 font-medium">{stock}</span>;
  };

  const matrixCols: Column<StockRow>[] = [
    { key: 'product_name', header: 'Product', render: r => <span className="font-medium text-ink-900 max-w-[200px] truncate block">{r.product_name}</span> },
    { key: 'sku', header: 'SKU', render: r => <code className="text-xs text-ink-500 bg-ink-100 px-1.5 py-0.5 rounded">{r.sku}</code> },
    { key: 'color', header: 'Colour', render: r => <span className="text-ink-600">{r.color || '—'}</span> },
    { key: 'size', header: 'Size', render: r => <span className="text-ink-600">{r.size || '—'}</span> },
    { key: 'stock', header: 'Available', render: r => stockBadge(r.stock) },
    { key: 'reserved', header: 'Reserved', render: r => <span className="text-ink-500">{r.reserved}</span> },
    {
      key: 'actions', header: '', render: r => (
        <Button size="sm" variant="ghost" onClick={() => { setAdjustTarget(r); setAdjForm({ delta: '', reason: 'adjustment' }); }}>Adjust</Button>
      )
    },
  ];

  const movementCols: Column<Movement>[] = [
    { key: 'product_name', header: 'Product', render: r => <span className="font-medium text-ink-900">{r.product_name}</span> },
    { key: 'sku', header: 'SKU', render: r => <code className="text-xs text-ink-500 bg-ink-100 px-1.5 py-0.5 rounded">{r.sku}</code> },
    {
      key: 'delta', header: 'Change', render: r => (
        <span className={`font-semibold ${r.delta > 0 ? 'text-emerald-600' : 'text-red-600'}`}>{r.delta > 0 ? `+${r.delta}` : r.delta}</span>
      )
    },
    { key: 'reason', header: 'Reason', render: r => <Badge variant="default">{r.reason}</Badge> },
    { key: 'created_at', header: 'Date', render: r => <span className="text-ink-500 text-sm">{new Date(r.created_at).toLocaleString('en-IN')}</span> },
  ];

  const display = tab === 'matrix' ? matrix : tab === 'lowstock' ? lowStock : movements;

  return (
    <div className="space-y-6">
      <PageHeader title="Inventory" description="Monitor stock levels, adjust quantities and review movement history." />
      <Tabs active={tab} onChange={setTab} tabs={[{ id: 'matrix', label: 'Stock Matrix' }, { id: 'lowstock', label: 'Low Stock' }, { id: 'movements', label: 'Movements' }]} />
      <Card>
        {loading ? <div className="flex justify-center py-16"><Spinner /></div> : (
          tab !== 'movements'
            ? (display.length === 0 ? <EmptyState title={tab === 'lowstock' ? 'No low stock items 🎉' : 'No inventory data'} description="Stock data will appear here once variants are created." /> : <DataTable columns={matrixCols} data={display as StockRow[]} />)
            : (movements.length === 0 ? <EmptyState title="No movements yet" description="Stock adjustments will appear here." /> : <DataTable columns={movementCols} data={movements} />)
        )}
      </Card>

      <Modal open={!!adjustTarget} onClose={() => setAdjustTarget(null)} title={`Adjust Stock — ${adjustTarget?.product_name ?? ''}`}>
        <div className="space-y-4">
          <p className="text-sm text-ink-500">Current stock: <strong className="text-ink-900">{adjustTarget?.stock ?? 0}</strong> · Reserved: {adjustTarget?.reserved ?? 0}</p>
          <div>
            <label className="label-sm flex items-center gap-1">Quantity Change <InfoTooltip content="Positive number to add stock (+10 = restock), negative to remove (-5 = write-off)." /></label>
            <Input type="number" value={adjForm.delta} onChange={e => setAdjForm(f => ({ ...f, delta: e.target.value }))} placeholder="+10 or -5" />
          </div>
          <div>
            <label className="label-sm flex items-center gap-1">Reason <InfoTooltip content="Reason for the stock adjustment. Stored in the movement log for auditing." /></label>
            <Select value={adjForm.reason} onChange={e => setAdjForm(f => ({ ...f, reason: e.target.value }))}>
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
