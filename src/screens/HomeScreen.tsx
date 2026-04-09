import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, Pressable,
  ScrollView, RefreshControl, ActivityIndicator, Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useAppContext } from '../context/AppContext';
import { useLanguage } from '../i18n';
import { jobs, profiles } from '../lib/supabase';
import { colors, radius, spacing, fontSize, shadow } from '../theme';
import { Avatar } from '../components/ui/Avatar';
import { Stars } from '../components/ui/Stars';
import JobDetailModal from './JobDetailModal';
import PostJobScreen from './PostJobScreen';
import type { Job, Category } from '../types';

function formatDate(dateStr: string) {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('sr-RS', { day: '2-digit', month: 'short' });
  } catch {
    return dateStr;
  }
}

function StatusBadge({ spots }: { spots: number }) {
  const bg = spots > 0 ? colors.okSoft : colors.errSoft;
  const tx = spots > 0 ? colors.ok : colors.err;
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color: tx }]}>
        {spots > 0 ? `${spots} spots left` : 'Full'}
      </Text>
    </View>
  );
}

function JobCard({ job, onPress }: { job: Job; onPress: () => void }) {
  const catColor = job.category?.color ?? colors.brand;
  const spotsLeft = job.spots_remaining ?? (job.crew_size - (job.accepted_workers ?? 0));

  return (
    <Pressable style={[styles.card, { borderLeftColor: catColor, borderLeftWidth: 4 }]} onPress={onPress}>
      <View style={styles.cardTop}>
        <View style={styles.cardMeta}>
          {job.category && (
            <Text style={[styles.catTag, { color: catColor }]}>{job.category.icon} {job.category.name}</Text>
          )}
          <StatusBadge spots={spotsLeft} />
        </View>
        <Text style={styles.cardTitle} numberOfLines={2}>{job.title}</Text>
        <View style={styles.cardRow}>
          <Ionicons name="location-outline" size={14} color={colors.tx3} />
          <Text style={styles.cardRowTxt}>{job.city}</Text>
          {job.distance_km != null && (
            <Text style={styles.distTxt}> · {job.distance_km.toFixed(1)} km</Text>
          )}
        </View>
        <View style={styles.cardRow}>
          <Ionicons name="calendar-outline" size={14} color={colors.tx3} />
          <Text style={styles.cardRowTxt}>{formatDate(job.scheduled_date)}</Text>
          <Text style={styles.cardRowTxt}> · {job.duration_hours}h</Text>
        </View>
      </View>
      <View style={styles.cardBottom}>
        <View style={styles.posterRow}>
          <Avatar url={job.poster?.avatar_url} name={job.poster?.full_name} size={28} />
          <Text style={styles.posterName} numberOfLines={1}>{job.poster?.full_name ?? 'Unknown'}</Text>
          {(job.poster?.rating_as_poster ?? 0) > 0 && (
            <Stars value={job.poster?.rating_as_poster ?? 0} size={12} />
          )}
        </View>
        <Text style={styles.pay}>{job.pay_per_worker.toLocaleString()} RSD</Text>
      </View>
    </Pressable>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const { user, profile, creditBalance, refreshProfile } = useAppContext();

  const [mode, setMode] = useState<'find' | 'post'>('find');
  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [jobList, setJobList] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [showPostJob, setShowPostJob] = useState(false);

  const loadCategories = useCallback(async () => {
    const { data } = await jobs.getCategories();
    if (data) setCategories(data);
  }, []);

  const loadJobs = useCallback(async () => {
    setLoading(true);
    let result;
    if (userLoc) {
      result = await jobs.getNearby(userLoc.lat, userLoc.lng, 50);
    } else {
      result = await jobs.getAll({ status: 'open' });
    }
    if (result.data) {
      setJobList(result.data);
    }
    setLoading(false);
  }, [userLoc]);

  const requestLocation = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const coords = { lat: loc.coords.latitude, lng: loc.coords.longitude };
        setUserLoc(coords);
        if (user) {
          profiles.updateLocation(user.id, coords.lat, coords.lng).catch(() => {});
        }
      }
    } catch {}
  }, [user]);

  useEffect(() => {
    loadCategories();
    requestLocation();
  }, []);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadJobs();
    await refreshProfile();
    setRefreshing(false);
  }, [loadJobs, refreshProfile]);

  const filteredJobs = jobList.filter(j => {
    const matchSearch = !search || j.title.toLowerCase().includes(search.toLowerCase()) || j.city.toLowerCase().includes(search.toLowerCase());
    const matchCat = !selectedCat || j.category_id === selectedCat;
    return matchSearch && matchCat;
  });

  const nearbyCount = userLoc
    ? jobList.filter(j => (j.distance_km ?? 999) < 10).length
    : jobList.length;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <View style={styles.logoBox}>
            <Ionicons name="hand-left" size={18} color={colors.white} />
          </View>
          <Text style={styles.brandName}>Hando</Text>
        </View>
        <View style={styles.modeToggle}>
          <Pressable
            style={[styles.modePill, mode === 'find' && styles.modePillActive]}
            onPress={() => setMode('find')}
          >
            <Text style={[styles.modePillTxt, mode === 'find' && styles.modePillTxtActive]}>
              {t('findWork')}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.modePill, mode === 'post' && styles.modePillActive]}
            onPress={() => { setMode('post'); setShowPostJob(true); }}
          >
            <Text style={[styles.modePillTxt, mode === 'post' && styles.modePillTxtActive]}>
              {t('postWork')}
            </Text>
          </Pressable>
        </View>
      </View>

      <FlatList
        data={filteredJobs}
        keyExtractor={j => j.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
        ListHeaderComponent={
          <>
            {/* Stats row */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statsRow} contentContainerStyle={styles.statsRowContent}>
              <StatCard label={t('statJobsDone')} value={String(profile?.completed_jobs_worker ?? 0)} icon="checkmark-circle-outline" />
              <StatCard label={t('statRating')} value={(profile?.rating_as_worker ?? 0).toFixed(1)} icon="star-outline" />
              <StatCard label={t('statCredits')} value={String(creditBalance)} icon="wallet-outline" />
              <StatCard label={t('statNearby')} value={String(nearbyCount)} icon="location-outline" />
            </ScrollView>

            {/* Search */}
            <View style={styles.searchWrap}>
              <Ionicons name="search-outline" size={18} color={colors.tx3} style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder={t('searchPlaceholder')}
                placeholderTextColor={colors.tx3}
                value={search}
                onChangeText={setSearch}
              />
              {!userLoc && (
                <Pressable onPress={requestLocation} style={styles.locBtn}>
                  <Ionicons name="locate-outline" size={18} color={colors.brand} />
                </Pressable>
              )}
            </View>

            {/* Categories */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll} contentContainerStyle={styles.catContent}>
              <Pressable
                style={[styles.catPill, !selectedCat && styles.catPillActive]}
                onPress={() => setSelectedCat(null)}
              >
                <Text style={[styles.catPillTxt, !selectedCat && styles.catPillTxtActive]}>{t('allCategories')}</Text>
              </Pressable>
              {categories.map(cat => (
                <Pressable
                  key={cat.id}
                  style={[styles.catPill, selectedCat === cat.id && styles.catPillActive]}
                  onPress={() => setSelectedCat(selectedCat === cat.id ? null : cat.id)}
                >
                  <Text style={[styles.catPillTxt, selectedCat === cat.id && styles.catPillTxtActive]}>
                    {cat.icon} {cat.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            {/* Count bar */}
            <View style={styles.countBar}>
              <Text style={styles.countTxt}>
                {filteredJobs.length} {userLoc ? t('nearYou') : 'jobs'}
              </Text>
              {!userLoc && (
                <Pressable onPress={requestLocation}>
                  <Text style={styles.enableLocTxt}>{t('enableLocation')}</Text>
                </Pressable>
              )}
            </View>
          </>
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.emptyWrap}>
              <ActivityIndicator color={colors.brand} size="large" />
            </View>
          ) : (
            <View style={styles.emptyWrap}>
              <Ionicons name="briefcase-outline" size={48} color={colors.tx3} />
              <Text style={styles.emptyTitle}>{t('noJobsFound')}</Text>
              <Text style={styles.emptySub}>{search || selectedCat ? t('tryFilters') : t('tryLater')}</Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <JobCard job={item} onPress={() => setSelectedJob(item)} />
        )}
      />

      {/* FAB */}
      <Pressable
        style={[styles.fab, { bottom: insets.bottom + 80 }]}
        onPress={() => setShowPostJob(true)}
      >
        <Ionicons name="add" size={28} color={colors.white} />
      </Pressable>

      {/* Job detail modal */}
      {selectedJob && (
        <JobDetailModal
          job={selectedJob}
          visible={!!selectedJob}
          onClose={() => setSelectedJob(null)}
          onApplied={() => {
            setSelectedJob(null);
            loadJobs();
          }}
        />
      )}

      {/* Post job modal */}
      <Modal visible={showPostJob} animationType="slide" presentationStyle="pageSheet">
        <PostJobScreen
          onClose={() => { setShowPostJob(false); setMode('find'); }}
          onPosted={() => { setShowPostJob(false); setMode('find'); loadJobs(); }}
        />
      </Modal>
    </View>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <View style={styles.statCard}>
      <Ionicons name={icon as never} size={20} color={colors.brand} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
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
    justifyContent: 'space-between',
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  logoBox: {
    width: 32, height: 32, borderRadius: radius.xs,
    backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center',
  },
  brandName: { fontSize: 18, fontWeight: '800', color: colors.tx },
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: colors.bgSub,
    borderRadius: radius.full,
    padding: 3,
    gap: 2,
  },
  modePill: { paddingHorizontal: spacing[3], paddingVertical: 5, borderRadius: radius.full },
  modePillActive: { backgroundColor: colors.brand },
  modePillTxt: { fontSize: fontSize.xs, fontWeight: '600', color: colors.tx2 },
  modePillTxtActive: { color: colors.white },
  listContent: { paddingBottom: spacing[10] },
  statsRow: { marginBottom: spacing[4] },
  statsRowContent: { paddingHorizontal: spacing[4], gap: spacing[3], paddingVertical: spacing[4] },
  statCard: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing[3],
    alignItems: 'center',
    minWidth: 82,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
    ...shadow.sm,
  },
  statValue: { fontSize: fontSize.md, fontWeight: '800', color: colors.tx },
  statLabel: { fontSize: fontSize.xs, color: colors.tx2, textAlign: 'center' },
  searchWrap: {
    marginHorizontal: spacing[4],
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[3],
    marginBottom: spacing[3],
  },
  searchIcon: { marginRight: spacing[2] },
  searchInput: { flex: 1, paddingVertical: spacing[3], fontSize: fontSize.base, color: colors.tx },
  locBtn: { padding: spacing[2] },
  catScroll: { marginBottom: spacing[3] },
  catContent: { paddingHorizontal: spacing[4], gap: spacing[2] },
  catPill: {
    paddingHorizontal: spacing[3],
    paddingVertical: 7,
    borderRadius: radius.full,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  catPillActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  catPillTxt: { fontSize: fontSize.xs, fontWeight: '600', color: colors.tx2 },
  catPillTxtActive: { color: colors.white },
  countBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    marginBottom: spacing[3],
  },
  countTxt: { fontSize: fontSize.sm, color: colors.tx2, fontWeight: '600' },
  enableLocTxt: { fontSize: fontSize.sm, color: colors.brand, fontWeight: '600' },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    marginHorizontal: spacing[4],
    marginBottom: spacing[3],
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.sm,
  },
  cardTop: { padding: spacing[4] },
  cardMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing[2] },
  catTag: { fontSize: fontSize.xs, fontWeight: '700' },
  badge: { borderRadius: radius.full, paddingHorizontal: spacing[2], paddingVertical: 3 },
  badgeText: { fontSize: fontSize.xs, fontWeight: '700' },
  cardTitle: { fontSize: fontSize.base, fontWeight: '700', color: colors.tx, marginBottom: spacing[2] },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 3 },
  cardRowTxt: { fontSize: fontSize.sm, color: colors.tx2 },
  distTxt: { fontSize: fontSize.sm, color: colors.brand, fontWeight: '600' },
  cardBottom: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.bg,
  },
  posterRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], flex: 1 },
  posterName: { fontSize: fontSize.sm, color: colors.tx2, fontWeight: '600', flex: 1 },
  pay: { fontSize: fontSize.md, fontWeight: '800', color: colors.brand },
  emptyWrap: { alignItems: 'center', padding: spacing[8], gap: spacing[3] },
  emptyTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.tx },
  emptySub: { fontSize: fontSize.sm, color: colors.tx2, textAlign: 'center' },
  fab: {
    position: 'absolute',
    right: spacing[5],
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.lg,
  },
});
