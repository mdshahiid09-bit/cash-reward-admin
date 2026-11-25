import React, { useState, useEffect } from 'react'
import {
  Trophy,
  Medal,
  Crown,
  Eye,
  EyeOff,
  UserPlus,
  Edit2,
  Trash2,
  RefreshCw,
  Search,
  Sparkles,
  ShieldAlert,
  ArrowUpRight
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAdminAuth } from '../context/AdminAuthContext'
import { logAdminAction } from '../lib/audit'
import { Modal } from '../components/common/Modal'
import { ConfirmModal } from '../components/common/ConfirmModal'
import { TableSkeleton } from '../components/common/Skeleton'

interface LeaderboardUser {
  id: string
  display_name: string
  avatar_url?: string
  total_earned: number
  balance: number
  show_on_leaderboard?: boolean
  is_demo?: boolean
  created_at: string
}

export const Leaderboard: React.FC = () => {
  const { admin } = useAdminAuth()
  const [users, setUsers] = useState<LeaderboardUser[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<'all' | 'real' | 'demo'>('all')

  // Demo user modal
  const [demoModalOpen, setDemoModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<LeaderboardUser | null>(null)
  const [demoName, setDemoName] = useState('')
  const [demoEarned, setDemoEarned] = useState('500')
  const [demoAvatar, setDemoAvatar] = useState('')

  // Delete modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [userToDelete, setUserToDelete] = useState<LeaderboardUser | null>(null)

  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    fetchLeaderboard()
  }, [])

  const fetchLeaderboard = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url, total_earned, balance, show_on_leaderboard, is_demo, created_at')
        .order('total_earned', { ascending: false })
        .limit(100)

      if (error) throw error
      setUsers(data || [])
    } catch (err) {
      console.error('Error fetching leaderboard:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleToggleVisibility = async (user: LeaderboardUser) => {
    const current = user.show_on_leaderboard !== false
    const nextVal = !current

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ show_on_leaderboard: nextVal })
        .eq('id', user.id)

      if (error) throw error

      await logAdminAction({
        adminId: admin?.id,
        adminEmail: admin?.email,
        action: nextVal ? 'SHOW_ON_LEADERBOARD' : 'HIDE_FROM_LEADERBOARD',
        entityType: 'leaderboard',
        entityId: user.id,
        beforeVal: { show_on_leaderboard: current },
        afterVal: { show_on_leaderboard: nextVal }
      })

      setUsers(prev =>
        prev.map(u => (u.id === user.id ? { ...u, show_on_leaderboard: nextVal } : u))
      )
    } catch (err) {
      console.error('Toggle visibility error:', err)
    }
  }

  const handleSaveDemoUser = async () => {
    if (!demoName.trim()) {
      setFormError('Display name is required')
      return
    }
    const earnedVal = parseFloat(demoEarned)
    if (isNaN(earnedVal) || earnedVal < 0) {
      setFormError('Valid total earned amount is required')
      return
    }

    setSubmitting(true)
    setFormError(null)

    try {
      if (editingUser) {
        // Update existing demo user
        const { error } = await supabase
          .from('profiles')
          .update({
            display_name: demoName.trim(),
            total_earned: earnedVal,
            avatar_url: demoAvatar.trim() || null
          })
          .eq('id', editingUser.id)

        if (error) throw error

        await logAdminAction({
          adminId: admin?.id,
          adminEmail: admin?.email,
          action: 'UPDATE_DEMO_USER',
          entityType: 'user',
          entityId: editingUser.id,
          afterVal: { display_name: demoName, total_earned: earnedVal }
        })
      } else {
        // Create new demo user
        const newDemoId = crypto.randomUUID()
        const { error } = await supabase.from('profiles').insert({
          id: newDemoId,
          display_name: demoName.trim(),
          avatar_url: demoAvatar.trim() || null,
          total_earned: earnedVal,
          balance: Math.floor(earnedVal * 0.2),
          referral_code: `DEMO${Math.floor(1000 + Math.random() * 9000)}`,
          is_demo: true,
          show_on_leaderboard: true,
          blocked: false,
          created_at: new Date().toISOString()
        })

        if (error) throw error

        await logAdminAction({
          adminId: admin?.id,
          adminEmail: admin?.email,
          action: 'CREATE_DEMO_USER',
          entityType: 'user',
          entityId: newDemoId,
          afterVal: { display_name: demoName, total_earned: earnedVal, is_demo: true }
        })
      }

      setDemoModalOpen(false)
      setEditingUser(null)
      setDemoName('')
      setDemoEarned('500')
      setDemoAvatar('')
      await fetchLeaderboard()
    } catch (err: any) {
      setFormError(err.message || 'Failed to save demo user')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteUser = async () => {
    if (!userToDelete) return
    setSubmitting(true)

    try {
      const { error } = await supabase.from('profiles').delete().eq('id', userToDelete.id)
      if (error) throw error

      await logAdminAction({
        adminId: admin?.id,
        adminEmail: admin?.email,
        action: 'DELETE_DEMO_USER',
        entityType: 'user',
        entityId: userToDelete.id,
        beforeVal: { name: userToDelete.display_name }
      })

      setDeleteModalOpen(false)
      setUserToDelete(null)
      await fetchLeaderboard()
    } catch (err) {
      console.error('Delete error:', err)
    } finally {
      setSubmitting(false)
    }
  }

  const filteredUsers = users.filter(u => {
    if (activeTab === 'real' && u.is_demo) return false
    if (activeTab === 'demo' && !u.is_demo) return false
    if (!searchQuery) return true
    return u.display_name?.toLowerCase().includes(searchQuery.toLowerCase())
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Leaderboard & Demo Users</h1>
          <p className="text-sm text-neutral-400 mt-1">
            Manage public ranking visibility and create demo users to stimulate user competition.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchLeaderboard()}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-300 hover:text-white transition text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => {
              setEditingUser(null)
              setDemoName('')
              setDemoEarned('1500')
              setDemoAvatar('')
              setFormError(null)
              setDemoModalOpen(true)
            }}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold rounded-xl text-sm transition shadow-sm"
          >
            <UserPlus className="w-4 h-4" />
            Add Demo User
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {(['all', 'real', 'demo'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold uppercase tracking-wider transition ${
                activeTab === tab
                  ? 'bg-amber-500 text-neutral-950 font-bold'
                  : 'bg-neutral-800 text-neutral-400 hover:text-white'
              }`}
            >
              {tab === 'all' ? 'All Ranked' : tab === 'real' ? 'Real Users' : 'Demo Users'}
            </button>
          ))}
        </div>

        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
          <input
            type="text"
            placeholder="Search leaderboard..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500/50"
          />
        </div>
      </div>

      {/* Leaderboard Table */}
      {loading ? (
        <TableSkeleton rows={10} />
      ) : filteredUsers.length === 0 ? (
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-12 text-center">
          <Trophy className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-white">No leaderboard records</h3>
          <p className="text-sm text-neutral-400 mt-1">
            No users matched current filters.
          </p>
        </div>
      ) : (
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-neutral-300">
              <thead className="bg-neutral-950 text-neutral-400 text-xs uppercase tracking-wider border-b border-neutral-800">
                <tr>
                  <th className="py-4 px-6 w-20">Rank</th>
                  <th className="py-4 px-6">User</th>
                  <th className="py-4 px-6">Total Earned</th>
                  <th className="py-4 px-6">Public Visibility</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60">
                {filteredUsers.map((u, idx) => {
                  const rank = idx + 1
                  const isVisible = u.show_on_leaderboard !== false
                  return (
                    <tr key={u.id} className="hover:bg-neutral-850/60 transition">
                      {/* Rank */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2 font-bold">
                          {rank === 1 && <Crown className="w-5 h-5 text-amber-400" />}
                          {rank === 2 && <Medal className="w-5 h-5 text-neutral-300" />}
                          {rank === 3 && <Medal className="w-5 h-5 text-amber-600" />}
                          <span
                            className={
                              rank <= 3 ? 'text-amber-400 font-extrabold' : 'text-neutral-500'
                            }
                          >
                            #{rank}
                          </span>
                        </div>
                      </td>

                      {/* User */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center font-bold text-amber-400 text-xs overflow-hidden shrink-0">
                            {u.avatar_url ? (
                              <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              u.display_name?.charAt(0) || 'U'
                            )}
                          </div>
                          <div>
                            <div className="font-semibold text-white flex items-center gap-2">
                              <span>{u.display_name}</span>
                              {u.is_demo && (
                                <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase rounded bg-purple-500/20 text-purple-400 border border-purple-500/30">
                                  DEMO
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-neutral-500 font-mono">
                              ID: {u.id.slice(0, 10)}...
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Total Earned */}
                      <td className="py-4 px-6">
                        <span className="text-base font-bold text-emerald-400">
                          ₹{u.total_earned.toLocaleString()}
                        </span>
                      </td>

                      {/* Visibility Toggle */}
                      <td className="py-4 px-6">
                        <button
                          onClick={() => handleToggleVisibility(u)}
                          className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold transition ${
                            isVisible
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}
                        >
                          {isVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                          <span>{isVisible ? 'Visible' : 'Hidden'}</span>
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-6 text-right">
                        {u.is_demo ? (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => {
                                setEditingUser(u)
                                setDemoName(u.display_name)
                                setDemoEarned(String(u.total_earned))
                                setDemoAvatar(u.avatar_url || '')
                                setDemoModalOpen(true)
                              }}
                              className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white"
                              title="Edit Demo User"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                setUserToDelete(u)
                                setDeleteModalOpen(true)
                              }}
                              className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-rose-400"
                              title="Delete Demo User"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-neutral-500">Real User</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Demo User Modal */}
      <Modal
        isOpen={demoModalOpen}
        onClose={() => setDemoModalOpen(false)}
        title={editingUser ? 'Edit Demo User' : 'Create Demo User'}
      >
        <div className="p-6 space-y-4">
          <p className="text-sm text-neutral-400">
            Demo users appear in the public leaderboard ranking with high earnings to inspire competition among users.
          </p>

          {formError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-400">
              {formError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase text-neutral-400 mb-2">
              Display Name <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Rahul Sharma"
              value={demoName}
              onChange={e => setDemoName(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500/50"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-neutral-400 mb-2">
              Total Earnings Amount (INR) <span className="text-rose-400">*</span>
            </label>
            <input
              type="number"
              placeholder="e.g. 2500"
              value={demoEarned}
              onChange={e => setDemoEarned(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500/50"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-neutral-400 mb-2">
              Avatar Image URL (Optional)
            </label>
            <input
              type="url"
              placeholder="https://..."
              value={demoAvatar}
              onChange={e => setDemoAvatar(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500/50"
            />
          </div>

          <div className="pt-3 flex items-center justify-end gap-3">
            <button
              onClick={() => setDemoModalOpen(false)}
              className="px-4 py-2 text-neutral-400 hover:text-white text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveDemoUser}
              disabled={submitting}
              className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold rounded-xl text-sm"
            >
              {submitting ? 'Saving...' : 'Save Demo User'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirm Modal */}
      <ConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDeleteUser}
        title="Delete Demo User?"
        message={`Are you sure you want to permanently remove demo user "${userToDelete?.display_name}"?`}
        confirmText="Delete"
        isDestructive={true}
        isLoading={submitting}
      />
    </div>
  )
}
