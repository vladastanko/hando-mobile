import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
  ActivityIndicator, FlatList, Modal, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useAppContext } from '../context/AppContext';
import { useLanguage, setLang } from '../i18n';
import { auth, profiles, ratings, supabase } from '../lib/supabase';
import { colors, radius, spacing, fontSize, shadow } from '../theme';
import { Avatar } from '../components/ui/Avatar';
import { Stars } from '../components/ui/Stars';
import type { Rating, SupportTicket, SupportMessage } from '../types';

type ProfileTab = 'overview' | 'edit' | 'ratings' | 'verification' | 'support';
type RatingSubTab = 'received' | 'given';

function Badge({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeTxt, { color }]}>{label}</Text>
    </View>
  );
}

// ── Overview Tab ─────────────────────────────────────────────────────────────
function OverviewTab() {
  const { profile, creditBalance } = useAppContext();
  const { t } = useLanguage();
  if (!profile) return null;

  return (
    <ScrollView contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false}>
      <View style={styles.statsGrid}>
        <StatBox icon="checkmark-circle-outline" label={t('statJobsDone')} value={String(profile.completed_jobs_worker)} />
        <StatBox icon="star-outline" label={t('statRating')} value={(profile.rating_as_worker || 0).toFixed(1)} />
        <StatBox icon="wallet-outline" label={t('statCredits')} value={String(creditBalance)} />
        <StatBox icon="briefcase-outline" label={t('jobsPosted')} value={String(profile.completed_jobs_poster || 0)} />
      </View>
      {!!profile.bio && (
        <View style={styles.bioBox}>
          <Text style={styles.bioLabel}>{t('bio')}</Text>
          <Text style={styles.bioText}>{profile.bio}</Text>
        </View>
      )}
    </ScrollView>
  );
}

function StatBox({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.statBox}>
      <Ionicons name={icon as never} size={22} color={colors.brand} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ── Edit Tab ─────────────────────────────────────────────────────────────────
function EditTab() {
  const { user, profile, toast, refreshProfile } = useAppContext();
  const { t } = useLanguage();
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [city, setCity] = useState(profile?.city ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await profiles.update(user.id, { full_name: fullName.trim(), city: city.trim(), bio: bio.trim() });
    setSaving(false);
    if (error) { toast(error, 'error'); return; }
    toast(t('profileUpdated'), 'success');
    await refreshProfile();
  };

  return (
    <ScrollView contentContainerStyle={styles.tabContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <Text style={styles.fieldLabel}>{t('fullName')}</Text>
      <TextInput style={styles.input} value={fullName} onChangeText={setFullName} placeholderTextColor={colors.tx3} placeholder={t('fullName')} />
      <Text style={styles.fieldLabel}>{t('city')}</Text>
      <TextInput style={styles.input} value={city} onChangeText={setCity} placeholderTextColor={colors.tx3} placeholder="Beograd" />
      <Text style={styles.fieldLabel}>{t('bio')} <Text style={styles.optional}>{t('bioOptional')}</Text></Text>
      <TextInput
        style={[styles.input, styles.textarea]}
        value={bio}
        onChangeText={setBio}
        placeholderTextColor={colors.tx3}
        placeholder={t('descriptionPh')}
        multiline
        numberOfLines={4}
        textAlignVertical="top"
      />
      <Pressable style={[styles.primaryBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
        {saving ? <ActivityIndicator color={colors.white} size="small" /> : <Text style={styles.primaryBtnTxt}>{t('saveChanges')}</Text>}
      </Pressable>
    </ScrollView>
  );
}

// ── Ratings Tab ───────────────────────────────────────────────────────────────
function RatingsTab() {
  const { user } = useAppContext();
  const { t } = useLanguage();
  const [subTab, setSubTab] = useState<RatingSubTab>('received');
  const [received, setReceived] = useState<Rating[]>([]);
  const [given, setGiven] = useState<Rating[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    Promise.all([
      ratings.getForUser(user.id),
      ratings.getByRater(user.id),
    ]).then(([r, g]) => {
      if (r.data) setReceived(r.data);
      if (g.data) setGiven(g.data);
      setLoading(false);
    });
  }, [user]);

  const list = subTab === 'received' ? received : given;

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.subTabs}>
        <Pressable style={[styles.subTabBtn, subTab === 'received' && styles.subTabBtnActive]} onPress={() => setSubTab('received')}>
          <Text style={[styles.subTabTxt, subTab === 'received' && styles.subTabTxtActive]}>Received ({received.length})</Text>
        </Pressable>
        <Pressable style={[styles.subTabBtn, subTab === 'given' && styles.subTabBtnActive]} onPress={() => setSubTab('given')}>
          <Text style={[styles.subTabTxt, subTab === 'given' && styles.subTabTxtActive]}>Given ({given.length})</Text>
        </Pressable>
      </View>
      {loading ? (
        <View style={styles.centered}><ActivityIndicator color={colors.brand} /></View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={r => r.id}
          contentContainerStyle={styles.tabContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={<Text style={styles.emptyTxt}>No ratings yet.</Text>}
          renderItem={({ item }) => (
            <View style={styles.ratingCard}>
              <View style={styles.ratingCardTop}>
                <Avatar url={item.rater?.avatar_url} name={item.rater?.full_name} size={36} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.raterName}>{item.rater?.full_name ?? 'Anonymous'}</Text>
                  <Text style={styles.ratingDate}>
                    {new Date(item.created_at).toLocaleDateString('sr-RS', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </Text>
                </View>
                <Stars value={item.score} size={14} />
              </View>
              {!!item.comment && <Text style={styles.ratingComment}>{item.comment}</Text>}
            </View>
          )}
        />
      )}
    </View>
  );
}

// ── Verification Tab ─────────────────────────────────────────────────────────
function VerificationTab() {
  const { user, profile, toast, refreshProfile } = useAppContext();
  const { t } = useLanguage();

  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);

  const [idFront, setIdFront] = useState<string | null>(null);
  const [idBack, setIdBack] = useState<string | null>(null);
  const [submittingVerif, setSubmittingVerif] = useState(false);

  const pickImage = async (side: 'front' | 'back') => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
    });
    if (!result.canceled && result.assets[0]) {
      if (side === 'front') setIdFront(result.assets[0].uri);
      else setIdBack(result.assets[0].uri);
    }
  };

  const sendOtp = async () => {
    if (!phone.trim()) { toast(t('enterPhone'), 'error'); return; }
    setOtpLoading(true);
    const { error } = await supabase.functions.invoke('send-phone-otp', { body: { phone: phone.trim() } });
    setOtpLoading(false);
    if (error) { toast(String(error), 'error'); return; }
    toast(t('otpSentEmail'), 'success');
    setOtpSent(true);
    if (user) await profiles.update(user.id, { phone: phone.trim() }).catch(() => {});
  };

  const verifyOtp = async () => {
    if (!otpCode.trim()) return;
    setOtpLoading(true);
    const { error } = await supabase.functions.invoke('verify-phone-otp', { body: { code: otpCode.trim() } });
    setOtpLoading(false);
    if (error) { toast('Invalid code. Please try again.', 'error'); return; }
    toast(t('phoneVerifiedMsg'), 'success');
    await refreshProfile();
  };

  const submitVerification = async () => {
    if (!user || !idFront || !idBack) { toast('Please upload both sides of your ID.', 'error'); return; }
    setSubmittingVerif(true);
    const { error } = await profiles.submitVerification(user.id, idFront, idBack);
    setSubmittingVerif(false);
    if (error) { toast(error, 'error'); return; }
    toast('Verification submitted! You\'ll be notified within 48 hours.', 'success');
    await refreshProfile();
  };

  const vs = profile?.verification_status;

  return (
    <ScrollView contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false}>
      {/* Email */}
      <View style={styles.verifSection}>
        <Text style={styles.verifSectionTitle}>{t('emailAddress')}</Text>
        <View style={styles.verifRow}>
          <Ionicons name="mail-outline" size={18} color={colors.brand} />
          <Text style={styles.verifValue}>{profile?.email}</Text>
          {profile?.is_email_verified
            ? <Badge label={t('verified')} color={colors.ok} bg={colors.okSoft} />
            : <Badge label={t('notVerifiedEmail')} color={colors.warn} bg={colors.warnSoft} />
          }
        </View>
      </View>

      {/* Phone */}
      <View style={styles.verifSection}>
        <Text style={styles.verifSectionTitle}>{t('phoneNumber')}</Text>
        {profile?.is_phone_verified ? (
          <View style={styles.verifRow}>
            <Ionicons name="call-outline" size={18} color={colors.brand} />
            <Text style={styles.verifValue}>{profile.phone}</Text>
            <Badge label={t('verified')} color={colors.ok} bg={colors.okSoft} />
          </View>
        ) : (
          <>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="+381 6X XXX XXXX"
              placeholderTextColor={colors.tx3}
              keyboardType="phone-pad"
              editable={!otpSent}
            />
            {otpSent ? (
              <>
                <TextInput
                  style={styles.input}
                  value={otpCode}
                  onChangeText={setOtpCode}
                  placeholder={t('enterCode')}
                  placeholderTextColor={colors.tx3}
                  keyboardType="number-pad"
                  maxLength={6}
                />
                <Pressable style={[styles.primaryBtn, otpLoading && { opacity: 0.6 }]} onPress={verifyOtp} disabled={otpLoading}>
                  {otpLoading ? <ActivityIndicator color={colors.white} size="small" /> : <Text style={styles.primaryBtnTxt}>{t('verifyBtn')}</Text>}
                </Pressable>
              </>
            ) : (
              <Pressable style={[styles.secondaryBtn, otpLoading && { opacity: 0.6 }]} onPress={sendOtp} disabled={otpLoading}>
                {otpLoading ? <ActivityIndicator color={colors.brand} size="small" /> : <Text style={styles.secondaryBtnTxt}>{t('sendOtpBtn')}</Text>}
              </Pressable>
            )}
          </>
        )}
      </View>

      {/* ID Verification */}
      <View style={styles.verifSection}>
        <Text style={styles.verifSectionTitle}>{t('identityCard')}</Text>

        {vs === 'verified' && (
          <View style={[styles.verifStatusBox, { backgroundColor: colors.okSoft }]}>
            <Ionicons name="shield-checkmark" size={22} color={colors.ok} />
            <Text style={[styles.verifStatusTxt, { color: colors.ok }]}>{t('identityVerifiedMsg')}</Text>
          </View>
        )}

        {vs === 'pending' && (
          <View style={[styles.verifStatusBox, { backgroundColor: colors.warnSoft }]}>
            <Ionicons name="time-outline" size={22} color={colors.warn} />
            <Text style={[styles.verifStatusTxt, { color: colors.warn }]}>{t('idUnderReview')}</Text>
          </View>
        )}

        {vs === 'rejected' && (
          <View style={[styles.verifStatusBox, { backgroundColor: colors.errSoft }]}>
            <Ionicons name="close-circle-outline" size={22} color={colors.err} />
            <Text style={[styles.verifStatusTxt, { color: colors.err }]}>{t('idRejected')}</Text>
            {!!profile?.verification_rejection_reason && (
              <Text style={[styles.verifStatusTxt, { color: colors.err, fontSize: fontSize.sm }]}>
                {t('rejectionReason')} {profile.verification_rejection_reason}
              </Text>
            )}
          </View>
        )}

        {(vs === 'unverified' || vs === 'rejected') && (
          <>
            <Text style={styles.verifDesc}>{t('idVerifDesc')}</Text>
            <Text style={styles.fieldLabel}>{t('idCardFront')}</Text>
            <Pressable style={styles.uploadBtn} onPress={() => pickImage('front')}>
              <Ionicons name="image-outline" size={20} color={colors.brand} />
              <Text style={styles.uploadBtnTxt}>{idFront ? t('changeFile') : t('uploadFile')}</Text>
              {idFront && <Ionicons name="checkmark-circle" size={18} color={colors.ok} />}
            </Pressable>
            <Text style={styles.fieldLabel}>{t('idCardBack')}</Text>
            <Pressable style={styles.uploadBtn} onPress={() => pickImage('back')}>
              <Ionicons name="image-outline" size={20} color={colors.brand} />
              <Text style={styles.uploadBtnTxt}>{idBack ? t('changeFile') : t('uploadFile')}</Text>
              {idBack && <Ionicons name="checkmark-circle" size={18} color={colors.ok} />}
            </Pressable>
            <Text style={styles.securityNote}>{t('idSecurityNote')}</Text>
            <Pressable
              style={[styles.primaryBtn, (submittingVerif || !idFront || !idBack) && { opacity: 0.5 }]}
              onPress={submitVerification}
              disabled={submittingVerif || !idFront || !idBack}
            >
              {submittingVerif ? <ActivityIndicator color={colors.white} size="small" /> : <Text style={styles.primaryBtnTxt}>{t('submitVerif')}</Text>}
            </Pressable>
          </>
        )}
      </View>
    </ScrollView>
  );
}

// ── Support Tab ───────────────────────────────────────────────────────────────
function SupportTab() {
  const { user, toast } = useAppContext();
  const { t } = useLanguage();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [activeTicket, setActiveTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [reply, setReply] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const loadTickets = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (data) setTickets(data as SupportTicket[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { loadTickets(); }, [loadTickets]);

  const openTicket = async (ticket: SupportTicket) => {
    setActiveTicket(ticket);
    const { data } = await supabase
      .from('support_messages')
      .select('*')
      .eq('ticket_id', ticket.id)
      .order('created_at', { ascending: true });
    if (data) setMessages(data as SupportMessage[]);

    channelRef.current?.unsubscribe();
    channelRef.current = supabase
      .channel(`support:${ticket.id}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'support_messages', filter: `ticket_id=eq.${ticket.id}` },
        payload => setMessages(prev => [...prev, payload.new as SupportMessage])
      )
      .subscribe();
  };

  const closeTicket = () => {
    channelRef.current?.unsubscribe();
    setActiveTicket(null);
    setMessages([]);
    setReply('');
  };

  const submitTicket = async () => {
    if (!user || !subject.trim() || !message.trim()) { toast('Please fill in all fields.', 'error'); return; }
    setSubmitting(true);
    const { data: ticketData, error } = await supabase
      .from('support_tickets')
      .insert({ user_id: user.id, subject: subject.trim(), status: 'open' })
      .select()
      .single();
    if (error || !ticketData) { toast(error?.message ?? 'Error', 'error'); setSubmitting(false); return; }
    await supabase.from('support_messages').insert({
      ticket_id: ticketData.id,
      sender_id: user.id,
      message: message.trim(),
      is_admin: false,
    });
    setSubmitting(false);
    setSubject(''); setMessage(''); setShowNew(false);
    toast('Ticket submitted!', 'success');
    loadTickets();
  };

  const sendReply = async () => {
    if (!user || !activeTicket || !reply.trim()) return;
    setSendingReply(true);
    await supabase.from('support_messages').insert({
      ticket_id: activeTicket.id,
      sender_id: user.id,
      message: reply.trim(),
      is_admin: false,
    });
    setReply('');
    setSendingReply(false);
  };

  const statusMap: Record<string, { label: string; color: string; bg: string }> = {
    open: { label: t('ticketOpen'), color: colors.brand, bg: colors.brandSoft },
    in_progress: { label: t('ticketInProgress'), color: colors.info, bg: colors.infoSoft },
    resolved: { label: t('ticketResolved'), color: colors.ok, bg: colors.okSoft },
    closed: { label: t('ticketClosed'), color: colors.tx2, bg: colors.bgSub },
  };

  if (activeTicket) {
    return (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ flex: 1 }}>
          <View style={styles.ticketHeader}>
            <Pressable onPress={closeTicket} style={styles.backBtn2}>
              <Ionicons name="chevron-back" size={20} color={colors.tx} />
            </Pressable>
            <Text style={styles.ticketHeaderTitle} numberOfLines={1}>{activeTicket.subject}</Text>
          </View>
          <FlatList
            data={messages}
            keyExtractor={m => m.id}
            contentContainerStyle={{ padding: spacing[4], gap: spacing[2] }}
            renderItem={({ item }) => {
              const isMe = !item.is_admin;
              return (
                <View style={{ alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                  <View style={[styles.msgBubble, isMe ? styles.msgBubbleMe : styles.msgBubbleAdmin]}>
                    {!isMe && <Text style={styles.adminLabel}>Support</Text>}
                    <Text style={[styles.msgBubbleTxt2, isMe && { color: colors.white }]}>{item.message}</Text>
                  </View>
                </View>
              );
            }}
          />
          <View style={styles.replyBar}>
            <TextInput
              style={styles.replyInput}
              placeholder={t('typeReply')}
              placeholderTextColor={colors.tx3}
              value={reply}
              onChangeText={setReply}
              multiline
            />
            <Pressable style={[styles.sendBtn2, !reply.trim() && { opacity: 0.4 }]} onPress={sendReply} disabled={!reply.trim() || sendingReply}>
              {sendingReply ? <ActivityIndicator size="small" color={colors.white} /> : <Ionicons name="send" size={16} color={colors.white} />}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.supportHeader}>
        <Text style={styles.supportTitle}>Support</Text>
        <Pressable style={styles.newTicketBtn} onPress={() => setShowNew(true)}>
          <Ionicons name="add" size={18} color={colors.white} />
          <Text style={styles.newTicketBtnTxt}>{t('newTicket')}</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.centered}><ActivityIndicator color={colors.brand} /></View>
      ) : (
        <FlatList
          data={tickets}
          keyExtractor={t => t.id}
          contentContainerStyle={styles.tabContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={<Text style={styles.emptyTxt}>{t('noTickets')}</Text>}
          renderItem={({ item }) => {
            const s = statusMap[item.status] ?? statusMap.open;
            return (
              <Pressable style={styles.ticketCard} onPress={() => openTicket(item)}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.ticketSubject}>{item.subject}</Text>
                  <Text style={styles.ticketDate}>
                    {new Date(item.created_at).toLocaleDateString('sr-RS')}
                  </Text>
                </View>
                <Badge label={s.label} color={s.color} bg={s.bg} />
              </Pressable>
            );
          }}
        />
      )}

      <Modal visible={showNew} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.newTicketModal, { paddingTop: 16 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('newTicket')}</Text>
              <Pressable onPress={() => setShowNew(false)}>
                <Ionicons name="close" size={24} color={colors.tx2} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={{ padding: spacing[4] }} keyboardShouldPersistTaps="handled">
              <Text style={styles.fieldLabel}>{t('ticketSubject')}</Text>
              <TextInput style={styles.input} value={subject} onChangeText={setSubject} placeholder={t('ticketSubjectPh')} placeholderTextColor={colors.tx3} />
              <Text style={styles.fieldLabel}>{t('ticketMessage')}</Text>
              <TextInput
                style={[styles.input, styles.textarea]}
                value={message}
                onChangeText={setMessage}
                placeholder={t('ticketMessagePh')}
                placeholderTextColor={colors.tx3}
                multiline
                numberOfLines={5}
                textAlignVertical="top"
              />
              <Pressable style={[styles.primaryBtn, submitting && { opacity: 0.6 }]} onPress={submitTicket} disabled={submitting}>
                {submitting ? <ActivityIndicator color={colors.white} size="small" /> : <Text style={styles.primaryBtnTxt}>{t('submitTicket')}</Text>}
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ── Main ProfileScreen ────────────────────────────────────────────────────────
export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { t, lang } = useLanguage();
  const { user, profile, creditBalance, toast, refreshProfile } = useAppContext();
  const [activeTab, setActiveTab] = useState<ProfileTab>('overview');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [showReferral, setShowReferral] = useState(false);

  const handleAvatarChange = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (!result.canceled && result.assets[0] && user) {
      setUploadingAvatar(true);
      const uri = result.assets[0].uri;
      const ext = uri.split('.').pop() ?? 'jpg';
      const { data, error } = await profiles.uploadAvatar(user.id, uri, ext);
      if (error) { toast(error, 'error'); setUploadingAvatar(false); return; }
      if (data) {
        await profiles.update(user.id, { avatar_url: data });
        await refreshProfile();
      }
      setUploadingAvatar(false);
      toast('Avatar updated!', 'success');
    }
  };

  const handleSignOut = () => {
    Alert.alert(t('signOut'), 'Are you sure you want to sign out?', [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('signOut'), style: 'destructive',
        onPress: async () => { await auth.signOut(); },
      },
    ]);
  };

  const tabs: { key: ProfileTab; label: string }[] = [
    { key: 'overview', label: t('overview') },
    { key: 'edit', label: t('editProfile') },
    { key: 'ratings', label: t('ratings') },
    { key: 'verification', label: t('verification') },
    { key: 'support', label: t('support') },
  ];

  const vs = profile?.verification_status;
  const verBadge = vs === 'verified'
    ? { label: t('verified'), color: colors.ok, bg: colors.okSoft }
    : vs === 'pending'
    ? { label: 'Pending', color: colors.warn, bg: colors.warnSoft }
    : null;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.profileHeader}>
        {/* Avatar */}
        <Pressable onPress={handleAvatarChange} style={styles.avatarWrap} disabled={uploadingAvatar}>
          <Avatar url={profile?.avatar_url} name={profile?.full_name} size={72} />
          <View style={styles.avatarEditIcon}>
            {uploadingAvatar
              ? <ActivityIndicator size="small" color={colors.white} />
              : <Ionicons name="camera" size={14} color={colors.white} />
            }
          </View>
        </Pressable>

        <View style={styles.profileMeta}>
          <Text style={styles.profileName}>{profile?.full_name ?? 'Loading...'}</Text>
          <Text style={styles.profileCity}>{profile?.city ?? ''}</Text>
          <View style={styles.profileStats}>
            <Stars value={profile?.rating_as_worker ?? 0} size={14} />
            <Text style={styles.profileRatingTxt}>{(profile?.rating_as_worker ?? 0).toFixed(1)}</Text>
          </View>
          {verBadge && <Badge label={verBadge.label} color={verBadge.color} bg={verBadge.bg} />}
        </View>

        {/* Actions */}
        <View style={styles.headerActions}>
          <Pressable
            style={styles.actionBtn}
            onPress={async () => {
              await setLang(lang === 'en' ? 'sr' : 'en');
            }}
          >
            <Ionicons name="language-outline" size={18} color={colors.brand} />
          </Pressable>
          <Pressable style={styles.actionBtn} onPress={handleSignOut}>
            <Ionicons name="log-out-outline" size={18} color={colors.err} />
          </Pressable>
        </View>
      </View>

      {/* Quick actions row */}
      <View style={styles.quickActions}>
        <Pressable style={styles.quickBtn} onPress={() => router.push('/credits' as never)}>
          <Ionicons name="wallet-outline" size={18} color={colors.brand} />
          <Text style={styles.quickBtnTxt}>{t('creditsAndBilling')}</Text>
          <Text style={styles.quickBtnSub}>{creditBalance} credits</Text>
        </Pressable>
        <Pressable style={styles.quickBtn} onPress={() => setShowReferral(true)}>
          <Ionicons name="people-outline" size={18} color={colors.brand} />
          <Text style={styles.quickBtnTxt}>{t('referFriend')}</Text>
        </Pressable>
      </View>

      {/* Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsRow}
        contentContainerStyle={styles.tabsRowContent}
      >
        {tabs.map(tab => (
          <Pressable
            key={tab.key}
            style={[styles.tabChip, activeTab === tab.key && styles.tabChipActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[styles.tabChipTxt, activeTab === tab.key && styles.tabChipTxtActive]}>{tab.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Tab content */}
      <View style={{ flex: 1 }}>
        {activeTab === 'overview' && <OverviewTab />}
        {activeTab === 'edit' && <EditTab />}
        {activeTab === 'ratings' && <RatingsTab />}
        {activeTab === 'verification' && <VerificationTab />}
        {activeTab === 'support' && <SupportTab />}
      </View>

      {/* Referral bottom sheet */}
      <Modal visible={showReferral} animationType="slide" presentationStyle="pageSheet" transparent>
        <View style={styles.referralOverlay}>
          <View style={[styles.referralSheet, { paddingBottom: insets.bottom + spacing[4] }]}>
            <View style={styles.sheetHandleRow}>
              <View style={styles.sheetHandle} />
            </View>
            <Text style={styles.referralTitle}>{t('referFriend')}</Text>
            <Text style={styles.referralSub}>Share your code and earn credits when friends join!</Text>
            {profile?.referral_code && (
              <View style={styles.referralCodeBox}>
                <Text style={styles.referralCode}>{profile.referral_code}</Text>
              </View>
            )}
            <Pressable style={styles.primaryBtn} onPress={() => setShowReferral(false)}>
              <Text style={styles.primaryBtnTxt}>{t('close')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  profileHeader: {
    backgroundColor: colors.white,
    padding: spacing[4],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  avatarWrap: { position: 'relative' },
  avatarEditIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.white,
  },
  profileMeta: { flex: 1, gap: 4 },
  profileName: { fontSize: fontSize.md, fontWeight: '800', color: colors.tx },
  profileCity: { fontSize: fontSize.sm, color: colors.tx2 },
  profileStats: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  profileRatingTxt: { fontSize: fontSize.sm, fontWeight: '600', color: colors.tx2 },
  headerActions: { flexDirection: 'column', gap: spacing[2] },
  actionBtn: {
    width: 36, height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActions: {
    flexDirection: 'row',
    padding: spacing[3],
    gap: spacing[3],
  },
  quickBtn: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing[3],
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.sm,
  },
  quickBtnTxt: { fontSize: fontSize.xs, fontWeight: '700', color: colors.tx, textAlign: 'center' },
  quickBtnSub: { fontSize: fontSize.xs, color: colors.brand, fontWeight: '600' },
  tabsRow: { maxHeight: 48, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border },
  tabsRowContent: { paddingHorizontal: spacing[4], gap: spacing[2], alignItems: 'center' },
  tabChip: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: radius.full,
    backgroundColor: 'transparent',
  },
  tabChipActive: { backgroundColor: colors.brandSoft },
  tabChipTxt: { fontSize: fontSize.sm, fontWeight: '600', color: colors.tx2 },
  tabChipTxtActive: { color: colors.brand },
  tabContent: { padding: spacing[4], gap: spacing[4], paddingBottom: 100 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] },
  statBox: {
    flex: 1,
    minWidth: '44%',
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing[4],
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.sm,
  },
  statValue: { fontSize: fontSize.xl, fontWeight: '800', color: colors.tx },
  statLabel: { fontSize: fontSize.xs, color: colors.tx2, textAlign: 'center' },
  bioBox: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing[4],
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing[2],
  },
  bioLabel: { fontSize: fontSize.sm, fontWeight: '700', color: colors.tx2 },
  bioText: { fontSize: fontSize.base, color: colors.tx, lineHeight: 22 },
  fieldLabel: { fontSize: fontSize.sm, fontWeight: '600', color: colors.tx2, marginBottom: spacing[2] },
  optional: { color: colors.tx3, fontWeight: '400' },
  input: {
    backgroundColor: colors.bg,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    fontSize: fontSize.base,
    color: colors.tx,
    marginBottom: spacing[4],
  },
  textarea: { minHeight: 90, textAlignVertical: 'top' },
  primaryBtn: {
    backgroundColor: colors.brand,
    borderRadius: radius.md,
    paddingVertical: spacing[4],
    alignItems: 'center',
  },
  primaryBtnTxt: { color: colors.white, fontSize: fontSize.base, fontWeight: '800' },
  secondaryBtn: {
    backgroundColor: colors.brandSoft,
    borderRadius: radius.md,
    paddingVertical: spacing[3],
    alignItems: 'center',
  },
  secondaryBtnTxt: { color: colors.brand, fontSize: fontSize.base, fontWeight: '700' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyTxt: { textAlign: 'center', color: colors.tx2, padding: spacing[6] },
  subTabs: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  subTabBtn: {
    flex: 1,
    paddingVertical: spacing[3],
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  subTabBtnActive: { borderBottomColor: colors.brand },
  subTabTxt: { fontSize: fontSize.sm, fontWeight: '600', color: colors.tx2 },
  subTabTxtActive: { color: colors.brand },
  ratingCard: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing[4],
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing[3],
    ...shadow.sm,
  },
  ratingCardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  raterName: { fontSize: fontSize.base, fontWeight: '700', color: colors.tx },
  ratingDate: { fontSize: fontSize.xs, color: colors.tx3 },
  ratingComment: { fontSize: fontSize.sm, color: colors.tx, lineHeight: 20 },
  verifSection: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing[4],
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing[3],
  },
  verifSectionTitle: { fontSize: fontSize.sm, fontWeight: '800', color: colors.tx2, textTransform: 'uppercase', letterSpacing: 0.5 },
  verifRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  verifValue: { flex: 1, fontSize: fontSize.base, color: colors.tx },
  verifStatusBox: { borderRadius: radius.md, padding: spacing[3], flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2] },
  verifStatusTxt: { fontSize: fontSize.base, fontWeight: '600', flex: 1 },
  verifDesc: { fontSize: fontSize.sm, color: colors.tx2, lineHeight: 20 },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    backgroundColor: colors.brandSoft,
    borderRadius: radius.md,
    padding: spacing[3],
    marginBottom: spacing[3],
  },
  uploadBtnTxt: { flex: 1, fontSize: fontSize.sm, fontWeight: '700', color: colors.brand },
  securityNote: { fontSize: fontSize.xs, color: colors.tx3, lineHeight: 18 },
  badge: { borderRadius: radius.full, paddingHorizontal: spacing[3], paddingVertical: 4, alignSelf: 'flex-start' },
  badgeTxt: { fontSize: fontSize.xs, fontWeight: '700' },
  supportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing[4],
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  supportTitle: { fontSize: fontSize.lg, fontWeight: '800', color: colors.tx },
  newTicketBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    backgroundColor: colors.brand,
    borderRadius: radius.sm,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  newTicketBtnTxt: { color: colors.white, fontSize: fontSize.sm, fontWeight: '700' },
  ticketCard: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing[4],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.sm,
  },
  ticketSubject: { fontSize: fontSize.base, fontWeight: '700', color: colors.tx },
  ticketDate: { fontSize: fontSize.xs, color: colors.tx3 },
  ticketHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing[4],
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing[2],
  },
  ticketHeaderTitle: { flex: 1, fontSize: fontSize.base, fontWeight: '700', color: colors.tx },
  backBtn2: { padding: 4 },
  msgBubble: {
    maxWidth: '78%',
    borderRadius: radius.md,
    padding: spacing[3],
    marginBottom: 4,
  },
  msgBubbleMe: { backgroundColor: colors.brand },
  msgBubbleAdmin: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  adminLabel: { fontSize: fontSize.xs, fontWeight: '700', color: colors.brand, marginBottom: 2 },
  msgBubbleTxt2: { fontSize: fontSize.sm, color: colors.tx },
  replyBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: spacing[3],
    gap: spacing[2],
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  replyInput: {
    flex: 1,
    backgroundColor: colors.bg,
    borderRadius: radius.full,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    fontSize: fontSize.base,
    color: colors.tx,
    borderWidth: 1.5,
    borderColor: colors.border,
    maxHeight: 80,
  },
  sendBtn2: {
    width: 40, height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newTicketModal: { flex: 1, backgroundColor: colors.white },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: { fontSize: fontSize.lg, fontWeight: '800', color: colors.tx },
  referralOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  referralSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing[5],
    gap: spacing[4],
  },
  sheetHandleRow: { alignItems: 'center' },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border },
  referralTitle: { fontSize: fontSize.xl, fontWeight: '800', color: colors.tx },
  referralSub: { fontSize: fontSize.base, color: colors.tx2, lineHeight: 22 },
  referralCodeBox: {
    backgroundColor: colors.brandSoft,
    borderRadius: radius.md,
    padding: spacing[4],
    alignItems: 'center',
  },
  referralCode: { fontSize: fontSize['2xl'], fontWeight: '800', color: colors.brand, letterSpacing: 3 },
});
