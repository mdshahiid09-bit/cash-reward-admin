import { supabase } from './supabase'

export async function logAdminAction(params: {
  adminId?: string
  adminEmail?: string
  action: string
  entityType: string
  entityId?: string
  beforeVal?: Record<string, unknown> | null
  afterVal?: Record<string, unknown> | null
}) {
  try {
    await supabase.from('audit_log').insert({
      admin_id: params.adminId || null,
      admin_email: params.adminEmail || 'admin@cashreward.app',
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId || null,
      before_val: params.beforeVal || null,
      after_val: params.afterVal || null,
      created_at: new Date().toISOString()
    })
  } catch (err) {
    console.error('Audit log error:', err)
  }
}
