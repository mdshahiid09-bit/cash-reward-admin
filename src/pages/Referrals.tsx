import React, { useState, useEffect } from 'react'
import {
  Users,
  GitBranch,
  Award,
  Settings,
  Plus,
  Edit2,
  Trash2,
  Save,
  CheckCircle,
  Clock,
  RefreshCw,
  Search,
  DollarSign
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAdminAuth } from '../context/AdminAuthContext'
import { logAdminAction } from '../lib/audit'
import { Modal } from '../components/common/Modal'
import { ConfirmModal } from '../components/common/ConfirmModal'
import { TableSkeleton } from '../components/common/Skeleton'

interface ReferralItem {
  id: string
  referrer_id: string
  referred_id: string
  level?: number
  reward_amount?: number
  reward_paid: boolean
  created_at: string
  referrer?: { id: string; display_name: string; referral_code: string }
  referee?: { id: string; display_name: string }
}

interface MilestoneItem {
  id: string
  referral_count: number
  bonus_amount: number
  sort_order: number
  active: boolean
}

export const Referrals: React.FC = () => {
  const { admin } = useAdminAuth()
  const [activeTab, setActiveTab] = useState<'list' | 'milestones' | 'settings'>('list')
  const [referrals, setReferrals] = useState<ReferralItem[]>([])
  const [milestones, setMilestones] = useState<MilestoneItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  // Settings State
  const [level1Reward, setLevel1Reward] = useState('5')
  const [level2Reward, setLevel2Reward] = useState('2')
  const [welcomeBonus, setWelcomeBonus] = useState('10')
  const [referralEnabled, setReferralEnabled] = useState(true)
  const [savingSettings, setSavingSettings] = useState(false)
  const [settingsSuccess, setSettingsSuccess] = useState(false)

  // Milestone Modal
  const [milestoneModalOpen, setMilestoneModalOpen] = useState(false)
  const [editingMilestone, setEditingMilestone] = useState<MilestoneItem | null>(null)
  const [mCount, setMCount] = useState('5')
  const [mBonus, setMBonus] = useState('25')
  const [submittingM, setSubmittingM] = useState(false)

  // Delete Milestone Modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [milestoneToDelete, setMilestoneToDelete] = useState<MilestoneItem | null>(null)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      // 1. Fetch Referrals
      const { data: refData } = await supabase
        .from('referrals')
        .select(`
          id,
          referrer_id,
          referred_id,
          level,
          reward_amount,
          reward_paid,
          created_at,
          referrer:profiles!referrals_referrer_id_fkey(id, display_name, referral_code),
          referee:profiles!referrals_referred_id_fkey(id, display_name)
        `)
        .order('created_at', { ascending: false })
        .limit(100)
      setReferrals((refData as any) || [])

      // 2. Fetch Milestones
      const { data: msData } = await supabase
        .from('milestones')
        .select('*')
        .order('referral_count', { ascending: true })
      setMilestones(msData || [])

      // 3. Fetch Settings
      const { data: stData } = await supabase.from('settings').select('*')
      if (stData) {
        stData.forEach(row => {
          if (row.key === 'referral_reward') setLevel1Reward(String(row.value))
          if (row.key === 'referral_reward_l2') setLevel2Reward(String(row.value))
          if (row.key === 'welcome_bonus') setWelcomeBonus(String(row.value))
          if (row.key === 'referral_enabled') setReferralEnabled(row.value === 'true' || row.value === true)
        })
      }
    } catch (err) {
      console.error('Fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveSettings = async () => {
    setSavingSettings(true)
    try {
      const updates = [
        { key: 'referral_reward', value: parseFloat(level1Reward) },
        { key: 'referral_reward_l2', value: parseFloat(level2Reward) },
        { key: 'welcome_bonus', value: parseFloat(welcomeBonus) },
        { key: 'referral_enabled', value: referralEnabled }
      ]

      for (const item of updates) {
        await supabase.from('settings').upsert({ key: item.key, value: item.value as any })
      }

      await logAdminAction({
        adminId: admin?.id,
        adminEmail: admin?.email,
        action: 'UPDATE_REFERRAL_SETTINGS',
        entityType: 'settings',
        afterVal: { level1Reward, level2Reward, welcomeBonus, referralEnabled }
      })

      setSettingsSuccess(true)
      setTimeout(() => setSettingsSuccess(false), 3000)
    } catch (err) {
      console.error('Save settings error:', err)
    } finally {
      setSavingSettings(false)
    }
  }

  const handleSaveMilestone = async () => {
    const count = parseInt(mCount)
    const bonus = parseFloat(mBonus)
    if (isNaN(count) || count <= 0 || isNaN(bonus) || bonus <= 0) return

    setSubmittingM(true)
    try {
      if (editingMilestone) {
        const { error } = await supabase
          .from('milestones')
          .update({ referral_count: count, bonus_amount: bonus })
          .eq('id', editingMilestone.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('milestones').insert({
          referral_count: count,
          bonus_amount: bonus,
          sort_order: count,
          active: true
        })
        if (error) throw error
      }

      setMilestoneModalOpen(false)
      setEditingMilestone(null)
      await fetchData()
    } catch (err) {
      console.error('Milestone error:', err)
    } finally {
      setSubmittingM(false)
    }
  }

  const handleDeleteMilestone = async () => {
    if (!milestoneToDelete) return
    setSubmittingM(true)
    try {
      await supabase.from('milestones').delete().eq('id', milestoneToDelete.id)
      setDeleteModalOpen(false)
      setMilestoneToDelete(null)
      await fetchData()
    } catch (err) {
      console.error('Delete milestone error:', err)
    } finally {
      setSubmittingM(false)
    }
  }

  const filteredReferrals = referrals.filter(r => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      r.referrer?.display_name?.toLowerCase().includes(q) ||
      r.referee?.display_name?.toLowerCase().includes(q) ||
      r.referrer?.referral_code?.toLowerCase().includes(q)
    )
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Referrals & Milestones</h1>
          <p className="text-sm text-neutral-400 mt-1">
            Track user invitations, configure 2-level reward commissions, and manage milestone bonuses.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchData()}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-300 hover:text-white transition text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-neutral-800 flex items-center gap-6 text-sm font-medium">
        {[
          { key: 'list', label: `Referral History (${referrals.length})`, icon: GitBranch },
          { key: 'milestones', label: `Milestones (${milestones.length})`, icon: Award },
          { key: 'settings', label: 'Reward Rules & Rates', icon: Settings }
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

      {/* Tab 1: Referrals List */}
      {activeTab === 'list' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
              <input
                type="text"
                placeholder="Search referrer or referee..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500/50"
              />
            </div>
          </div>

          {loading ? (
            <TableSkeleton rows={8} />
          ) : filteredReferrals.length === 0 ? (
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-12 text-center">
              <GitBranch className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-white">No referral records found</h3>
              <p className="text-sm text-neutral-400 mt-1">
                When users invite friends using their referral code, the invites will appear here.
              </p>
            </div>
          ) : (
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-neutral-300">
                  <thead className="bg-neutral-950 text-neutral-400 text-xs uppercase tracking-wider border-b border-neutral-800">
                    <tr>
                      <th className="py-4 px-6">Referrer (Inviter)</th>
                      <th className="py-4 px-6">Referee (Friend)</th>
                      <th className="py-4 px-6">Level</th>
                      <th className="py-4 px-6">Reward (INR)</th>
                      <th className="py-4 px-6">Status</th>
                      <th className="py-4 px-6 text-right">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800/60">
                    {filteredReferrals.map(r => (
                      <tr key={r.id} className="hover:bg-neutral-850/60 transition">
                        <td className="py-4 px-6">
                          <div className="font-semibold text-white">
                            {r.referrer?.display_name || 'User'}
                          </div>
                          <div className="text-xs text-amber-400 font-mono">
                            Code: {r.referrer?.referral_code || 'N/A'}
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <div className="text-white font-medium">
                            {r.referee?.display_name || 'New User'}
                          </div>
                          <div className="text-xs text-neutral-500 font-mono">
                            ID: {r.referred_id.slice(0, 8)}
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <span className="px-2 py-0.5 text-xs font-bold rounded bg-neutral-800 text-neutral-300">
                            Level {r.level || 1}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          <span className="font-bold text-emerald-400">
                            ₹{r.reward_amount ?? level1Reward}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          {r.reward_paid ? (
                            <span className="px-2.5 py-0.5 text-xs font-semibold uppercase rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              Credited
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 text-xs font-semibold uppercase rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              Pending Task
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-6 text-right text-xs text-neutral-400">
                          {new Date(r.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Milestones Manager */}
      {activeTab === 'milestones' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-neutral-400">
              Users earn extra bonus rewards when they reach these cumulative referral invite goals.
            </p>
            <button
              onClick={() => {
                setEditingMilestone(null)
                setMCount('5')
                setMBonus('25')
                setMilestoneModalOpen(true)
              }}
              className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold rounded-xl text-sm transition shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Add Milestone
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {milestones.map(m => (
              <div
                key={m.id}
                className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center font-bold text-amber-400">
                    <Award className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-white font-bold text-base">
                      {m.referral_count} Referrals
                    </div>
                    <div className="text-emerald-400 font-bold text-sm">₹{m.bonus_amount} Bonus</div>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setEditingMilestone(m)
                      setMCount(String(m.referral_count))
                      setMBonus(String(m.bonus_amount))
                      setMilestoneModalOpen(true)
                    }}
                    className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      setMilestoneToDelete(m)
                      setDeleteModalOpen(true)
                    }}
                    className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-rose-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Settings */}
      {activeTab === 'settings' && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 max-w-2xl space-y-5">
          <h3 className="text-lg font-bold text-white">Referral Program Rules</h3>

          {settingsSuccess && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-400 flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Settings updated successfully!
            </div>
          )}

          <div className="flex items-center justify-between p-4 bg-neutral-950 rounded-xl border border-neutral-800">
            <div>
              <div className="font-semibold text-white text-sm">Enable Referral System</div>
              <div className="text-xs text-neutral-500">Allow users to share codes and receive commissions</div>
            </div>
            <input
              type="checkbox"
              checked={referralEnabled}
              onChange={e => setReferralEnabled(e.target.checked)}
              className="w-5 h-5 accent-amber-500 rounded cursor-pointer"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-neutral-400 mb-2">
              Level 1 Direct Referral Bonus (INR)
            </label>
            <input
              type="number"
              value={level1Reward}
              onChange={e => setLevel1Reward(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500/50"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-neutral-400 mb-2">
              Level 2 Indirect Referral Bonus (INR)
            </label>
            <input
              type="number"
              value={level2Reward}
              onChange={e => setLevel2Reward(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500/50"
            />
          </div>

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

          <div className="pt-2">
            <button
              onClick={handleSaveSettings}
              disabled={savingSettings}
              className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold rounded-xl text-sm transition shadow-sm"
            >
              {savingSettings ? 'Saving...' : 'Save Referral Rules'}
            </button>
          </div>
        </div>
      )}

      {/* Add / Edit Milestone Modal */}
      <Modal
        isOpen={milestoneModalOpen}
        onClose={() => setMilestoneModalOpen(false)}
        title={editingMilestone ? 'Edit Milestone' : 'Add Milestone Goal'}
      >
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase text-neutral-400 mb-2">
              Required Referral Invites Count
            </label>
            <input
              type="number"
              value={mCount}
              onChange={e => setMCount(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500/50"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-neutral-400 mb-2">
              Bonus Reward Amount (INR)
            </label>
            <input
              type="number"
              value={mBonus}
              onChange={e => setMBonus(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500/50"
            />
          </div>

          <div className="pt-3 flex items-center justify-end gap-3">
            <button
              onClick={() => setMilestoneModalOpen(false)}
              className="px-4 py-2 text-neutral-400 hover:text-white text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveMilestone}
              disabled={submittingM}
              className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold rounded-xl text-sm"
            >
              {submittingM ? 'Saving...' : 'Save Milestone'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Milestone Confirm */}
      <ConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDeleteMilestone}
        title="Delete Milestone?"
        message={`Delete the ${milestoneToDelete?.referral_count} referrals milestone?`}
        confirmText="Delete"
        isDestructive={true}
        isLoading={submittingM}
      />
    </div>
  )
}
