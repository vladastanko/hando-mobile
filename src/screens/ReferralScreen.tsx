import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Share, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '../context/AppContext';
import { useLanguage } from '../i18n';
import { referrals } from '../lib/supabase';
import { colors, radius, spacing, fontSize, shadow } from '../theme';
import { Avatar } from '../components/ui/Avatar';
import type { Referral } from '../types';

export default function ReferralScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const { user, profile, toast } = useAppContext();
  const [list, setList] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    referrals.get(user.id).then(({ data }) => {
      if (data) setList(data as Referral[]);
      setLoading(false);
    });
  }, [user]);

  const referralLink = profile?.referral_code
    ? `https://hando.app/join?ref=${profile.referral_code}`
    : '';

  const completedCount = list.filter(r => r.status === 'completed').length;
  const creditsEarned = completedCount * 20;

  const copyLink = async () => {
    if (!referralLink) return;
    try {
      await Share.share({ message: referralLink });
    } catch {
      toast('Could not share link', 'error');
    }
  };

  const copyCode = async () => {
    if (!profile?.referral_code) return;
    try {
      await Share.share({ message: profile.referral_code });
    } catch {
      toast('Could not copy code', 'error');
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('referFriend')}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Hero card */}
        <View style={styles.heroCard}>
          <Ionicons name="people" size={36} color={colors.white} />
          <Text style={styles.heroTitle}>Invite friends, earn credits!</Text>
          <Text style={styles.heroSub}>
            Earn <Text style={styles.heroEm}>20 credits</Text> for every friend who joins and completes their first job.
          </Text>
          <View style={styles.heroStats}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatVal}>{list.length}</Text>
              <Text style={styles.heroStatLabel}>Friends joined</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatVal}>{creditsEarned}</Text>
              <Text style={styles.heroStatLabel}>Credits earned</Text>
            </View>
          </View>
        </View>

        {/* Referral code */}
        {profile?.referral_code && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your referral code</Text>
            <View style={styles.codeBox}>
              <Text style={styles.code}>{profile.referral_code}</Text>
              <Pressable style={styles.copyBtn} onPress={copyCode}>
                <Ionicons name="copy-outline" size={18} color={colors.brand} />
                <Text style={styles.copyBtnTxt}>{t('copy')}</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Referral link */}
        {!!referralLink && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Share your link</Text>
            <View style={styles.linkBox}>
              <Text style={styles.linkTxt} numberOfLines={1}>{referralLink}</Text>
            </View>
            <Pressable style={styles.shareLinkBtn} onPress={copyLink}>
              <Ionicons name="share-outline" size={18} color={colors.white} />
              <Text style={styles.shareLinkBtnTxt}>Copy Link</Text>
            </Pressable>
          </View>
        )}

        {/* How it works */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('howItWorks')}</Text>
          <View style={styles.howCard}>
            {[
              { icon: 'share-social-outline', text: 'Share your unique referral link with friends' },
              { icon: 'person-add-outline', text: 'Your friend signs up using your link or code' },
              { icon: 'briefcase-outline', text: 'They complete their first job on Hando' },
              { icon: 'wallet-outline', text: 'You receive 20 bonus credits automatically!' },
            ].map((step, i) => (
              <View key={i} style={styles.howStep}>
                <View style={styles.howIconWrap}>
                  <Ionicons name={step.icon as never} size={20} color={colors.brand} />
                </View>
                <Text style={styles.howStepTxt}>{step.text}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Referrals list */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your referrals ({list.length})</Text>
          {loading ? (
            <ActivityIndicator color={colors.brand} />
          ) : list.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Ionicons name="people-outline" size={36} color={colors.tx3} />
              <Text style={styles.emptyTxt}>No referrals yet. Share your link to get started!</Text>
            </View>
          ) : (
            list.map(ref => (
              <View key={ref.id} style={styles.refCard}>
                <Avatar url={ref.referred_user?.avatar_url} name={ref.referred_user?.full_name} size={40} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.refName}>{ref.referred_user?.full_name ?? 'Anonymous'}</Text>
                  <Text style={styles.refDate}>
                    Joined {new Date(ref.created_at).toLocaleDateString('sr-RS', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </Text>
                </View>
                <View style={[
                  styles.refBadge,
                  { backgroundColor: ref.status === 'completed' ? colors.okSoft : colors.warnSoft }
                ]}>
                  <Text style={[
                    styles.refBadgeTxt,
                    { color: ref.status === 'completed' ? colors.ok : colors.warn }
                  ]}>
                    {ref.status === 'completed' ? '+20 credits' : 'Pending'}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>

        <View style={{ height: spacing[8] }} />
      </ScrollView>
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
  },
  headerTitle: { fontSize: fontSize.xl, fontWeight: '800', color: colors.tx },
  content: { padding: spacing[4], gap: spacing[5] },
  heroCard: {
    backgroundColor: colors.brand,
    borderRadius: radius.xl,
    padding: spacing[6],
    alignItems: 'center',
    gap: spacing[3],
    ...shadow.lg,
  },
  heroTitle: { fontSize: fontSize.xl, fontWeight: '800', color: colors.white, textAlign: 'center' },
  heroSub: { fontSize: fontSize.base, color: 'rgba(255,255,255,0.8)', textAlign: 'center', lineHeight: 22 },
  heroEm: { fontWeight: '800', color: colors.white },
  heroStats: { flexDirection: 'row', marginTop: spacing[2] },
  heroStat: { flex: 1, alignItems: 'center', gap: 4 },
  heroStatVal: { fontSize: fontSize.xl, fontWeight: '900', color: colors.white },
  heroStatLabel: { fontSize: fontSize.xs, color: 'rgba(255,255,255,0.7)', fontWeight: '500' },
  heroStatDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginHorizontal: spacing[4] },
  section: { gap: spacing[3] },
  sectionTitle: { fontSize: fontSize.base, fontWeight: '800', color: colors.tx },
  codeBox: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing[4],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 2,
    borderColor: colors.brand,
    ...shadow.sm,
  },
  code: { fontSize: fontSize.xl, fontWeight: '900', color: colors.brand, letterSpacing: 3 },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    backgroundColor: colors.brandSoft,
    borderRadius: radius.sm,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  copyBtnTxt: { fontSize: fontSize.sm, fontWeight: '700', color: colors.brand },
  linkBox: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing[3],
    borderWidth: 1,
    borderColor: colors.border,
  },
  linkTxt: { fontSize: fontSize.sm, color: colors.tx2, fontFamily: 'monospace' },
  shareLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    backgroundColor: colors.brand,
    borderRadius: radius.md,
    paddingVertical: spacing[3],
  },
  shareLinkBtnTxt: { color: colors.white, fontSize: fontSize.base, fontWeight: '700' },
  howCard: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing[4],
    gap: spacing[4],
    borderWidth: 1,
    borderColor: colors.border,
  },
  howStep: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3] },
  howIconWrap: {
    width: 40, height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  howStepTxt: { flex: 1, fontSize: fontSize.sm, color: colors.tx, lineHeight: 20, paddingTop: 10 },
  emptyWrap: { alignItems: 'center', padding: spacing[6], gap: spacing[3] },
  emptyTxt: { fontSize: fontSize.sm, color: colors.tx2, textAlign: 'center' },
  refCard: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing[3],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.sm,
  },
  refName: { fontSize: fontSize.base, fontWeight: '700', color: colors.tx },
  refDate: { fontSize: fontSize.xs, color: colors.tx3 },
  refBadge: { borderRadius: radius.full, paddingHorizontal: spacing[3], paddingVertical: 4 },
  refBadgeTxt: { fontSize: fontSize.xs, fontWeight: '700' },
});
