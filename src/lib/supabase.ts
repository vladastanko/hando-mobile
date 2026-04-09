import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import type { ApiResponse, Job, Profile, Application, CreditTransaction, CreditPackage, Rating, Category } from '../types';

const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl as string;
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// ── Auth ─────────────────────────────────────────────────────────────────

export const auth = {
  signUp: async (email: string, password: string, fullName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    return { data, error };
  },
  signIn: async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    return { data, error };
  },
  signOut: async () => {
    const { error } = await supabase.auth.signOut();
    return { error };
  },
  getSession: async () => {
    const { data, error } = await supabase.auth.getSession();
    return { session: data.session, error };
  },
  onAuthChange: (callback: (event: string, session: import('@supabase/supabase-js').Session | null) => void) => {
    return supabase.auth.onAuthStateChange(callback);
  },
  resetPassword: async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    return { error };
  },
};

// ── Profiles ──────────────────────────────────────────────────────────────

export const profiles = {
  get: async (userId: string): Promise<ApiResponse<Profile>> => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    return { data, error: error?.message ?? null };
  },
  update: async (userId: string, updates: Partial<Profile>): Promise<ApiResponse<Profile>> => {
    const { data, error } = await supabase
      .from('profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .select()
      .single();
    return { data, error: error?.message ?? null };
  },
  uploadAvatar: async (userId: string, uri: string, ext: string): Promise<ApiResponse<string>> => {
    try {
      const path = `avatars/${userId}.${ext}`;
      const response = await fetch(uri);
      const blob = await response.blob();
      const { error } = await supabase.storage.from('user-media').upload(path, blob, { upsert: true, contentType: `image/${ext}` });
      if (error) return { data: null, error: error.message };
      const { data } = supabase.storage.from('user-media').getPublicUrl(path);
      return { data: data.publicUrl, error: null };
    } catch (err) {
      return { data: null, error: String(err) };
    }
  },
  submitVerification: async (userId: string, idFrontUri: string, idBackUri: string): Promise<ApiResponse<boolean>> => {
    try {
      const upload = async (uri: string, path: string) => {
        const response = await fetch(uri);
        const blob = await response.blob();
        const ext = uri.split('.').pop() ?? 'jpg';
        const { error } = await supabase.storage.from('user-media').upload(path, blob, { upsert: true, contentType: `image/${ext}` });
        if (error) throw error;
        const { data } = supabase.storage.from('user-media').getPublicUrl(path);
        return data.publicUrl;
      };
      const idUrl = await upload(idFrontUri, `verifications/${userId}/id_front.jpg`);
      const selfieUrl = await upload(idBackUri, `verifications/${userId}/id_back.jpg`);
      const { error } = await supabase.from('verifications').upsert({
        user_id: userId,
        id_document_url: idUrl,
        selfie_url: selfieUrl,
        submitted_at: new Date().toISOString(),
        status: 'pending',
      }, { onConflict: 'user_id' });
      if (error) return { data: null, error: error.message };
      await supabase.from('profiles').update({ verification_status: 'pending' }).eq('id', userId);
      return { data: true, error: null };
    } catch (err) {
      return { data: null, error: String(err) };
    }
  },
  updateLocation: async (userId: string, lat: number, lng: number) => {
    await supabase.rpc('update_user_location', { user_id: userId, lat, lng }).catch(() => {});
  },
};

// ── Jobs ──────────────────────────────────────────────────────────────────

export const jobs = {
  getAll: async (filters?: { status?: string; city?: string }): Promise<ApiResponse<Job[]>> => {
    let q = supabase
      .from('jobs')
      .select('*, poster:profiles!jobs_poster_id_fkey(id,full_name,avatar_url,rating_as_poster,verification_status,completed_jobs_poster), category:categories(id,name,icon,color)')
      .order('created_at', { ascending: false });
    if (filters?.status) q = q.eq('status', filters.status);
    if (filters?.city) q = q.ilike('city', `%${filters.city}%`);
    const { data, error } = await q;
    return { data: data as Job[], error: error?.message ?? null };
  },
  getNearby: async (lat: number, lng: number, radiusKm = 50): Promise<ApiResponse<Job[]>> => {
    const { data, error } = await supabase.rpc('get_jobs_nearby', { lat, lng, radius_km: radiusKm });
    if (error) return { data: null, error: error.message };
    const ids = (data as { id: string }[]).map(r => r.id);
    if (!ids.length) return { data: [], error: null };
    const { data: full, error: e2 } = await supabase
      .from('jobs')
      .select('*, poster:profiles!jobs_poster_id_fkey(id,full_name,avatar_url,rating_as_poster,verification_status,completed_jobs_poster), category:categories(id,name,icon,color)')
      .in('id', ids)
      .eq('status', 'open');
    return { data: full as Job[], error: e2?.message ?? null };
  },
  create: async (jobData: Record<string, unknown>): Promise<ApiResponse<Job>> => {
    const { data, error } = await supabase.from('jobs').insert(jobData).select().single();
    return { data, error: error?.message ?? null };
  },
  getCategories: async (): Promise<ApiResponse<Category[]>> => {
    const { data, error } = await supabase.from('categories').select('*').order('name');
    return { data, error: error?.message ?? null };
  },
  getMyPosted: async (userId: string): Promise<ApiResponse<Job[]>> => {
    const { data, error } = await supabase
      .from('jobs')
      .select('*, category:categories(id,name,icon,color)')
      .eq('poster_id', userId)
      .order('created_at', { ascending: false });
    return { data, error: error?.message ?? null };
  },
};

// ── Applications ──────────────────────────────────────────────────────────

export const applications = {
  getMyApplications: async (userId: string): Promise<ApiResponse<Application[]>> => {
    const { data, error } = await supabase
      .from('applications')
      .select('*, job:jobs(id,title,city,scheduled_date,pay_per_worker,status,poster_id,category:categories(icon,color))')
      .eq('worker_id', userId)
      .order('created_at', { ascending: false });
    return { data, error: error?.message ?? null };
  },
  getForJob: async (jobId: string): Promise<ApiResponse<Application[]>> => {
    const { data, error } = await supabase
      .from('applications')
      .select('*, worker:profiles!applications_worker_id_fkey(id,full_name,avatar_url,rating_as_worker,total_ratings_worker,completed_jobs_worker,bio,city,verification_status)')
      .eq('job_id', jobId)
      .order('created_at', { ascending: false });
    return { data, error: error?.message ?? null };
  },
  apply: async (jobId: string, workerId: string, message?: string): Promise<ApiResponse<Application>> => {
    const { data, error } = await supabase
      .from('applications')
      .insert({ job_id: jobId, worker_id: workerId, message, status: 'pending', credits_spent: 3 })
      .select()
      .single();
    if (!error) {
      await supabase.from('profiles').update({ credits: supabase.rpc('decrement', { x: 3 }) }).eq('id', workerId).catch(() => {});
      await supabase.rpc('deduct_credits', { user_id: workerId, amount: 3 }).catch(() => {});
    }
    return { data, error: error?.message ?? null };
  },
  accept: async (applicationId: string, jobId: string, workerId: string): Promise<ApiResponse<boolean>> => {
    const { error } = await supabase.rpc('accept_application', { p_application_id: applicationId, p_job_id: jobId, p_worker_id: workerId });
    return { data: !error, error: error?.message ?? null };
  },
  reject: async (applicationId: string): Promise<ApiResponse<boolean>> => {
    const { error } = await supabase.from('applications').update({ status: 'rejected' }).eq('id', applicationId);
    return { data: !error, error: error?.message ?? null };
  },
  withdraw: async (applicationId: string): Promise<ApiResponse<boolean>> => {
    const { error } = await supabase.from('applications').update({ status: 'withdrawn' }).eq('id', applicationId);
    return { data: !error, error: error?.message ?? null };
  },
  hasApplied: async (jobId: string, userId: string): Promise<boolean> => {
    const { data } = await supabase.from('applications').select('id').eq('job_id', jobId).eq('worker_id', userId).maybeSingle();
    return !!data;
  },
};

// ── Credits ───────────────────────────────────────────────────────────────

export const credits = {
  getBalance: async (userId: string): Promise<number> => {
    const { data } = await supabase.from('profiles').select('credits').eq('id', userId).single();
    return (data as { credits: number } | null)?.credits ?? 0;
  },
  getTransactions: async (userId: string): Promise<ApiResponse<CreditTransaction[]>> => {
    const { data, error } = await supabase
      .from('credit_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);
    return { data, error: error?.message ?? null };
  },
  getPackages: async (): Promise<ApiResponse<CreditPackage[]>> => {
    const { data, error } = await supabase.from('credit_packages').select('*').eq('is_active', true).order('credits');
    return { data, error: error?.message ?? null };
  },
  createOrder: async (userId: string, packageId: string, credits: number, amountRsd: number, email: string): Promise<ApiResponse<{ reference: string }>> => {
    const reference = `HANDO-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const { error } = await supabase.from('credit_orders').insert({
      user_id: userId, package_id: packageId, credits, amount_rsd: amountRsd, reference, email, status: 'pending',
    });
    return { data: error ? null : { reference }, error: error?.message ?? null };
  },
  getOrders: async (userId: string) => {
    const { data, error } = await supabase
      .from('credit_orders')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    return { data, error: error?.message ?? null };
  },
};

// ── Ratings ───────────────────────────────────────────────────────────────

export const ratings = {
  getForUser: async (userId: string): Promise<ApiResponse<Rating[]>> => {
    const { data, error } = await supabase
      .from('ratings')
      .select('*, rater:profiles!ratings_rater_id_fkey(id,full_name,avatar_url)')
      .eq('ratee_id', userId)
      .order('created_at', { ascending: false });
    return { data, error: error?.message ?? null };
  },
  getByRater: async (userId: string): Promise<ApiResponse<Rating[]>> => {
    const { data, error } = await supabase
      .from('ratings')
      .select('*, rater:profiles!ratings_rater_id_fkey(id,full_name,avatar_url)')
      .eq('rater_id', userId)
      .order('created_at', { ascending: false });
    return { data, error: error?.message ?? null };
  },
  submit: async (jobId: string, raterId: string, rateeId: string, score: number, comment: string, raterRole: 'worker' | 'poster'): Promise<ApiResponse<boolean>> => {
    const { error } = await supabase.from('ratings').insert({ job_id: jobId, rater_id: raterId, ratee_id: rateeId, score, comment, rater_role: raterRole });
    if (!error) await supabase.rpc('refresh_rating_stats', { p_user_id: rateeId, p_role: raterRole }).catch(() => {});
    return { data: !error, error: error?.message ?? null };
  },
  hasRated: async (jobId: string, raterId: string, raterRole: 'worker' | 'poster'): Promise<boolean> => {
    const { data } = await supabase.from('ratings').select('id').eq('job_id', jobId).eq('rater_id', raterId).eq('rater_role', raterRole).maybeSingle();
    return !!data;
  },
};

// ── Referrals ─────────────────────────────────────────────────────────────

export const referrals = {
  get: async (userId: string) => {
    const { data, error } = await supabase
      .from('referrals')
      .select('id, status, created_at, referred_user:profiles!referred_user_id(full_name, avatar_url)')
      .eq('referrer_id', userId)
      .order('created_at', { ascending: false });
    return { data, error: error?.message ?? null };
  },
  recordReferral: async (referralCode: string, newUserId: string) => {
    const { data: referrer } = await supabase.from('profiles').select('id').eq('referral_code', referralCode).single();
    if (!referrer) return;
    await supabase.from('referrals').insert({ referrer_id: referrer.id, referred_user_id: newUserId, status: 'pending' }).catch(() => {});
  },
};

// ── Notifications ─────────────────────────────────────────────────────────

export const notificationsApi = {
  getAll: async (userId: string) => {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);
    return { data, error: error?.message ?? null };
  },
  markRead: async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
  },
  markAllRead: async (userId: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', userId);
  },
  getUnreadCount: async (userId: string): Promise<number> => {
    const { count } = await supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('is_read', false);
    return count ?? 0;
  },
};
