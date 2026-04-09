import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, Pressable,
  ActivityIndicator, KeyboardAvoidingView, Platform, Modal, FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useAppContext } from '../context/AppContext';
import { useLanguage } from '../i18n';
import { jobs, supabase } from '../lib/supabase';
import { colors, radius, spacing, fontSize } from '../theme';
import type { Category } from '../types';

interface Props {
  onClose: () => void;
  onPosted: () => void;
}

const DURATION_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8];

export default function PostJobScreen({ onClose, onPosted }: Props) {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const { user, creditBalance, toast, refreshCredits, refreshProfile } = useAppContext();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCat, setSelectedCat] = useState<Category | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [showCatPicker, setShowCatPicker] = useState(false);

  const [date, setDate] = useState<Date>(new Date(Date.now() + 86400000));
  const [startTime, setStartTime] = useState('09:00');
  const [duration, setDuration] = useState(2);
  const [showDurPicker, setShowDurPicker] = useState(false);

  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState(0);
  const [lng, setLng] = useState(0);
  const [locCaptured, setLocCaptured] = useState(false);
  const [locLoading, setLocLoading] = useState(false);

  const [payPerWorker, setPayPerWorker] = useState('');
  const [crewSize, setCrewSize] = useState(1);

  const [posting, setPosting] = useState(false);

  useEffect(() => {
    jobs.getCategories().then(({ data }) => { if (data) setCategories(data); });
  }, []);

  const useMyLocation = async () => {
    setLocLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { toast('Location permission denied.', 'error'); setLocLoading(false); return; }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setLat(loc.coords.latitude);
      setLng(loc.coords.longitude);
      setLocCaptured(true);

      const [geo] = await Location.reverseGeocodeAsync({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      if (geo) {
        if (!city) setCity(geo.city ?? geo.region ?? '');
        if (!address) setAddress([geo.street, geo.streetNumber].filter(Boolean).join(' '));
      }
    } catch (e) {
      toast('Could not get location.', 'error');
    }
    setLocLoading(false);
  };

  const totalPay = Number(payPerWorker || 0) * crewSize;

  const validate = () => {
    if (!title.trim()) { toast(t('enterJobTitle'), 'error'); return false; }
    if (!description.trim()) { toast(t('enterDescription'), 'error'); return false; }
    if (!selectedCat) { toast(t('selectCategoryErr'), 'error'); return false; }
    if (!city.trim()) { toast(t('enterCity'), 'error'); return false; }
    if (!address.trim()) { toast(t('enterAddress'), 'error'); return false; }
    if (!payPerWorker || Number(payPerWorker) <= 0) { toast(t('enterPayPerWorker'), 'error'); return false; }
    return true;
  };

  const handlePost = async () => {
    if (!user) return;
    if (creditBalance < 10) { toast(t('insufficientCr'), 'error'); return; }
    if (!validate()) return;

    setPosting(true);

    const scheduledDate = new Date(date);
    const [h, m] = startTime.split(':').map(Number);
    scheduledDate.setHours(h, m, 0, 0);

    const jobData: Record<string, unknown> = {
      poster_id: user.id,
      title: title.trim(),
      description: description.trim(),
      category_id: selectedCat!.id,
      address: address.trim(),
      city: city.trim(),
      scheduled_date: scheduledDate.toISOString(),
      duration_hours: duration,
      pay_per_worker: Number(payPerWorker),
      crew_size: crewSize,
      status: 'open',
      accepted_workers: 0,
      credits_spent: 10,
    };

    if (lat && lng) {
      jobData.lat = lat;
      jobData.lng = lng;
    }

    const { error: jobError } = await jobs.create(jobData);

    if (jobError) {
      toast(jobError, 'error');
      setPosting(false);
      return;
    }

    // Deduct 10 credits
    await supabase.rpc('deduct_credits', { user_id: user.id, amount: 10 }).catch(() => {});
    await refreshCredits();
    await refreshProfile();

    toast(t('jobPostedOk'), 'success');
    setPosting(false);
    onPosted();
  };

  const [dateText, setDateText] = useState(
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  );

  const handleDateChange = (text: string) => {
    setDateText(text);
    const parsed = new Date(text);
    if (!isNaN(parsed.getTime())) setDate(parsed);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.root, { paddingTop: insets.top }]}>
        {/* Navbar */}
        <View style={styles.nav}>
          <Pressable onPress={onClose} style={styles.navBtn}>
            <Ionicons name="close" size={24} color={colors.tx} />
          </Pressable>
          <Text style={styles.navTitle}>{t('postAJob')}</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionHeader}>{t('jobDetails')}</Text>

          {/* Title */}
          <Text style={styles.label}>{t('jobTitle')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('jobTitlePh')}
            placeholderTextColor={colors.tx3}
            value={title}
            onChangeText={setTitle}
          />

          {/* Description */}
          <Text style={styles.label}>{t('description')}</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            placeholder={t('descriptionPh')}
            placeholderTextColor={colors.tx3}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />

          {/* Category */}
          <Text style={styles.label}>{t('category')}</Text>
          <Pressable style={styles.picker} onPress={() => setShowCatPicker(true)}>
            <Text style={selectedCat ? styles.pickerValue : styles.pickerPlaceholder}>
              {selectedCat ? `${selectedCat.icon} ${selectedCat.name}` : t('selectCategory')}
            </Text>
            <Ionicons name="chevron-down" size={18} color={colors.tx3} />
          </Pressable>

          <Text style={styles.sectionHeader}>{t('when')}</Text>

          {/* Date */}
          <Text style={styles.label}>{t('date')}</Text>
          <TextInput
            style={styles.input}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.tx3}
            value={dateText}
            onChangeText={handleDateChange}
            keyboardType="numbers-and-punctuation"
          />

          {/* Start time */}
          <Text style={styles.label}>{t('startTime')}</Text>
          <TextInput
            style={styles.input}
            placeholder="09:00"
            placeholderTextColor={colors.tx3}
            value={startTime}
            onChangeText={setStartTime}
            keyboardType="numbers-and-punctuation"
          />

          {/* Duration */}
          <Text style={styles.label}>{t('duration')}</Text>
          <Pressable style={styles.picker} onPress={() => setShowDurPicker(true)}>
            <Ionicons name="time-outline" size={18} color={colors.brand} />
            <Text style={styles.pickerValue}>{duration}h</Text>
            <Ionicons name="chevron-down" size={18} color={colors.tx3} />
          </Pressable>

          <Text style={styles.sectionHeader}>{t('location')}</Text>

          {/* City */}
          <Text style={styles.label}>{t('city')}</Text>
          <TextInput
            style={styles.input}
            placeholder="Beograd"
            placeholderTextColor={colors.tx3}
            value={city}
            onChangeText={setCity}
          />

          {/* Address */}
          <Text style={styles.label}>{t('streetArea')}</Text>
          <TextInput
            style={styles.input}
            placeholder="Knez Mihajlova 12"
            placeholderTextColor={colors.tx3}
            value={address}
            onChangeText={setAddress}
          />

          {/* Use my location */}
          <Pressable style={styles.locBtn} onPress={useMyLocation} disabled={locLoading}>
            {locLoading
              ? <ActivityIndicator size="small" color={colors.brand} />
              : <Ionicons name="locate-outline" size={16} color={colors.brand} />
            }
            <Text style={styles.locBtnTxt}>
              {locCaptured ? t('locationCaptured') : t('useMyLocation')}
            </Text>
          </Pressable>

          <Text style={styles.sectionHeader}>{t('payAndCrew')}</Text>

          {/* Pay */}
          <Text style={styles.label}>{t('payPerWorkerRsd')}</Text>
          <TextInput
            style={styles.input}
            placeholder="3000"
            placeholderTextColor={colors.tx3}
            value={payPerWorker}
            onChangeText={setPayPerWorker}
            keyboardType="numeric"
          />

          {/* Workers needed */}
          <Text style={styles.label}>{t('workersNeeded')}</Text>
          <View style={styles.stepper}>
            <Pressable
              style={[styles.stepBtn, crewSize <= 1 && styles.stepBtnDisabled]}
              onPress={() => setCrewSize(v => Math.max(1, v - 1))}
              disabled={crewSize <= 1}
            >
              <Ionicons name="remove" size={20} color={crewSize <= 1 ? colors.tx3 : colors.brand} />
            </Pressable>
            <Text style={styles.stepValue}>{crewSize}</Text>
            <Pressable
              style={[styles.stepBtn, crewSize >= 10 && styles.stepBtnDisabled]}
              onPress={() => setCrewSize(v => Math.min(10, v + 1))}
              disabled={crewSize >= 10}
            >
              <Ionicons name="add" size={20} color={crewSize >= 10 ? colors.tx3 : colors.brand} />
            </Pressable>
          </View>

          {/* Total payout */}
          {totalPay > 0 && (
            <View style={styles.totalBox}>
              <Text style={styles.totalLabel}>{t('totalPayout')}</Text>
              <Text style={styles.totalValue}>{totalPay.toLocaleString()} RSD</Text>
            </View>
          )}

          {/* Cost notice */}
          <View style={styles.costNotice}>
            <Ionicons name="information-circle-outline" size={16} color={colors.brand} />
            <Text style={styles.costTxt}>
              {t('postingCostsMsg').replace('{n}', '10').replace('{b}', String(creditBalance))}
            </Text>
          </View>

          <View style={{ height: spacing[8] }} />
        </ScrollView>

        {/* Footer */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing[2] }]}>
          <Pressable
            style={[styles.postBtn, (posting || creditBalance < 10) && styles.postBtnDisabled]}
            onPress={handlePost}
            disabled={posting || creditBalance < 10}
          >
            {posting
              ? <ActivityIndicator color={colors.white} size="small" />
              : <Text style={styles.postBtnTxt}>{t('postJobBtn')}</Text>
            }
          </Pressable>
        </View>

        {/* Category picker modal */}
        <Modal visible={showCatPicker} animationType="slide" presentationStyle="pageSheet" transparent>
          <Pressable style={styles.catOverlay} onPress={() => setShowCatPicker(false)}>
            <View style={[styles.catSheet, { paddingBottom: insets.bottom + spacing[4] }]}>
              <View style={styles.catSheetHandle}>
                <View style={styles.handle} />
              </View>
              <Text style={styles.catSheetTitle}>{t('selectCategory')}</Text>
              <FlatList
                data={categories}
                keyExtractor={c => c.id}
                renderItem={({ item }) => (
                  <Pressable
                    style={[styles.catOption, selectedCat?.id === item.id && styles.catOptionActive]}
                    onPress={() => { setSelectedCat(item); setShowCatPicker(false); }}
                  >
                    <Text style={styles.catOptionIcon}>{item.icon}</Text>
                    <Text style={[styles.catOptionName, selectedCat?.id === item.id && { color: colors.brand }]}>{item.name}</Text>
                    {selectedCat?.id === item.id && (
                      <Ionicons name="checkmark" size={18} color={colors.brand} />
                    )}
                  </Pressable>
                )}
              />
            </View>
          </Pressable>
        </Modal>

        {/* Duration picker modal */}
        <Modal visible={showDurPicker} animationType="slide" presentationStyle="pageSheet" transparent>
          <Pressable style={styles.catOverlay} onPress={() => setShowDurPicker(false)}>
            <View style={[styles.catSheet, { paddingBottom: insets.bottom + spacing[4] }]}>
              <View style={styles.catSheetHandle}>
                <View style={styles.handle} />
              </View>
              <Text style={styles.catSheetTitle}>{t('duration')}</Text>
              {DURATION_OPTIONS.map(h => (
                <Pressable
                  key={h}
                  style={[styles.catOption, duration === h && styles.catOptionActive]}
                  onPress={() => { setDuration(h); setShowDurPicker(false); }}
                >
                  <Text style={[styles.catOptionName, duration === h && { color: colors.brand }]}>{h} hour{h > 1 ? 's' : ''}</Text>
                  {duration === h && <Ionicons name="checkmark" size={18} color={colors.brand} />}
                </Pressable>
              ))}
            </View>
          </Pressable>
        </Modal>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  navBtn: { width: 40, alignItems: 'flex-start' },
  navTitle: { fontSize: fontSize.md, fontWeight: '800', color: colors.tx },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing[4] },
  sectionHeader: {
    fontSize: fontSize.sm,
    fontWeight: '800',
    color: colors.brand,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: spacing[5],
    marginBottom: spacing[3],
  },
  label: { fontSize: fontSize.sm, fontWeight: '600', color: colors.tx2, marginBottom: spacing[2] },
  input: {
    backgroundColor: colors.white,
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
  picker: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginBottom: spacing[4],
  },
  pickerValue: { flex: 1, fontSize: fontSize.base, color: colors.tx, fontWeight: '500' },
  pickerPlaceholder: { flex: 1, fontSize: fontSize.base, color: colors.tx3 },
  locBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    backgroundColor: colors.brandSoft,
    borderRadius: radius.md,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    marginBottom: spacing[4],
    alignSelf: 'flex-start',
  },
  locBtnTxt: { fontSize: fontSize.sm, fontWeight: '700', color: colors.brand },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
    marginBottom: spacing[4],
  },
  stepBtn: {
    width: 40, height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnDisabled: { opacity: 0.4 },
  stepValue: { fontSize: fontSize.xl, fontWeight: '800', color: colors.tx, minWidth: 32, textAlign: 'center' },
  totalBox: {
    backgroundColor: colors.brandSoft,
    borderRadius: radius.md,
    padding: spacing[4],
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[4],
  },
  totalLabel: { fontSize: fontSize.sm, fontWeight: '600', color: colors.brand },
  totalValue: { fontSize: fontSize.lg, fontWeight: '800', color: colors.brand },
  costNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    backgroundColor: colors.infoSoft,
    borderRadius: radius.md,
    padding: spacing[3],
    marginBottom: spacing[2],
  },
  costTxt: { fontSize: fontSize.sm, color: colors.info, flex: 1 },
  footer: {
    backgroundColor: colors.white,
    padding: spacing[4],
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  postBtn: {
    backgroundColor: colors.brand,
    borderRadius: radius.md,
    paddingVertical: spacing[4],
    alignItems: 'center',
  },
  postBtnDisabled: { opacity: 0.5 },
  postBtnTxt: { color: colors.white, fontSize: fontSize.base, fontWeight: '800' },
  catOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  catSheet: { backgroundColor: colors.white, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, maxHeight: '70%' },
  catSheetHandle: { alignItems: 'center', paddingTop: spacing[3], paddingBottom: spacing[2] },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border },
  catSheetTitle: { fontSize: fontSize.md, fontWeight: '800', color: colors.tx, paddingHorizontal: spacing[4], paddingBottom: spacing[3] },
  catOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  catOptionActive: { backgroundColor: colors.brandSoft },
  catOptionIcon: { fontSize: 22 },
  catOptionName: { flex: 1, fontSize: fontSize.base, color: colors.tx, fontWeight: '500' },
});
