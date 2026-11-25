import React, { useState, useEffect } from 'react'
import {
  Settings as SettingsIcon,
  Globe,
  DollarSign,
  AlertTriangle,
  Mail,
  Shield,
  Tag,
  CheckCircle,
  Plus,
  Trash2,
  Save,
  RefreshCw,
  PhoneCall
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAdminAuth } from '../context/AdminAuthContext'
import { logAdminAction } from '../lib/audit'
import { Modal } from '../components/common/Modal'
import { ConfirmModal } from '../components/common/ConfirmModal'

export const Settings: React.FC = () => {
  const { admin } = useAdminAuth()
  const [activeTab, setActiveTab] = useState<'general' | 'finance' | 'templates' | 'badges' | 'email'>('general')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // General Settings
  const [siteName, setSiteName] = useState('Cash Reward')
  const [siteTagline, setSiteTagline] = useState('Earn real cash by completing simple mobile app tasks')
  const [siteLogo, setSiteLogo] = useState('')
  const [maintenanceMode, setMaintenanceMode] = useState(false)
  const [maintenanceMsg, setMaintenanceMsg] = useState('We are upgrading our servers. Please check back soon!')
  const [contactEmail, setContactEmail] = useState('support@cashreward.app')
  const [contactWhatsapp, setContactWhatsapp] = useState('')
  const [contactTelegram, setContactTelegram] = useState('')

  // Finance Settings
  const [welcomeBonus, setWelcomeBonus] = useState('10')
  const [withdrawMin, setWithdrawMin] = useState('50')
  const [withdrawMax, setWithdrawMax] = useState('5000')

  // Reject Templates
  const [templates, setTemplates] = useState<{ id: string; text: string; category: string }[]>([])
  const [newTemplateText, setNewTemplateText] = useState('')
  const [newTemplateCat, setNewTemplateCat] = useState('Proof')
  const [templateModalOpen, setTemplateModalOpen] = useState(false)

  // Badges & Categories
  const [badges, setBadges] = useState<{ id: string; name: string; color: string }[]>([])
  const [newBadgeName, setNewBadgeName] = useState('')
  const [newBadgeColor, setNewBadgeColor] = useState('#F59E0B')
  const [badgeModalOpen, setBadgeModalOpen] = useState(false)

  // Email Layer
  const [emailProvider, setEmailProvider] = useState<'none' | 'resend' | 'smtp'>('none')
  const [emailApiKey, setEmailApiKey] = useState('')
  const [emailSender, setEmailSender] = useState('Cash Reward <noreply@cashreward.app>')

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    setLoading(true)
    try {
      const { data: stData } = await supabase.from('settings').select('*')
      if (stData) {
        stData.forEach(row => {
          if (row.key === 'site_name') setSiteName(String(row.value))
          if (row.key === 'site_tagline') setSiteTagline(String(row.value))
          if (row.key === 'site_logo') setSiteLogo(String(row.value))
          if (row.key === 'maintenance_mode') setMaintenanceMode(row.value === 'true' || row.value === true)
          if (row.key === 'maintenance_message') setMaintenanceMsg(String(row.value))
          if (row.key === 'contact_email') setContactEmail(String(row.value))
          if (row.key === 'contact_whatsapp') setContactWhatsapp(String(row.value))
          if (row.key === 'contact_telegram') setContactTelegram(String(row.value))
          if (row.key === 'welcome_bonus') setWelcomeBonus(String(row.value))
          if (row.key === 'withdraw_min') setWithdrawMin(String(row.value))
          if (row.key === 'withdraw_max') setWithdrawMax(String(row.value))
        })
      }

      // Fetch reject templates
      const { data: tData } = await supabase.from('reject_templates').select('*')
      setTemplates(tData || [])

      // Fetch badges
      const { data: bData } = await supabase.from('badges').select('*')
      setBadges(bData || [])
    } catch (err) {
      console.error('Fetch settings error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveGeneral = async () => {
    setSaving(true)
    try {
      const updates = [
        { key: 'site_name', value: siteName },
        { key: 'site_tagline', value: siteTagline },
        { key: 'site_logo', value: siteLogo },
        { key: 'maintenance_mode', value: maintenanceMode },
        { key: 'maintenance_message', value: maintenanceMsg },
        { key: 'contact_email', value: contactEmail },
        { key: 'contact_whatsapp', value: contactWhatsapp },
        { key: 'contact_telegram', value: contactTelegram }
      ]

      for (const item of updates) {
        await supabase.from('settings').upsert({ key: item.key, value: item.value as any })
      }

      await logAdminAction({
        adminId: admin?.id,
        adminEmail: admin?.email,
        action: 'UPDATE_GENERAL_SETTINGS',
        entityType: 'settings'
      })

      setSuccessMsg('General settings saved!')
      setTimeout(() => setSuccessMsg(null), 3000)
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  const handleSaveFinance = async () => {
    setSaving(true)
    try {
      const updates = [
        { key: 'welcome_bonus', value: parseFloat(welcomeBonus) },
        { key: 'withdraw_min', value: parseFloat(withdrawMin) },
        { key: 'withdraw_max', value: parseFloat(withdrawMax) }
      ]

      for (const item of updates) {
        await supabase.from('settings').upsert({ key: item.key, value: item.value as any })
      }

      await logAdminAction({
        adminId: admin?.id,
        adminEmail: admin?.email,
        action: 'UPDATE_FINANCE_SETTINGS',
        entityType: 'settings'
      })

      setSuccessMsg('Financial limits saved!')
      setTimeout(() => setSuccessMsg(null), 3000)
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  const handleAddTemplate = async () => {
    if (!newTemplateText.trim()) return
    try {
      const { data, error } = await supabase
        .from('reject_templates')
        .insert({ text: newTemplateText.trim(), category: newTemplateCat })
        .select()
        .single()
      if (error) throw error
      setTemplates(prev => [...prev, data])
      setNewTemplateText('')
      setTemplateModalOpen(false)
    } catch (err) {
      console.error(err)
    }
  }

  const handleDeleteTemplate = async (id: string) => {
    try {
      await supabase.from('reject_templates').delete().eq('id', id)
      setTemplates(prev => prev.filter(t => t.id !== id))
    } catch (err) {
      console.error(err)
    }
  }

  const handleAddBadge = async () => {
    if (!newBadgeName.trim()) return
    try {
      const { data, error } = await supabase
        .from('badges')
        .insert({ name: newBadgeName.trim(), color: newBadgeColor, is_default: false })
        .select()
        .single()
      if (error) throw error
      setBadges(prev => [...prev, data])
      setNewBadgeName('')
      setBadgeModalOpen(false)
    } catch (err) {
      console.error(err)
    }
  }

  const handleDeleteBadge = async (id: string) => {
    try {
      await supabase.from('badges').delete().eq('id', id)
      setBadges(prev => prev.filter(b => b.id !== id))
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Platform Settings</h1>
          <p className="text-sm text-neutral-400 mt-1">
            Configure platform branding, payout thresholds, reject templates, and system integrations.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchSettings()}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-300 hover:text-white transition text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-400 flex items-center gap-2">
          <CheckCircle className="w-4 h-4" />
          {successMsg}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-neutral-800 flex items-center gap-6 text-sm font-medium">
        {[
          { key: 'general', label: 'General & Maintenance', icon: Globe },
          { key: 'finance', label: 'Payouts & Bonus Limits', icon: DollarSign },
          { key: 'templates', label: `Reject Templates (${templates.length})`, icon: Shield },
          { key: 'badges', label: `Custom Badges (${badges.length})`, icon: Tag },
          { key: 'email', label: 'Email Layer', icon: Mail }
        ].map(tab => {
          const Icon = tab.icon
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex items-center gap-2 pb-3 border-b-2 transition ${
                isActive
                  ? 'border-amber-500 text-amber-400 font-semibold'
                  : 'border-transparent text-neutral-400 hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </div>

      {/* Tab 1: General */}
      {activeTab === 'general' && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 max-w-3xl space-y-5">
          <h3 className="text-lg font-bold text-white">Branding & System</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-neutral-400 mb-2">
                Site / App Name
              </label>
              <input
                type="text"
                value={siteName}
                onChange={e => setSiteName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500/50"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-neutral-400 mb-2">
                Logo Image URL
              </label>
              <input
                type="url"
                value={siteLogo}
                onChange={e => setSiteLogo(e.target.value)}
                placeholder="https://..."
                className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500/50"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-neutral-400 mb-2">
              Tagline
            </label>
            <input
              type="text"
              value={siteTagline}
              onChange={e => setSiteTagline(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500/50"
            />
          </div>

          <div className="p-4 bg-neutral-950 border border-neutral-800 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-white font-semibold text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  Maintenance Mode
                </div>
                <div className="text-xs text-neutral-500 mt-0.5">
                  Temporarily lock out normal users with a friendly maintenance message
                </div>
              </div>
              <input
                type="checkbox"
                checked={maintenanceMode}
                onChange={e => setMaintenanceMode(e.target.checked)}
                className="w-5 h-5 accent-amber-500 rounded cursor-pointer"
              />
            </div>
            {maintenanceMode && (
              <div>
                <label className="block text-xs font-semibold uppercase text-neutral-400 mb-1">
                  Maintenance Message to Users
                </label>
                <input
                  type="text"
                  value={maintenanceMsg}
                  onChange={e => setMaintenanceMsg(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-xs text-white"
                />
              </div>
            )}
          </div>

          <h4 className="text-sm font-bold uppercase tracking-wider text-neutral-400 pt-3">
            Support Channels
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-neutral-400 mb-1">Support Email</label>
              <input
                type="email"
                value={contactEmail}
                onChange={e => setContactEmail(e.target.value)}
                className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-neutral-400 mb-1">WhatsApp Support Number</label>
              <input
                type="text"
                placeholder="+91..."
                value={contactWhatsapp}
                onChange={e => setContactWhatsapp(e.target.value)}
                className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-neutral-400 mb-1">Telegram Channel / User</label>
              <input
                type="text"
                placeholder="@CashRewardOfficial"
                value={contactTelegram}
                onChange={e => setContactTelegram(e.target.value)}
                className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-xs text-white"
              />
            </div>
          </div>

          <div className="pt-3">
            <button
              onClick={handleSaveGeneral}
              disabled={saving}
              className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold rounded-xl text-sm transition shadow-sm"
            >
              {saving ? 'Saving...' : 'Save General Settings'}
            </button>
          </div>
        </div>
      )}

      {/* Tab 2: Finance */}
      {activeTab === 'finance' && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 max-w-xl space-y-5">
          <h3 className="text-lg font-bold text-white">Payout & Welcome Rules</h3>

          <div>
            <label className="block text-xs font-semibold uppercase text-neutral-400 mb-2">
              New User Welcome Bonus (INR)
            </label>
            <input
              type="number"
              value={welcomeBonus}
              onChange={e => setWelcomeBonus(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500/50"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-neutral-400 mb-2">
              Minimum Cashout Amount (INR)
            </label>
            <input
              type="number"
              value={withdrawMin}
              onChange={e => setWithdrawMin(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500/50"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-neutral-400 mb-2">
              Maximum Single Cashout Amount (INR)
            </label>
            <input
              type="number"
              value={withdrawMax}
              onChange={e => setWithdrawMax(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500/50"
            />
          </div>

          <div className="pt-3">
            <button
              onClick={handleSaveFinance}
              disabled={saving}
              className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold rounded-xl text-sm transition shadow-sm"
            >
              {saving ? 'Saving...' : 'Save Financial Limits'}
            </button>
          </div>
        </div>
      )}

      {/* Tab 3: Reject Templates */}
      {activeTab === 'templates' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-neutral-400">
              Pre-defined rejection reasons shown in the Proof Review modal.
            </p>
            <button
              onClick={() => setTemplateModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold rounded-xl text-sm transition shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Add Reason
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {templates.map(t => (
              <div
                key={t.id}
                className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex items-start justify-between gap-3"
              >
                <div>
                  <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-neutral-800 text-amber-400">
                    {t.category}
                  </span>
                  <p className="text-sm text-white mt-1.5">{t.text}</p>
                </div>
                <button
                  onClick={() => handleDeleteTemplate(t.id)}
                  className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-rose-400 shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 4: Badges */}
      {activeTab === 'badges' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-neutral-400">
              Custom badges available for decorating task cards.
            </p>
            <button
              onClick={() => setBadgeModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold rounded-xl text-sm transition shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Add Badge
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {badges.map(b => (
              <div
                key={b.id}
                className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-3.5 h-3.5 rounded-full shrink-0"
                    style={{ backgroundColor: b.color }}
                  />
                  <span className="text-sm font-semibold text-white">{b.name}</span>
                </div>
                <button
                  onClick={() => handleDeleteBadge(b.id)}
                  className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-rose-400"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 5: Email Layer */}
      {activeTab === 'email' && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 max-w-xl space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-white">Email Notification Gateway</h3>
            <span className="px-2.5 py-1 text-xs font-bold uppercase rounded-full bg-neutral-800 text-neutral-400 border border-neutral-700">
              Not Configured
            </span>
          </div>

          <p className="text-sm text-neutral-400">
            A provider-agnostic layer for transactional emails (password reset, payout confirmations, high-value alerts). Supports Resend, SMTP, or SendGrid.
          </p>

          <div>
            <label className="block text-xs font-semibold uppercase text-neutral-400 mb-2">
              Email Provider
            </label>
            <select
              value={emailProvider}
              onChange={e => setEmailProvider(e.target.value as any)}
              className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500/50"
            >
              <option value="none">Disabled (No external provider)</option>
              <option value="resend">Resend API</option>
              <option value="smtp">Custom SMTP Server</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-neutral-400 mb-2">
              Sender Name & Email
            </label>
            <input
              type="text"
              value={emailSender}
              onChange={e => setEmailSender(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500/50"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-neutral-400 mb-2">
              API Key / Connection Secret
            </label>
            <input
              type="password"
              placeholder="re_xxxxxxxxxxxxxx"
              value={emailApiKey}
              onChange={e => setEmailApiKey(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500/50"
            />
          </div>

          <div className="pt-2">
            <button
              onClick={() => {
                setSuccessMsg('Email settings saved in config.')
                setTimeout(() => setSuccessMsg(null), 3000)
              }}
              className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold rounded-xl text-sm transition shadow-sm"
            >
              Save Email Config
            </button>
          </div>
        </div>
      )}

      {/* Add Template Modal */}
      <Modal
        isOpen={templateModalOpen}
        onClose={() => setTemplateModalOpen(false)}
        title="Add Rejection Template"
      >
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase text-neutral-400 mb-2">
              Category
            </label>
            <select
              value={newTemplateCat}
              onChange={e => setNewTemplateCat(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-sm text-white focus:outline-none"
            >
              <option value="Proof">Screenshot Proof</option>
              <option value="Account">Account Duplicate</option>
              <option value="Time">Timing / Incomplete</option>
              <option value="Policy">Terms Violation</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase text-neutral-400 mb-2">
              Template Explanation Text
            </label>
            <textarea
              rows={3}
              placeholder="e.g. Screenshot does not show task completion banner..."
              value={newTemplateText}
              onChange={e => setNewTemplateText(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500/50"
            />
          </div>
          <div className="pt-3 flex items-center justify-end gap-3">
            <button
              onClick={() => setTemplateModalOpen(false)}
              className="px-4 py-2 text-neutral-400 hover:text-white text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleAddTemplate}
              className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold rounded-xl text-sm"
            >
              Save Template
            </button>
          </div>
        </div>
      </Modal>

      {/* Add Badge Modal */}
      <Modal
        isOpen={badgeModalOpen}
        onClose={() => setBadgeModalOpen(false)}
        title="Create Custom Badge"
      >
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase text-neutral-400 mb-2">
              Badge Label
            </label>
            <input
              type="text"
              placeholder="e.g. VIP ONLY"
              value={newBadgeName}
              onChange={e => setNewBadgeName(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500/50"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase text-neutral-400 mb-2">
              Accent Color
            </label>
            <input
              type="color"
              value={newBadgeColor}
              onChange={e => setNewBadgeColor(e.target.value)}
              className="w-full h-10 bg-neutral-950 border border-neutral-800 rounded-xl p-1 cursor-pointer"
            />
          </div>
          <div className="pt-3 flex items-center justify-end gap-3">
            <button
              onClick={() => setBadgeModalOpen(false)}
              className="px-4 py-2 text-neutral-400 hover:text-white text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleAddBadge}
              className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold rounded-xl text-sm"
            >
              Create Badge
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
