import React, { useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { auth, supabase } from '../lib/supabase';
import { colors, radius, spacing, fontSize } from '../theme';

type Mode = 'login' | 'signup' | 'forgot';

interface Props {
  onSuccess: (user: { id: string; email?: string }) => void;
}

export default function AuthScreen({ onSuccess }: Props) {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>('login');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState<'ok' | 'err'>('err');
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const showMsg = (m: string, t: 'ok' | 'err' = 'err') => { setMsg(m); setMsgType(t); };
  const clear = () => setMsg('');

  const handleLogin = async () => {
    if (!email.trim() || !password) { showMsg('Please enter your email and password.'); return; }
    setLoading(true); clear();
    const { data, error } = await auth.signIn(email.trim(), password);
    setLoading(false);
    if (error) { showMsg(error.message); return; }
    if (data.user) onSuccess({ id: data.user.id, email: data.user.email ?? undefined });
  };

  const handleSignup = async () => {
    if (!fullName.trim()) { showMsg('Please enter your full name.'); return; }
    if (!email.trim()) { showMsg('Please enter your email address.'); return; }
    if (password.length < 6) { showMsg('Password must be at least 6 characters.'); return; }
    setLoading(true); clear();
    const { data, error } = await auth.signUp(email.trim(), password, fullName.trim());
    setLoading(false);
    if (error) { showMsg(error.message); return; }
    if (data.user) {
      try {
        await supabase.from('profiles').upsert({
          id: data.user.id,
          email: email.trim(),
          full_name: fullName.trim(),
          credits: 20,
          role: 'both',
          rating_as_worker: 0,
          rating_as_poster: 0,
          total_ratings_worker: 0,
          total_ratings_poster: 0,
          completed_jobs_worker: 0,
          completed_jobs_poster: 0,
          verification_status: 'unverified',
          is_email_verified: false,
          is_phone_verified: false,
        }, { onConflict: 'id' });
      } catch { /* trigger handled it */ }

      if (!data.session) {
        showMsg('Account created! Check your inbox to verify your email.', 'ok');
      } else {
        onSuccess({ id: data.user.id, email: data.user.email ?? undefined });
      }
    }
  };

  const handleForgot = async () => {
    if (!email.trim()) { showMsg('Enter your email to receive a reset link.'); return; }
    setLoading(true); clear();
    const { error } = await auth.resetPassword(email.trim());
    setLoading(false);
    if (error) { showMsg(error.message); return; }
    showMsg('Reset link sent — check your email inbox.', 'ok');
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Brand */}
        <View style={styles.brand}>
          <View style={styles.logoWrap}>
            <Ionicons name="hand-left" size={28} color={colors.white} />
          </View>
          <Text style={styles.brandName}>Hando</Text>
        </View>

        <Text style={styles.headline}>Local work,{'\n'}<Text style={styles.headlineEm}>done right</Text></Text>
        <Text style={styles.sub}>Find skilled people nearby or earn money helping your neighbours.</Text>

        {/* Trust bullets */}
        <View style={styles.trust}>
          {[
            ['shield-checkmark-outline', 'Verified profiles — real ID confirmation'],
            ['star-outline', 'Transparent ratings from real jobs'],
            ['location-outline', 'Map-based matching in your area'],
            ['card-outline', 'Fair pay, agreed directly between people'],
          ].map(([icon, text]) => (
            <View key={text} style={styles.trustItem}>
              <Ionicons name={icon as never} size={16} color={colors.brand} />
              <Text style={styles.trustText}>{text}</Text>
            </View>
          ))}
        </View>

        {/* Card */}
        <View style={styles.card}>
          {mode === 'forgot' ? (
            <>
              <Text style={styles.cardTitle}>Reset password</Text>
              <Text style={styles.cardSub}>We'll send a link to your email.</Text>
              <TextInput
                style={styles.input}
                placeholder="your@email.com"
                placeholderTextColor={colors.tx3}
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />
              {!!msg && <MsgBox msg={msg} type={msgType} />}
              <Btn loading={loading} onPress={handleForgot} label="Send reset link" />
              <Pressable style={styles.backBtn} onPress={() => { setMode('login'); clear(); }}>
                <Ionicons name="chevron-back" size={16} color={colors.tx2} />
                <Text style={styles.backBtnText}>Back to sign in</Text>
              </Pressable>
            </>
          ) : (
            <>
              <View style={styles.tabs}>
                <Pressable style={[styles.tabBtn, mode === 'login' && styles.tabBtnOn]} onPress={() => { setMode('login'); clear(); }}>
                  <Text style={[styles.tabText, mode === 'login' && styles.tabTextOn]}>Sign in</Text>
                </Pressable>
                <Pressable style={[styles.tabBtn, mode === 'signup' && styles.tabBtnOn]} onPress={() => { setMode('signup'); clear(); }}>
                  <Text style={[styles.tabText, mode === 'signup' && styles.tabTextOn]}>Register</Text>
                </Pressable>
              </View>

              {mode === 'signup' && (
                <TextInput
                  style={styles.input}
                  placeholder="Full name"
                  placeholderTextColor={colors.tx3}
                  value={fullName}
                  onChangeText={setFullName}
                  autoCapitalize="words"
                />
              )}
              <TextInput
                style={styles.input}
                placeholder="Email address"
                placeholderTextColor={colors.tx3}
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />
              <View style={styles.pwWrap}>
                <TextInput
                  style={[styles.input, { flex: 1, marginBottom: 0 }]}
                  placeholder={mode === 'signup' ? 'Minimum 6 characters' : '••••••••'}
                  placeholderTextColor={colors.tx3}
                  secureTextEntry={!showPw}
                  value={password}
                  onChangeText={setPassword}
                  onSubmitEditing={mode === 'login' ? handleLogin : handleSignup}
                />
                <Pressable onPress={() => setShowPw(v => !v)} style={styles.eyeBtn}>
                  <Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.tx2} />
                </Pressable>
              </View>

              {mode === 'login' && (
                <Pressable onPress={() => { setMode('forgot'); clear(); }}>
                  <Text style={styles.forgot}>Forgot password?</Text>
                </Pressable>
              )}

              {mode === 'signup' && (
                <View style={styles.infoBox}>
                  <Ionicons name="information-circle-outline" size={16} color={colors.brand} />
                  <Text style={styles.infoText}>After registering you'll receive a <Text style={{ fontWeight: '700' }}>verification email</Text>. Click the link before signing in.</Text>
                </View>
              )}

              {!!msg && <MsgBox msg={msg} type={msgType} />}

              <Btn
                loading={loading}
                onPress={mode === 'login' ? handleLogin : handleSignup}
                label={loading
                  ? (mode === 'login' ? 'Signing in...' : 'Creating account...')
                  : (mode === 'login' ? 'Sign in' : 'Create account')}
              />

              {mode === 'signup' && (
                <Text style={styles.terms}>By registering you agree to our Terms of Service and Privacy Policy.</Text>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Btn({ loading, onPress, label }: { loading: boolean; onPress: () => void; label: string }) {
  return (
    <Pressable style={({ pressed }) => [styles.primaryBtn, pressed && styles.primaryBtnPressed]} onPress={onPress} disabled={loading}>
      {loading
        ? <ActivityIndicator color={colors.white} size="small" />
        : <Text style={styles.primaryBtnText}>{label}</Text>
      }
    </Pressable>
  );
}

function MsgBox({ msg, type }: { msg: string; type: 'ok' | 'err' }) {
  return (
    <View style={[styles.msgBox, { backgroundColor: type === 'ok' ? colors.okSoft : colors.errSoft, borderColor: type === 'ok' ? colors.ok : colors.err }]}>
      <Text style={[styles.msgText, { color: type === 'ok' ? colors.ok : colors.err }]}>{msg}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: spacing[5] },
  brand: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], marginBottom: spacing[6] },
  logoWrap: { width: 44, height: 44, borderRadius: radius.sm, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
  brandName: { fontSize: 22, fontWeight: '800', color: colors.tx, letterSpacing: -0.5 },
  headline: { fontSize: 30, fontWeight: '800', color: colors.tx, lineHeight: 36, marginBottom: spacing[3] },
  headlineEm: { color: colors.brand, fontStyle: 'italic' },
  sub: { fontSize: fontSize.base, color: colors.tx2, lineHeight: 22, marginBottom: spacing[5] },
  trust: { gap: spacing[3], marginBottom: spacing[6] },
  trustItem: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  trustText: { fontSize: fontSize.sm, color: colors.tx2, flex: 1 },
  card: { backgroundColor: colors.bgEl, borderRadius: radius.xl, padding: spacing[5], borderWidth: 1, borderColor: colors.border },
  tabs: { flexDirection: 'row', backgroundColor: colors.bgSub, borderRadius: radius.md, padding: 4, marginBottom: spacing[5] },
  tabBtn: { flex: 1, paddingVertical: spacing[2], borderRadius: radius.sm, alignItems: 'center' },
  tabBtnOn: { backgroundColor: colors.white, shadowColor: colors.brand, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  tabText: { fontSize: fontSize.sm, fontWeight: '600', color: colors.tx2 },
  tabTextOn: { color: colors.brand },
  cardTitle: { fontSize: 19, fontWeight: '800', color: colors.tx, marginBottom: 4 },
  cardSub: { fontSize: fontSize.base, color: colors.tx2, marginBottom: spacing[5] },
  input: {
    backgroundColor: colors.bg,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    fontSize: fontSize.base,
    color: colors.tx,
    marginBottom: spacing[3],
  },
  pwWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginBottom: spacing[3] },
  eyeBtn: { padding: spacing[3] },
  forgot: { fontSize: fontSize.sm, color: colors.brand, fontWeight: '600', marginBottom: spacing[4] },
  infoBox: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2], backgroundColor: colors.brandSoft, borderRadius: radius.sm, padding: spacing[3], marginBottom: spacing[3] },
  infoText: { fontSize: fontSize.sm, color: colors.brand, flex: 1, lineHeight: 18 },
  msgBox: { borderWidth: 1.5, borderRadius: radius.sm, padding: spacing[3], marginBottom: spacing[3] },
  msgText: { fontSize: fontSize.sm, fontWeight: '500' },
  primaryBtn: { backgroundColor: colors.brand, borderRadius: radius.md, paddingVertical: spacing[4], alignItems: 'center', marginTop: 4 },
  primaryBtnPressed: { backgroundColor: colors.brandHover },
  primaryBtnText: { color: colors.white, fontSize: fontSize.base, fontWeight: '700' },
  backBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: spacing[3] },
  backBtnText: { fontSize: fontSize.sm, color: colors.tx2, fontWeight: '600' },
  terms: { fontSize: 11, color: colors.tx3, textAlign: 'center', marginTop: spacing[4], lineHeight: 16 },
});
