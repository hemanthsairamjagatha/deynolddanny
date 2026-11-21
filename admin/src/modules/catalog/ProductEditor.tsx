import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { products as productsApi, categories as catsApi } from '../../lib/api';
import { uploadLocalMediaFile } from '../../lib/mediaUpload';
import { PageHeader, Button, Input, Textarea, Select, Card, Badge, Tabs, Spinner, Modal, InfoTooltip } from '../../components/ui';
import { ImageUrlField, MediaPickerModal } from '../../components/MediaPickerModal';

interface CatOption {
  id: string;
  title: string;
}

interface VariantRow {
  id: string;
  sku: string;
  color_name?: string | null;
  color?: string | null;
  color_hex?: string | null;
  size: string;
  price_paise?: number | null;
  compare_paise?: number | null;
  stock: number;
  reserved_stock?: number;
  reserved?: number;
  is_active: number;
}

interface GalleryImageItem {
  url: string;
  color_name: string;
}

interface VariantEditDraft {
  color_name: string;
  color_hex: string;
  priceRupees: string;
  compareRupees: string;
  stock: string;
  is_active: 0 | 1;
  dirty?: boolean;
}

function fmt(paise: number) {
  return (paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function ProductEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = !id || id === 'new';

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [savingVariants, setSavingVariants] = useState(false);
  const [tab, setTab] = useState('details');
  const [categories, setCategories] = useState<CatOption[]>([]);
  const [form, setForm] = useState({
    title: '',
    slug: '',
    sku_prefix: '',
    category_id: '',
    priceRupees: '',
    compareRupees: '',
    badge: '',
    section_group: 'mastery',
    gender: 'Men',
    tag: '',
    default_img: '/images/mastery-1-model.jpg',
    hover_img: '/images/mastery-1-product.jpg',
    description: '',
    material: '',
    care_guide: '',
    size_and_fit: '',
    composition_care: '',
    shipping_returns: '',
    hsn_code: '6203',
    gst_rate_bps: 1200,
    is_active: 1,
    is_featured: 0,
  });
  const [isDirty, setIsDirty] = useState(false);
  const [gallery, setGallery] = useState<GalleryImageItem[]>([]);
  const [variants, setVariants] = useState<VariantRow[]>([]);
  const [variantDrafts, setVariantDrafts] = useState<Record<string, VariantEditDraft>>({});
  const [bulkSizePrices, setBulkSizePrices] = useState<Record<string, string>>({});
  const [bulkColorPrices, setBulkColorPrices] = useState<Record<string, string>>({});
  const [bulkColorHexes, setBulkColorHexes] = useState<Record<string, string>>({});
  const [renameColors, setRenameColors] = useState<Record<string, string>>({});

  // Quick Add Size Across All Colours Modal
  const [addSizeModal, setAddSizeModal] = useState(false);
  const [newSizeForm, setNewSizeForm] = useState({ size: '', priceRupees: '', stock: '10' });

  // Cross-Sells State
  const [crossSells, setCrossSells] = useState<Array<{ target_product_id: string; relation_type: 'style_it_with' | 'related' }>>([]);
  const [allProducts, setAllProducts] = useState<Array<{ id: string; title: string; slug: string; default_img: string; price_paise: number }>>([]);
  const [crossSellSearch, setCrossSellSearch] = useState('');
  const [savingCrossSells, setSavingCrossSells] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');

  // Quick Add Colour Across All Sizes Modal
  const [addColorModal, setAddColorModal] = useState(false);
  const [newColorForm, setNewColorForm] = useState({
    name: '',
    hex: '#8C7355',
    priceRupees: '',
    imageUrl: '',
    stock: '15',
  });

  // Single Variant Modal
  const [variantModal, setVariantModal] = useState(false);
  const [variantForm, setVariantForm] = useState({
    sku: '',
    color_name: 'Black',
    color_hex: '#111111',
    size: 'M',
    priceRupees: '',
    compareRupees: '',
    stock: '5',
  });

  // Bulk Matrix Generator Modal
  const [matrixModal, setMatrixModal] = useState(false);
  const [matrixSizesInput, setMatrixSizesInput] = useState('S, M, L, XL, XXL');
  const [matrixColors, setMatrixColors] = useState<Array<{ name: string; hex: string }>>([
    { name: 'Black', hex: '#111111' },
  ]);
  const [matrixStock, setMatrixStock] = useState('5');
  const [matrixSizePrices, setMatrixSizePrices] = useState<Record<string, string>>({});
  const [matrixColorPrices, setMatrixColorPrices] = useState<Record<string, string>>({});

  const [galleryPickerOpen, setGalleryPickerOpen] = useState(false);
  const [galleryUploadColor, setGalleryUploadColor] = useState<string>('');
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const galleryFileRef = useRef<HTMLInputElement>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const hydrateVariants = (rows: VariantRow[]) => {
    setVariants(rows);
    const nextDrafts: Record<string, VariantEditDraft> = {};
    for (const v of rows) {
      nextDrafts[v.id] = {
        color_name: String(v.color_name ?? v.color ?? 'Default'),
        color_hex: String(v.color_hex || '#111111'),
        priceRupees: v.price_paise != null ? String(v.price_paise / 100) : '',
        compareRupees: v.compare_paise != null ? String(v.compare_paise / 100) : '',
        stock: String(v.stock ?? 0),
        is_active: v.is_active ? 1 : 0,
        dirty: false,
      };
    }
    setVariantDrafts(nextDrafts);
  };

  const reloadProduct = async (productId: string) => {
    const res = await productsApi.get(productId);
    if (res.success && res.data) {
      const p = res.data as Record<string, unknown>;
      setForm({
        title: String(p.title ?? p.name ?? ''),
        slug: String(p.slug ?? ''),
        sku_prefix: String(p.sku_prefix ?? ''),
        category_id: String(p.category_id ?? ''),
        priceRupees: p.price_paise ? String(Number(p.price_paise) / 100) : '',
        compareRupees: p.compare_paise ? String(Number(p.compare_paise) / 100) : '',
        badge: String(p.badge ?? ''),
        section_group: String(p.section_group ?? 'mastery'),
        gender: String(p.gender ?? 'Men'),
        tag: String(p.tag ?? ''),
        default_img: String(p.default_img ?? ''),
        hover_img: String(p.hover_img ?? ''),
        description: String(p.description ?? ''),
        material: String(p.material ?? ''),
        care_guide: String(p.care_guide ?? ''),
        size_and_fit: Array.isArray(p.size_and_fit) ? (p.size_and_fit as string[]).join('\n') : '',
        composition_care: Array.isArray(p.composition_care) ? (p.composition_care as string[]).join('\n') : '',
        shipping_returns: Array.isArray(p.shipping_returns) ? (p.shipping_returns as string[]).join('\n') : '',
        hsn_code: String(p.hsn_code ?? '6203'),
        gst_rate_bps: Number(p.gst_rate_bps ?? 1200),
        is_active: Number(p.is_active ?? 1),
        is_featured: Number(p.is_featured ?? 0),
      });
      setIsDirty(false);
      hydrateVariants((p.variants ?? []) as VariantRow[]);
      const csRaw = (p.crossSells ?? []) as Array<{ target_product_id?: string; relation_type?: string }>;
      setCrossSells(
        csRaw
          .filter((x) => x.target_product_id && (x.relation_type === 'style_it_with' || x.relation_type === 'related'))
          .map((x) => ({
            target_product_id: String(x.target_product_id),
            relation_type: x.relation_type as 'style_it_with' | 'related',
          })),
      );
      const imgs = (p.images ?? []) as Array<string | { url?: string; image_url?: string; color_name?: string | null }>;
      setGallery(
        imgs
          .map((x) =>
            typeof x === 'string'
              ? { url: x, color_name: '' }
              : { url: String(x.url ?? x.image_url ?? ''), color_name: String(x.color_name ?? '') },
          )
          .filter((x) => Boolean(x.url)),
      );
    }
  };

  useEffect(() => {
    catsApi.list().then((r) => {
      if (r.success && r.data) {
        const raw = r.data as unknown;
        const arr = (Array.isArray(raw) ? raw : (raw as { items?: Record<string, unknown>[] }).items ?? []) as Record<string, unknown>[];
        setCategories(arr.map((c) => ({ id: String(c.id ?? ''), title: String(c.title ?? c.name ?? '') })));
      }
    });

    if (!isNew && id) {
      reloadProduct(id).finally(() => setLoading(false));
      productsApi.list({ status: 'active', limit: 100 }).then((r) => {
        if (r.success && r.data?.items) {
          setAllProducts(
            (r.data.items as Array<Record<string, unknown>>)
              .filter((p) => String(p.id) !== id)
              .map((p) => ({
                id: String(p.id ?? ''),
                title: String(p.title ?? ''),
                slug: String(p.slug ?? ''),
                default_img: String(p.default_img ?? ''),
                price_paise: Number(p.price_paise ?? 0),
              })),
          );
        }
      });
    }
  }, [id, isNew]);

  const distinctSizes = useMemo(() => Array.from(new Set(variants.map((v) => v.size))), [variants]);
  const distinctColors = useMemo(() => {
    const map = new Map<string, { name: string; hex: string; pricePaise: number | null }>();
    for (const v of variants) {
      const cName = String(v.color_name ?? v.color ?? 'Default').trim();
      const key = cName.toLowerCase();
      if (!map.has(key)) {
        map.set(key, { name: cName, hex: String(v.color_hex || '#111111'), pricePaise: v.price_paise ?? null });
      }
    }
    return Array.from(map.values());
  }, [variants]);
  const parsedMatrixSizes = useMemo(
    () =>
      Array.from(
        new Set(
          matrixSizesInput
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
        ),
      ),
    [matrixSizesInput],
  );
  const dirtyCount = useMemo(
    () => Object.values(variantDrafts).filter((d) => d.dirty).length,
    [variantDrafts],
  );

  const hasUnsavedChanges = isDirty || dirtyCount > 0;
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasUnsavedChanges]);

  const updateForm = (updater: (f: typeof form) => typeof form) => {
    setForm(updater);
    setIsDirty(true);
  };

  const discountPct = useMemo(() => {
    const p = parseFloat(form.priceRupees || '0');
    const c = parseFloat(form.compareRupees || '0');
    if (p > 0 && c > p) return Math.round(((c - p) / c) * 100);
    return 0;
  }, [form.priceRupees, form.compareRupees]);

  const parseLines = (text: string) =>
    text
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

  const autoSlug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const autoSku = (name: string) =>
    'DD-' +
    name
      .replace(/[^a-zA-Z0-9]+/g, '')
      .toUpperCase()
      .slice(0, 6);

  const save = async () => {
    setError('');
    setNotice('');
    const pricePaise = Math.round(parseFloat(form.priceRupees || '0') * 100);
    const comparePaise = form.compareRupees.trim() ? Math.round(parseFloat(form.compareRupees) * 100) : null;
    if (!form.title.trim() || !form.slug.trim() || pricePaise <= 0) {
      setError('Product Title, URL Slug, and a positive Base Price (₹) are required.');
      return;
    }
    if (comparePaise !== null && (!Number.isFinite(comparePaise) || comparePaise <= pricePaise)) {
      setError('Compare / MRP Price must be strictly greater than Base Price.');
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        title: form.title.trim(),
        slug: form.slug.trim(),
        sku_prefix: form.sku_prefix.trim() || autoSku(form.title),
        category_id: form.category_id || null,
        price_paise: pricePaise,
        compare_paise: comparePaise,
        badge: form.badge.trim() || null,
        section_group: form.section_group,
        gender: form.gender,
        tag: form.tag.trim() || null,
        default_img: form.default_img.trim(),
        hover_img: form.hover_img.trim(),
        description: form.description,
        material: form.material,
        care_guide: form.care_guide,
        size_and_fit: parseLines(form.size_and_fit),
        composition_care: parseLines(form.composition_care),
        shipping_returns: parseLines(form.shipping_returns),
        hsn_code: form.hsn_code || '6203',
        gst_rate_bps: Number(form.gst_rate_bps) || 1200,
        is_active: form.is_active ? 1 : 0,
        is_featured: form.is_featured ? 1 : 0,
      };

      const res = isNew ? await productsApi.create(payload) : await productsApi.update(id!, payload);
      if (!res.success) {
        setError(res.error?.message ?? 'Save failed');
        return;
      }
      setIsDirty(false);
      if (isNew && res.data?.id) {
        navigate(`/catalog/products/${String(res.data.id)}`);
      } else {
        setNotice('Product saved live and catalog cache refreshed!');
      }
    } finally {
      setSaving(false);
    }
  };

  const updateDraft = (vid: string, patch: Partial<VariantEditDraft>) => {
    setVariantDrafts((prev) => ({
      ...prev,
      [vid]: {
        ...(prev[vid] ?? { color_name: 'Default', color_hex: '#111111', priceRupees: '', compareRupees: '', stock: '0', is_active: 1 }),
        ...patch,
        dirty: true,
      },
    }));
  };

  const saveAllVariantEdits = async () => {
    if (!id) return;
    setError('');
    setNotice('');
    const updates = Object.entries(variantDrafts)
      .filter(([, d]) => d.dirty)
      .map(([variantId, d]) => ({
        variantId,
        color_name: d.color_name.trim() || 'Default',
        color_hex: /^#[0-9A-Fa-f]{6}$/.test(d.color_hex) ? d.color_hex : '#111111',
        price_paise: d.priceRupees.trim() === '' ? null : Math.round(parseFloat(d.priceRupees) * 100),
        compare_paise: d.compareRupees.trim() === '' ? null : Math.round(parseFloat(d.compareRupees) * 100),
        stock: Math.max(0, parseInt(d.stock || '0', 10)),
        is_active: d.is_active,
      }));

    if (updates.length === 0) return;
    const invalid = updates.find(
      (u) =>
        (u.price_paise !== null && (!Number.isFinite(u.price_paise) || u.price_paise <= 0)) ||
        (u.compare_paise !== null && (!Number.isFinite(u.compare_paise) || u.compare_paise <= 0)),
    );
    if (invalid) {
      setError('Variant prices must be blank (inherit base price) or a positive rupee amount.');
      return;
    }

    setSavingVariants(true);
    try {
      const res = await productsApi.variants.bulkPrice(id, updates);
      if (!res.success) {
        setError(res.error?.message ?? 'Failed to save variant pricing.');
        return;
      }
      await reloadProduct(id);
      setNotice(`Saved ${updates.length} variant colour/size/price/stock update(s) live to storefront & checkout!`);
    } finally {
      setSavingVariants(false);
    }
  };

  const applyQuickColorPrice = async (colorName: string, defaultHex: string) => {
    if (!id) return;
    setError('');
    setNotice('');
    const raw = (bulkColorPrices[colorName] ?? '').trim();
    const hex = bulkColorHexes[colorName] || defaultHex;
    const pricePaise = raw === '' ? null : Math.round(parseFloat(raw) * 100);
    if (pricePaise !== null && (!Number.isFinite(pricePaise) || pricePaise <= 0)) {
      setError(`Enter a valid positive rupee price for colour ${colorName} (or leave empty to inherit base price).`);
      return;
    }
    setSavingVariants(true);
    try {
      const res = await productsApi.variants.bulkPrice(id, [
        {
          color_name: colorName,
          color_hex: /^#[0-9A-Fa-f]{6}$/.test(hex) ? hex : defaultHex,
          price_paise: pricePaise,
        },
      ]);
      if (!res.success) {
        setError(res.error?.message ?? 'Failed to apply colour-wise price.');
        return;
      }
      await reloadProduct(id);
      setNotice(
        pricePaise === null
          ? `Updated colour "${colorName}" to inherit base price (₹ ${form.priceRupees}).`
          : `Set all "${colorName}" variants to ₹ ${fmt(pricePaise)} live!`,
      );
    } finally {
      setSavingVariants(false);
    }
  };

  const assignColorShiftImage = async (colorName: string, url: string) => {
    if (!id) return;
    const cleanUrl = url.trim();
    const otherImgs = gallery.filter((g) => g.color_name.toLowerCase() !== colorName.toLowerCase());
    const nextGallery = cleanUrl ? [{ url: cleanUrl, color_name: colorName }, ...otherImgs] : otherImgs;
    await saveGallery(nextGallery);
  };

  const renameColorOption = async (oldName: string) => {
    if (!id) return;
    const nextName = (renameColors[oldName] ?? '').trim();
    if (!nextName || nextName.toLowerCase() === oldName.toLowerCase()) {
      setError('Enter a different colour name to rename.');
      return;
    }
    setError('');
    setNotice('');
    setSavingVariants(true);
    try {
      const res = await productsApi.variants.bulkPrice(id, [
        { color_name: oldName, new_color_name: nextName },
      ]);
      if (!res.success) {
        setError(res.error?.message ?? 'Failed to rename colour.');
        return;
      }
      setRenameColors((prev) => {
        const copy = { ...prev };
        delete copy[oldName];
        return copy;
      });
      await reloadProduct(id);
      setNotice(`Renamed colour "${oldName}" to "${nextName}" across all variants & images live!`);
    } finally {
      setSavingVariants(false);
    }
  };

  const removeColorOption = async (colorName: string) => {
    if (!id) return;
    if (!confirm(`Remove colour "${colorName}" across all sizes? Variants with past orders will be safely deactivated.`)) return;
    setError('');
    setNotice('');
    setSavingVariants(true);
    try {
      const res = await productsApi.removeColor(id, colorName);
      if (!res.success) {
        setError(res.error?.message ?? 'Failed to remove colour.');
        return;
      }
      await reloadProduct(id);
      setNotice(`Removed colour "${colorName}" (${res.data?.deletedCount ?? 0} deleted, ${res.data?.deactivatedCount ?? 0} deactivated).`);
    } finally {
      setSavingVariants(false);
    }
  };

  const addNewSizeAcrossColors = async () => {
    if (!id || !newSizeForm.size.trim()) {
      setError('Enter a size label (e.g. XXL or IT 56).');
      return;
    }
    setError('');
    setNotice('');
    setSavingVariants(true);
    try {
      const sizeLabel = newSizeForm.size.trim();
      const colorsToUse =
        distinctColors.length > 0
          ? distinctColors.map((c) => ({ name: c.name, hex: c.hex }))
          : [{ name: 'Black', hex: '#111111' }];
      const customPaise =
        newSizeForm.priceRupees.trim() !== '' ? Math.round(parseFloat(newSizeForm.priceRupees) * 100) : null;
      const res = await productsApi.variants.matrix(id, {
        sizes: [sizeLabel],
        colors: colorsToUse,
        initialStock: Math.max(0, parseInt(newSizeForm.stock || '10', 10)),
        sizePrices: customPaise ? { [sizeLabel]: customPaise } : undefined,
      });
      if (!res.success) {
        setError(res.error?.message ?? 'Failed to add size across colours.');
        return;
      }
      await reloadProduct(id);
      setAddSizeModal(false);
      setNewSizeForm({ size: '', priceRupees: '', stock: '10' });
      setNotice(`Added size "${sizeLabel}" across ${colorsToUse.length} colour(s) live!`);
    } finally {
      setSavingVariants(false);
    }
  };

  const removeSizeOption = async (sizeLabel: string) => {
    if (!id) return;
    if (!confirm(`Remove size "${sizeLabel}" across all colours? Variants with past orders will be safely deactivated.`)) return;
    setError('');
    setNotice('');
    setSavingVariants(true);
    try {
      const res = await productsApi.removeSize(id, sizeLabel);
      if (!res.success) {
        setError(res.error?.message ?? 'Failed to remove size.');
        return;
      }
      await reloadProduct(id);
      setNotice(`Removed size "${sizeLabel}" (${res.data?.deletedCount ?? 0} deleted, ${res.data?.deactivatedCount ?? 0} deactivated).`);
    } finally {
      setSavingVariants(false);
    }
  };

  const setPrimaryOrHoverImage = async (url: string, field: 'default_img' | 'hover_img') => {
    if (!id) return;
    setError('');
    setNotice('');
    const res = await productsApi.update(id, { [field]: url });
    if (!res.success) {
      setError(res.error?.message ?? 'Failed to update product cover image.');
      return;
    }
    setForm((f) => ({ ...f, [field]: url }));
    setNotice(field === 'default_img' ? 'Updated Primary Card Image live!' : 'Updated Hover / Studio Image live!');
  };

  const toggleCrossSell = (targetId: string, relationType: 'style_it_with' | 'related') => {
    setCrossSells((prev) => {
      const exists = prev.some((x) => x.target_product_id === targetId && x.relation_type === relationType);
      if (exists) {
        return prev.filter((x) => !(x.target_product_id === targetId && x.relation_type === relationType));
      }
      return [...prev, { target_product_id: targetId, relation_type: relationType }];
    });
  };

  const saveCrossSells = async () => {
    if (!id) return;
    setSavingCrossSells(true);
    setError('');
    setNotice('');
    try {
      const res = await productsApi.updateCrossSells(
        id,
        crossSells.map((item, idx) => ({ ...item, sort_order: idx + 1 })),
      );
      if (!res.success) {
        setError(res.error?.message ?? 'Failed to save cross-sells.');
        return;
      }
      setNotice(`Saved ${crossSells.length} cross-sell / styling recommendation(s) live!`);
    } finally {
      setSavingCrossSells(false);
    }
  };

  const addNewColorAcrossSizes = async () => {
    if (!id || !newColorForm.name.trim()) {
      setError('Enter a colour name (e.g. Camel or Midnight Navy).');
      return;
    }
    setError('');
    setSavingVariants(true);
    try {
      const sizesToCreate = distinctSizes.length > 0 ? distinctSizes : ['S', 'M', 'L', 'XL'];
      const colorName = newColorForm.name.trim();
      const colorHex = /^#[0-9A-Fa-f]{6}$/.test(newColorForm.hex) ? newColorForm.hex : '#111111';
      const customPaise =
        newColorForm.priceRupees.trim() !== '' ? Math.round(parseFloat(newColorForm.priceRupees) * 100) : null;
      const res = await productsApi.variants.matrix(id, {
        sizes: sizesToCreate,
        colors: [{ name: colorName, hex: colorHex }],
        initialStock: Math.max(0, parseInt(newColorForm.stock || '15', 10)),
        colorPrices: customPaise ? { [colorName]: customPaise } : undefined,
        colorImages: newColorForm.imageUrl.trim() ? { [colorName]: newColorForm.imageUrl.trim() } : undefined,
      });
      if (!res.success) {
        setError(res.error?.message ?? 'Failed to add colour across sizes.');
        return;
      }
      await reloadProduct(id);
      setAddColorModal(false);
      setNewColorForm({ name: '', hex: '#8C7355', priceRupees: '', imageUrl: '', stock: '15' });
      setNotice(`Added colour "${colorName}" across ${sizesToCreate.length} size(s) live!`);
    } finally {
      setSavingVariants(false);
    }
  };

  const applyQuickSizePrice = async (size: string) => {
    if (!id) return;
    setError('');
    setNotice('');
    const raw = (bulkSizePrices[size] ?? '').trim();
    const pricePaise = raw === '' ? null : Math.round(parseFloat(raw) * 100);
    if (pricePaise !== null && (!Number.isFinite(pricePaise) || pricePaise <= 0)) {
      setError(`Enter a valid positive rupee price for size ${size} (or leave empty to reset to base price).`);
      return;
    }
    setSavingVariants(true);
    try {
      const res = await productsApi.variants.bulkPrice(id, [{ size, price_paise: pricePaise }]);
      if (!res.success) {
        setError(res.error?.message ?? 'Failed to apply size-wise price.');
        return;
      }
      await reloadProduct(id);
      setNotice(
        pricePaise === null
          ? `Reset all "${size}" variants to inherit base price (₹ ${form.priceRupees}).`
          : `Set all "${size}" variants to ₹ ${fmt(pricePaise)} live!`,
      );
    } finally {
      setSavingVariants(false);
    }
  };

  const addVariant = async () => {
    if (!id || !variantForm.sku.trim()) {
      setError('SKU is required for the new variant.');
      return;
    }
    setError('');
    const pricePaise =
      variantForm.priceRupees.trim() !== '' ? Math.round(parseFloat(variantForm.priceRupees) * 100) : null;
    const comparePaise =
      variantForm.compareRupees.trim() !== '' ? Math.round(parseFloat(variantForm.compareRupees) * 100) : null;

    const res = await productsApi.variants.create(id, {
      sku: variantForm.sku.trim(),
      color_name: variantForm.color_name.trim() || 'Black',
      color_hex: variantForm.color_hex || '#111111',
      size: variantForm.size.trim() || 'M',
      price_paise: pricePaise,
      compare_paise: comparePaise,
      stock: Math.max(0, parseInt(variantForm.stock || '0', 10)),
    });
    if (!res.success) {
      setError(res.error?.message ?? 'Failed to add variant.');
      return;
    }
    await reloadProduct(id);
    setVariantModal(false);
    setVariantForm({ sku: '', color_name: 'Black', color_hex: '#111111', size: 'M', priceRupees: '', compareRupees: '', stock: '5' });
    setNotice('Variant added with size-wise pricing.');
  };

  const generateMatrix = async () => {
    if (!id || parsedMatrixSizes.length === 0 || matrixColors.length === 0) {
      setError('Provide at least one size and one color.');
      return;
    }
    setError('');
    setSavingVariants(true);
    try {
      const sizePrices: Record<string, number | null> = {};
      for (const sz of parsedMatrixSizes) {
        const raw = (matrixSizePrices[sz] ?? '').trim();
        if (raw !== '') {
          const paise = Math.round(parseFloat(raw) * 100);
          if (Number.isFinite(paise) && paise > 0) sizePrices[sz] = paise;
        }
      }
      const colorPrices: Record<string, number | null> = {};
      for (const col of matrixColors) {
        const cName = col.name.trim();
        const raw = (matrixColorPrices[cName] ?? '').trim();
        if (cName && raw !== '') {
          const paise = Math.round(parseFloat(raw) * 100);
          if (Number.isFinite(paise) && paise > 0) colorPrices[cName] = paise;
        }
      }
      const res = await productsApi.variants.matrix(id, {
        sizes: parsedMatrixSizes,
        colors: matrixColors.filter((c) => c.name.trim()),
        initialStock: Math.max(0, parseInt(matrixStock || '5', 10)),
        sizePrices: Object.keys(sizePrices).length > 0 ? sizePrices : undefined,
        colorPrices: Object.keys(colorPrices).length > 0 ? colorPrices : undefined,
      });
      if (!res.success) {
        setError(res.error?.message ?? 'Matrix generation failed.');
        return;
      }
      await reloadProduct(id);
      setMatrixModal(false);
      setNotice(`Generated / updated ${res.data?.count ?? 0} size × color variants!`);
    } finally {
      setSavingVariants(false);
    }
  };

  const deleteVariant = async (vid: string) => {
    if (!id || !confirm('Delete (or deactivate if ordered) this variant?')) return;
    await productsApi.variants.delete(id, vid);
    await reloadProduct(id);
    setNotice('Variant removed / deactivated.');
  };

  const saveGallery = async (next: GalleryImageItem[]) => {
    setError('');
    setNotice('');
    setGallery(next);
    if (!isNew && id) {
      const res = await productsApi.updateImages(
        id,
        next.map((item, idx) => ({
          image_url: item.url,
          url: item.url,
          color_name: item.color_name || '',
          alt_text: item.color_name ? `${form.title} — ${item.color_name}` : form.title,
          sort_order: idx,
        })),
      );
      if (!res.success) {
        setError(res.error?.message ?? 'Failed to save gallery images.');
        await reloadProduct(id);
        return;
      }
      setNotice('Gallery & colour shift images saved live to storefront!');
    }
  };

  const handleDirectGalleryUpload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setUploadingGallery(true);
    setError('');
    try {
      const files = Array.from(fileList);
      const uploadedItems: GalleryImageItem[] = [];
      for (let i = 0; i < files.length; i++) {
        setUploadProgress(`Uploading ${i + 1} / ${files.length}…`);
        const res = await uploadLocalMediaFile(files[i], { folder: 'products', altText: form.title });
        if (!res.success) {
          setError(res.message);
          continue;
        }
        uploadedItems.push({ url: res.asset.url, color_name: galleryUploadColor });
      }
      if (uploadedItems.length > 0) {
        await saveGallery([...gallery, ...uploadedItems]);
      }
    } finally {
      setUploadingGallery(false);
      setUploadProgress('');
      if (galleryFileRef.current) galleryFileRef.current.value = '';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    );
  }

  const basePricePaise = Math.round(parseFloat(form.priceRupees || '0') * 100);

  return (
    <div>
      <PageHeader
        title={isNew ? 'New Product' : form.title || 'Edit Product'}
        description={isNew ? 'Add a new piece to the Deynold Danny catalogue.' : `Editing product · /products/${form.slug}`}
        actions={
          <div className="flex items-center gap-3 flex-wrap">
            {hasUnsavedChanges && <Badge variant="warning">Unsaved changes</Badge>}
            {!isNew && form.slug && (
              <a
                href={`/products/${form.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-2 text-xs font-medium text-ink-700 border border-ink-200 rounded-lg hover:border-ink-900 bg-white transition-colors"
              >
                View Live ↗
              </a>
            )}
            <Button
              variant="outline"
              onClick={() => {
                if (hasUnsavedChanges && !confirm('You have unsaved changes. Leave without saving?')) return;
                navigate('/catalog/products');
              }}
            >
              Back
            </Button>
            <Button loading={saving} onClick={save}>
              {isNew ? 'Create Product' : 'Save Changes'}
            </Button>
          </div>
        }
      />

      {notice && (
        <div className="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm px-4 py-3 rounded-xl flex justify-between items-center">
          <span>{notice}</span>
          <button onClick={() => setNotice('')} className="text-xs underline">
            Dismiss
          </button>
        </div>
      )}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-xs underline">
            Dismiss
          </button>
        </div>
      )}

      <Tabs
        tabs={[
          { id: 'details', label: 'Details & Base Pricing' },
          { id: 'variants', label: `Colour & Size Pricing / Stock (${variants.length})` },
          { id: 'images', label: `Images & Colour Shift (${gallery.length})` },
          { id: 'cross_sells', label: `Cross-Sells & Styling (${crossSells.length})` },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'details' && (
        <div className="max-w-3xl space-y-5">
          <Card className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Input
                label="Product Title"
                value={form.title}
                onChange={(e) =>
                  updateForm((f) => ({
                    ...f,
                    title: e.target.value,
                    slug: isNew ? autoSlug(e.target.value) : f.slug,
                    sku_prefix: isNew && !f.sku_prefix ? autoSku(e.target.value) : f.sku_prefix,
                  }))
                }
                required
              />
            </div>
            <Input label="URL Slug" value={form.slug} onChange={(e) => updateForm((f) => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))} />
            <Input label="SKU Prefix" value={form.sku_prefix} onChange={(e) => updateForm((f) => ({ ...f, sku_prefix: e.target.value.toUpperCase() }))} placeholder="DD-SUIT" />
            <Input
              label="Base Price (INR ₹)"
              tooltip="Default price used for all sizes unless a size has its own custom price in the Size-Wise Pricing tab."
              type="number"
              step="0.01"
              value={form.priceRupees}
              onChange={(e) => updateForm((f) => ({ ...f, priceRupees: e.target.value }))}
              required
            />
            <div>
              <Input
                label="Compare / MRP Price (₹, optional)"
                type="number"
                step="0.01"
                value={form.compareRupees}
                onChange={(e) => updateForm((f) => ({ ...f, compareRupees: e.target.value }))}
                error={
                  form.compareRupees.trim() !== '' && parseFloat(form.compareRupees) <= parseFloat(form.priceRupees || '0')
                    ? 'Compare / MRP must be greater than Base Price'
                    : undefined
                }
              />
              {discountPct > 0 && (
                <div className="mt-1">
                  <Badge variant="success">Live Discount: {discountPct}% OFF</Badge>
                </div>
              )}
            </div>
            <Select
              label="Category"
              value={form.category_id}
              onChange={(e) => updateForm((f) => ({ ...f, category_id: e.target.value }))}
              options={[{ value: '', label: 'Select category…' }, ...categories.map((c) => ({ value: c.id, label: c.title }))]}
            />
            <Select
              label="Homepage Placement"
              value={form.section_group}
              onChange={(e) => updateForm((f) => ({ ...f, section_group: e.target.value }))}
              options={[
                { value: 'mastery', label: 'Best Sellers (Mastery)' },
                { value: 'style_space', label: 'New Arrivals (Style Space)' },
                { value: 'news', label: 'Editorial / News' },
              ]}
            />
            <Select
              label="Gender / Line"
              value={form.gender}
              onChange={(e) => updateForm((f) => ({ ...f, gender: e.target.value }))}
              options={[
                { value: 'Men', label: 'Men' },
                { value: 'Women', label: 'Women' },
                { value: 'Unisex', label: 'Unisex' },
              ]}
            />
            <Input label="Collection Tag (optional)" value={form.tag} onChange={(e) => updateForm((f) => ({ ...f, tag: e.target.value }))} placeholder="AUTUMN / WINTER" />
            <Input label="Badge (optional, e.g. NEW)" value={form.badge} onChange={(e) => updateForm((f) => ({ ...f, badge: e.target.value }))} />
            <Select
              label="Status"
              value={String(form.is_active)}
              onChange={(e) => updateForm((f) => ({ ...f, is_active: Number(e.target.value) }))}
              options={[
                { value: '1', label: 'Active (Live on Storefront)' },
                { value: '0', label: 'Archived (Hidden)' },
              ]}
            />
            <div className="sm:col-span-2 pt-1">
              <label className="flex items-center gap-2 text-sm font-medium text-ink-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_featured === 1}
                  onChange={(e) => updateForm((f) => ({ ...f, is_featured: e.target.checked ? 1 : 0 }))}
                  className="w-4 h-4 rounded accent-gold-500"
                />
                Featured Piece (prioritised in homepage carousels &amp; default sort)
              </label>
            </div>
            <div className="sm:col-span-2">
              <ImageUrlField label="Primary Card Image" value={form.default_img} onChange={(url) => updateForm((f) => ({ ...f, default_img: url }))} />
            </div>
            <div className="sm:col-span-2">
              <ImageUrlField label="Hover / Studio Image" value={form.hover_img} onChange={(url) => updateForm((f) => ({ ...f, hover_img: url }))} />
            </div>
          </Card>

          <Card className="p-6 space-y-4">
            <Textarea label="Product Description" value={form.description} onChange={(e) => updateForm((f) => ({ ...f, description: e.target.value }))} rows={4} />
            <Input label="Material & Composition" value={form.material} onChange={(e) => updateForm((f) => ({ ...f, material: e.target.value }))} placeholder="100% Virgin Wool" />
            <Textarea label="Care Instructions" value={form.care_guide} onChange={(e) => updateForm((f) => ({ ...f, care_guide: e.target.value }))} rows={2} />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-ink-100">
              <Textarea
                label="Size & Fit Bullets (1 per line)"
                value={form.size_and_fit}
                onChange={(e) => updateForm((f) => ({ ...f, size_and_fit: e.target.value }))}
                rows={3}
                placeholder={'Tailored slim silhouette\nModel is 188cm wearing size M'}
              />
              <Textarea
                label="Composition & Care Bullets"
                value={form.composition_care}
                onChange={(e) => updateForm((f) => ({ ...f, composition_care: e.target.value }))}
                rows={3}
                placeholder={'100% Superfine Virgin Wool\nDry clean only'}
              />
              <Textarea
                label="Shipping & Returns Bullets"
                value={form.shipping_returns}
                onChange={(e) => updateForm((f) => ({ ...f, shipping_returns: e.target.value }))}
                rows={3}
                placeholder={'Complimentary express delivery\n14-day return window'}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="HSN Code (GST)" value={form.hsn_code} onChange={(e) => updateForm((f) => ({ ...f, hsn_code: e.target.value }))} />
              <Input label="GST Rate (bps, e.g. 1200 = 12%)" type="number" value={String(form.gst_rate_bps)} onChange={(e) => updateForm((f) => ({ ...f, gst_rate_bps: Number(e.target.value) }))} />
            </div>
          </Card>
        </div>
      )}

      {tab === 'variants' && (
        <div className="space-y-5">
          {/* Quick Colour-Wise Pricing & Colour Shift Swatch Bar */}
          {!isNew && (
            <Card className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div>
                  <p className="text-sm font-semibold text-ink-900 flex items-center gap-1.5">
                    Quick Colour-Wise Pricing &amp; Colour Shift Swatch Bar
                    <InfoTooltip text="Set different prices, hex swatches, and colour-shift photos for each colour option. Clicking a colour swatch on Our Best Sellers, New Arrivals, or the Product Detail Page immediately shifts the garment photo and price." />
                  </p>
                  <p className="text-xs text-ink-500">
                    Each colour can have its own price and primary photo across all sizes, or inherit Base Price (<strong>₹ {fmt(basePricePaise)}</strong>).
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => setAddColorModal(true)}>
                  + Add New Colour Option (All Sizes)
                </Button>
              </div>

              {distinctColors.length === 0 ? (
                <p className="text-xs text-ink-500">No colour variants yet. Click &quot;+ Add New Colour Option&quot; or &quot;Size × Color Matrix&quot; to add colours.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {distinctColors.map((col) => {
                    const colorImg = gallery.find((g) => g.color_name.toLowerCase() === col.name.toLowerCase())?.url || '';
                    const currentLabel = col.pricePaise != null ? `₹ ${fmt(col.pricePaise)}` : 'Inherits base';
                    const activeHex = bulkColorHexes[col.name] ?? col.hex;
                    return (
                      <div key={col.name} className="border border-ink-200 rounded-xl p-3.5 bg-ink-50/40 space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={activeHex}
                              onChange={(e) => setBulkColorHexes((prev) => ({ ...prev, [col.name]: e.target.value }))}
                              title="Change swatch hex colour"
                              className="w-7 h-7 rounded border border-ink-300 cursor-pointer bg-white p-0.5"
                            />
                            <div>
                              <span className="font-semibold text-sm text-ink-900 block leading-tight">{col.name}</span>
                              <span className="text-[10px] font-mono text-ink-400">{activeHex}</span>
                            </div>
                          </div>
                          <span className="text-[11px] font-medium text-ink-600">{currentLabel}</span>
                        </div>

                        <div className="flex gap-1.5">
                          <input
                            type="number"
                            step="1"
                            placeholder={`Base ₹${form.priceRupees || '0'}`}
                            value={bulkColorPrices[col.name] ?? (col.pricePaise != null ? String(col.pricePaise / 100) : '')}
                            onChange={(e) => setBulkColorPrices((prev) => ({ ...prev, [col.name]: e.target.value }))}
                            className="w-full px-2.5 py-1.5 text-xs bg-white border border-ink-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-ink-900"
                          />
                          <Button
                            size="sm"
                            variant="secondary"
                            loading={savingVariants}
                            onClick={() => applyQuickColorPrice(col.name, col.hex)}
                          >
                            Set
                          </Button>
                        </div>

                        <div className="flex gap-1.5 items-center pt-1 border-t border-ink-100">
                          <input
                            type="text"
                            placeholder="Rename colour…"
                            value={renameColors[col.name] ?? ''}
                            onChange={(e) => setRenameColors((prev) => ({ ...prev, [col.name]: e.target.value }))}
                            className="w-full px-2 py-1 text-xs bg-white border border-ink-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-ink-900"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!(renameColors[col.name] ?? '').trim()}
                            loading={savingVariants}
                            onClick={() => renameColorOption(col.name)}
                          >
                            Rename
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            loading={savingVariants}
                            onClick={() => removeColorOption(col.name)}
                            className="text-red-500 hover:bg-red-50 px-2"
                            title={`Remove colour ${col.name}`}
                          >
                            ✕
                          </Button>
                        </div>

                        <div className="pt-1 border-t border-ink-100">
                          <ImageUrlField
                            label={`Colour Shift Photo (${col.name})`}
                            value={colorImg}
                            onChange={(url) => assignColorShiftImage(col.name, url)}
                            placeholder="Upload or pick photo for this colour"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          )}

          {/* Quick Size-Wise Pricing Bar */}
          {!isNew && (
            <Card className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div>
                  <p className="text-sm font-semibold text-ink-900 flex items-center gap-1.5">
                    Quick Size-Wise Pricing &amp; Size Manager
                    <InfoTooltip text="Set a price for an entire size (e.g. XL or IT 54) across all colors in one click. Leave empty and click Set to reset that size back to the base product price." />
                  </p>
                  <p className="text-xs text-ink-500">
                    Base product price: <strong>₹ {fmt(basePricePaise)}</strong> · Changes propagate immediately to Cards, PDP, Cart &amp; Checkout.
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => setAddSizeModal(true)}>
                  + Add Size (All Colours)
                </Button>
              </div>
              {distinctSizes.length === 0 ? (
                <p className="text-xs text-ink-500">No sizes configured yet. Click &quot;+ Add Size (All Colours)&quot; or &quot;Size × Color Matrix&quot;.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                  {distinctSizes.map((sz) => {
                    const firstMatch = variants.find((v) => v.size === sz);
                    const currentLabel = firstMatch?.price_paise != null ? `₹ ${fmt(firstMatch.price_paise)}` : 'Inherits base';
                    return (
                      <div key={sz} className="border border-ink-200 rounded-xl p-3 bg-ink-50/40 space-y-2">
                        <div className="flex items-center justify-between gap-1">
                          <div>
                            <span className="font-semibold text-sm text-ink-900 block leading-tight">Size {sz}</span>
                            <span className="text-[10px] text-ink-500">{currentLabel}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeSizeOption(sz)}
                            title={`Remove size ${sz} across all colours`}
                            className="text-xs text-red-500 hover:bg-red-50 rounded px-1.5 py-0.5"
                          >
                            ✕
                          </button>
                        </div>
                        <div className="flex gap-1.5">
                          <input
                            type="number"
                            step="1"
                            placeholder={form.priceRupees || 'Base ₹'}
                            value={bulkSizePrices[sz] ?? (firstMatch?.price_paise != null ? String(firstMatch.price_paise / 100) : '')}
                            onChange={(e) => setBulkSizePrices((prev) => ({ ...prev, [sz]: e.target.value }))}
                            className="w-full px-2.5 py-1.5 text-xs bg-white border border-ink-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-ink-900"
                          />
                          <Button size="sm" variant="secondary" loading={savingVariants} onClick={() => applyQuickSizePrice(sz)}>
                            Set
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          )}

          {/* Full Editable Variants Table */}
          <Card padding={false}>
            <div className="p-4 border-b border-ink-100 flex flex-wrap justify-between items-center gap-3">
              <div>
                <p className="text-sm font-semibold text-ink-900">Variant Matrix (Per-Colour &amp; Per-Size Price, Swatch Hex, MRP &amp; Stock)</p>
                <p className="text-xs text-ink-500">Edit any colour name, swatch hex, custom price, or stock directly below. Leave Custom Price blank to inherit Base Price (₹ {fmt(basePricePaise)}).</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {dirtyCount > 0 && (
                  <Button size="sm" loading={savingVariants} onClick={saveAllVariantEdits}>
                    Save {dirtyCount} Edited Row{dirtyCount > 1 ? 's' : ''}
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => setMatrixModal(true)} disabled={isNew}>
                  ⚡ Size × Color Matrix
                </Button>
                <Button size="sm" onClick={() => setVariantModal(true)} disabled={isNew}>
                  + Add Single Variant
                </Button>
              </div>
            </div>
            {isNew && <p className="p-6 text-sm text-ink-500 text-center">Create the product first, then configure colour-wise &amp; size-wise pricing &amp; stock.</p>}
            {!isNew && variants.length === 0 && (
              <p className="p-6 text-sm text-ink-500 text-center">
                No variants yet. Use <strong>Size × Color Matrix</strong> to generate all colours and sizes with custom pricing in seconds.
              </p>
            )}
            {variants.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-ink-50 border-b border-ink-200">
                      {['SKU', 'Colour & Swatch', 'Size', 'Custom Price (₹)', 'MRP / Compare (₹)', 'Stock', 'Reserved', 'Active', ''].map((h) => (
                        <th key={h} className="text-left py-2.5 px-3 text-xs font-semibold text-ink-500 uppercase tracking-wider">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100">
                    {variants.map((v) => {
                      const d = variantDrafts[v.id] ?? {
                        color_name: String(v.color_name ?? v.color ?? 'Default'),
                        color_hex: String(v.color_hex || '#111111'),
                        priceRupees: v.price_paise != null ? String(v.price_paise / 100) : '',
                        compareRupees: v.compare_paise != null ? String(v.compare_paise / 100) : '',
                        stock: String(v.stock),
                        is_active: v.is_active ? 1 : 0,
                      };
                      const reserved = v.reserved_stock ?? v.reserved ?? 0;
                      const isCustom = d.priceRupees.trim() !== '';
                      return (
                        <tr key={v.id} className={d.dirty ? 'bg-amber-50/40' : 'hover:bg-ink-50/50'}>
                          <td className="py-2.5 px-3 font-mono text-xs text-ink-700">{v.sku}</td>
                          <td className="py-2.5 px-3 text-ink-800">
                            <div className="flex items-center gap-1.5">
                              <input
                                type="color"
                                value={d.color_hex || '#111111'}
                                onChange={(e) => updateDraft(v.id, { color_hex: e.target.value })}
                                className="w-6 h-6 rounded border border-ink-300 cursor-pointer bg-white p-0.5 flex-shrink-0"
                              />
                              <input
                                type="text"
                                value={d.color_name}
                                onChange={(e) => updateDraft(v.id, { color_name: e.target.value })}
                                className="w-28 px-2 py-1 text-xs bg-white border border-ink-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-ink-900"
                              />
                            </div>
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-ink-900">{v.size}</td>
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-1.5">
                              <input
                                type="number"
                                step="0.01"
                                placeholder={`Base (${form.priceRupees || '0'})`}
                                value={d.priceRupees}
                                onChange={(e) => updateDraft(v.id, { priceRupees: e.target.value })}
                                className="w-28 px-2.5 py-1.5 text-xs bg-white border border-ink-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-ink-900"
                              />
                              <Badge variant={isCustom ? 'gold' : 'default'}>{isCustom ? 'Custom' : 'Base'}</Badge>
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            <input
                              type="number"
                              step="0.01"
                              placeholder={form.compareRupees || '—'}
                              value={d.compareRupees}
                              onChange={(e) => updateDraft(v.id, { compareRupees: e.target.value })}
                              className="w-24 px-2.5 py-1.5 text-xs bg-white border border-ink-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-ink-900"
                            />
                          </td>
                          <td className="py-2.5 px-3">
                            <input
                              type="number"
                              min={reserved}
                              value={d.stock}
                              onChange={(e) => updateDraft(v.id, { stock: e.target.value })}
                              className="w-20 px-2.5 py-1.5 text-xs bg-white border border-ink-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-ink-900"
                            />
                          </td>
                          <td className="py-2.5 px-3 text-xs text-ink-500">{reserved}</td>
                          <td className="py-2.5 px-3">
                            <input
                              type="checkbox"
                              checked={d.is_active === 1}
                              onChange={(e) => updateDraft(v.id, { is_active: e.target.checked ? 1 : 0 })}
                              className="w-4 h-4 rounded text-ink-900"
                            />
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <Button size="sm" variant="ghost" onClick={() => deleteVariant(v.id)} className="text-red-500 hover:bg-red-50">
                              Delete
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Add Size Across All Colours Modal */}
          <Modal
            open={addSizeModal}
            onClose={() => setAddSizeModal(false)}
            title="Add New Size (Across All Colours)"
            footer={
              <>
                <Button variant="outline" onClick={() => setAddSizeModal(false)}>Cancel</Button>
                <Button loading={savingVariants} onClick={addNewSizeAcrossColors}>Add Size</Button>
              </>
            }
          >
            <div className="space-y-4">
              <Input
                label="Size Label"
                value={newSizeForm.size}
                onChange={(e) => setNewSizeForm((f) => ({ ...f, size: e.target.value }))}
                placeholder="e.g. XXL, IT 56, 36"
                required
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Custom Price for This Size (₹, optional)"
                  type="number"
                  step="0.01"
                  value={newSizeForm.priceRupees}
                  onChange={(e) => setNewSizeForm((f) => ({ ...f, priceRupees: e.target.value }))}
                  placeholder={`Base ₹${form.priceRupees || '0'}`}
                />
                <Input
                  label="Initial Stock per Colour"
                  type="number"
                  min="0"
                  value={newSizeForm.stock}
                  onChange={(e) => setNewSizeForm((f) => ({ ...f, stock: e.target.value }))}
                />
              </div>
            </div>
          </Modal>

          {/* Add New Colour Across All Sizes Modal */}
          <Modal
            open={addColorModal}
            onClose={() => setAddColorModal(false)}
            title="Add New Colour Option (Across All Sizes)"
            footer={
              <>
                <Button variant="outline" onClick={() => setAddColorModal(false)}>
                  Cancel
                </Button>
                <Button loading={savingVariants} onClick={addNewColorAcrossSizes}>
                  Add Colour Option
                </Button>
              </>
            }
          >
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Colour Name"
                  value={newColorForm.name}
                  onChange={(e) => setNewColorForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Sartorial Camel"
                  required
                />
                <div>
                  <label className="block text-xs font-medium text-ink-700 mb-1.5">Swatch Hex</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={newColorForm.hex}
                      onChange={(e) => setNewColorForm((f) => ({ ...f, hex: e.target.value }))}
                      className="w-9 h-9 rounded border border-ink-200 cursor-pointer"
                    />
                    <input
                      value={newColorForm.hex}
                      onChange={(e) => setNewColorForm((f) => ({ ...f, hex: e.target.value }))}
                      className="w-full px-2.5 py-2 text-xs font-mono border border-ink-200 rounded-lg"
                    />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Custom Price for This Colour (₹, optional)"
                  type="number"
                  step="0.01"
                  value={newColorForm.priceRupees}
                  onChange={(e) => setNewColorForm((f) => ({ ...f, priceRupees: e.target.value }))}
                  placeholder={`Leave blank for Base (₹${form.priceRupees || '0'})`}
                />
                <Input
                  label="Initial Stock per Size"
                  type="number"
                  min="0"
                  value={newColorForm.stock}
                  onChange={(e) => setNewColorForm((f) => ({ ...f, stock: e.target.value }))}
                />
              </div>
              <ImageUrlField
                label="Colour Shift Garment Photo (Optional)"
                value={newColorForm.imageUrl}
                onChange={(url) => setNewColorForm((f) => ({ ...f, imageUrl: url }))}
                placeholder="Upload or choose photo shown when this colour is clicked"
              />
            </div>
          </Modal>

          {/* Add Single Variant Modal */}
          <Modal
            open={variantModal}
            onClose={() => setVariantModal(false)}
            title="Add Size / Colour Variant"
            footer={
              <>
                <Button variant="outline" onClick={() => setVariantModal(false)}>
                  Cancel
                </Button>
                <Button onClick={addVariant}>Add Variant</Button>
              </>
            }
          >
            <div className="space-y-3">
              <Input label="SKU" value={variantForm.sku} onChange={(e) => setVariantForm((f) => ({ ...f, sku: e.target.value.toUpperCase() }))} placeholder={`${form.sku_prefix || 'DD'}-BLK-M`} required />
              <div className="grid grid-cols-3 gap-3">
                <Input label="Colour Name" value={variantForm.color_name} onChange={(e) => setVariantForm((f) => ({ ...f, color_name: e.target.value }))} />
                <div>
                  <label className="block text-xs font-medium text-ink-700 mb-1.5">Swatch Hex</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={variantForm.color_hex}
                      onChange={(e) => setVariantForm((f) => ({ ...f, color_hex: e.target.value }))}
                      className="w-9 h-9 rounded border border-ink-200 cursor-pointer"
                    />
                    <input
                      value={variantForm.color_hex}
                      onChange={(e) => setVariantForm((f) => ({ ...f, color_hex: e.target.value }))}
                      className="w-full px-2 py-1.5 text-xs font-mono border border-ink-200 rounded-lg"
                    />
                  </div>
                </div>
                <Input label="Size" value={variantForm.size} onChange={(e) => setVariantForm((f) => ({ ...f, size: e.target.value }))} placeholder="M / IT 48" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Input
                  label="Custom Price (₹)"
                  type="number"
                  step="0.01"
                  value={variantForm.priceRupees}
                  onChange={(e) => setVariantForm((f) => ({ ...f, priceRupees: e.target.value }))}
                  placeholder={`Base: ${form.priceRupees}`}
                />
                <Input
                  label="Compare / MRP (₹)"
                  type="number"
                  step="0.01"
                  value={variantForm.compareRupees}
                  onChange={(e) => setVariantForm((f) => ({ ...f, compareRupees: e.target.value }))}
                  placeholder="Optional"
                />
                <Input label="Initial Stock" type="number" value={variantForm.stock} onChange={(e) => setVariantForm((f) => ({ ...f, stock: e.target.value }))} />
              </div>
            </div>
          </Modal>

          {/* Bulk Size × Color Matrix Generator Modal */}
          <Modal
            open={matrixModal}
            onClose={() => setMatrixModal(false)}
            title="Generate Size × Colour Matrix with Size-Wise Pricing"
            wide
            footer={
              <>
                <Button variant="outline" onClick={() => setMatrixModal(false)}>Cancel</Button>
                <Button loading={savingVariants} onClick={generateMatrix}>
                  Generate {parsedMatrixSizes.length * matrixColors.length} Variant(s)
                </Button>
              </>
            }
          >
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-ink-700">Sizes (comma-separated)</label>
                  <div className="flex gap-1.5">
                    <button type="button" onClick={() => setMatrixSizesInput('XS, S, M, L, XL, XXL')} className="text-[11px] px-2 py-0.5 rounded bg-ink-100 hover:bg-ink-200 text-ink-700">XS–XXL</button>
                    <button type="button" onClick={() => setMatrixSizesInput('46, 48, 50, 52, 54, 56')} className="text-[11px] px-2 py-0.5 rounded bg-ink-100 hover:bg-ink-200 text-ink-700">IT 46–56</button>
                    <button type="button" onClick={() => setMatrixSizesInput('28, 30, 32, 34, 36, 38')} className="text-[11px] px-2 py-0.5 rounded bg-ink-100 hover:bg-ink-200 text-ink-700">Waist 28–38</button>
                  </div>
                </div>
                <Input value={matrixSizesInput} onChange={(e) => setMatrixSizesInput(e.target.value)} placeholder="S, M, L, XL, XXL" />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-ink-700">Colours</label>
                  <button
                    type="button"
                    onClick={() => setMatrixColors((c) => [...c, { name: 'Ivory', hex: '#F4F1EA' }])}
                    className="text-xs font-medium text-gold-700 hover:underline"
                  >
                    + Add Colour
                  </button>
                </div>
                <div className="space-y-2">
                  {matrixColors.map((col, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="color"
                        value={col.hex}
                        onChange={(e) => setMatrixColors((cs) => cs.map((x, i) => (i === idx ? { ...x, hex: e.target.value } : x)))}
                        className="w-9 h-9 rounded border border-ink-200 cursor-pointer"
                      />
                      <input
                        value={col.name}
                        onChange={(e) => setMatrixColors((cs) => cs.map((x, i) => (i === idx ? { ...x, name: e.target.value } : x)))}
                        placeholder="Colour name"
                        className="flex-1 px-3 py-2 text-sm border border-ink-200 rounded-lg"
                      />
                      {matrixColors.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setMatrixColors((cs) => cs.filter((_, i) => i !== idx))}
                          className="text-xs text-red-500 px-2 py-1 hover:bg-red-50 rounded"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <Input label="Initial Stock per Variant" type="number" min="0" value={matrixStock} onChange={(e) => setMatrixStock(e.target.value)} />

              {matrixColors.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-ink-700 mb-2">
                    Optional Per-Colour Price Overrides (₹) — leave blank to inherit Base Price (₹ {form.priceRupees || '0'})
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {matrixColors
                      .filter((c) => c.name.trim())
                      .map((col) => (
                        <div key={col.name} className="flex items-center gap-2 bg-ink-50 px-3 py-2 rounded-lg border border-ink-200">
                          <span className="w-3 h-3 rounded-full border border-ink-300 flex-shrink-0" style={{ backgroundColor: col.hex }} />
                          <span className="text-xs font-semibold text-ink-800 truncate">{col.name}</span>
                          <input
                            type="number"
                            step="1"
                            placeholder={`₹${form.priceRupees || 'Base'}`}
                            value={matrixColorPrices[col.name] ?? ''}
                            onChange={(e) => setMatrixColorPrices((prev) => ({ ...prev, [col.name]: e.target.value }))}
                            className="w-full px-2 py-1 text-xs bg-white border border-ink-200 rounded"
                          />
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {parsedMatrixSizes.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-ink-700 mb-2">
                    Optional Per-Size Price Overrides (₹) — overrides colour/base price for specific sizes
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {parsedMatrixSizes.map((sz) => (
                      <div key={sz} className="flex items-center gap-2 bg-ink-50 px-3 py-2 rounded-lg border border-ink-200">
                        <span className="text-xs font-semibold text-ink-800 w-10">{sz}</span>
                        <input
                          type="number"
                          step="1"
                          placeholder={`₹${form.priceRupees || 'Base'}`}
                          value={matrixSizePrices[sz] ?? ''}
                          onChange={(e) => setMatrixSizePrices((prev) => ({ ...prev, [sz]: e.target.value }))}
                          className="w-full px-2 py-1 text-xs bg-white border border-ink-200 rounded"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Modal>
        </div>
      )}

      {tab === 'images' && (
        <div className="max-w-4xl">
          <Card className="p-6">
            <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
              <div>
                <p className="text-sm font-semibold text-ink-900">Product Gallery &amp; Colour-Shift Images</p>
                <p className="text-xs text-ink-500">
                  Assign any image to a specific colour option so clicking that colour swatch on the storefront shifts the card and gallery to that colour&apos;s photography.
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {distinctColors.length > 0 && (
                  <select
                    value={galleryUploadColor}
                    onChange={(e) => setGalleryUploadColor(e.target.value)}
                    className="px-2.5 py-1.5 text-xs bg-white border border-ink-200 rounded-lg text-ink-700"
                    title="Default colour assignment for newly uploaded images"
                  >
                    <option value="">Assign upload to: All Colours</option>
                    {distinctColors.map((c) => (
                      <option key={c.name} value={c.name}>
                        Assign upload to: {c.name}
                      </option>
                    ))}
                  </select>
                )}
                <input
                  ref={galleryFileRef}
                  type="file"
                  multiple
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleDirectGalleryUpload(e.target.files)}
                />
                <Button
                  size="sm"
                  variant="secondary"
                  loading={uploadingGallery}
                  disabled={isNew}
                  onClick={() => galleryFileRef.current?.click()}
                >
                  {uploadingGallery ? (uploadProgress || 'Uploading…') : '+ Upload from Device'}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setGalleryPickerOpen(true)} disabled={isNew}>
                  Media Library
                </Button>
              </div>
            </div>
            {isNew && <p className="text-sm text-ink-500 mb-4">Create the product first, then add gallery images.</p>}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {gallery.map((item, i) => (
                <div key={`${item.url}-${i}`} className="flex flex-col rounded-xl overflow-hidden border border-ink-200 bg-ink-50">
                  <div className="relative group aspect-[3/4] overflow-hidden bg-ink-100">
                    <img src={item.url} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      title="Remove image"
                      onClick={() => saveGallery(gallery.filter((_, j) => j !== i))}
                      className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-black/75 hover:bg-red-600 text-white text-xs font-bold flex items-center justify-center shadow"
                    >
                      ✕
                    </button>
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2 flex items-center justify-between gap-1">
                      <div className="flex gap-1">
                        <button
                          type="button"
                          disabled={i === 0}
                          onClick={() => {
                            const next = [...gallery];
                            [next[i - 1], next[i]] = [next[i], next[i - 1]];
                            saveGallery(next);
                          }}
                          className="px-1.5 py-0.5 rounded bg-white/20 text-white text-[10px] hover:bg-white/30 disabled:opacity-30"
                          title="Move left"
                        >
                          ←
                        </button>
                        <button
                          type="button"
                          disabled={i === gallery.length - 1}
                          onClick={() => {
                            const next = [...gallery];
                            [next[i + 1], next[i]] = [next[i], next[i + 1]];
                            saveGallery(next);
                          }}
                          className="px-1.5 py-0.5 rounded bg-white/20 text-white text-[10px] hover:bg-white/30 disabled:opacity-30"
                          title="Move right"
                        >
                          →
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => saveGallery(gallery.filter((_, j) => j !== i))}
                        className="px-2 py-0.5 bg-red-600 hover:bg-red-700 text-white rounded text-[10px] font-medium"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                  <div className="p-2 bg-white border-t border-ink-100 space-y-1.5">
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => setPrimaryOrHoverImage(item.url, 'default_img')}
                        className={`flex-1 px-1.5 py-1 text-[10px] font-medium rounded border transition-colors ${
                          form.default_img === item.url
                            ? 'bg-ink-900 text-white border-ink-900'
                            : 'bg-ink-50 text-ink-700 border-ink-200 hover:border-ink-500'
                        }`}
                      >
                        {form.default_img === item.url ? '★ Main' : 'Set Main'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setPrimaryOrHoverImage(item.url, 'hover_img')}
                        className={`flex-1 px-1.5 py-1 text-[10px] font-medium rounded border transition-colors ${
                          form.hover_img === item.url
                            ? 'bg-gold-600 text-white border-gold-600'
                            : 'bg-ink-50 text-ink-700 border-ink-200 hover:border-ink-500'
                        }`}
                      >
                        {form.hover_img === item.url ? '★ Hover' : 'Set Hover'}
                      </button>
                    </div>
                    <label className="block text-[10px] uppercase tracking-wider text-ink-400">
                      Colour Shift Swatch
                    </label>
                    <select
                      value={item.color_name}
                      onChange={(e) => {
                        const next = gallery.map((g, idx) => (idx === i ? { ...g, color_name: e.target.value } : g));
                        saveGallery(next);
                      }}
                      className="w-full px-2 py-1 text-xs border border-ink-200 rounded bg-ink-50/50 text-ink-800"
                    >
                      <option value="">All Colours (Shared)</option>
                      {distinctColors.map((c) => (
                        <option key={c.name} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
              {!isNew && (
                <button
                  type="button"
                  onClick={() => galleryFileRef.current?.click()}
                  className="aspect-[3/4] rounded-xl border-2 border-dashed border-ink-300 hover:border-gold-400 transition-colors flex flex-col items-center justify-center text-ink-400 hover:text-gold-600 gap-1"
                >
                  <span className="text-2xl">+</span>
                  <span className="text-xs font-medium">Upload Photo</span>
                </button>
              )}
            </div>
          </Card>

          <MediaPickerModal
            open={galleryPickerOpen}
            onClose={() => setGalleryPickerOpen(false)}
            title="Add Product Gallery Image"
            onSelect={(asset) => saveGallery([...gallery, { url: asset.url, color_name: galleryUploadColor }])}
          />
        </div>
      )}

      {tab === 'cross_sells' && (
        <div className="max-w-4xl">
          <Card className="p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-ink-900">Style It With &amp; Related Suggestions</p>
                <p className="text-xs text-ink-500">
                  Choose pieces to merchandise in the &quot;Style It With&quot; and &quot;More Suggestions&quot; sections on this product&apos;s storefront page.
                </p>
              </div>
              <Button size="sm" loading={savingCrossSells} disabled={isNew} onClick={saveCrossSells}>
                Save Cross-Sells ({crossSells.length})
              </Button>
            </div>
            {isNew ? (
              <p className="text-sm text-ink-500">Create the product first, then link styling recommendations.</p>
            ) : (
              <>
                <Input
                  placeholder="Search catalogue products to link…"
                  value={crossSellSearch}
                  onChange={(e) => setCrossSellSearch(e.target.value)}
                />
                <div className="divide-y divide-ink-100 border border-ink-200 rounded-xl max-h-[420px] overflow-y-auto">
                  {allProducts
                    .filter((p) => {
                      const q = crossSellSearch.trim().toLowerCase();
                      return !q || p.title.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q);
                    })
                    .map((p) => {
                      const isStyle = crossSells.some((x) => x.target_product_id === p.id && x.relation_type === 'style_it_with');
                      const isRelated = crossSells.some((x) => x.target_product_id === p.id && x.relation_type === 'related');
                      return (
                        <div key={p.id} className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-ink-50/50">
                          <div className="flex items-center gap-3 min-w-0">
                            {p.default_img && <img src={p.default_img} alt="" className="w-9 h-11 rounded object-cover border border-ink-200 flex-shrink-0" />}
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-ink-900 truncate">{p.title}</p>
                              <p className="text-xs text-ink-400 font-mono">₹ {fmt(p.price_paise)} · /{p.slug}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <button
                              type="button"
                              onClick={() => toggleCrossSell(p.id, 'style_it_with')}
                              className={`px-2.5 py-1 text-xs rounded-lg border font-medium transition-colors ${
                                isStyle ? 'bg-ink-900 text-white border-ink-900' : 'bg-white text-ink-700 border-ink-200 hover:border-ink-500'
                              }`}
                            >
                              {isStyle ? '✓ Style It With' : '+ Style It With'}
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleCrossSell(p.id, 'related')}
                              className={`px-2.5 py-1 text-xs rounded-lg border font-medium transition-colors ${
                                isRelated ? 'bg-gold-600 text-white border-gold-600' : 'bg-white text-ink-700 border-ink-200 hover:border-ink-500'
                              }`}
                            >
                              {isRelated ? '✓ Related' : '+ Related'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
