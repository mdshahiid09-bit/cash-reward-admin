import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus,
  Search,
  CheckSquare,
  Edit,
  Trash2,
  Copy,
  Eye,
  EyeOff,
  Star,
  RefreshCw,
  ExternalLink,
  Flame,
  Clock,
  Sparkles,
  Layers,
  Check,
  X
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Task } from '../types'
import { TableSkeleton } from '../components/common/Skeleton'
import { ConfirmModal } from '../components/common/ConfirmModal'
import { logAdminAction } from '../lib/audit'
import { useAdminAuth } from '../context/AdminAuthContext'

export const Tasks: React.FC = () => {
  const navigate = useNavigate()
  const { admin } = useAdminAuth()

  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'unpublished'>('all')
  const [categoryFilter, setCategoryFilter] = useState('all')

  // Modals & Action States
  const [deleteTask, setDeleteTask] = useState<Task | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editPrize, setEditPrize] = useState<number>(0)

  const loadTasks = async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: false })

      if (err) throw err
      setTasks(data || [])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to fetch tasks')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTasks()
  }, [])

  // Categories
  const categories = useMemo(() => {
    const set = new Set<string>()
    tasks.forEach((t) => {
      if (t.category) set.add(t.category)
    })
    return ['all', ...Array.from(set)]
  }, [tasks])

  // Filtered Tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      const matchSearch =
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.title.toLowerCase().includes(search.toLowerCase())

      const matchStatus =
        statusFilter === 'all'
          ? true
          : statusFilter === 'published'
          ? t.published
          : !t.published

      const matchCat = categoryFilter === 'all' || t.category === categoryFilter

      return matchSearch && matchStatus && matchCat
    })
  }, [tasks, search, statusFilter, categoryFilter])

  // Toggle Published
  const togglePublish = async (task: Task) => {
    const newStatus = !task.published
    try {
      const { error: upErr } = await supabase
        .from('tasks')
        .update({ published: newStatus, status: newStatus ? 'published' : 'unpublished' })
        .eq('id', task.id)

      if (upErr) throw upErr

      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, published: newStatus } : t))
      )

      await logAdminAction({
        adminId: admin?.id,
        adminEmail: admin?.email,
        action: newStatus ? 'PUBLISH_TASK' : 'UNPUBLISH_TASK',
        entityType: 'tasks',
        entityId: task.id,
        beforeVal: { published: task.published },
        afterVal: { published: newStatus }
      })
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Error updating task status')
    }
  }

  // Toggle Featured
  const toggleFeatured = async (task: Task) => {
    const newFeatured = !task.featured
    try {
      await supabase
        .from('tasks')
        .update({ featured: newFeatured })
        .eq('id', task.id)

      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, featured: newFeatured } : t))
      )

      await logAdminAction({
        adminId: admin?.id,
        adminEmail: admin?.email,
        action: newFeatured ? 'FEATURE_TASK' : 'UNFEATURE_TASK',
        entityType: 'tasks',
        entityId: task.id,
        beforeVal: { featured: task.featured },
        afterVal: { featured: newFeatured }
      })
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Error updating featured status')
    }
  }

  // Duplicate Task
  const handleDuplicate = async (task: Task) => {
    try {
      const { data: newTask, error: insErr } = await supabase
        .from('tasks')
        .insert({
          name: `${task.name} (Copy)`,
          title: task.title,
          logo_url: task.logo_url,
          banner_url: task.banner_url,
          play_store_url: task.play_store_url,
          prize_inr: task.prize_inr,
          demo_proof_url: task.demo_proof_url,
          proof_max_images: task.proof_max_images,
          category: task.category,
          featured: false,
          published: false,
          status: 'draft',
          badge_hot: task.badge_hot,
          badge_exclusive: task.badge_exclusive,
          badge_new: true,
          badge_limited: task.badge_limited
        })
        .select()
        .single()

      if (insErr) throw insErr

      // Duplicate steps
      const { data: steps } = await supabase
        .from('task_steps')
        .select('*')
        .eq('task_id', task.id)

      if (steps && steps.length > 0) {
        const newSteps = steps.map((s) => ({
          task_id: newTask.id,
          step_order: s.step_order,
          title: s.title,
          body: s.body,
          image_url: s.image_url,
          min_payment_amount: s.min_payment_amount
        }))
        await supabase.from('task_steps').insert(newSteps)
      }

      await logAdminAction({
        adminId: admin?.id,
        adminEmail: admin?.email,
        action: 'DUPLICATE_TASK',
        entityType: 'tasks',
        entityId: newTask.id,
        afterVal: { originalId: task.id }
      })

      alert('Task duplicated successfully as Draft!')
      loadTasks()
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Error duplicating task')
    }
  }

  // Delete Task
  const handleDeleteConfirm = async () => {
    if (!deleteTask) return
    setIsDeleting(true)
    try {
      await supabase.from('tasks').delete().eq('id', deleteTask.id)

      setTasks((prev) => prev.filter((t) => t.id !== deleteTask.id))

      await logAdminAction({
        adminId: admin?.id,
        adminEmail: admin?.email,
        action: 'DELETE_TASK',
        entityType: 'tasks',
        entityId: deleteTask.id,
        beforeVal: { name: deleteTask.name }
      })

      setDeleteTask(null)
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Error deleting task')
    } finally {
      setIsDeleting(false)
    }
  }

  // Save Inline Edit
  const handleSaveInline = async (task: Task) => {
    try {
      await supabase
        .from('tasks')
        .update({ title: editTitle, prize_inr: editPrize })
        .eq('id', task.id)

      setTasks((prev) =>
        prev.map((t) =>
          t.id === task.id ? { ...t, title: editTitle, prize_inr: editPrize } : t
        )
      )

      await logAdminAction({
        adminId: admin?.id,
        adminEmail: admin?.email,
        action: 'INLINE_EDIT_TASK',
        entityType: 'tasks',
        entityId: task.id,
        beforeVal: { title: task.title, prize: task.prize_inr },
        afterVal: { title: editTitle, prize: editPrize }
      })

      setEditingId(null)
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Failed to save inline changes')
    }
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black font-heading text-white">
            Task Management
          </h2>
          <p className="text-xs text-slate-400">
            Create, configure, publish, and manage all earning offers for users.
          </p>
        </div>

        <button
          onClick={() => navigate('/tasks/create')}
          className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Create New Task</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-3xl bg-slate-900 border border-slate-800 shadow-md flex flex-col sm:flex-row items-center gap-3">
        {/* Search Input */}
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks by name or title..."
            className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl pl-10 pr-3.5 py-2 text-xs text-slate-200 outline-none transition-colors"
          />
        </div>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className="w-full sm:w-auto bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 outline-none"
        >
          <option value="all">All Status</option>
          <option value="published">Published</option>
          <option value="unpublished">Unpublished / Draft</option>
        </select>

        {/* Category Filter */}
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="w-full sm:w-auto bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 outline-none capitalize"
        >
          {categories.map((c) => (
            <option key={c} value={c}>
              Category: {c}
            </option>
          ))}
        </select>

        <button
          onClick={loadTasks}
          title="Refresh"
          className="p-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Tasks Table */}
      {loading ? (
        <TableSkeleton rows={5} cols={5} />
      ) : error ? (
        <div className="p-8 rounded-3xl bg-slate-900 border border-rose-500/30 text-center">
          <p className="text-xs text-rose-400 mb-3">{error}</p>
          <button
            onClick={loadTasks}
            className="px-4 py-2 rounded-xl bg-slate-800 text-xs font-bold text-slate-200"
          >
            Retry
          </button>
        </div>
      ) : filteredTasks.length > 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3.5 px-4">Task Info</th>
                  <th className="py-3.5 px-4">Prize</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Featured</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredTasks.map((t) => {
                  const isEditing = editingId === t.id
                  return (
                    <tr key={t.id} className="hover:bg-slate-800/30 transition-colors">
                      {/* Task Info */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={t.logo_url}
                            alt={t.name}
                            className="w-10 h-10 rounded-xl object-cover border border-slate-800 bg-slate-950 shrink-0"
                          />
                          <div className="min-w-0 max-w-xs">
                            <span className="font-bold text-white block truncate">
                              {t.name}
                            </span>
                            {isEditing ? (
                              <input
                                type="text"
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                                className="bg-slate-950 border border-emerald-500 rounded px-2 py-0.5 text-xs text-slate-200 w-full mt-1"
                              />
                            ) : (
                              <span className="text-[11px] text-slate-400 block truncate">
                                {t.title}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Prize */}
                      <td className="py-3 px-4">
                        {isEditing ? (
                          <input
                            type="number"
                            min="1"
                            value={editPrize}
                            onChange={(e) => setEditPrize(Number(e.target.value))}
                            className="bg-slate-950 border border-emerald-500 rounded px-2 py-0.5 text-xs text-emerald-400 font-bold w-20"
                          />
                        ) : (
                          <span className="font-extrabold text-emerald-400 font-heading">
                            ₹{t.prize_inr}
                          </span>
                        )}
                      </td>

                      {/* Category */}
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-full bg-slate-950 border border-slate-800 text-[10px] font-semibold text-slate-300">
                          {t.category || 'General'}
                        </span>
                      </td>

                      {/* Status Toggle */}
                      <td className="py-3 px-4">
                        <button
                          onClick={() => togglePublish(t)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold transition-colors cursor-pointer ${
                            t.published
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : 'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}
                        >
                          {t.published ? (
                            <>
                              <Eye className="w-3 h-3" />
                              <span>Live</span>
                            </>
                          ) : (
                            <>
                              <EyeOff className="w-3 h-3" />
                              <span>Draft</span>
                            </>
                          )}
                        </button>
                      </td>

                      {/* Featured Toggle */}
                      <td className="py-3 px-4">
                        <button
                          onClick={() => toggleFeatured(t)}
                          title="Toggle featured on Home"
                          className={`p-1.5 rounded-xl border transition-colors ${
                            t.featured
                              ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                              : 'text-slate-600 hover:text-slate-400 border-slate-800'
                          }`}
                        >
                          <Star className="w-4 h-4 fill-current" />
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {isEditing ? (
                            <>
                              <button
                                onClick={() => handleSaveInline(t)}
                                title="Save"
                                className="p-1.5 rounded-lg bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                title="Cancel"
                                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => {
                                  setEditingId(t.id)
                                  setEditTitle(t.title)
                                  setEditPrize(t.prize_inr)
                                }}
                                title="Quick Edit"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => navigate(`/tasks/edit/${t.id}`)}
                                title="Open Full Wizard"
                                className="p-1.5 rounded-lg text-emerald-400 hover:bg-emerald-500/10"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDuplicate(t)}
                                title="Duplicate Task"
                                className="p-1.5 rounded-lg text-cyan-400 hover:bg-cyan-500/10"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setDeleteTask(t)}
                                title="Delete Task"
                                className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/10"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="p-12 rounded-3xl bg-slate-900 border border-slate-800 text-center space-y-3">
          <CheckSquare className="w-10 h-10 text-slate-600 mx-auto" />
          <h3 className="text-sm font-bold text-slate-300">No tasks found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Get started by creating your first task using the step-by-step task wizard.
          </p>
          <button
            onClick={() => navigate('/tasks/create')}
            className="px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs"
          >
            Create Task Now
          </button>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!deleteTask}
        title="Delete Task Permanently?"
        message={`Are you sure you want to delete "${deleteTask?.name}"? All associated steps, terms, and submission history will be removed. This action cannot be undone.`}
        confirmText="Yes, Delete Task"
        cancelText="Cancel"
        variant="danger"
        isLoading={isDeleting}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTask(null)}
      />
    </div>
  )
}
