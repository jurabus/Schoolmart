import React, { useState, type ReactNode } from 'react';
import {
  ActivityIndicator, FlatList, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Switch, Text, TextInput,
  View, useWindowDimensions, type TextInputProps, type ViewStyle,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image, type ImageStyle } from 'expo-image';
import { colors, radius, space, statusColors } from './theme';
import { useSettings } from './settings';
import { fmtDate, money, safeUrl } from './format';
import type { Mode, Order, OrderItem } from './supabase';

// ------------------------------------------------------------ layout
export function Screen({ children, onRefresh, padded = true }: {
  children: ReactNode; onRefresh?: () => Promise<unknown>; padded?: boolean;
}) {
  const [refreshing, setRefreshing] = useState(false);
  const { accent } = useSettings();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={[padded && { padding: space }, { paddingBottom: 48 }]}
      keyboardShouldPersistTaps="handled"
      refreshControl={onRefresh ? (
        <RefreshControl
          tintColor={accent}
          colors={[accent]}
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            try { await onRefresh(); } finally { setRefreshing(false); }
          }}
        />
      ) : undefined}
    >
      {children}
    </ScrollView>
  );
}

export function Loading() {
  const { accent } = useSettings();
  return <View style={st.center}><ActivityIndicator size="large" color={accent} /></View>;
}

export function ErrorView({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <View style={st.center}>
      <Text style={st.muted}>Something went wrong. Please check your connection.</Text>
      {message ? <Text style={[st.muted, st.small, { marginTop: 6 }]}>{message}</Text> : null}
      {onRetry ? <Button title="Try again" onPress={onRetry} style={{ marginTop: 16 }} /> : null}
    </View>
  );
}

export function Empty({ text, action }: { text: string; action?: ReactNode }) {
  return <View style={st.center}><Text style={st.muted}>{text}</Text>{action}</View>;
}

export const H1 = ({ children }: { children: ReactNode }) => <Text style={st.h1}>{children}</Text>;
export const Muted = ({ children, small, left }: { children: ReactNode; small?: boolean; left?: boolean }) =>
  <Text style={[st.muted, small && st.small, left && { textAlign: 'left' }]}>{children}</Text>;

export function Notice({ children, kind = 'warn' }: { children: ReactNode; kind?: 'warn' | 'error' | 'info' }) {
  const c = kind === 'error' ? { bg: colors.dangerBg, fg: colors.danger }
    : kind === 'info' ? { bg: colors.preBg, fg: colors.preText }
    : { bg: colors.noticeBg, fg: colors.noticeText };
  return <View style={[st.notice, { backgroundColor: c.bg }]}><Text style={{ color: c.fg }}>{children}</Text></View>;
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[st.card, style]}>{children}</View>;
}

// ------------------------------------------------------------ images
export function Img({ uri, label, style }: { uri?: string | null; label: string; style: ViewStyle & ImageStyle }) {
  const u = safeUrl(uri);
  if (u) return <Image source={{ uri: u }} style={[style as ImageStyle, { backgroundColor: colors.soft }]} contentFit="cover" transition={150} accessibilityLabel={label} />;
  return (
    <View style={[style as ViewStyle, st.ph]}>
      <Text style={st.phText}>{(label.trim()[0] || '?').toUpperCase()}</Text>
    </View>
  );
}

// ------------------------------------------------------------ grid of image tiles
export function TileGrid<T extends { id: string }>({ items, title, image, onPress, footer }: {
  items: T[]; title: (t: T) => string; image: (t: T) => string | null;
  onPress: (t: T) => void; footer?: (t: T) => ReactNode;
}) {
  const { width } = useWindowDimensions();
  const cols = width >= 900 ? 4 : width >= 600 ? 3 : 2;
  const gap = 12;
  const w = (Math.min(width, 1100) - space * 2 - gap * (cols - 1)) / cols;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap }}>
      {items.map(it => (
        <Pressable key={it.id} onPress={() => onPress(it)} style={({ pressed }) => [st.tile, { width: w }, pressed && { opacity: 0.85 }]}>
          <Img uri={image(it)} label={title(it)} style={{ width: '100%', aspectRatio: 1 }} />
          <View style={{ padding: 10 }}>
            <Text style={st.tileTitle} numberOfLines={2}>{title(it)}</Text>
            {footer?.(it)}
          </View>
        </Pressable>
      ))}
    </View>
  );
}

// ------------------------------------------------------------ controls
export function Button({ title, onPress, variant = 'default', disabled, style, loading }: {
  title: string; onPress?: () => void; variant?: 'default' | 'primary' | 'danger';
  disabled?: boolean; style?: ViewStyle; loading?: boolean;
}) {
  const { accent } = useSettings();
  const primary = variant === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        st.btn,
        primary && { backgroundColor: accent, borderColor: accent },
        variant === 'danger' && { borderColor: '#fecaca' },
        (disabled || loading) && { opacity: 0.5 },
        pressed && { opacity: 0.8 },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={primary ? '#fff' : accent} /> : (
        <Text style={[st.btnText, primary && { color: '#fff' }, variant === 'danger' && { color: colors.danger }]}>{title}</Text>
      )}
    </Pressable>
  );
}

export function QtyStepper({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [text, setText] = useState<string | null>(null);
  return (
    <View style={st.qty}>
      <Pressable accessibilityLabel="Decrease" onPress={() => onChange(Math.max(1, value - 1))} style={st.qtyBtn}><Text style={st.qtyBtnText}>−</Text></Pressable>
      <TextInput
        style={st.qtyInput}
        keyboardType="number-pad"
        value={text ?? String(value)}
        onChangeText={t => setText(t.replace(/\D/g, '').slice(0, 3))}
        onBlur={() => { if (text !== null) onChange(Math.max(1, Math.min(999, Number(text) || 1))); setText(null); }}
        accessibilityLabel="Quantity"
      />
      <Pressable accessibilityLabel="Increase" onPress={() => onChange(Math.min(999, value + 1))} style={st.qtyBtn}><Text style={st.qtyBtnText}>+</Text></Pressable>
    </View>
  );
}

export function Field({ label, ...props }: { label: string } & TextInputProps) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={st.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.muted}
        accessibilityLabel={label}
        style={[st.input, props.multiline && { minHeight: 90, textAlignVertical: 'top' }, props.editable === false && { backgroundColor: colors.soft, color: colors.muted }]}
        {...props}
      />
    </View>
  );
}

export function ModeTag({ mode }: { mode: Mode }) {
  const { S } = useSettings();
  if (mode === 'preorder') return <Tag text={S.badge_preorder} bg={colors.preBg} fg={colors.preText} />;
  if (mode === 'unavailable') return <Tag text={S.badge_unavailable} bg={colors.offBg} fg={colors.offText} />;
  return null;
}

export function Tag({ text, bg, fg }: { text: string; bg: string; fg: string }) {
  return <View style={[st.tag, { backgroundColor: bg }]}><Text style={[st.tagText, { color: fg }]}>{text}</Text></View>;
}

// ------------------------------------------------------------ money & orders
export function Totals({ subtotal, fee }: { subtotal: number; fee: number }) {
  const { S } = useSettings();
  return (
    <View style={{ gap: 8 }}>
      <Row l={S.label_subtotal} r={money(subtotal, S.currency)} />
      {fee > 0 ? <Row l={S.label_delivery} r={money(fee, S.currency)} /> : null}
      <View style={st.hr} />
      <Row l={S.label_total} r={money(subtotal + fee, S.currency)} bold />
    </View>
  );
}

export function Row({ l, r, bold }: { l: string; r: string; bold?: boolean }) {
  return (
    <View style={st.row}>
      <Text style={[{ color: colors.text, flexShrink: 1 }, bold && st.bold]}>{l}</Text>
      <Text style={[{ color: colors.text }, bold && st.bold]}>{r}</Text>
    </View>
  );
}

export function OrderCard({ order, items }: { order: Order; items: OrderItem[] }) {
  const { S, accent } = useSettings();
  const sc = statusColors[order.status] || statusColors.new;
  const label = (S as Record<string, unknown>)['status_' + order.status] as string || order.status;
  return (
    <Card style={{ gap: 12 }}>
      <View style={[st.row, { alignItems: 'center' }]}>
        <View>
          <Muted small left>{S.lbl_order_code}</Muted>
          <Text style={[st.code, { color: accent, fontSize: 20 }]}>{order.order_code}</Text>
        </View>
        <Tag text={label} bg={sc.bg} fg={sc.fg} />
      </View>
      <View style={st.hr} />
      {order.business_name ? <KV k={S.supplier_label} v={order.business_name} /> : null}
      <KV k={S.lbl_date} v={fmtDate(order.created_at)} />
      <KV k={S.lbl_name} v={`${order.first_name} ${order.last_name}`} />
      <KV k={S.f_phone} v={order.phone} />
      <KV k={S.f_address} v={order.address} />
      <View style={st.hr} />
      {[...items].sort((a, b) => a.position - b.position).map((i, idx) => (
        <View key={idx} style={[st.row, { alignItems: 'flex-start' }]}>
          <View style={{ flex: 1, gap: 2 }}>
            <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <Text style={st.bold}>{i.product_name}</Text>
              {i.mode === 'preorder' ? <ModeTag mode="preorder" /> : null}
            </View>
            <Muted small left>{i.quantity} × {money(i.unit_price, S.currency)}</Muted>
          </View>
          <Text style={st.bold}>{money(i.line_total, S.currency)}</Text>
        </View>
      ))}
      <View style={st.hr} />
      <Totals subtotal={Number(order.subtotal)} fee={Number(order.delivery_fee)} />
    </Card>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 12 }}>
      <Text style={[st.muted, { width: 110, textAlign: 'left' }]}>{k}</Text>
      <Text style={{ flex: 1, color: colors.text }}>{v}</Text>
    </View>
  );
}

// ------------------------------------------------------------ form helpers
export function Segmented<T extends string>({ value, options, onChange }: {
  value: T; options: { value: T; label: string }[]; onChange: (v: T) => void;
}) {
  const { accent } = useSettings();
  return (
    <View style={st.seg}>
      {options.map(o => {
        const on = o.value === value;
        return (
          <Pressable key={o.value} onPress={() => onChange(o.value)} accessibilityRole="button" accessibilityState={{ selected: on }}
            style={[st.segItem, on && { backgroundColor: accent }]}>
            <Text style={[st.segText, on && { color: '#fff' }]} numberOfLines={1}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function SwitchRow({ label, value, onChange, hint }: { label: string; value: boolean; onChange: (v: boolean) => void; hint?: string }) {
  const { accent } = useSettings();
  return (
    <View style={[st.row, { alignItems: 'center' }]}>
      <View style={{ flex: 1 }}>
        <Text style={st.label}>{label}</Text>
        {hint ? <Text style={[st.muted, st.small, { textAlign: 'left' }]}>{hint}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: accent, false: colors.line }} />
    </View>
  );
}

/** A tappable field that opens a searchable list (works the same on every platform). */
export function SelectField<T extends { id: string; label: string }>({ label, value, options, onChange, placeholder }: {
  label: string; value: string | null | undefined; options: T[]; onChange: (o: T) => void; placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const insets = useSafeAreaInsets();
  const current = options.find(o => o.id === value);
  const shown = q ? options.filter(o => o.label.toLowerCase().includes(q.toLowerCase())) : options;
  return (
    <View style={{ gap: 6 }}>
      <Text style={st.label}>{label}</Text>
      <Pressable style={[st.input, st.row, { alignItems: 'center' }]} onPress={() => { setQ(''); setOpen(true); }} accessibilityRole="button">
        <Text style={{ color: current ? colors.text : colors.muted, flex: 1, fontSize: 16 }} numberOfLines={1}>
          {current ? current.label : placeholder || 'Choose…'}
        </Text>
        <Ionicons name="chevron-down" size={18} color={colors.muted} />
      </Pressable>
      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top + 8 }}>
          <View style={[st.row, { padding: space, alignItems: 'center' }]}>
            <Text style={[st.h1, { marginBottom: 0, fontSize: 20, flex: 1 }]}>{label}</Text>
            <Pressable onPress={() => setOpen(false)} hitSlop={12} accessibilityLabel="Close"><Ionicons name="close" size={26} color={colors.text} /></Pressable>
          </View>
          {options.length > 8 ? (
            <View style={{ paddingHorizontal: space, paddingBottom: 8 }}>
              <TextInput style={st.input} placeholder="Search" placeholderTextColor={colors.muted} value={q} onChangeText={setQ} autoCorrect={false} />
            </View>
          ) : null}
          <FlatList
            data={shown}
            keyExtractor={o => o.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
            renderItem={({ item }) => (
              <Pressable onPress={() => { onChange(item); setOpen(false); }} style={({ pressed }) => [st.option, pressed && { backgroundColor: colors.soft }]}>
                <Text style={{ flex: 1, fontSize: 16, color: colors.text }}>{item.label}</Text>
                {item.id === value ? <Ionicons name="checkmark" size={20} color={colors.ok} /> : null}
              </Pressable>
            )}
            ListEmptyComponent={<Text style={[st.muted, { padding: 24 }]}>Nothing found</Text>}
          />
        </View>
      </Modal>
    </View>
  );
}

export function ListRow({ title, subtitle, onPress, icon, danger }: {
  title: string; subtitle?: string; onPress?: () => void; icon?: React.ComponentProps<typeof Ionicons>['name']; danger?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [st.listRow, pressed && { backgroundColor: colors.soft }]} accessibilityRole="button">
      {icon ? <Ionicons name={icon} size={20} color={danger ? colors.danger : colors.muted} /> : null}
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 16, color: danger ? colors.danger : colors.text, fontWeight: '600' }}>{title}</Text>
        {subtitle ? <Text style={{ color: colors.muted, fontSize: 13 }}>{subtitle}</Text> : null}
      </View>
      {onPress && !danger ? <Ionicons name="chevron-forward" size={18} color={colors.muted} /> : null}
    </Pressable>
  );
}

// ------------------------------------------------------------ styles
export const st = StyleSheet.create({
  center: { flex: 1, minHeight: 280, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  h1: { fontSize: 26, fontWeight: '800', color: colors.text, marginBottom: 12 },
  muted: { color: colors.muted, textAlign: 'center' },
  small: { fontSize: 13 },
  bold: { fontWeight: '700', color: colors.text },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: space },
  notice: { padding: 12, borderRadius: 12, marginBottom: 12 },
  ph: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#ece9e6' },
  phText: { fontSize: 36, fontWeight: '800', color: colors.muted, opacity: 0.6 },
  tile: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' },
  tileTitle: { fontSize: 15, fontWeight: '700', color: colors.text, textAlign: 'center' },
  btn: { minHeight: 50, paddingHorizontal: 20, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontSize: 16, fontWeight: '700', color: colors.text },
  qty: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.line, borderRadius: radius.pill, backgroundColor: colors.surface, alignSelf: 'flex-start' },
  qtyBtn: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  qtyBtnText: { fontSize: 22, color: colors.text },
  qtyInput: { width: 48, height: 42, textAlign: 'center', fontSize: 16, color: colors.text },
  label: { fontWeight: '600', fontSize: 14, color: colors.text },
  input: { borderWidth: 1, borderColor: colors.line, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, backgroundColor: colors.surface, color: colors.text },
  tag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, alignSelf: 'flex-start' },
  tagText: { fontSize: 11, fontWeight: '800' },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  hr: { height: 1, backgroundColor: colors.line },
  code: { fontWeight: '800', letterSpacing: 1.5, fontVariant: ['tabular-nums'] },
  seg: { flexDirection: 'row', borderWidth: 1, borderColor: colors.line, borderRadius: radius.pill, padding: 3, backgroundColor: colors.surface },
  segItem: { flex: 1, minHeight: 38, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  segText: { fontWeight: '700', color: colors.text, fontSize: 13 },
  option: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space, paddingVertical: 16, borderBottomWidth: 1, borderColor: colors.line, gap: 10 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 4 },
});
