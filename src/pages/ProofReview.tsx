import React, { useState, useEffect } from 'react'
import {
  CheckCircle,
  XCircle,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Filter,
  RefreshCw,
  Search,
  ExternalLink,
  AlertTriangle,
  Clock,
  User,
  ShieldCheck,
  Image as ImageIcon
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAdminAuth } from '../context/AdminAuthContext'
import { logAdminAction } from '../lib/audit'
import { ConfirmModal } from '../components/common/ConfirmModal'
import { Modal } from '../components/common/Modal'
import { TableSkeleton } from '../components/common/Skeleton'

interface SubmissionItem {
  id: string
  user_id: string
  task_id: string
  status: 'pending' | 'approved' | 'rejected'
  reject_reason?: string
  created_at: string
  decided_at?: string
  user?: {
    id: string
    display_name: string
    balance: number
    avatar_url?: string
    referral_code?: string
  }
  task?: {
    id: string
    name: string
    prize_inr: number
    logo_url?: string
  }
  images: string[]
}

interface RejectTemplate {
  id: string
  text: string
  category: string
}

export const ProofReview: React.FC = () => {
  const { admin } = useAdminAuth()
  const [submissions, setSubmissions] = useState<SubmissionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSubmission, setSelectedSubmission] = useState<SubmissionItem | null>(null)
  
  // Image viewer state
  const [activeImageIdx, setActiveImageIdx] = useState(0)
  const [zoomLevel, setZoomLevel] = useState(1)
  const [viewerOpen, setViewerOpen] = useState(false)

  // Actions state
  const [approveConfirmOpen, setApproveConfirmOpen] = useState(false)
  const [rejectModalOpen, setRejectModalOpen] = useState(false)
  const [submittingAction, setSubmittingAction] = useState(false)
  const [templates, setTemplates] = useState<RejectTemplate[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [customRejectReason, setCustomRejectReason] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    fetchSubmissions()
    fetchRejectTemplates()
  }, [statusFilter])

  const fetchRejectTemplates = async () => {
    try {
      const { data, error } = await supabase.from('reject_templates').select('*').order('category')
      if (!error && data) {
        setTemplates(data)
      }
    } catch (err) {
      console.error('Error fetching templates:', err)
    }
  }

  const fetchSubmissions = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('submissions')
        .select(`
          id,
          user_id,
          task_id,
          status,
          reject_reason,
          created_at,
          decided_at,
          user:profiles (
            id,
            display_name,
            balance,
            avatar_url,
            referral_code
          ),
          task:tasks (
            id,
            name,
            prize_inr,
            logo_url
          )
        `)
        .order('created_at', { ascending: false })

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter)
      }

      const { data, error } = await query
      if (error) throw error

      if (data && data.length > 0) {
        // Fetch submission images for all fetched submissions
        const subIds = data.map((d: any) => d.id)
        const { data: imgData } = await supabase
          .from('submission_images')
          .select('submission_id, image_url')
          .in('submission_id', subIds)

        const imgMap: Record<string, string[]> = {}
        imgData?.forEach((img: any) => {
          if (!imgMap[img.submission_id]) imgMap[img.submission_id] = []
          imgMap[img.submission_id].push(img.image_url)
        })

        const mapped: SubmissionItem[] = data.map((item: any) => ({
          ...item,
          images: imgMap[item.id] || []
        }))
        setSubmissions(mapped)
        if (mapped.length > 0 && !selectedSubmission) {
          setSelectedSubmission(mapped[0])
        }
      } else {
        setSubmissions([])
        setSelectedSubmission(null)
      }
    } catch (err) {
      console.error('Error fetching submissions:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async () => {
    if (!selectedSubmission) return
    setSubmittingAction(true)
    setActionError(null)

    try {
      const { error } = await supabase.rpc('admin_approve_submission', {
        p_sub_id: selectedSubmission.id,
        p_admin_id: admin?.id
      })

      if (error) throw error

      await logAdminAction({
        adminId: admin?.id,
        adminEmail: admin?.email,
        action: 'APPROVE_SUBMISSION',
        entityType: 'submission',
        entityId: selectedSubmission.id,
        beforeVal: { status: selectedSubmission.status },
        afterVal: { status: 'approved' }
      })

      setApproveConfirmOpen(false)
      await fetchSubmissions()
    } catch (err: any) {
      console.error('Approve error:', err)
      setActionError(err.message || 'Failed to approve submission')
    } finally {
      setSubmittingAction(false)
    }
  }

  const handleReject = async () => {
    if (!selectedSubmission) return
    const reason = customRejectReason.trim() || 
      (templates.find(t => t.id === selectedTemplateId)?.text || 'Requirements not satisfied')

    setSubmittingAction(true)
    setActionError(null)

    try {
      const { error } = await supabase.rpc('admin_reject_submission', {
        p_sub_id: selectedSubmission.id,
        p_admin_id: admin?.id,
        p_reason: reason
      })

      if (error) throw error

      await logAdminAction({
        adminId: admin?.id,
        adminEmail: admin?.email,
        action: 'REJECT_SUBMISSION',
        entityType: 'submission',
        entityId: selectedSubmission.id,
        beforeVal: { status: selectedSubmission.status },
        afterVal: { status: 'rejected', reject_reason: reason }
      })

      setRejectModalOpen(false)
      setSelectedTemplateId('')
      setCustomRejectReason('')
      await fetchSubmissions()
    } catch (err: any) {
      console.error('Reject error:', err)
      setActionError(err.message || 'Failed to reject submission')
    } finally {
      setSubmittingAction(false)
    }
  }

  const filteredSubmissions = submissions.filter(sub => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      sub.user?.display_name?.toLowerCase().includes(q) ||
      sub.task?.name?.toLowerCase().includes(q) ||
      sub.id.toLowerCase().includes(q)
    )
  })

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Proof Review Queue</h1>
          <p className="text-sm text-neutral-400 mt-1">
            Review user task screenshots, verify compliance, and approve rewards.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchSubmissions()}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-300 hover:text-white hover:border-neutral-700 transition text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          {(['pending', 'approved', 'rejected', 'all'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider transition ${
                statusFilter === tab
                  ? 'bg-amber-500 text-neutral-950 shadow-md shadow-amber-500/10'
                  : 'bg-neutral-800 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-750'
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
            placeholder="Search by user, task, or ID..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500/50"
          />
        </div>
      </div>

      {loading ? (
        <TableSkeleton rows={8} />
      ) : filteredSubmissions.length === 0 ? (
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-12 text-center">
          <div className="w-14 h-14 bg-neutral-800/80 rounded-2xl flex items-center justify-center mx-auto mb-4 text-neutral-400">
            <CheckCircle className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-semibold text-white">No submissions found</h3>
          <p className="text-sm text-neutral-400 mt-1 max-w-sm mx-auto">
            {statusFilter === 'pending'
              ? 'Awesome! There are no pending task proofs waiting for review right now.'
              : `No submissions matching status "${statusFilter}".`}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Submissions List (Left 5 Cols) */}
          <div className="lg:col-span-5 space-y-3 max-h-[750px] overflow-y-auto pr-1">
            {filteredSubmissions.map(sub => {
              const isSelected = selectedSubmission?.id === sub.id
              return (
                <div
                  key={sub.id}
                  onClick={() => {
                    setSelectedSubmission(sub)
                    setActiveImageIdx(0)
                    setZoomLevel(1)
                  }}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-neutral-850 border-amber-500/50 shadow-lg shadow-black/40 ring-1 ring-amber-500/30'
                      : 'bg-neutral-900 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-850/60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-neutral-800 border border-neutral-700 flex items-center justify-center font-bold text-amber-400 overflow-hidden shrink-0">
                        {sub.task?.logo_url ? (
                          <img src={sub.task.logo_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          sub.task?.name?.slice(0, 2).toUpperCase() || 'TK'
                        )}
                      </div>
                      <div>
                        <h4 className="font-semibold text-white text-sm line-clamp-1">
                          {sub.task?.name || 'Unknown Task'}
                        </h4>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-neutral-400">
                          <User className="w-3.5 h-3.5" />
                          <span>{sub.user?.display_name || 'Anonymous User'}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-sm font-bold text-emerald-400">
                        ₹{sub.task?.prize_inr || 0}
                      </span>
                      <div>
                        <span
                          className={`inline-block px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-full mt-1 ${
                            sub.status === 'approved'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : sub.status === 'rejected'
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          }`}
                        >
                          {sub.status}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-neutral-800/80 flex items-center justify-between text-xs text-neutral-400">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-neutral-500" />
                      <span>{new Date(sub.created_at).toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <ImageIcon className="w-3.5 h-3.5 text-neutral-400" />
                      <span>{sub.images.length} {sub.images.length === 1 ? 'image' : 'images'}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Submission Details & Viewer (Right 7 Cols) */}
          {selectedSubmission && (
            <div className="lg:col-span-7 bg-neutral-900 border border-neutral-800 rounded-2xl p-6 sticky top-6 space-y-6">
              {/* Header Info */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-neutral-800">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs uppercase tracking-wider font-semibold text-neutral-400">
                      Submission #{selectedSubmission.id.slice(0, 8)}
                    </span>
                    <span
                      className={`px-2 py-0.5 text-[10px] font-semibold uppercase rounded-full ${
                        selectedSubmission.status === 'approved'
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : selectedSubmission.status === 'rejected'
                          ? 'bg-rose-500/10 text-rose-400'
                          : 'bg-amber-500/10 text-amber-400'
                      }`}
                    >
                      {selectedSubmission.status}
                    </span>
                  </div>
                  <h2 className="text-xl font-bold text-white mt-1">
                    {selectedSubmission.task?.name}
                  </h2>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-xs text-neutral-400">Reward Value</div>
                    <div className="text-lg font-bold text-emerald-400">
                      ₹{selectedSubmission.task?.prize_inr || 0}
                    </div>
                  </div>
                </div>
              </div>

              {/* User Snapshot */}
              <div className="p-3.5 bg-neutral-950 border border-neutral-800/80 rounded-xl flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-neutral-800 flex items-center justify-center font-bold text-neutral-300">
                    {selectedSubmission.user?.display_name?.charAt(0) || 'U'}
                  </div>
                  <div>
                    <span className="text-white font-medium">
                      {selectedSubmission.user?.display_name || 'User'}
                    </span>
                    <span className="text-neutral-500 ml-2">
                      ({selectedSubmission.user_id.slice(0, 8)})
                    </span>
                  </div>
                </div>
                <div className="text-neutral-400">
                  Current Balance: <span className="text-white font-medium">₹{selectedSubmission.user?.balance ?? 0}</span>
                </div>
              </div>

              {/* Reject Reason Display (if already rejected) */}
              {selectedSubmission.status === 'rejected' && selectedSubmission.reject_reason && (
                <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 text-xs">
                  <strong className="block font-semibold mb-0.5">Rejection Reason:</strong>
                  {selectedSubmission.reject_reason}
                </div>
              )}

              {/* Image Preview & Zoom Controls */}
              {selectedSubmission.images.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-neutral-400">
                    <span>
                      Screenshot {activeImageIdx + 1} of {selectedSubmission.images.length}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setZoomLevel(prev => Math.min(prev + 0.25, 3))}
                        className="p-1.5 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-neutral-300"
                        title="Zoom In"
                      >
                        <ZoomIn className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setZoomLevel(prev => Math.max(prev - 0.25, 0.5))}
                        className="p-1.5 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-neutral-300"
                        title="Zoom Out"
                      >
                        <ZoomOut className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setZoomLevel(1)}
                        className="p-1.5 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-neutral-300"
                        title="Reset Zoom"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setViewerOpen(true)}
                        className="p-1.5 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-neutral-300 ml-1"
                        title="Open Fullscreen"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Main Image Box */}
                  <div className="relative bg-neutral-950 border border-neutral-800 rounded-xl overflow-hidden h-[340px] flex items-center justify-center">
                    <img
                      src={selectedSubmission.images[activeImageIdx]}
                      alt="Proof Screenshot"
                      style={{ transform: `scale(${zoomLevel})` }}
                      className="max-h-full max-w-full object-contain transition-transform duration-200 cursor-zoom-in"
                      onClick={() => setViewerOpen(true)}
                    />

                    {/* Nav buttons over image */}
                    {selectedSubmission.images.length > 1 && (
                      <>
                        <button
                          disabled={activeImageIdx === 0}
                          onClick={() => {
                            setActiveImageIdx(prev => Math.max(prev - 1, 0))
                            setZoomLevel(1)
                          }}
                          className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-neutral-900/80 hover:bg-neutral-800 text-white disabled:opacity-30 disabled:cursor-not-allowed backdrop-blur"
                        >
                          <ChevronLeft className="w-5 h-5" />
                        </button>
                        <button
                          disabled={activeImageIdx === selectedSubmission.images.length - 1}
                          onClick={() => {
                            setActiveImageIdx(prev => Math.min(prev + 1, selectedSubmission.images.length - 1))
                            setZoomLevel(1)
                          }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-neutral-900/80 hover:bg-neutral-800 text-white disabled:opacity-30 disabled:cursor-not-allowed backdrop-blur"
                        >
                          <ChevronRight className="w-5 h-5" />
                        </button>
                      </>
                    )}
                  </div>

                  {/* Thumbnails */}
                  {selectedSubmission.images.length > 1 && (
                    <div className="flex items-center gap-2 overflow-x-auto py-1">
                      {selectedSubmission.images.map((img, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            setActiveImageIdx(idx)
                            setZoomLevel(1)
                          }}
                          className={`w-14 h-14 rounded-lg overflow-hidden border-2 shrink-0 transition ${
                            activeImageIdx === idx
                              ? 'border-amber-500 ring-2 ring-amber-500/20'
                              : 'border-neutral-800 opacity-60 hover:opacity-100'
                          }`}
                        >
                          <img src={img} alt="" className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-8 text-center text-neutral-500 text-sm">
                  No proof screenshots attached to this submission.
                </div>
              )}

              {/* Action Buttons */}
              {selectedSubmission.status === 'pending' && (
                <div className="pt-4 border-t border-neutral-800 flex items-center justify-end gap-3">
                  <button
                    onClick={() => {
                      setActionError(null)
                      setRejectModalOpen(true)
                    }}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 transition font-medium text-sm"
                  >
                    <XCircle className="w-4 h-4" />
                    Reject Submission
                  </button>
                  <button
                    onClick={() => {
                      setActionError(null)
                      setApproveConfirmOpen(true)
                    }}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-semibold transition text-sm shadow-md shadow-emerald-500/10"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Approve & Reward
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Fullscreen Image Modal */}
      {viewerOpen && selectedSubmission && selectedSubmission.images.length > 0 && (
        <Modal
          isOpen={viewerOpen}
          onClose={() => setViewerOpen(false)}
          title={`Screenshot ${activeImageIdx + 1} of ${selectedSubmission.images.length}`}
          size="2xl"
        >
          <div className="p-4 flex flex-col items-center">
            <div className="relative max-h-[75vh] w-full flex items-center justify-center overflow-auto bg-neutral-950 rounded-xl p-2">
              <img
                src={selectedSubmission.images[activeImageIdx]}
                alt="Full proof"
                className="max-h-[70vh] object-contain rounded-lg"
              />
            </div>
            <div className="mt-4 flex items-center gap-3">
              <button
                disabled={activeImageIdx === 0}
                onClick={() => setActiveImageIdx(prev => Math.max(prev - 1, 0))}
                className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40 rounded-xl text-sm font-medium text-white"
              >
                Previous
              </button>
              <button
                disabled={activeImageIdx === selectedSubmission.images.length - 1}
                onClick={() => setActiveImageIdx(prev => Math.min(prev + 1, selectedSubmission.images.length - 1))}
                className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40 rounded-xl text-sm font-medium text-white"
              >
                Next
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Approve Confirmation Modal */}
      <ConfirmModal
        isOpen={approveConfirmOpen}
        onClose={() => setApproveConfirmOpen(false)}
        onConfirm={handleApprove}
        title="Approve Task Submission?"
        message={`Are you sure you want to approve this proof for ₹${selectedSubmission?.task?.prize_inr || 0}? The reward will be immediately credited to the user's wallet, and any applicable referral bonus will be processed.`}
        confirmText="Approve & Credit Reward"
        isDestructive={false}
        isLoading={submittingAction}
      />

      {/* Reject Modal with Template selection */}
      <Modal
        isOpen={rejectModalOpen}
        onClose={() => setRejectModalOpen(false)}
        title="Reject Task Submission"
      >
        <div className="p-6 space-y-4">
          <p className="text-sm text-neutral-400">
            Please choose a rejection reason or type a custom note. The user will receive this reason in their notification so they can fix and re-submit.
          </p>

          {actionError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-400">
              {actionError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase text-neutral-400 mb-2">
              Select Reject Template
            </label>
            <select
              value={selectedTemplateId}
              onChange={e => {
                setSelectedTemplateId(e.target.value)
                const found = templates.find(t => t.id === e.target.value)
                if (found) setCustomRejectReason(found.text)
              }}
              className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500/50"
            >
              <option value="">-- Choose a standard reason --</option>
              {templates.map(t => (
                <option key={t.id} value={t.id}>
                  [{t.category}] {t.text.slice(0, 70)}...
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-neutral-400 mb-2">
              Custom Reason / Explanation
            </label>
            <textarea
              rows={3}
              placeholder="Explain what was wrong with the proof screenshot..."
              value={customRejectReason}
              onChange={e => setCustomRejectReason(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500/50"
            />
          </div>

          <div className="pt-3 flex items-center justify-end gap-3">
            <button
              onClick={() => setRejectModalOpen(false)}
              className="px-4 py-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 text-sm font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleReject}
              disabled={submittingAction}
              className="px-5 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition shadow-md shadow-rose-600/20"
            >
              {submittingAction ? 'Rejecting...' : 'Confirm Rejection'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
