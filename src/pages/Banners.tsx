import React, { useState, useEffect } from 'react'
import {
  Image,
  Plus,
  Edit2,
  Trash2,
  Eye,
  EyeOff,
  MoveUp,
  MoveDown,
  ExternalLink,
  Link as LinkIcon,
  Upload,
  RefreshCw,
  Sparkles
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAdminAuth } from '../context/AdminAuthContext'
import { logAdminAction } from '../lib/audit'
import { Modal } from '../components/common/Modal'
import { ConfirmModal } from '../components/common/ConfirmModal'
import { TableSkeleton } from '../components/common/Skeleton'

interface BannerItem {
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

export const Banners: React.FC = () => {
  const { admin } = useAdminAuth()
  const [banners, setBanners] = useState<BannerItem[]>([])
  const [loading, setLoading] = useState(true)

  // Add / Edit Modal
  const [modalOpen, setModalOpen] = useState(false)
  const [editingBanner, setEditingBanner] = useState<BannerItem | null>(null)
  const [imageUrl, setImageUrl] = useState('')
  const [title, setTitle] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [buttonText, setButtonText] = useState('')
  const [link, setLink] = useState('')
  const [linkType, setLinkType] = useState<'internal' | 'external'>('internal')
  const [sortOrder, setSortOrder] = useState('0')
  const [uploadingImage, setUploadingImage] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Delete Modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [bannerToDelete, setBannerToDelete] = useState<BannerItem | null>(null)

  useEffect(() => {
    fetchBanners()
  }, [])

  const fetchBanners = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('banners')
        .select('*')
        .order('sort_order', { ascending: true })

      if (error) throw error
      setBanners(data || [])
    } catch (err) {
      console.error('Fetch banners error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingImage(true)
    try {
      const ext = file.name.split('.').pop()
      const fileName = `banner_${Date.now()}.${ext}`
      const { data, error } = await supabase.storage.from('banners').upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      })

      if (error) throw error
      const { data: pubData } = supabase.storage.from('banners').getPublicUrl(fileName)
      setImageUrl(pubData.publicUrl)
    } catch (err: any) {
      setFormError(err.message || 'Image upload failed. Ensure bucket is public or check file size.')
    } finally {
      setUploadingImage(false)
    }
  }

  const handleToggleActive = async (banner: BannerItem) => {
    const nextVal = !banner.active
    try {
      const { error } = await supabase
        .from('banners')
        .update({ active: nextVal })
        .eq('id', banner.id)

      if (error) throw error

      await logAdminAction({
        adminId: admin?.id,
        adminEmail: admin?.email,
        action: nextVal ? 'ACTIVATE_BANNER' : 'DEACTIVATE_BANNER',
        entityType: 'banner',
        entityId: banner.id,
        beforeVal: { active: banner.active },
        afterVal: { active: nextVal }
      })

      setBanners(prev => prev.map(b => (b.id === banner.id ? { ...b, active: nextVal } : b)))
    } catch (err) {
      console.error('Toggle active error:', err)
    }
  }

  const handleMoveOrder = async (banner: BannerItem, direction: 'up' | 'down') => {
    const idx = banners.findIndex(b => b.id === banner.id)
    if (idx < 0) return
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1
    if (targetIdx < 0 || targetIdx >= banners.length) return

    const targetBanner = banners[targetIdx]
    const order1 = targetBanner.sort_order
    const order2 = banner.sort_order

    try {
      await supabase.from('banners').update({ sort_order: order1 }).eq('id', banner.id)
      await supabase.from('banners').update({ sort_order: order2 }).eq('id', targetBanner.id)
      await fetchBanners()
    } catch (err) {
      console.error('Reorder error:', err)
    }
  }

  const handleSaveBanner = async () => {
    if (!imageUrl.trim()) {
      setFormError('Image URL or uploaded image is required')
      return
    }

    setSubmitting(true)
    setFormError(null)

    try {
      const bannerData: any = {
        image_url: imageUrl.trim(),
        title: title.trim() || null,
        subtitle: subtitle.trim() || null,
        button_text: buttonText.trim() || null,
        link: link.trim() || null,
        link_type: linkType,
        sort_order: parseInt(sortOrder) || 0,
        active: editingBanner ? editingBanner.active : true
      }

      if (editingBanner) {
        const { error } = await supabase.from('banners').update(bannerData).eq('id', editingBanner.id)
        if (error) throw error

        await logAdminAction({
          adminId: admin?.id,
          adminEmail: admin?.email,
          action: 'UPDATE_BANNER',
          entityType: 'banner',
          entityId: editingBanner.id,
          afterVal: bannerData
        })
      } else {
        const { error } = await supabase.from('banners').insert(bannerData)
        if (error) throw error

        await logAdminAction({
          adminId: admin?.id,
          adminEmail: admin?.email,
          action: 'CREATE_BANNER',
          entityType: 'banner',
          afterVal: bannerData
        })
      }

      setModalOpen(false)
      setEditingBanner(null)
      await fetchBanners()
    } catch (err: any) {
      setFormError(err.message || 'Failed to save banner')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteBanner = async () => {
    if (!bannerToDelete) return
    setSubmitting(true)
    try {
      const { error } = await supabase.from('banners').delete().eq('id', bannerToDelete.id)
      if (error) throw error

      await logAdminAction({
        adminId: admin?.id,
        adminEmail: admin?.email,
        action: 'DELETE_BANNER',
        entityType: 'banner',
        entityId: bannerToDelete.id
      })

      setDeleteModalOpen(false)
      setBannerToDelete(null)
      await fetchBanners()
    } catch (err) {
      console.error('Delete error:', err)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Promotional Banners</h1>
          <p className="text-sm text-neutral-400 mt-1">
            Display eye-catching hero carousels and announcements on the user mobile homepage.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchBanners()}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-300 hover:text-white transition text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => {
              setEditingBanner(null)
              setImageUrl('')
              setTitle('')
              setSubtitle('')
              setButtonText('')
              setLink('')
              setSortOrder(String(banners.length + 1))
              setFormError(null)
              setModalOpen(true)
            }}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold rounded-xl text-sm transition shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add Banner
          </button>
        </div>
      </div>

      {/* Banners List */}
      {loading ? (
        <TableSkeleton rows={4} />
      ) : banners.length === 0 ? (
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-12 text-center">
          <Image className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-white">No active banners</h3>
          <p className="text-sm text-neutral-400 mt-1">
            Create promotional banners to inform users of new offers or events.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {banners.map((b, idx) => (
            <div
              key={b.id}
              className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-lg flex flex-col justify-between"
            >
              {/* Banner Preview Card */}
              <div className="relative aspect-[16/7] bg-neutral-950 overflow-hidden">
                <img
                  src={b.image_url}
                  alt={b.title || 'Banner'}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-4">
                  {b.title && <h4 className="text-white font-bold text-base">{b.title}</h4>}
                  {b.subtitle && <p className="text-xs text-neutral-300 mt-0.5 line-clamp-1">{b.subtitle}</p>}
                  {b.button_text && (
                    <span className="mt-2 inline-block px-3 py-1 bg-amber-500 text-neutral-950 font-bold text-[11px] rounded-lg w-max">
                      {b.button_text}
                    </span>
                  )}
                </div>

                {/* Status Badge */}
                <div className="absolute top-3 right-3 flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-full backdrop-blur ${
                      b.active
                        ? 'bg-emerald-500/80 text-white'
                        : 'bg-neutral-800/80 text-neutral-400'
                    }`}
                  >
                    {b.active ? 'Active' : 'Disabled'}
                  </span>
                </div>
              </div>

              {/* Controls Footer */}
              <div className="p-3.5 bg-neutral-850/60 border-t border-neutral-800 flex items-center justify-between text-xs text-neutral-400">
                <div className="flex items-center gap-1.5 font-mono">
                  <span>Order: #{b.sort_order}</span>
                  {b.link && (
                    <a
                      href={b.link}
                      target="_blank"
                      rel="noreferrer"
                      className="text-amber-400 flex items-center gap-1 hover:underline ml-2"
                    >
                      <LinkIcon className="w-3 h-3" />
                      Link
                    </a>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <button
                    disabled={idx === 0}
                    onClick={() => handleMoveOrder(b, 'up')}
                    className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 disabled:opacity-30"
                    title="Move Up"
                  >
                    <MoveUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    disabled={idx === banners.length - 1}
                    onClick={() => handleMoveOrder(b, 'down')}
                    className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 disabled:opacity-30"
                    title="Move Down"
                  >
                    <MoveDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleToggleActive(b)}
                    className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300"
                    title={b.active ? 'Disable banner' : 'Enable banner'}
                  >
                    {b.active ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => {
                      setEditingBanner(b)
                      setImageUrl(b.image_url)
                      setTitle(b.title || '')
                      setSubtitle(b.subtitle || '')
                      setButtonText(b.button_text || '')
                      setLink(b.link || '')
                      setLinkType(b.link_type || 'internal')
                      setSortOrder(String(b.sort_order))
                      setFormError(null)
                      setModalOpen(true)
                    }}
                    className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300"
                    title="Edit Banner"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      setBannerToDelete(b)
                      setDeleteModalOpen(true)
                    }}
                    className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-rose-400"
                    title="Delete Banner"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Banner Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingBanner ? 'Edit Banner' : 'Create Banner'}
      >
        <div className="p-6 space-y-4">
          {formError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-400">
              {formError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase text-neutral-400 mb-2">
              Banner Image URL <span className="text-rose-400">*</span>
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                placeholder="https://... or upload below"
                value={imageUrl}
                onChange={e => setImageUrl(e.target.value)}
                className="flex-1 px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500/50"
              />
              <label className="cursor-pointer px-3 py-2 bg-neutral-800 hover:bg-neutral-700 rounded-xl text-xs font-semibold text-neutral-200 flex items-center gap-1.5 shrink-0">
                <Upload className="w-4 h-4" />
                <span>{uploadingImage ? 'Uploading...' : 'Upload'}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-neutral-400 mb-2">
              Title (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Daily Bonus Special"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500/50"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-neutral-400 mb-2">
              Subtitle (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Complete 3 tasks today to earn ₹50 extra"
              value={subtitle}
              onChange={e => setSubtitle(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500/50"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase text-neutral-400 mb-2">
                Button Text (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Earn Now"
                value={buttonText}
                onChange={e => setButtonText(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500/50"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-neutral-400 mb-2">
                Sort Order
              </label>
              <input
                type="number"
                value={sortOrder}
                onChange={e => setSortOrder(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500/50"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-neutral-400 mb-2">
              Click Link / URL
            </label>
            <input
              type="text"
              placeholder="e.g. /tasks or https://telegram.me/..."
              value={link}
              onChange={e => setLink(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500/50"
            />
          </div>

          <div className="pt-3 flex items-center justify-end gap-3">
            <button
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-neutral-400 hover:text-white text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveBanner}
              disabled={submitting}
              className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold rounded-xl text-sm"
            >
              {submitting ? 'Saving...' : 'Save Banner'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirm Modal */}
      <ConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDeleteBanner}
        title="Delete Banner?"
        message="Are you sure you want to remove this promotional banner?"
        confirmText="Delete"
        isDestructive={true}
        isLoading={submitting}
      />
    </div>
  )
}
