import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { sb, friendlyError, type Business, type Customer } from './supabase';
import { canonicalPhone, isValidPhone, phoneEmail } from './phone';

export type Role = 'guest' | 'customer' | 'business' | 'admin' | 'none';
export interface Account { role: Role; customer?: Customer; business?: Business }

type Result = { error?: string };
export interface SignUpInput { firstName: string; lastName: string; phone: string; address: string; password: string }

type Ctx = {
  loading: boolean;
  session: Session | null;
  account: Account;
  role: Role;
  refresh: () => Promise<void>;
  signIn: (phone: string, password: string) => Promise<Result>;
  signUp: (input: SignUpInput) => Promise<Result>;
  signOut: () => Promise<void>;
  updateProfile: (p: { firstName: string; lastName: string; address: string }) => Promise<Result>;
  changePassword: (current: string, next: string) => Promise<Result>;
  deleteAccount: () => Promise<Result>;
};

const GUEST: Account = { role: 'guest' };
const AuthContext = createContext<Ctx | null>(null);
export const MIN_PASSWORD = 8;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [account, setAccount] = useState<Account>(GUEST);
  const [loading, setLoading] = useState(true);
  const seq = useRef(0);

  // Only the most recent account check may update state, and "loading" ends only when it does —
  // so the app never briefly treats a logged-in user as a guest.
  const loadAccount = useCallback(async (s: Session | null) => {
    const my = ++seq.current;
    let next: Account = GUEST;
    if (s) {
      const { data, error } = await sb.rpc('my_account');
      next = error || !data ? { role: 'none' } : (data as Account);
    }
    if (my !== seq.current) return;
    setAccount(next);
    setLoading(false);
  }, []);

  useEffect(() => {
    let alive = true;
    sb.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setSession(data.session);
      loadAccount(data.session);
    });
    const { data: sub } = sb.auth.onAuthStateChange((event, s) => {
      setSession(s);
      // Token refreshes don't change who you are; everything else reloads the role.
      if (event !== 'TOKEN_REFRESHED') setTimeout(() => loadAccount(s), 0);
    });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, [loadAccount]);

  const value = useMemo<Ctx>(() => ({
    loading,
    session,
    account,
    role: account.role,
    refresh: () => loadAccount(session),

    signIn: async (phone, password) => {
      if (!isValidPhone(phone)) return { error: 'Please enter a valid phone number.' };
      if (!password) return { error: 'Please enter your password.' };
      const { data, error } = await sb.auth.signInWithPassword({ email: phoneEmail(phone), password });
      if (error) return { error: friendlyError(error.message) };
      await loadAccount(data.session);
      return {};
    },

    signUp: async ({ firstName, lastName, phone, address, password }) => {
      const f = firstName.trim(), l = lastName.trim(), a = address.trim();
      if (!f || !l || !a || !phone.trim() || !password) return { error: 'Please fill in all fields.' };
      if (f.length > 60 || l.length > 60 || a.length > 500) return { error: 'One of the fields is too long.' };
      if (!isValidPhone(phone)) return { error: 'Please enter a valid phone number.' };
      if (password.length < MIN_PASSWORD) return { error: `Password must be at least ${MIN_PASSWORD} characters.` };
      const { data, error } = await sb.auth.signUp({
        email: phoneEmail(phone),
        password,
        options: { data: { account_type: 'customer', phone: canonicalPhone(phone), first_name: f, last_name: l, address: a } },
      });
      if (error) return { error: friendlyError(error.message) };
      // An existing phone can come back as a user with no identities and no session.
      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        return { error: 'An account with this phone number already exists.' };
      }
      if (!data.session) {
        return { error: 'Your account was created but could not be signed in automatically. Please try logging in.' };
      }
      await loadAccount(data.session);
      return {};
    },

    signOut: async () => {
      await sb.auth.signOut({ scope: 'local' });
      setAccount(GUEST);
    },

    updateProfile: async ({ firstName, lastName, address }) => {
      const uid = session?.user.id;
      if (!uid || account.role !== 'customer') return { error: 'Please log in again.' };
      const f = firstName.trim(), l = lastName.trim(), a = address.trim();
      if (!f || !l || !a) return { error: 'Please fill in all fields.' };
      const { error } = await sb.from('customers').update({ first_name: f, last_name: l, address: a }).eq('user_id', uid);
      if (error) return { error: friendlyError(error.message) };
      await loadAccount(session);
      return {};
    },

    changePassword: async (current, next) => {
      const email = session?.user.email;
      if (!email) return { error: 'Please log in again.' };
      if (next.length < MIN_PASSWORD) return { error: `New password must be at least ${MIN_PASSWORD} characters.` };
      // Confirm the current password first, so an unlocked phone can't be used to take over the account.
      const check = await sb.auth.signInWithPassword({ email, password: current });
      if (check.error) return { error: 'Your current password is not correct.' };
      const { error } = await sb.auth.updateUser({ password: next });
      if (error) return { error: friendlyError(error.message) };
      return {};
    },

    deleteAccount: async () => {
      const { error } = await sb.rpc('delete_my_account');
      if (error) return { error: friendlyError(error.message) };
      await sb.auth.signOut({ scope: 'local' });
      setAccount(GUEST);
      return {};
    },
  }), [loading, session, account, loadAccount]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const c = useContext(AuthContext);
  if (!c) throw new Error('useAuth must be used inside AuthProvider');
  return c;
}
