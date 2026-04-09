import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, FlatList,
  ActivityIndicator, Share,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '../context/AppContext';
import { useLanguage } from '../i18n';
import { credits } from '../lib/supabase';
import { colors, radius, spacing, fontSize, shadow } from '../theme';
import type { CreditPackage, CreditTransaction } from '../types';

const BANK = {
  name: 'Hando d.o.o.',
  bank: 'Banca Intesa',
  account: '160-0000000123456-12',
  swift: 'DBDBRSBG',
};

type Step = 'packages' | 'payment';

interface CreditOrder {
  id: string;
  user_id: string;
  package_id: string;
  credits: number;
  amount_rsd: number;
  reference: string;
  status: string;
  created_at: string;
}

async function copyToClipboard(text: string, toast: (m: string, t?: 'success' | 'error' | 'info') => void) {
  try {
    await Share.share({ message: text });
  } catch {
    toast('Could not copy', 'error');
  }
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { color: string; bg: string }> = {
    pending:  { color: colors.warn,  bg: colors.warnSoft  },
    approved: { color: colors.ok,    bg: colors.okSoft    },
    rejected: { color: colors.err,   bg: colors.errSoft   },
  };
  const s = map[status] ?? map.pending;
  return (
    <View style={[styles.badge, { backgroundColor: s.bg }]}>
      <Text style={[styles.badgeTxt, { color: s.color }]}>{status}</Text>
    </View>
  );
}

export default function CreditsScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const { user, creditBalance, toast, refreshCredits } = useAppContext();

  const [step, setStep] = useState<Step>('packages');
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [selectedPkg, setSelectedPkg] = useState<CreditPackage | null>(null);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [orders, setOrders] = useState<CreditOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [currentRef, setCurrentRef] = useState('');

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [pkgs, txs, ords] = await Promise.all([
      credits.getPackages(),
      credits.getTransactions(user.id),
      credits.getOrders(user.id),
    ]);
    if (pkgs.data) setPackages(pkgs.data);
    if (txs.data) setTransactions(txs.data);
    if (ords.data) setOrders(ords.data as CreditOrder[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadData();
    refreshCredits();
  }, [loadData]);

  const handleSelectPackage = (pkg: CreditPackage) => {
    setSelectedPkg(pkg);
    setStep('payment');
  };

  const handleInitiateTransfer = async () => {
    if (!user || !selectedPkg) return;
    setSubmitting(true);
    const { data, error } = await credits.createOrder(
      user.id,
      selectedPkg.id,
      selectedPkg.credits,
      selectedPkg.price_rsd,
      user.email ?? '',
    );
    setSubmitting(false);
    if (error || !data) { toast(error ?? 'Error creating order', 'error'); return; }
    setCurrentRef(data.reference);
    toast(t('orderSubmitted'), 'success');
    await loadData();
  };

  const pendingOrders = orders.filter(o => o.status === 'pending');

  const renderTransaction = ({ item }: { item: CreditTransaction }) => {
    const isPositive = item.amount > 0;
    const typeLabels: Record<string, string> = {
      purchase: 'Credit purchase',
      post_job: 'Posted job',
      apply_job: 'Applied to job',
      refund: 'Refund',
      bonus: 'Bonus credits',
    };
    return (
      <View style={styles.txRow}>
        <View style={[styles.txIcon, { backgroundColor: isPositive ? colors.okSoft : colors.errSoft }]}>
          <Ionicons
            name={isPositive ? 'arrow-down-outline' : 'arrow-up-outline'}
            size={16}
            color={isPositive ? colors.ok : colors.err}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.txDesc}>{item.description || typeLabels[item.type] || item.type}</Text>
          <Text style={styles.txDate}>
            {new Date(item.created_at).toLocaleDateString('sr-RS', { day: '2-digit', month: 'short', year: 'numeric' })}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[styles.txAmount, { color: isPositive ? colors.ok : colors.err }]}>
            {isPositive ? '+' : ''}{item.amount}
          </Text>
          <Text style={styles.txBalance}>bal: {item.balance_after}</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        {step === 'payment' && (
          <Pressable onPress={() => setStep('packages')} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={colors.tx} />
          </Pressable>
        )}
        <Text style={styles.headerTitle}>{t('creditsAndBilling')}</Text>
        {step === 'payment' && <View style={{ width: 32 }} />}
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Balance card */}
        <View style={styles.balanceCard}>
          <Ionicons name="wallet-outline" size={28} color={colors.brand} />
          <Text style={styles.balanceLabel}>{t('yourBalance')}</Text>
          <Text style={styles.balanceValue}>{creditBalance}</Text>
          <Text style={styles.balanceSub}>{t('creditsAvailable')}</Text>
          <Text style={styles.balanceDesc}>{t('creditSubtitle')}</Text>
        </View>

        {step === 'packages' && (
          <>
            {/* Pending orders */}
            {pendingOrders.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t('pendingOrders')}</Text>
                {pendingOrders.map(order => (
                  <View key={order.id} style={styles.orderCard}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.orderCredits}>{order.credits} credits</Text>
                      <Text style={styles.orderRef}>Ref: {order.reference}</Text>
                      <Text style={styles.orderAmount}>{order.amount_rsd.toLocaleString()} RSD</Text>
                    </View>
                    <StatusBadge status={order.status} />
                  </View>
                ))}
              </View>
            )}

            {/* How it works */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('howItWorks')}</Text>
              <View style={styles.howCard}>
                {[
                  t('howItWorks1'),
                  t('howItWorks2'),
                  t('howItWorks3'),
                  t('howItWorks4'),
                  t('howItWorks5'),
                ].map((step, i) => (
                  <View key={i} style={styles.howStep}>
                    <View style={styles.howNum}>
                      <Text style={styles.howNumTxt}>{i + 1}</Text>
                    </View>
                    <Text style={styles.howStepTxt}>{step}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Packages */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('choosePackage')}</Text>
              {loading
                ? <ActivityIndicator color={colors.brand} />
                : packages.map((pkg, i) => {
                    const isPopular = i === Math.floor(packages.length / 2);
                    const pricePerCredit = pkg.credits > 0 ? (pkg.price_rsd / pkg.credits).toFixed(1) : '-';
                    return (
                      <Pressable
                        key={pkg.id}
                        style={[styles.pkgCard, selectedPkg?.id === pkg.id && styles.pkgCardSelected]}
                        onPress={() => handleSelectPackage(pkg)}
                      >
                        {isPopular && (
                          <View style={styles.popularBadge}>
                            <Text style={styles.popularTxt}>{t('popular')}</Text>
                          </View>
                        )}
                        <View style={styles.pkgTop}>
                          <Text style={styles.pkgCredits}>{pkg.credits} <Text style={styles.pkgCreditsUnit}>credits</Text></Text>
                          <Text style={styles.pkgPrice}>{pkg.price_rsd.toLocaleString()} RSD</Text>
                        </View>
                        <Text style={styles.pkgPer}>{pricePerCredit} {t('perCredit')}</Text>
                        <View style={[styles.selectPill, selectedPkg?.id === pkg.id && styles.selectPillActive]}>
                          <Text style={[styles.selectPillTxt, selectedPkg?.id === pkg.id && { color: colors.white }]}>
                            {selectedPkg?.id === pkg.id ? t('selectedLabel') : t('selectLabel')}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })
              }
            </View>

            {/* Transaction history */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('transactionHistory')}</Text>
              {transactions.length === 0
                ? <Text style={styles.emptyTxt}>{t('noTransactions')}</Text>
                : transactions.map(tx => renderTransaction({ item: tx }))
              }
            </View>
          </>
        )}

        {step === 'payment' && selectedPkg && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('paymentInstructions')}</Text>

            <View style={styles.payCard}>
              <Text style={styles.payDesc}>
                {t('transferDesc')
                  .replace('{amount}', selectedPkg.price_rsd.toLocaleString())}
              </Text>

              <View style={styles.bankTable}>
                <BankRow label={t('bankLabel')} value={BANK.bank} onCopy={() => copyToClipboard(BANK.bank, toast)} />
                <BankRow label="Name" value={BANK.name} onCopy={() => copyToClipboard(BANK.name, toast)} />
                <BankRow label={t('accountLabel')} value={BANK.account} onCopy={() => copyToClipboard(BANK.account, toast)} />
                <BankRow label={t('swiftLabel')} value={BANK.swift} onCopy={() => copyToClipboard(BANK.swift, toast)} />
                <BankRow label={t('paymentReference')} value={currentRef || 'Will be generated below'} onCopy={currentRef ? () => copyToClipboard(currentRef, toast) : undefined} bold />
              </View>

              <Text style={styles.amountBox}>{selectedPkg.price_rsd.toLocaleString()} RSD → {selectedPkg.credits} credits</Text>

              {!currentRef && (
                <Pressable
                  style={[styles.primaryBtn, submitting && { opacity: 0.6 }]}
                  onPress={handleInitiateTransfer}
                  disabled={submitting}
                >
                  {submitting
                    ? <ActivityIndicator color={colors.white} size="small" />
                    : <Text style={styles.primaryBtnTxt}>{t('confirmTransfer')}</Text>
                  }
                </Pressable>
              )}

              {!!currentRef && (
                <View style={styles.confirmedBox}>
                  <Ionicons name="checkmark-circle" size={24} color={colors.ok} />
                  <Text style={styles.confirmedTxt}>Transfer initiated! Your reference number is:</Text>
                  <Pressable onPress={() => copyToClipboard(currentRef, toast)}>
                    <Text style={styles.confirmedRef}>{currentRef}</Text>
                  </Pressable>
                  <Text style={styles.confirmedNote}>Credits will be added within 1-24 business hours.</Text>
                </View>
              )}
            </View>
          </View>
        )}

        <View style={{ height: spacing[8] }} />
      </ScrollView>
    </View>
  );
}

function BankRow({ label, value, onCopy, bold }: { label: string; value: string; onCopy?: () => void; bold?: boolean }) {
  return (
    <View style={styles.bankRow}>
      <Text style={styles.bankLabel}>{label}</Text>
      <Text style={[styles.bankValue, bold && { color: colors.brand, fontWeight: '800' }]} selectable>{value}</Text>
      {onCopy && (
        <Pressable onPress={onCopy} style={styles.copyBtn}>
          <Ionicons name="copy-outline" size={14} color={colors.brand} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    backgroundColor: colors.white,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  backBtn: { padding: 4 },
  headerTitle: { flex: 1, fontSize: fontSize.xl, fontWeight: '800', color: colors.tx },
  content: { padding: spacing[4], gap: spacing[4] },
  balanceCard: {
    backgroundColor: colors.brand,
    borderRadius: radius.xl,
    padding: spacing[6],
    alignItems: 'center',
    gap: spacing[2],
    ...shadow.lg,
  },
  balanceLabel: { fontSize: fontSize.sm, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
  balanceValue: { fontSize: 56, fontWeight: '900', color: colors.white, lineHeight: 64 },
  balanceSub: { fontSize: fontSize.base, color: 'rgba(255,255,255,0.8)', fontWeight: '600' },
  balanceDesc: { fontSize: fontSize.sm, color: 'rgba(255,255,255,0.6)', textAlign: 'center', lineHeight: 18 },
  section: { gap: spacing[3] },
  sectionTitle: { fontSize: fontSize.base, fontWeight: '800', color: colors.tx },
  orderCard: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing[4],
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing[3],
  },
  orderCredits: { fontSize: fontSize.base, fontWeight: '800', color: colors.tx },
  orderRef: { fontSize: fontSize.xs, color: colors.tx3, fontFamily: 'monospace' },
  orderAmount: { fontSize: fontSize.sm, color: colors.brand, fontWeight: '600' },
  badge: { borderRadius: radius.full, paddingHorizontal: spacing[3], paddingVertical: 4 },
  badgeTxt: { fontSize: fontSize.xs, fontWeight: '700' },
  howCard: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing[4],
    gap: spacing[3],
    borderWidth: 1,
    borderColor: colors.border,
  },
  howStep: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3] },
  howNum: {
    width: 24, height: 24,
    borderRadius: radius.full,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  howNumTxt: { color: colors.white, fontSize: fontSize.xs, fontWeight: '800' },
  howStepTxt: { flex: 1, fontSize: fontSize.sm, color: colors.tx, lineHeight: 20 },
  pkgCard: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing[4],
    borderWidth: 2,
    borderColor: colors.border,
    gap: spacing[2],
    ...shadow.sm,
  },
  pkgCardSelected: { borderColor: colors.brand, backgroundColor: colors.brandSoft },
  popularBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.warn,
    borderRadius: radius.full,
    paddingHorizontal: spacing[3],
    paddingVertical: 3,
    marginBottom: spacing[1],
  },
  popularTxt: { color: colors.white, fontSize: fontSize.xs, fontWeight: '800' },
  pkgTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pkgCredits: { fontSize: fontSize.xl, fontWeight: '800', color: colors.tx },
  pkgCreditsUnit: { fontSize: fontSize.base, fontWeight: '500', color: colors.tx2 },
  pkgPrice: { fontSize: fontSize.lg, fontWeight: '800', color: colors.brand },
  pkgPer: { fontSize: fontSize.xs, color: colors.tx3 },
  selectPill: {
    alignSelf: 'flex-start',
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.brand,
    paddingHorizontal: spacing[4],
    paddingVertical: 5,
    marginTop: spacing[1],
  },
  selectPillActive: { backgroundColor: colors.brand },
  selectPillTxt: { fontSize: fontSize.sm, fontWeight: '700', color: colors.brand },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing[3],
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing[2],
  },
  txIcon: { width: 36, height: 36, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  txDesc: { fontSize: fontSize.sm, fontWeight: '600', color: colors.tx },
  txDate: { fontSize: fontSize.xs, color: colors.tx3 },
  txAmount: { fontSize: fontSize.base, fontWeight: '800' },
  txBalance: { fontSize: fontSize.xs, color: colors.tx3 },
  emptyTxt: { color: colors.tx2, textAlign: 'center', padding: spacing[4] },
  payCard: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing[4],
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing[4],
  },
  payDesc: { fontSize: fontSize.sm, color: colors.tx2, lineHeight: 20 },
  bankTable: { gap: spacing[2] },
  bankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing[2],
  },
  bankLabel: { width: 70, fontSize: fontSize.xs, fontWeight: '600', color: colors.tx2, textTransform: 'uppercase' },
  bankValue: { flex: 1, fontSize: fontSize.sm, color: colors.tx },
  copyBtn: { padding: 4 },
  amountBox: {
    backgroundColor: colors.brandSoft,
    borderRadius: radius.md,
    padding: spacing[3],
    textAlign: 'center',
    fontSize: fontSize.md,
    fontWeight: '800',
    color: colors.brand,
  },
  primaryBtn: {
    backgroundColor: colors.brand,
    borderRadius: radius.md,
    paddingVertical: spacing[4],
    alignItems: 'center',
  },
  primaryBtnTxt: { color: colors.white, fontSize: fontSize.base, fontWeight: '800' },
  confirmedBox: {
    backgroundColor: colors.okSoft,
    borderRadius: radius.md,
    padding: spacing[4],
    alignItems: 'center',
    gap: spacing[2],
  },
  confirmedTxt: { fontSize: fontSize.sm, color: colors.ok, textAlign: 'center' },
  confirmedRef: { fontSize: fontSize.md, fontWeight: '800', color: colors.ok, letterSpacing: 1 },
  confirmedNote: { fontSize: fontSize.xs, color: colors.ok, textAlign: 'center' },
});
