import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { friendlyError, isUuid, sb, type Mode } from '@/core/supabase';
import { useAuth } from '@/core/auth';
import { useSettings } from '@/core/settings';
import { useConfirm } from '@/core/confirm';
import { useQuery, unwrap } from '@/core/useQuery';
import { Button, Card, Empty, ErrorView, Field, Img, Loading, Notice, Screen, Segmented, SelectField, SwitchRow, st } from '@/core/ui';
import { colors, radius } from '@/core/theme';
import { pickAndUploadProductImage } from './upload';

interface Cat { id: string; title: string }
interface Sub { id: string; title: string; category_id: string }
interface ProductRow {
  id: string; name: string; description: string; price: number; mode: Mode; visible: boolean;
  image_url: string | null; subcategory_id: string; business_id: string;
}

/** Add or edit one of the business's products (existing product model and categories). */
export function BizProductFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editing = isUuid(id);
  const auth = useAuth();
  const biz = auth.account.business;
  const { S } = useSettings();
  const confirm = useConfirm();
  const nav = useNavigation();

  const q = useQuery(async () => {
    const [cats, subs, product] = await Promise.all([
      unwrap<Cat[]>(sb.from('categories').select('id,title').eq('visible', true).order('sort_order').order('title')),
      unwrap<Sub[]>(sb.from('subcategories').select('id,title,category_id').eq('visible', true).order('sort_order').order('title')),
      editing ? unwrap<ProductRow | null>(sb.from('products').select('id,name,description,price,mode,visible,image_url,subcategory_id,business_id').eq('id', id!).maybeSingle()) : Promise.resolve(null),
    ]);
    return { cats, subs, product };
  }, [id]);

  const [f, setF] = useState({ name: '', description: '', price: '', mode: 'order' as Mode, visible: true, image_url: '' as string, category: '', subcategory: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState<'' | 'save' | 'image' | 'delete'>('');

  useEffect(() => { nav.setOptions({ title: editing ? 'Edit product' : 'New product' }); }, [editing, nav]);
  useEffect(() => {
    const p = q.data?.product;
    if (!p || !q.data) return;
    const sub = q.data.subs.find(s => s.id === p.subcategory_id);
    setF({ name: p.name, description: p.description, price: String(p.price), mode: p.mode, visible: p.visible,
      image_url: p.image_url || '', category: sub?.category_id || '', subcategory: p.subcategory_id });
  }, [q.data]);

  const catOptions = useMemo(() => (q.data?.cats || []).map(c => ({ id: c.id, label: c.title })), [q.data]);
  const subOptions = useMemo(() => (q.data?.subs || []).filter(s => s.category_id === f.category).map(s => ({ id: s.id, label: s.title })), [q.data, f.category]);

  if (!biz) return <Empty text="Please log in with your business account." />;
  if (q.loading) return <Loading />;
  if (q.error) return <ErrorView message={q.error} onRetry={q.reload} />;
  if (editing && (!q.data?.product || q.data.product.business_id !== biz.id)) return <Empty text="Product not found." />;

  const set = <K extends keyof typeof f>(k: K) => (v: (typeof f)[K]) => setF(x => ({ ...x, [k]: v }));

  async function pickImage() {
    setErr(''); setBusy('image');
    try {
      const url = await pickAndUploadProductImage(biz!.id);
      if (url) setF(x => ({ ...x, image_url: url }));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Upload failed.');
    } finally { setBusy(''); }
  }

  async function save() {
    setErr('');
    const name = f.name.trim();
    const price = Math.round(parseFloat(f.price.replace(',', '.')) * 100) / 100;
    if (!name) return setErr('Please enter a product name.');
    if (!Number.isFinite(price) || price < 0) return setErr('Please enter a valid price (0 or more).');
    if (!isUuid(f.subcategory)) return setErr('Please choose a category and subcategory.');
    const row = { name, description: f.description.trim(), price, mode: f.mode, visible: f.visible,
      image_url: f.image_url || null, subcategory_id: f.subcategory };
    setBusy('save');
    let error;
    if (editing) {
      ({ error } = await sb.from('products').update(row).eq('id', id!).eq('business_id', biz!.id));
    } else {
      const { data: last } = await sb.from('products').select('sort_order').eq('business_id', biz!.id).order('sort_order', { ascending: false }).limit(1);
      ({ error } = await sb.from('products').insert({ ...row, business_id: biz!.id, sort_order: ((last?.[0]?.sort_order as number) || 0) + 10 }));
    }
    setBusy('');
    if (error) return setErr(friendlyError(error.message));
    router.back();
  }

  async function remove() {
    if (!(await confirm({ title: 'Delete this product?', message: `"${f.name}" will be removed. Past orders keep their copy.`, confirmText: 'Delete', destructive: true }))) return;
    setBusy('delete');
    const { error } = await sb.from('products').delete().eq('id', id!).eq('business_id', biz!.id);
    setBusy('');
    if (error) return setErr(friendlyError(error.message));
    router.back();
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <Screen>
        <Card style={{ gap: 14 }}>
          <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
            <Pressable onPress={pickImage} disabled={!!busy} accessibilityRole="button" accessibilityLabel="Choose photo">
              <Img uri={f.image_url} label={f.name || '+'} style={{ width: 96, height: 96, borderRadius: radius.md }} />
            </Pressable>
            <View style={{ flex: 1, gap: 8 }}>
              <Button title={f.image_url ? 'Change photo' : 'Add photo'} onPress={pickImage} loading={busy === 'image'} disabled={!!busy && busy !== 'image'} />
              {f.image_url ? <Text style={{ color: colors.danger, textAlign: 'center' }} onPress={() => set('image_url')('')}>Remove photo</Text> : null}
            </View>
          </View>
          <Field label="Product name" value={f.name} onChangeText={set('name')} maxLength={200} />
          <Field label={`Price (${S.currency})`} value={f.price} onChangeText={t => set('price')(t.replace(/[^0-9.,]/g, ''))} keyboardType="decimal-pad" maxLength={12} />
          <Field label="Description" value={f.description} onChangeText={set('description')} multiline maxLength={5000} />
          <SelectField label="Category" value={f.category} options={catOptions} placeholder="Choose a category"
            onChange={o => { setErr(''); setF(x => ({ ...x, category: o.id, subcategory: '' })); }} />
          <SelectField label="Subcategory" value={f.subcategory} options={subOptions}
            placeholder={f.category ? (subOptions.length ? 'Choose a subcategory' : 'No subcategories in this category') : 'Choose a category first'}
            onChange={o => { setErr(''); set('subcategory')(o.id); }} />
          <View style={{ gap: 6 }}>
            <Text style={st.label}>Ordering</Text>
            <Segmented value={f.mode} onChange={set('mode')} options={[
              { value: 'order', label: 'Order' }, { value: 'preorder', label: 'Pre-order' }, { value: 'unavailable', label: 'Unavailable' }]} />
          </View>
          <SwitchRow label="Visible in the app" value={f.visible} onChange={set('visible')} hint="Hidden products are kept but customers can't see them." />
          {err ? <Notice kind="error">{err}</Notice> : null}
          <Button title={editing ? 'Save changes' : 'Add product'} variant="primary" loading={busy === 'save'} disabled={!!busy && busy !== 'save'} onPress={save} />
          {editing ? <Button title="Delete product" variant="danger" loading={busy === 'delete'} disabled={!!busy && busy !== 'delete'} onPress={remove} /> : null}
        </Card>
      </Screen>
    </KeyboardAvoidingView>
  );
}
