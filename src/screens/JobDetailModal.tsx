import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Modal, ScrollView, Pressable,
  TextInput, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '../context/AppContext';
import { applications } from '../lib/supabase';
import { colors, radius, spacing, fontSize } from '../theme';
import { Avatar } from '../components/ui/Avatar';
import { Stars } from '../components/ui/Stars';
import type { Job } from '../types';

function formatDate(dateStr: string) {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('sr-RS', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

interface Props {
  job: Job;
  visible: boolean;
  onClose: () => void;
  onApplied?: () => void;
}

export default function JobDetailModal({ job, visible, onClose, onApplied }: Props) {
  const insets = useSafeAreaInsets();
  const { user, creditBalance, toast, refreshCredits } = useAppContext();
  const [message, setMessage] = useState('');
  const [applying, setApplying] = useState(false);
  const [hasApplied, setHasApplied] = useState(false);
  const [checking, setChecking] = useState(true);

  const spotsLeft = job.spots_remaining ?? (job.crew_size - (job.accepted_workers ?? 0));
  const isOwn = user?.id === job.poster_id;

  useEffect(() => {
    if (!user || !visible) return;
    setChecking(true);
    applications.hasApplied(job.id, user.id).then(applied => {
      setHasApplied(applied);
      setChecking(false);
    });
  }, [visible, job.id, user?.id]);

  const handleApply = async () => {
    if (!user) { toast('Please sign in to apply.', 'error'); return; }
    if (creditBalance < 3) { toast('Not enough credits. You need 3 credits to apply.', 'error'); return; }
    if (spotsLeft <= 0) { toast('No spots remaining for this job.', 'error'); return; }

    setApplying(true);
    const { error } = await applications.apply(job.id, user.id, message.trim() || undefined);
    setApplying(false);

    if (error) {
      toast(error, 'error');
    } else {
      toast('Application submitted! −3 credits deducted.', 'success');
      setHasApplied(true);
      await refreshCredits();
      onApplied?.();
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.root, { paddingBottom: insets.bottom }]}>
          {/* Handle bar */}
          <View style={styles.handleWrap}>
            <View style={styles.handle} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={colors.tx2} />
            </Pressable>
            {job.category && (
              <View style={[styles.catBadge, { backgroundColor: job.category.color + '22' }]}>
                <Text style={[styles.catBadgeTxt, { color: job.category.color }]}>
                  {job.category.icon} {job.category.name}
                </Text>
              </View>
            )}
          </View>

          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Title & status */}
            <Text style={styles.title}>{job.title}</Text>

            <View style={styles.metaRow}>
              {spotsLeft > 0 ? (
                <View style={[styles.statusPill, { backgroundColor: colors.okSoft }]}>
                  <Text style={[styles.statusTxt, { color: colors.ok }]}>{spotsLeft} spots left</Text>
                </View>
              ) : (
                <View style={[styles.statusPill, { backgroundColor: colors.errSoft }]}>
                  <Text style={[styles.statusTxt, { color: colors.err }]}>Full</Text>
                </View>
              )}
              <View style={[styles.statusPill, { backgroundColor: colors.brandSoft }]}>
                <Text style={[styles.statusTxt, { color: colors.brand }]}>{job.crew_size} workers needed</Text>
              </View>
            </View>

            {/* Details grid */}
            <View style={styles.detailGrid}>
              <DetailRow icon="calendar-outline" label="Date" value={formatDate(job.scheduled_date)} />
              <DetailRow icon="time-outline" label="Duration" value={`${job.duration_hours} hours`} />
              <DetailRow icon="location-outline" label="Location" value={`${job.address}, ${job.city}`} />
              <DetailRow
                icon="cash-outline"
                label="Pay per worker"
                value={`${job.pay_per_worker.toLocaleString()} RSD`}
                bold
              />
              <DetailRow
                icon="people-outline"
                label="Total payout"
                value={`${(job.pay_per_worker * job.crew_size).toLocaleString()} RSD`}
              />
            </View>

            {/* Description */}
            {!!job.description && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Description</Text>
                <Text style={styles.description}>{job.description}</Text>
              </View>
            )}

            {/* Poster */}
            {job.poster && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Posted by</Text>
                <View style={styles.posterCard}>
                  <Avatar url={job.poster.avatar_url} name={job.poster.full_name} size={48} />
                  <View style={styles.posterInfo}>
                    <Text style={styles.posterName}>{job.poster.full_name}</Text>
                    <Stars value={job.poster.rating_as_poster ?? 0} size={14} />
                    <Text style={styles.posterSub}>
                      {job.poster.completed_jobs_poster ?? 0} jobs posted
                      {job.poster.verification_status === 'verified' && ' · Verified'}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Apply section */}
            {!isOwn && job.status === 'open' && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Cover message (optional)</Text>
                <TextInput
                  style={styles.msgInput}
                  placeholder="Introduce yourself and explain why you're a good fit..."
                  placeholderTextColor={colors.tx3}
                  multiline
                  numberOfLines={3}
                  value={message}
                  onChangeText={setMessage}
                  textAlignVertical="top"
                  editable={!hasApplied}
                />
              </View>
            )}

            <View style={{ height: spacing[6] }} />
          </ScrollView>

          {/* Footer */}
          {!isOwn && job.status === 'open' && (
            <View style={[styles.footer, { borderTopColor: colors.border }]}>
              {checking ? (
                <ActivityIndicator color={colors.brand} />
              ) : hasApplied ? (
                <View style={[styles.appliedBadge]}>
                  <Ionicons name="checkmark-circle" size={20} color={colors.ok} />
                  <Text style={styles.appliedTxt}>Already applied</Text>
                </View>
              ) : (
                <>
                  <Text style={styles.creditNote}>
                    Costs 3 credits · Balance: {creditBalance}
                  </Text>
                  <Pressable
                    style={[styles.applyBtn, (applying || creditBalance < 3) && styles.applyBtnDisabled]}
                    onPress={handleApply}
                    disabled={applying || creditBalance < 3}
                  >
                    {applying
                      ? <ActivityIndicator color={colors.white} size="small" />
                      : <Text style={styles.applyBtnTxt}>Apply for this job (−3 credits)</Text>
                    }
                  </Pressable>
                </>
              )}
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function DetailRow({ icon, label, value, bold }: { icon: string; label: string; value: string; bold?: boolean }) {
  return (
    <View style={styles.detailRow}>
      <Ionicons name={icon as never} size={16} color={colors.brand} />
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, bold && styles.detailValueBold]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },
  handleWrap: { alignItems: 'center', paddingTop: spacing[3] },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  closeBtn: { padding: 4 },
  catBadge: { borderRadius: radius.full, paddingHorizontal: spacing[3], paddingVertical: 5 },
  catBadgeTxt: { fontSize: fontSize.xs, fontWeight: '700' },
  scroll: { flex: 1, paddingHorizontal: spacing[4] },
  title: { fontSize: fontSize.xl, fontWeight: '800', color: colors.tx, marginTop: spacing[4], marginBottom: spacing[3] },
  metaRow: { flexDirection: 'row', gap: spacing[2], marginBottom: spacing[4], flexWrap: 'wrap' },
  statusPill: { borderRadius: radius.full, paddingHorizontal: spacing[3], paddingVertical: 5 },
  statusTxt: { fontSize: fontSize.xs, fontWeight: '700' },
  detailGrid: {
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    padding: spacing[4],
    gap: spacing[3],
    marginBottom: spacing[4],
  },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  detailLabel: { fontSize: fontSize.sm, color: colors.tx2, width: 120 },
  detailValue: { fontSize: fontSize.sm, color: colors.tx, fontWeight: '500', flex: 1 },
  detailValueBold: { fontWeight: '800', color: colors.brand, fontSize: fontSize.base },
  section: { marginBottom: spacing[4] },
  sectionTitle: { fontSize: fontSize.sm, fontWeight: '700', color: colors.tx2, marginBottom: spacing[2], textTransform: 'uppercase', letterSpacing: 0.5 },
  description: { fontSize: fontSize.base, color: colors.tx, lineHeight: 22 },
  posterCard: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], backgroundColor: colors.bg, borderRadius: radius.md, padding: spacing[3] },
  posterInfo: { flex: 1, gap: 3 },
  posterName: { fontSize: fontSize.base, fontWeight: '700', color: colors.tx },
  posterSub: { fontSize: fontSize.sm, color: colors.tx2 },
  msgInput: {
    backgroundColor: colors.bg,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing[3],
    fontSize: fontSize.base,
    color: colors.tx,
    minHeight: 80,
  },
  footer: {
    padding: spacing[4],
    borderTopWidth: 1,
    gap: spacing[2],
  },
  creditNote: { fontSize: fontSize.sm, color: colors.tx2, textAlign: 'center' },
  applyBtn: {
    backgroundColor: colors.brand,
    borderRadius: radius.md,
    paddingVertical: spacing[4],
    alignItems: 'center',
  },
  applyBtnDisabled: { opacity: 0.5 },
  applyBtnTxt: { color: colors.white, fontSize: fontSize.base, fontWeight: '700' },
  appliedBadge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[2], padding: spacing[3] },
  appliedTxt: { fontSize: fontSize.base, fontWeight: '700', color: colors.ok },
});
