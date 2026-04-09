// ============================================================
// HANDO - TypeScript Types
// ============================================================

export type UserRole = 'worker' | 'poster' | 'both';
export type JobStatus = 'open' | 'in_progress' | 'completed' | 'cancelled' | 'disputed';
export type ApplicationStatus = 'pending' | 'accepted' | 'rejected' | 'withdrawn';
export type TransactionType = 'purchase' | 'post_job' | 'apply_job' | 'refund' | 'bonus';
export type DisputeStatus = 'open' | 'under_review' | 'resolved' | 'closed';
export type VerificationStatus = 'unverified' | 'pending' | 'verified' | 'rejected';
export type NotificationType =
  | 'job_nearby'
  | 'application_accepted'
  | 'application_rejected'
  | 'job_completed'
  | 'new_rating'
  | 'dispute_update'
  | 'credit_low';

export interface Profile {
  id: string;
  email: string;
  phone?: string;
  full_name: string;
  avatar_url?: string;
  city?: string;
  bio?: string;
  role: UserRole;
  credits: number;
  rating_as_worker: number;
  rating_as_poster: number;
  total_ratings_worker: number;
  total_ratings_poster: number;
  completed_jobs_worker: number;
  completed_jobs_poster: number;
  verification_status: VerificationStatus;
  is_phone_verified: boolean;
  is_email_verified: boolean;
  is_admin: boolean;
  location?: { lat: number; lng: number };
  referral_code?: string;
  verification_rejection_reason?: string;
  created_at: string;
  updated_at: string;
}

export interface SupportTicket {
  id: string;
  user_id: string;
  subject: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  created_at: string;
  updated_at: string;
  user?: { full_name: string; email: string; avatar_url?: string };
  last_message?: string;
}

export interface SupportMessage {
  id: string;
  ticket_id: string;
  sender_id: string;
  message: string;
  is_admin: boolean;
  created_at: string;
}

export interface Referral {
  id: string;
  referrer_id: string;
  referred_user_id: string;
  status: 'pending' | 'completed';
  created_at: string;
  referred_user?: { full_name: string; avatar_url?: string };
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
}

export interface Job {
  id: string;
  poster_id: string;
  title: string;
  description: string;
  category_id: string;
  category?: Category;
  address: string;
  city: string;
  location: { lat: number; lng: number };
  scheduled_date: string;
  duration_hours: number;
  pay_per_worker: number;
  crew_size: number;
  accepted_workers: number;
  status: JobStatus;
  credits_spent: number;
  created_at: string;
  updated_at: string;
  poster?: Profile;
  distance_km?: number;
  spots_remaining?: number;
}

export interface Application {
  id: string;
  job_id: string;
  worker_id: string;
  status: ApplicationStatus;
  message?: string;
  credits_spent: number;
  created_at: string;
  updated_at: string;
  job?: Job;
  worker?: Profile;
}

export interface CreditTransaction {
  id: string;
  user_id: string;
  amount: number;
  type: TransactionType;
  description: string;
  reference_id?: string;
  balance_after: number;
  created_at: string;
}

export interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  price_rsd: number;
  is_active: boolean;
}

export interface Rating {
  id: string;
  job_id: string;
  rater_id: string;
  ratee_id: string;
  score: number;
  comment?: string;
  rater_role: 'worker' | 'poster';
  created_at: string;
  rater?: Profile;
}

export interface Dispute {
  id: string;
  job_id: string;
  reporter_id: string;
  reported_id: string;
  reason: string;
  description: string;
  evidence_urls?: string[];
  status: DisputeStatus;
  resolution?: string;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
}

// API Response types
export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  per_page: number;
  has_more: boolean;
}

// Form types
export interface CreateJobForm {
  title: string;
  description: string;
  category_id: string;
  address: string;
  city: string;
  lat: number;
  lng: number;
  scheduled_date: string;
  duration_hours: number;
  pay_per_worker: number;
  crew_size: number;
}

export interface ApplyJobForm {
  job_id: string;
  message?: string;
}

export interface RatingForm {
  job_id: string;
  ratee_id: string;
  score: number;
  comment?: string;
  rater_role: 'worker' | 'poster';
}

export interface DisputeForm {
  job_id: string;
  reported_id: string;
  reason: string;
  description: string;
  evidence_urls?: string[];
}
