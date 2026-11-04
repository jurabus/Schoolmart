import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius } from './theme';
import { useSettings } from './settings';

// A confirm dialog that looks the same on iPhone, Android and web previews.
export interface ConfirmOptions { title: string; message?: string; confirmText?: string; cancelText?: string; destructive?: boolean }
type ConfirmFn = (o: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);
  const { accent } = useSettings();

  const confirm = useCallback<ConfirmFn>(o => new Promise(res => { resolver.current = res; setOpts(o); }), []);
  const close = (v: boolean) => { resolver.current?.(v); resolver.current = null; setOpts(null); };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal visible={!!opts} transparent animationType="fade" onRequestClose={() => close(false)}>
        <Pressable style={s.backdrop} onPress={() => close(false)}>
          <Pressable style={s.box} onPress={() => { /* keep open */ }}>
            <Text style={s.title}>{opts?.title}</Text>
            {opts?.message ? <Text style={s.msg}>{opts.message}</Text> : null}
            <View style={s.row}>
              <Pressable style={[s.btn, s.cancel]} onPress={() => close(false)} accessibilityRole="button">
                <Text style={s.cancelText}>{opts?.cancelText || 'Cancel'}</Text>
              </Pressable>
              <Pressable
                style={[s.btn, { backgroundColor: opts?.destructive ? colors.danger : accent }]}
                onPress={() => close(true)}
                accessibilityRole="button"
              >
                <Text style={s.okText}>{opts?.confirmText || 'OK'}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const c = useContext(ConfirmContext);
  if (!c) throw new Error('useConfirm must be used inside ConfirmProvider');
  return c;
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(28,25,23,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  box: { width: '100%', maxWidth: 420, backgroundColor: colors.surface, borderRadius: radius.lg, padding: 22, gap: 10 },
  title: { fontSize: 18, fontWeight: '800', color: colors.text },
  msg: { fontSize: 15, color: colors.muted, lineHeight: 21 },
  row: { flexDirection: 'row', gap: 10, marginTop: 10 },
  btn: { flex: 1, minHeight: 48, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  cancel: { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  cancelText: { fontWeight: '700', color: colors.text, fontSize: 15 },
  okText: { fontWeight: '700', color: '#fff', fontSize: 15 },
});
