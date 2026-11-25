import React, { useState, useEffect } from 'react'
import {
  Bell,
  Send,
  Users,
  User,
  History,
  CheckCircle,
  AlertCircle,
  Clock,
  Sparkles,
  RefreshCw
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAdminAuth } from '../context/AdminAuthContext'
import { logAdminAction } from '../lib/audit'
import { TableSkeleton } from '../components/common/Skeleton'

interface BroadcastItem {
  id: string
  title: string
  body: string
  link?: string
  recipient_count: number
  sent_at: string
}

export const Notifications: React.FC = () => {
  const { admin } = useAdminAuth()
  const [activeTab, setActiveTab] = useState<'broadcast' | 'direct' | 'history'>('broadcast')
  const [broadcasts, setBroadcasts] = useState<BroadcastItem[]>([])
  const [loading, setLoading] = useState(true)

  // Broadcast Form
  const [bTitle, setBTitle] = useState('')
  const [bBody, setBBody] = useState('')
  const [bLink, setBLink] = useState('')
  const [sendingBroadcast, setSendingBroadcast] = useState(false)
  const [broadcastSuccess, setBroadcastSuccess] = useState(false)
  const [broadcastError, setBroadcastError] = useState<string | null>(null)

  // Direct Message Form
  const [targetUserId, setTargetUserId] = useState('')
  const [dTitle, setDTitle] = useState('')
  const [dBody, setDBody] = useState('')
  const [usersList, setUsersList] = useState<{ id: string; display_name: string }[]>([])
  const [sendingDirect, setSendingDirect] = useState(false)
  const [directSuccess, setDirectSuccess] = useState(false)
  const [directError, setDirectError] = useState<string | null>(null)

  useEffect(() => {
    fetchHistory()
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      const { data } = await supabase.from('profiles').select('id, display_name').limit(100)
      if (data) setUsersList(data)
    } catch (err) {
      console.error(err)
    }
  }

  const fetchHistory = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('broadcasts')
        .select('*')
        .order('sent_at', { ascending: false })
      if (!error && data) {
        setBroadcasts(data)
      }
    } catch (err) {
      console.error('Fetch broadcast history error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!bTitle.trim() || !bBody.trim()) {
      setBroadcastError('Title and message body are required')
      return
    }

    setSendingBroadcast(true)
    setBroadcastError(null)

    try {
      // 1. Fetch user IDs to fan-out notifications
      const { data: users, error: uErr } = await supabase.from('profiles').select('id')
      if (uErr) throw uErr

      const recipientCount = users?.length || 0

      // 2. Insert into broadcasts table
      const { data: bData, error: bErr } = await supabase
        .from('broadcasts')
        .insert({
          title: bTitle.trim(),
          body: bBody.trim(),
          link: bLink.trim() || null,
          recipient_count: recipientCount,
          sent_at: new Date().toISOString()
        })
        .select()
        .single()

      if (bErr) throw bErr

      // 3. Batch insert notification rows into notifications table
      if (users && users.length > 0) {
        const notifRows = users.map(u => ({
          user_id: u.id,
          title: bTitle.trim(),
          message: bBody.trim(),
          read: false,
          created_at: new Date().toISOString()
        }))

        // Supabase allows batch inserting chunks of 200
        for (let i = 0; i < notifRows.length; i += 200) {
          const chunk = notifRows.slice(i, i + 200)
          await supabase.from('notifications').insert(chunk)
        }
      }

      await logAdminAction({
        adminId: admin?.id,
        adminEmail: admin?.email,
        action: 'SEND_BROADCAST',
        entityType: 'broadcast',
        entityId: bData?.id,
        afterVal: { title: bTitle, recipientCount }
      })

      setBroadcastSuccess(true)
      setBTitle('')
      setBBody('')
      setBLink('')
      await fetchHistory()
      setTimeout(() => setBroadcastSuccess(false), 4000)
    } catch (err: any) {
      setBroadcastError(err.message || 'Failed to send broadcast')
    } finally {
      setSendingBroadcast(false)
    }
  }

  const handleSendDirect = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!targetUserId || !dTitle.trim() || !dBody.trim()) {
      setDirectError('Please choose a recipient user, and fill in title and message')
      return
    }

    setSendingDirect(true)
    setDirectError(null)

    try {
      const { error } = await supabase.from('notifications').insert({
        user_id: targetUserId,
        title: dTitle.trim(),
        message: dBody.trim(),
        read: false,
        created_at: new Date().toISOString()
      })

      if (error) throw error

      await logAdminAction({
        adminId: admin?.id,
        adminEmail: admin?.email,
        action: 'SEND_DIRECT_NOTIFICATION',
        entityType: 'notification',
        entityId: targetUserId,
        afterVal: { title: dTitle }
      })

      setDirectSuccess(true)
      setDTitle('')
      setDBody('')
      setTargetUserId('')
      setTimeout(() => setDirectSuccess(false), 4000)
    } catch (err: any) {
      setDirectError(err.message || 'Failed to send message')
    } finally {
      setSendingDirect(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Notification Center</h1>
          <p className="text-sm text-neutral-400 mt-1">
            Broadcast platform announcements to all active users or send direct targeted messages.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchHistory()}
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
          { key: 'broadcast', label: 'Broadcast to All Users', icon: Users },
          { key: 'direct', label: 'Direct User Message', icon: User },
          { key: 'history', label: `Broadcast History (${broadcasts.length})`, icon: History }
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

      {/* Tab 1: Broadcast to All */}
      {activeTab === 'broadcast' && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 max-w-2xl space-y-5">
          <div>
            <h3 className="text-lg font-bold text-white">Send Platform Announcement</h3>
            <p className="text-xs text-neutral-400 mt-1">
              Delivers an in-app push notification to every registered user's notification feed.
            </p>
          </div>

          {broadcastSuccess && (
            <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-400 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 shrink-0" />
              <span>Broadcast dispatched successfully to all registered users!</span>
            </div>
          )}

          {broadcastError && (
            <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-400">
              {broadcastError}
            </div>
          )}

          <form onSubmit={handleSendBroadcast} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-neutral-400 mb-2">
                Announcement Title <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Weekend Mega Reward Festival is Live!"
                value={bTitle}
                onChange={e => setBTitle(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500/50"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-neutral-400 mb-2">
                Message Body <span className="text-rose-400">*</span>
              </label>
              <textarea
                rows={5}
                placeholder="Write your announcement details..."
                value={bBody}
                onChange={e => setBBody(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500/50"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-neutral-400 mb-2">
                Optional Action URL / App Link
              </label>
              <input
                type="text"
                placeholder="e.g. /tasks or https://..."
                value={bLink}
                onChange={e => setBLink(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500/50"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={sendingBroadcast}
                className="flex items-center gap-2 px-6 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-neutral-950 font-bold rounded-xl text-sm transition shadow-sm"
              >
                <Send className="w-4 h-4" />
                {sendingBroadcast ? 'Broadcasting...' : 'Send Broadcast to All'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tab 2: Direct User Message */}
      {activeTab === 'direct' && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 max-w-2xl space-y-5">
          <div>
            <h3 className="text-lg font-bold text-white">Send Direct Message to User</h3>
            <p className="text-xs text-neutral-400 mt-1">
              Send a personalized in-app message regarding task feedback, payout instructions, or bonuses.
            </p>
          </div>

          {directSuccess && (
            <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-400 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 shrink-0" />
              <span>Direct notification delivered!</span>
            </div>
          )}

          {directError && (
            <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-400">
              {directError}
            </div>
          )}

          <form onSubmit={handleSendDirect} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-neutral-400 mb-2">
                Select Recipient User <span className="text-rose-400">*</span>
              </label>
              <select
                value={targetUserId}
                onChange={e => setTargetUserId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500/50"
              >
                <option value="">-- Choose User --</option>
                {usersList.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.display_name} ({u.id.slice(0, 8)})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-neutral-400 mb-2">
                Subject / Title <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Clarification needed on your Task Proof"
                value={dTitle}
                onChange={e => setDTitle(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500/50"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-neutral-400 mb-2">
                Message Content <span className="text-rose-400">*</span>
              </label>
              <textarea
                rows={5}
                placeholder="Type your message to the user..."
                value={dBody}
                onChange={e => setDBody(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500/50"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={sendingDirect}
                className="flex items-center gap-2 px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-neutral-950 font-bold rounded-xl text-sm transition shadow-sm"
              >
                <Send className="w-4 h-4" />
                {sendingDirect ? 'Sending...' : 'Send Direct Message'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tab 3: History */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          {loading ? (
            <TableSkeleton rows={6} />
          ) : broadcasts.length === 0 ? (
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-12 text-center">
              <History className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-white">No broadcast history</h3>
              <p className="text-sm text-neutral-400 mt-1">
                Announcements sent to all users will be logged here.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-neutral-800 bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden">
              {broadcasts.map(b => (
                <div key={b.id} className="p-5 hover:bg-neutral-850/50 transition">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <h4 className="font-bold text-white text-base">{b.title}</h4>
                    <div className="flex items-center gap-3 text-xs text-neutral-400">
                      <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                        <Users className="w-3.5 h-3.5" />
                        {b.recipient_count} recipients
                      </span>
                      <span>•</span>
                      <span>{new Date(b.sent_at).toLocaleString()}</span>
                    </div>
                  </div>
                  <p className="text-sm text-neutral-300 mt-2 whitespace-pre-wrap">{b.body}</p>
                  {b.link && (
                    <div className="mt-2 text-xs text-amber-400 font-mono">Action URL: {b.link}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
