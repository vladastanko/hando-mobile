import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator,
  Modal, TextInput, ScrollView, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '../context/AppContext';
import { useLanguage } from '../i18n';
import { applications, jobs, ratings, supabase } from '../lib/supabase';
import { colors, radius, spacing, fontSize, shadow } from '../theme';
import { Avatar } from '../components/ui/Avatar';
import { Stars } from '../components/ui/Stars';
import type { Application, Job } from '../types';

type MainTab = 'applied' | 'posted';

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; tx: string; label: string }> = {
    pending:   { bg: colors.warnSoft,  tx: colors.warn,  label: 'Pending'   },
    accepted:  { bg: colors.okSoft,    tx: colors.ok,    label: 'Accepted'  },
    rejected:  { bg: colors.errSoft,   tx: colors.err,   label: 'Rejected'  },
    withdrawn: { bg: colors.bgSub,     tx: colors.tx2,   label: 'Withdrawn' },
    open:      { bg: colors.brandSoft, tx: colors.brand, label: 'Open'      },
    in_progress:{ bg: colors.infoSoft, tx: colors.info,  label: 'In Progress'},
    completed: { bg: colors.okSoft,    tx: colors.ok,    label: 'Completed' },
    cancelled: { bg: colors.errSoft,   tx: colors.err,   label: 'Cancelled' },
  };
  const style = map[status] ?? { bg: colors.bgSub, tx: colors.tx2, label: status };
  return (
    <View style={[styles.statusBadge, { backgroundColor: style.bg }]}>
      <Text style={[styles.statusTxt, { color: style.tx }]}>{style.label}</Text>
    </View>
  );
}

interface RatingModalProps {
  visible: boolean;
  jobId: string;
  rateeId: string;
  raterRole: 'worker' | 'poster';
  rateeeName: string;
  onClose: () => void;
  onSubmitted: () => void;
}

function RatingModal({ visible, jobId, rateeId, raterRole, rateeeName, onClose, onSubmitted }: RatingModalProps) {
  const { user, toast } = useAppContext();
  const { t } = useLanguage();
  const [score, setScore] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!user) return;
    setSubmitting(true);
    const { error } = await ratings.submit(jobId, user.id, rateeId, score, comment, raterRole);
    setSubmitting(false);
    if (error) { toast(error, 'error'); return; }
    toast('Rating submitted!', 'success');
    onSubmitted();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" transparent>
      <View style={styles.ratingOverlay}>
        <View style={styles.ratingSheet}>
          <View style={styles.sheetHandleWrap}>
            <View style={styles.sheetHandle} />
          </View>
          <Text style={styles.ratingTitle}>{t('leaveRating')}</Text>
          <Text style={styles.ratingSubtitle}>
            {raterRole === 'poster' ? t('ratingExpWorker') : t('ratingExpPoster')} — {rateeeName}
          </Text>
          <Stars value={score} size={36} interactive onChange={setScore} />
          <Text style={styles.label}>{t('publicReview')} <Text style={styles.labelMuted}>{t('visibleToAll')}</Text></Text>
          <TextInput
            style={styles.textarea}
            placeholder={t('publicPlaceholder')}
            placeholderTextColor={colors.tx3}
            multiline
            numberOfLines={3}
            value={comment}
            onChangeText={setComment}
            textAlignVertical="top"
          />
          <Pressable style={[styles.primaryBtn, submitting && { opacity: 0.6 }]} onPress={handleSubmit} disabled={submitting}>
            {submitting
              ? <ActivityIndicator color={colors.white} size="small" />
              : <Text style={styles.primaryBtnTxt}>{t('sendRating')}</Text>
            }
          </Pressable>
          <Pressable onPress={onClose} style={styles.cancelBtn}>
            <Text style={styles.cancelTxt}>{t('cancel')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export default function ApplicationsScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const { user, toast, refreshCredits } = useAppContext();

  const [mainTab, setMainTab] = useState<MainTab>('applied');
  const [appliedList, setAppliedList] = useState<Application[]>([]);
  const [postedJobs, setPostedJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);

  // For posted jobs — expanded view
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [jobApplicants, setJobApplicants] = useState<Application[]>([]);
  const [loadingApplicants, setLoadingApplicants] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  // Rating modal
  const [ratingTarget, setRatingTarget] = useState<{
    jobId: string; rateeId: string; raterRole: 'worker' | 'poster'; name: string;
  } | null>(null);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    if (mainTab === 'applied') {
      const { data } = await applications.getMyApplications(user.id);
      if (data) setAppliedList(data);
    } else {
      const { data } = await jobs.getMyPosted(user.id);
      if (data) setPostedJobs(data);
    }
    setLoading(false);
  }, [user, mainTab]);

  useEffect(() => { loadData(); }, [loadData]);

  const loadApplicants = useCallback(async (jobId: string) => {
    setLoadingApplicants(true);
    const { data } = await applications.getForJob(jobId);
    if (data) setJobApplicants(data);
    setLoadingApplicants(false);
  }, []);

  const openJob = (job: Job) => {
    setSelectedJob(job);
    loadApplicants(job.id);
  };

  const handleAccept = async (app: Application) => {
    setAcceptingId(app.id);
    const { error } = await applications.accept(app.id, app.job_id, app.worker_id);
    setAcceptingId(null);
    if (error) { toast(error, 'error'); return; }
    toast(t('applicantAccepted'), 'success');
    loadApplicants(app.job_id);
    loadData();
  };

  const handleDecline = async (app: Application) => {
    const { error } = await applications.reject(app.id);
    if (error) { toast(error, 'error'); return; }
    toast('Applicant declined.', 'info');
    if (selectedJob) loadApplicants(selectedJob.id);
  };

  const handleMarkComplete = async (job: Job) => {
    const { error } = await supabase
      .from('jobs')
      .update({ status: 'completed' })
      .eq('id', job.id);
    if (error) { toast(error.message, 'error'); return; }
    toast('Job marked as completed!', 'success');
    setSelectedJob(null);
    loadData();
  };

  const handleWithdraw = async (app: Application) => {
    Alert.alert(
      t('withdrawApp'),
      t('withdrawWarn'),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('withdrawConfirm'),
          style: 'destructive',
          onPress: async () => {
            const { error } = await applications.withdraw(app.id);
            if (error) { toast(error, 'error'); return; }
            toast(t('appWithdrawn'), 'success');
            loadData();
          },
        },
      ]
    );
  };

  const renderApplied = ({ item }: { item: Application }) => {
    const job = item.job;
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          {job?.category && (
            <Text style={{ fontSize: fontSize.lg }}>{job.category.icon}</Text>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle} numberOfLines={1}>{job?.title ?? 'Unknown job'}</Text>
            <Text style={styles.cardSub}>{job?.city}</Text>
          </View>
          <StatusBadge status={item.status} />
        </View>
        <View style={styles.cardMeta}>
          <Text style={styles.pay}>{job?.pay_per_worker?.toLocaleString()} RSD</Text>
          <Text style={styles.cardDate}>
            {new Date(item.created_at).toLocaleDateString('sr-RS', { day: '2-digit', month: 'short' })}
          </Text>
        </View>
        <View style={styles.cardActions}>
          {item.status === 'pending' && (
            <Pressable style={styles.dangerBtn} onPress={() => handleWithdraw(item)}>
              <Text style={styles.dangerBtnTxt}>{t('withdrawConfirm')}</Text>
            </Pressable>
          )}
          {item.status === 'accepted' && job?.status === 'completed' && (
            <Pressable
              style={styles.rateBtn}
              onPress={() => setRatingTarget({
                jobId: item.job_id,
                rateeId: job.poster_id,
                raterRole: 'worker',
                name: 'employer',
              })}
            >
              <Ionicons name="star-outline" size={15} color={colors.warn} />
              <Text style={styles.rateBtnTxt}>{t('ratePoster')}</Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  };

  const renderPostedJob = ({ item }: { item: Job }) => (
    <Pressable style={styles.card} onPress={() => openJob(item)}>
      <View style={styles.cardHeader}>
        {item.category && <Text style={{ fontSize: fontSize.lg }}>{item.category.icon}</Text>}
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.cardSub}>{item.city}</Text>
        </View>
        <StatusBadge status={item.status} />
      </View>
      <View style={styles.cardMeta}>
        <Text style={styles.pay}>{item.pay_per_worker.toLocaleString()} RSD/worker</Text>
        <View style={styles.rowCenter}>
          <Ionicons name="people-outline" size={14} color={colors.tx3} />
          <Text style={styles.cardDate}>{item.accepted_workers}/{item.crew_size}</Text>
        </View>
      </View>
      <View style={styles.chevronRow}>
        <Text style={styles.tapToView}>Tap to view applicants</Text>
        <Ionicons name="chevron-right" size={16} color={colors.tx3} />
      </View>
    </Pressable>
  );

  const renderApplicant = ({ item }: { item: Application }) => {
    const w = item.worker;
    const isAccepted = item.status === 'accepted';
    const isRejected = item.status === 'rejected';

    return (
      <View style={styles.applicantCard}>
        <View style={styles.applicantTop}>
          <Avatar url={w?.avatar_url} name={w?.full_name} size={44} />
          <View style={{ flex: 1 }}>
            <Text style={styles.applicantName}>{w?.full_name ?? 'Unknown'}</Text>
            <View style={styles.rowCenter}>
              <Stars value={w?.rating_as_worker ?? 0} size={12} />
              <Text style={styles.applicantSub}> · {w?.completed_jobs_worker ?? 0} jobs done</Text>
            </View>
            {w?.city ? <Text style={styles.applicantSub}>{w.city}</Text> : null}
          </View>
          <StatusBadge status={item.status} />
        </View>
        {!!item.message && (
          <View style={styles.msgBox}>
            <Text style={styles.msgLabel}>{t('coverMessage')}</Text>
            <Text style={styles.msgTxt}>{item.message}</Text>
          </View>
        )}
        {!isAccepted && !isRejected && (
          <View style={styles.applicantActions}>
            <Pressable
              style={[styles.acceptBtn, acceptingId === item.id && { opacity: 0.6 }]}
              onPress={() => handleAccept(item)}
              disabled={acceptingId === item.id}
            >
              {acceptingId === item.id
                ? <ActivityIndicator size="small" color={colors.white} />
                : <Text style={styles.acceptBtnTxt}>{t('acceptApplicant')}</Text>
              }
            </Pressable>
            <Pressable style={styles.declineBtn} onPress={() => handleDecline(item)}>
              <Text style={styles.declineBtnTxt}>{t('decline')}</Text>
            </Pressable>
          </View>
        )}
        {isAccepted && selectedJob?.status === 'completed' && w && (
          <Pressable
            style={styles.rateBtn}
            onPress={() => setRatingTarget({
              jobId: item.job_id,
              rateeId: w.id,
              raterRole: 'poster',
              name: w.full_name,
            })}
          >
            <Ionicons name="star-outline" size={15} color={colors.warn} />
            <Text style={styles.rateBtnTxt}>{t('rateWorker')}</Text>
          </Pressable>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        {selectedJob ? (
          <Pressable onPress={() => { setSelectedJob(null); loadData(); }} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={colors.tx} />
            <Text style={styles.headerTitle}>{selectedJob.title}</Text>
          </Pressable>
        ) : (
          <Text style={styles.headerBig}>My Jobs</Text>
        )}
      </View>

      {selectedJob ? (
        // Applicants view
        <View style={{ flex: 1 }}>
          {selectedJob.status === 'in_progress' && (
            <Pressable style={styles.completeBtn} onPress={() => handleMarkComplete(selectedJob)}>
              <Ionicons name="checkmark-circle-outline" size={18} color={colors.ok} />
              <Text style={styles.completeBtnTxt}>{t('markComplete')}</Text>
            </Pressable>
          )}
          {loadingApplicants ? (
            <View style={styles.centered}><ActivityIndicator color={colors.brand} size="large" /></View>
          ) : (
            <FlatList
              data={jobApplicants}
              keyExtractor={a => a.id}
              renderItem={renderApplicant}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.emptyWrap}>
                  <Ionicons name="people-outline" size={40} color={colors.tx3} />
                  <Text style={styles.emptyTitle}>{t('noApplicants')}</Text>
                  <Text style={styles.emptySub}>{t('shareJob')}</Text>
                </View>
              }
            />
          )}
        </View>
      ) : (
        <>
          {/* Main tabs */}
          <View style={styles.tabs}>
            {(['applied', 'posted'] as MainTab[]).map(tab => (
              <Pressable
                key={tab}
                style={[styles.tabBtn, mainTab === tab && styles.tabBtnActive]}
                onPress={() => setMainTab(tab)}
              >
                <Text style={[styles.tabTxt, mainTab === tab && styles.tabTxtActive]}>
                  {tab === 'applied' ? t('applied') : t('posted')}
                </Text>
              </Pressable>
            ))}
          </View>

          {loading ? (
            <View style={styles.centered}><ActivityIndicator color={colors.brand} size="large" /></View>
          ) : mainTab === 'applied' ? (
            <FlatList
              data={appliedList}
              keyExtractor={a => a.id}
              renderItem={renderApplied}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.emptyWrap}>
                  <Ionicons name="briefcase-outline" size={40} color={colors.tx3} />
                  <Text style={styles.emptyTitle}>{t('noApplications')}</Text>
                  <Text style={styles.emptySub}>{t('noApplicationsBrowse')}</Text>
                </View>
              }
            />
          ) : (
            <FlatList
              data={postedJobs}
              keyExtractor={j => j.id}
              renderItem={renderPostedJob}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.emptyWrap}>
                  <Ionicons name="add-circle-outline" size={40} color={colors.tx3} />
                  <Text style={styles.emptyTitle}>{t('noPostedJobs')}</Text>
                </View>
              }
            />
          )}
        </>
      )}

      {ratingTarget && (
        <RatingModal
          visible={!!ratingTarget}
          jobId={ratingTarget.jobId}
          rateeId={ratingTarget.rateeId}
          raterRole={ratingTarget.raterRole}
          rateeeName={ratingTarget.name}
          onClose={() => setRatingTarget(null)}
          onSubmitted={loadData}
        />
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
  },
  headerBig: { fontSize: fontSize.xl, fontWeight: '800', color: colors.tx },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing[1], flex: 1 },
  headerTitle: { fontSize: fontSize.base, fontWeight: '700', color: colors.tx, flex: 1 },
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tabBtn: { flex: 1, paddingVertical: spacing[3], alignItems: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' },
  tabBtnActive: { borderBottomColor: colors.brand },
  tabTxt: { fontSize: fontSize.sm, fontWeight: '600', color: colors.tx2 },
  tabTxtActive: { color: colors.brand },
  listContent: { padding: spacing[4], gap: spacing[3], paddingBottom: 100 },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing[4],
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing[3],
    ...shadow.sm,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3] },
  cardTitle: { fontSize: fontSize.base, fontWeight: '700', color: colors.tx },
  cardSub: { fontSize: fontSize.sm, color: colors.tx2, marginTop: 2 },
  cardMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pay: { fontSize: fontSize.base, fontWeight: '800', color: colors.brand },
  cardDate: { fontSize: fontSize.sm, color: colors.tx3 },
  cardActions: { flexDirection: 'row', gap: spacing[2] },
  statusBadge: { borderRadius: radius.full, paddingHorizontal: spacing[3], paddingVertical: 4 },
  statusTxt: { fontSize: fontSize.xs, fontWeight: '700' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyWrap: { alignItems: 'center', padding: spacing[8], gap: spacing[3] },
  emptyTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.tx },
  emptySub: { fontSize: fontSize.sm, color: colors.tx2, textAlign: 'center' },
  rowCenter: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  chevronRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tapToView: { fontSize: fontSize.sm, color: colors.tx3 },
  completeBtn: {
    margin: spacing[4],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    backgroundColor: colors.okSoft,
    borderRadius: radius.md,
    padding: spacing[4],
  },
  completeBtnTxt: { fontSize: fontSize.base, fontWeight: '700', color: colors.ok },
  applicantCard: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing[4],
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing[3],
    ...shadow.sm,
  },
  applicantTop: { flexDirection: 'row', gap: spacing[3], alignItems: 'flex-start' },
  applicantName: { fontSize: fontSize.base, fontWeight: '700', color: colors.tx },
  applicantSub: { fontSize: fontSize.sm, color: colors.tx2 },
  msgBox: { backgroundColor: colors.bg, borderRadius: radius.sm, padding: spacing[3], gap: 4 },
  msgLabel: { fontSize: fontSize.xs, fontWeight: '700', color: colors.tx2, textTransform: 'uppercase' },
  msgTxt: { fontSize: fontSize.sm, color: colors.tx },
  applicantActions: { flexDirection: 'row', gap: spacing[3] },
  acceptBtn: {
    flex: 1,
    backgroundColor: colors.brand,
    borderRadius: radius.sm,
    paddingVertical: spacing[3],
    alignItems: 'center',
  },
  acceptBtnTxt: { color: colors.white, fontSize: fontSize.sm, fontWeight: '700' },
  declineBtn: {
    paddingHorizontal: spacing[4],
    backgroundColor: colors.errSoft,
    borderRadius: radius.sm,
    paddingVertical: spacing[3],
    alignItems: 'center',
  },
  declineBtnTxt: { color: colors.err, fontSize: fontSize.sm, fontWeight: '700' },
  dangerBtn: {
    backgroundColor: colors.errSoft,
    borderRadius: radius.sm,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  dangerBtnTxt: { color: colors.err, fontSize: fontSize.sm, fontWeight: '700' },
  rateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    backgroundColor: colors.warnSoft,
    borderRadius: radius.sm,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    alignSelf: 'flex-start',
  },
  rateBtnTxt: { fontSize: fontSize.sm, fontWeight: '700', color: colors.warn },
  // Rating modal
  ratingOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  ratingSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing[5],
    gap: spacing[4],
  },
  sheetHandleWrap: { alignItems: 'center' },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border },
  ratingTitle: { fontSize: fontSize.xl, fontWeight: '800', color: colors.tx },
  ratingSubtitle: { fontSize: fontSize.sm, color: colors.tx2 },
  label: { fontSize: fontSize.sm, fontWeight: '600', color: colors.tx2 },
  labelMuted: { color: colors.tx3, fontWeight: '400' },
  textarea: {
    backgroundColor: colors.bg,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing[3],
    fontSize: fontSize.base,
    color: colors.tx,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  primaryBtn: {
    backgroundColor: colors.brand,
    borderRadius: radius.md,
    paddingVertical: spacing[4],
    alignItems: 'center',
  },
  primaryBtnTxt: { color: colors.white, fontSize: fontSize.base, fontWeight: '800' },
  cancelBtn: { alignItems: 'center', padding: spacing[3] },
  cancelTxt: { fontSize: fontSize.base, color: colors.tx2, fontWeight: '600' },
});
