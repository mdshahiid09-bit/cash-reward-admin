import React, { useState, useEffect } from 'react'
import {
  MessageSquare,
  Search,
  CheckCircle,
  Mail,
  Trash2,
  RefreshCw,
  Clock,
  User,
  ExternalLink,
  CheckCheck
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAdminAuth } from '../context/AdminAuthContext'
import { logAdminAction } from '../lib/audit'
import { Modal } from '../components/common/Modal'
import { ConfirmModal } from '../components/common/ConfirmModal'
import { TableSkeleton } from '../components/common/Skeleton'

interface ContactMessageItem {
  id: string
  user_id?: string
  name?: string
  email?: string
  message: string
  status: 'unread' | 'read' | 'resolved'
  created_at: string
}

export const ContactMessages: React.FC = () => {
  const { admin } = useAdminAuth()
  const [messages, setMessages] = useState<ContactMessageItem[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<'all' | 'unread' | 'read' | 'resolved'>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // View modal
  const [selectedMessage, setSelectedMessage] = useState<ContactMessageItem | null>(null)
  const [viewModalOpen, setViewModalOpen] = useState(false)

  // Delete modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [msgToDelete, setMsgToDelete] = useState<ContactMessageItem | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchMessages()
  }, [statusFilter])

  const fetchMessages = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('contact_messages')
        .select('*')
        .order('created_at', { ascending: false })

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter)
      }

      const { data, error } = await query
      if (error) throw error
      setMessages(data || [])
    } catch (err) {
      console.error('Fetch contact messages error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateStatus = async (msg: ContactMessageItem, nextStatus: 'read' | 'resolved') => {
    try {
      const { error } = await supabase
        .from('contact_messages')
        .update({ status: nextStatus })
        .eq('id', msg.id)

      if (error) throw error

      await logAdminAction({
        adminId: admin?.id,
        adminEmail: admin?.email,
        action: `SET_MESSAGE_${nextStatus.toUpperCase()}`,
        entityType: 'contact_message',
        entityId: msg.id,
        beforeVal: { status: msg.status },
        afterVal: { status: nextStatus }
      })

      setMessages(prev => prev.map(m => (m.id === msg.id ? { ...m, status: nextStatus } : m)))
      if (selectedMessage?.id === msg.id) {
        setSelectedMessage({ ...selectedMessage, status: nextStatus })
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleDeleteMessage = async () => {
    if (!msgToDelete) return
    setSubmitting(true)
    try {
      const { error } = await supabase.from('contact_messages').delete().eq('id', msgToDelete.id)
      if (error) throw error

      await logAdminAction({
        adminId: admin?.id,
        adminEmail: admin?.email,
        action: 'DELETE_CONTACT_MESSAGE',
        entityType: 'contact_message',
        entityId: msgToDelete.id
      })

      setDeleteModalOpen(false)
      setMsgToDelete(null)
      await fetchMessages()
    } catch (err) {
      console.error(err)
    } finally {
      setSubmitting(false)
    }
  }

  const filteredMessages = messages.filter(m => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      m.name?.toLowerCase().includes(q) ||
      m.email?.toLowerCase().includes(q) ||
      m.message.toLowerCase().includes(q)
    )
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Support Inquiries</h1>
          <p className="text-sm text-neutral-400 mt-1">
            Review and respond to messages submitted by users through the in-app Contact Support form.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchMessages()}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-300 hover:text-white transition text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {(['all', 'unread', 'read', 'resolved'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold uppercase tracking-wider transition ${
                statusFilter === tab
                  ? 'bg-amber-500 text-neutral-950 font-bold'
                  : 'bg-neutral-800 text-neutral-400 hover:text-white'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
          <input
            type="text"
            placeholder="Search inquiries by sender, email or message..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500/50"
          />
        </div>
      </div>

      {/* Messages List */}
      {loading ? (
        <TableSkeleton rows={6} />
      ) : filteredMessages.length === 0 ? (
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-12 text-center">
          <MessageSquare className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-white">No messages found</h3>
          <p className="text-sm text-neutral-400 mt-1">
            All user support tickets have been processed.
          </p>
        </div>
      ) : (
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden divide-y divide-neutral-800">
          {filteredMessages.map(m => (
            <div
              key={m.id}
              onClick={() => {
                setSelectedMessage(m)
                if (m.status === 'unread') handleUpdateStatus(m, 'read')
                setViewModalOpen(true)
              }}
              className={`p-5 hover:bg-neutral-850/60 transition cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                m.status === 'unread' ? 'bg-amber-500/5 border-l-4 border-amber-500' : ''
              }`}
            >
              <div className="space-y-1 flex-1">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-white text-base">
                    {m.name || 'Anonymous User'}
                  </span>
                  {m.email && <span className="text-xs text-neutral-400 font-mono">{m.email}</span>}
                  <span
                    className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-full ${
                      m.status === 'resolved'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : m.status === 'read'
                        ? 'bg-neutral-800 text-neutral-400'
                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    }`}
                  >
                    {m.status}
                  </span>
                </div>
                <p className="text-sm text-neutral-300 line-clamp-2 mt-1">{m.message}</p>
                <div className="text-xs text-neutral-500 flex items-center gap-1.5 mt-2">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{new Date(m.created_at).toLocaleString()}</span>
                </div>
              </div>

              <div
                className="flex items-center gap-2 shrink-0"
                onClick={e => e.stopPropagation()}
              >
                {m.status !== 'resolved' && (
                  <button
                    onClick={() => handleUpdateStatus(m, 'resolved')}
                    className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 rounded-xl text-xs font-semibold transition"
                    title="Mark as Resolved"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    <span>Resolve</span>
                  </button>
                )}
                <button
                  onClick={() => {
                    setMsgToDelete(m)
                    setDeleteModalOpen(true)
                  }}
                  className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-rose-400 rounded-xl transition"
                  title="Delete message"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* View Message Modal */}
      {selectedMessage && (
        <Modal
          isOpen={viewModalOpen}
          onClose={() => setViewModalOpen(false)}
          title="Support Inquiry Details"
        >
          <div className="p-6 space-y-4">
            <div className="p-4 bg-neutral-950 border border-neutral-800 rounded-xl space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-neutral-400">Sender:</span>
                <span className="text-white font-medium">{selectedMessage.name || 'User'}</span>
              </div>
              {selectedMessage.email && (
                <div className="flex justify-between">
                  <span className="text-neutral-400">Email:</span>
                  <a
                    href={`mailto:${selectedMessage.email}`}
                    className="text-amber-400 font-mono hover:underline"
                  >
                    {selectedMessage.email}
                  </a>
                </div>
              )}
              {selectedMessage.user_id && (
                <div className="flex justify-between">
                  <span className="text-neutral-400">User ID:</span>
                  <span className="text-neutral-300 font-mono">{selectedMessage.user_id}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-neutral-400">Date:</span>
                <span className="text-neutral-300">{new Date(selectedMessage.created_at).toLocaleString()}</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-neutral-400 mb-2">
                Inquiry Message:
              </label>
              <div className="p-4 bg-neutral-950 border border-neutral-800 rounded-xl text-sm text-neutral-200 whitespace-pre-wrap leading-relaxed">
                {selectedMessage.message}
              </div>
            </div>

            <div className="pt-3 flex items-center justify-between">
              <div>
                {selectedMessage.email && (
                  <a
                    href={`mailto:${selectedMessage.email}?subject=Regarding Cash Reward Support Ticket`}
                    className="flex items-center gap-1.5 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl text-xs font-semibold transition"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    Reply via Email
                  </a>
                )}
              </div>

              <div className="flex items-center gap-2">
                {selectedMessage.status !== 'resolved' && (
                  <button
                    onClick={() => {
                      handleUpdateStatus(selectedMessage, 'resolved')
                      setViewModalOpen(false)
                    }}
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold rounded-xl text-xs transition"
                  >
                    Mark as Resolved
                  </button>
                )}
                <button
                  onClick={() => setViewModalOpen(false)}
                  className="px-4 py-2 text-neutral-400 hover:text-white text-xs"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirm */}
      <ConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDeleteMessage}
        title="Delete Message?"
        message="Are you sure you want to delete this message record?"
        confirmText="Delete"
        isDestructive={true}
        isLoading={submitting}
      />
    </div>
  )
}
