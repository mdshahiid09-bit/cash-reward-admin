export interface Admin {
  id: string
  auth_user_id: string
  email: string
  created_at: string
}

export interface AuditLog {
  id: string
  admin_id?: string
  admin_email?: string
  action: string
  entity_type: string
  entity_id?: string
  before_val?: Record<string, unknown> | null
  after_val?: Record<string, unknown> | null
  ip_address?: string
  created_at: string
}

export interface Profile {
  id: string
  google_id?: string
  display_name: string
  avatar_url?: string
  accent_color?: string
  theme?: string
  referral_code: string
  referred_by?: string
  total_earned: number
  balance: number
  blocked: boolean
  is_demo?: boolean
  show_on_leaderboard?: boolean
  admin_note?: string
  block_reason?: string
  reached_amount_at?: string
  created_at: string
  deleted_at?: string
}

export interface Task {
  id: string
  name: string
  title: string
  logo_url: string
  banner_url?: string
  play_store_url: string
  prize_inr: number
  demo_proof_url?: string
  proof_max_images: number
  category?: string
  category_id?: string
  featured: boolean
  published: boolean
  status?: 'draft' | 'published' | 'unpublished'
  scheduled_publish_at?: string
  scheduled_unpublish_at?: string
  internal_note?: string
  badge_hot?: boolean
  badge_exclusive?: boolean
  badge_new?: boolean
  badge_limited?: boolean
  created_at: string
}

export interface TaskStep {
  id: string
  task_id: string
  step_order: number
  title: string
  body: string
  image_url?: string
  min_payment_amount?: number
}

export interface TaskTerm {
  id: string
  task_id: string
  term_order: number
  title: string
  body: string
}

export interface Submission {
  id: string
  user_id: string
  task_id: string
  status: 'pending' | 'approved' | 'rejected'
  reject_reason?: string
  reviewed_by?: string
  review_note?: string
  reject_template_id?: string
  created_at: string
  decided_at?: string
  user?: Profile
  task?: Task
  images?: string[]
}

export interface PaymentMethod {
  id: string
  user_id: string
  type: 'upi' | 'bank' | 'redeem'
  fields: Record<string, string>
  created_at: string
}

export interface Withdrawal {
  id: string
  user_id: string
  amount: number
  method_id: string
  status: 'pending' | 'approved' | 'paid' | 'rejected'
  paid_reference?: string
  admin_note?: string
  reject_reason?: string
  created_at: string
  updated_at?: string
  user?: Profile
  method?: PaymentMethod
}

export interface Transaction {
  id: string
  user_id: string
  type: string
  amount: number
  note?: string
  created_at: string
  user?: Profile
}

export interface RedeemCode {
  id: string
  code: string
  description?: string
  amount?: number
  status: 'available' | 'assigned' | 'expired'
  assigned_user_id?: string
  expires_at?: string
  created_at: string
  assigned_user?: Profile
}

export interface Category {
  id: string
  name: string
  icon?: string
  sort_order: number
}

export interface CustomBadge {
  id: string
  name: string
  color: string
  icon?: string
  is_default: boolean
}

export interface RejectTemplate {
  id: string
  text: string
  category: string
}

export interface Banner {
  id: string
  image_url: string
  title?: string
  subtitle?: string
  button_text?: string
  link?: string
  link_type?: 'internal' | 'external'
  sort_order: number
  active: boolean
  start_at?: string
  end_at?: string
}

export interface Referral {
  id: string
  referrer_id: string
  referred_id: string
  level?: number
  status?: string
  reward_amount?: number
  reward_paid: boolean
  rewarded_at?: string
  created_at: string
  referrer?: Profile
  referee?: Profile
}

export interface Milestone {
  id: string
  referral_count: number
  bonus_amount: number
  sort_order: number
  active: boolean
}

export interface Broadcast {
  id: string
  title: string
  body: string
  link?: string
  scheduled_at?: string
  sent_at: string
  recipient_count: number
  created_at: string
}

export interface ContactMessage {
  id: string
  user_id?: string
  name?: string
  email?: string
  message: string
  status: 'unread' | 'read' | 'resolved'
  replied_at?: string
  created_at: string
}

export interface SiteSettings {
  site_name: string
  site_logo?: string
  site_tagline?: string
  maintenance_mode: boolean
  maintenance_message?: string
  expected_back_time?: string
  welcome_bonus: number
  referral_reward: number
  referral_reward_l2?: number
  referral_enabled: boolean
  max_referrals?: number
  withdraw_min: number
  withdraw_max: number
  proof_max_images: number
  contact_email?: string
  contact_whatsapp?: string
  contact_telegram?: string
  support_hours?: string
  contact_options?: {
    email: boolean
    whatsapp: boolean
    telegram: boolean
    form: boolean
  }
  payment_fields_config?: Record<string, { enabled: boolean; required: boolean }>
  email_settings?: {
    provider: 'resend' | 'smtp' | 'sendgrid' | 'none'
    configured: boolean
    sender_name?: string
    sender_email?: string
    api_key?: string
  }
}
