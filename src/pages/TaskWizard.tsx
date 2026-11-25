import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  Copy,
  Upload,
  Sparkles,
  ExternalLink,
  Save,
  Layers,
  MoveUp,
  MoveDown
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Task, TaskStep, TaskTerm, Category, CustomBadge } from '../types'
import { logAdminAction } from '../lib/audit'
import { useAdminAuth } from '../context/AdminAuthContext'

export const TaskWizard: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { admin } = useAdminAuth()

  const [currentStep, setCurrentStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Categories & Badges from DB
  const [categories, setCategories] = useState<Category[]>([])
  const [availableBadges, setAvailableBadges] = useState<CustomBadge[]>([])

  // Form State
  const [taskData, setTaskData] = useState<Partial<Task>>({
    name: '',
    title: '',
    category: 'Finance & Banking',
    prize_inr: 50,
    play_store_url: '',
    logo_url: '',
    banner_url: '',
    demo_proof_url: '',
    proof_max_images: 5,
    featured: false,
    published: true,
    status: 'published',
    badge_hot: true,
    badge_exclusive: false,
    badge_new: true,
    badge_limited: false,
    internal_note: ''
  })

  // Steps state (Default 5 standard steps)
  const [steps, setSteps] = useState<Partial<TaskStep>[]>([
    {
      step_order: 1,
      title: 'Download the App',
      body: 'Click on Open in Play Store button, download and install the official app.',
      min_payment_amount: 0
    },
    {
      step_order: 2,
      title: 'Complete Registration',
      body: 'Open the app, sign up with your active mobile number and complete basic profile registration.',
      min_payment_amount: 0
    },
    {
      step_order: 3,
      title: 'Bind Bank Account / KYC',
      body: 'Link your bank account or complete basic PAN/Aadhaar verification in the app.',
      min_payment_amount: 0
    },
    {
      step_order: 4,
      title: 'Make First Payment / Deposit',
      body: 'Complete your first transaction or deposit of minimum amount to qualify.',
      min_payment_amount: 5
    },
    {
      step_order: 5,
      title: 'Submit Screenshot Proof',
      body: 'Upload clear screenshots showing registration and payment confirmation.',
      min_payment_amount: 0
    }
  ])

  // Terms state
  const [terms, setTerms] = useState<Partial<TaskTerm>[]>([
    {
      term_order: 1,
      title: 'New Users Only',
      body: 'This task is valid only for users registering on this application for the first time.'
    },
    {
      term_order: 2,
      title: 'Authentic Proofs',
      body: 'Proofs must clearly show registered phone number and timestamp. Tampered images will lead to account suspension.'
    }
  ])

  // Proof Settings
  const [acceptedFormats, setAcceptedFormats] = useState(['PNG', 'JPG', 'WebP'])
  const [proofInstructions, setProofInstructions] = useState(
    'Please capture and upload clear screenshots of your registration and transaction.'
  )

  useEffect(() => {
    // Load categories & badges
    const loadMeta = async () => {
      const { data: catData } = await supabase.from('categories').select('*').order('sort_order')
      if (catData) setCategories(catData)

      const { data: bData } = await supabase.from('badges').select('*')
      if (bData) setAvailableBadges(bData)
    }
    loadMeta()

    // If editing existing task
    if (id) {
      const loadExisting = async () => {
        setLoading(true)
        try {
          const { data: t } = await supabase.from('tasks').select('*').eq('id', id).single()
          if (t) setTaskData(t)

          const { data: s } = await supabase
            .from('task_steps')
            .select('*')
            .eq('task_id', id)
            .order('step_order')
          if (s && s.length > 0) setSteps(s)

          const { data: tm } = await supabase
            .from('task_terms')
            .select('*')
            .eq('task_id', id)
            .order('term_order')
          if (tm && tm.length > 0) setTerms(tm)
        } finally {
          setLoading(false)
        }
      }
      loadExisting()
    }
  }, [id])

  // Step Validation logic
  const validateStep = (stepNum: number): boolean => {
    const errs: Record<string, string> = {}

    if (stepNum === 1) {
      if (!taskData.name?.trim()) errs.name = 'Task name is required (max 80 chars).'
      if (taskData.name && taskData.name.length > 80) errs.name = 'Name cannot exceed 80 characters.'
      if (!taskData.prize_inr || taskData.prize_inr < 1) errs.prize = 'Prize must be at least ₹1.'
      if (!taskData.play_store_url?.trim()) errs.playStore = 'Play Store URL is required.'
      if (!taskData.logo_url?.trim()) errs.logo = 'App logo URL is required.'
    } else if (stepNum === 2) {
      if (steps.length === 0) errs.steps = 'At least one step is required.'
      steps.forEach((s, idx) => {
        if (!s.title?.trim()) errs[`step_${idx}`] = `Step ${idx + 1} title is required.`
      })
    } else if (stepNum === 3) {
      if (!taskData.proof_max_images || taskData.proof_max_images < 1) {
        errs.proofMax = 'Proof max images must be between 1 and 20.'
      }
    } else if (stepNum === 4) {
      terms.forEach((t, idx) => {
        if (!t.title?.trim() || !t.body?.trim()) {
          errs[`term_${idx}`] = `Term ${idx + 1} requires both a title and body.`
        }
      })
    }

    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, 7))
    }
  }

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1))
  }

  // Save Task
  const handleSave = async (publishImmediate = false) => {
    if (!validateStep(1) || !validateStep(2) || !validateStep(3) || !validateStep(4)) {
      alert('Please resolve all validation errors before saving.')
      return
    }

    setIsSaving(true)
    try {
      const payload = {
        ...taskData,
        published: publishImmediate ? true : taskData.published,
        status: publishImmediate ? 'published' : taskData.status || 'draft'
      }

      let taskId = id

      if (id) {
        // Update existing task
        const { error: upErr } = await supabase.from('tasks').update(payload).eq('id', id)
        if (upErr) throw upErr

        // Delete & recreate steps & terms
        await supabase.from('task_steps').delete().eq('task_id', id)
        await supabase.from('task_terms').delete().eq('task_id', id)
      } else {
        // Insert new task
        const { data: newT, error: insErr } = await supabase
          .from('tasks')
          .insert(payload)
          .select()
          .single()

        if (insErr) throw insErr
        taskId = newT.id
      }

      // Insert steps
      if (steps.length > 0) {
        const stepPayload = steps.map((s, idx) => ({
          task_id: taskId,
          step_order: idx + 1,
          title: s.title || `Step ${idx + 1}`,
          body: s.body || '',
          image_url: s.image_url || null,
          min_payment_amount: s.min_payment_amount || 0
        }))
        await supabase.from('task_steps').insert(stepPayload)
      }

      // Insert terms
      if (terms.length > 0) {
        const termPayload = terms.map((t, idx) => ({
          task_id: taskId,
          term_order: idx + 1,
          title: t.title || `Term ${idx + 1}`,
          body: t.body || ''
        }))
        await supabase.from('task_terms').insert(termPayload)
      }

      await logAdminAction({
        adminId: admin?.id,
        adminEmail: admin?.email,
        action: id ? 'UPDATE_TASK' : 'CREATE_TASK',
        entityType: 'tasks',
        entityId: taskId,
        afterVal: payload
      })

      alert('Task saved successfully!')
      navigate('/tasks')
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Error saving task')
    } finally {
      setIsSaving(false)
    }
  }

  // Steps Handlers
  const addStep = () => {
    setSteps((prev) => [
      ...prev,
      {
        step_order: prev.length + 1,
        title: `Step ${prev.length + 1}`,
        body: '',
        min_payment_amount: 0
      }
    ])
  }

  const removeStep = (index: number) => {
    if (steps.length <= 1) return
    setSteps((prev) => prev.filter((_, i) => i !== index))
  }

  const moveStep = (index: number, direction: 'up' | 'down') => {
    const newIdx = direction === 'up' ? index - 1 : index + 1
    if (newIdx < 0 || newIdx >= steps.length) return
    const updated = [...steps]
    const temp = updated[index]
    updated[index] = updated[newIdx]
    updated[newIdx] = temp
    setSteps(updated)
  }

  // Terms Handlers
  const addTerm = () => {
    setTerms((prev) => [
      ...prev,
      {
        term_order: prev.length + 1,
        title: `Rule ${prev.length + 1}`,
        body: ''
      }
    ])
  }

  const removeTerm = (index: number) => {
    setTerms((prev) => prev.filter((_, i) => i !== index))
  }

  const stepTitles = [
    'Basic Info',
    'Task Steps',
    'Proof Settings',
    'Terms & Conditions',
    'Badges & Visibility',
    'Schedule & Notes',
    'Review & Save'
  ]

  if (loading) {
    return <div className="p-12 text-center text-xs text-slate-400">Loading task data...</div>
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-24">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/tasks')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Tasks
        </button>
        <span className="text-xs font-mono text-emerald-400 font-bold">
          Step {currentStep} of 7: {stepTitles[currentStep - 1]}
        </span>
      </div>

      {/* Step Indicators Bar */}
      <div className="grid grid-cols-7 gap-1.5 p-1.5 rounded-2xl bg-slate-900 border border-slate-800">
        {stepTitles.map((title, idx) => {
          const stepNum = idx + 1
          const isDone = stepNum < currentStep
          const isCurrent = stepNum === currentStep
          return (
            <button
              key={idx}
              onClick={() => {
                if (stepNum < currentStep || validateStep(currentStep)) {
                  setCurrentStep(stepNum)
                }
              }}
              className={`py-2 px-1 rounded-xl text-[10px] font-bold text-center truncate transition-all ${
                isCurrent
                  ? 'bg-emerald-500 text-slate-950 shadow-md'
                  : isDone
                  ? 'bg-slate-800 text-emerald-400'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {stepNum}. {title}
            </button>
          )
        })}
      </div>

      {/* Main Wizard Form Body */}
      <div className="p-6 sm:p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-6">
        {/* STEP 1: BASIC INFO */}
        {currentStep === 1 && (
          <div className="space-y-4">
            <h3 className="text-base font-bold text-white font-heading">
              Step 1: Task Identity & Prize
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs font-semibold text-slate-300 block">
                  Task Name * <span className="text-slate-500 font-normal">(Max 80 chars)</span>
                </label>
                <input
                  type="text"
                  maxLength={80}
                  value={taskData.name}
                  onChange={(e) => setTaskData({ ...taskData, name: e.target.value })}
                  placeholder="e.g. Angel One Demat Account"
                  className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 outline-none"
                />
                {errors.name && <span className="text-[11px] text-rose-400">{errors.name}</span>}
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs font-semibold text-slate-300 block">
                  Subtitle / Promo Title <span className="text-slate-500 font-normal">(Max 120 chars)</span>
                </label>
                <input
                  type="text"
                  maxLength={120}
                  value={taskData.title}
                  onChange={(e) => setTaskData({ ...taskData, title: e.target.value })}
                  placeholder="e.g. Register, Complete KYC & Make 1st Trade"
                  className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 block">
                  Prize in INR (₹) *
                </label>
                <input
                  type="number"
                  min="1"
                  value={taskData.prize_inr}
                  onChange={(e) => setTaskData({ ...taskData, prize_inr: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-xs text-emerald-400 font-bold outline-none"
                />
                {errors.prize && <span className="text-[11px] text-rose-400">{errors.prize}</span>}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 block">Category</label>
                <select
                  value={taskData.category}
                  onChange={(e) => setTaskData({ ...taskData, category: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 outline-none"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                  <option value="General">General</option>
                </select>
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs font-semibold text-slate-300 block">
                  Play Store App Link *
                </label>
                <input
                  type="url"
                  value={taskData.play_store_url}
                  onChange={(e) => setTaskData({ ...taskData, play_store_url: e.target.value })}
                  placeholder="https://play.google.com/store/apps/details?id=..."
                  className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 outline-none font-mono"
                />
                {errors.playStore && (
                  <span className="text-[11px] text-rose-400">{errors.playStore}</span>
                )}
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs font-semibold text-slate-300 block">
                  App Logo Image URL * <span className="text-slate-500 font-normal">(Square ratio, PNG/JPG/WebP)</span>
                </label>
                <input
                  type="text"
                  value={taskData.logo_url}
                  onChange={(e) => setTaskData({ ...taskData, logo_url: e.target.value })}
                  placeholder="https://..."
                  className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 outline-none font-mono"
                />
                {errors.logo && <span className="text-[11px] text-rose-400">{errors.logo}</span>}
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs font-semibold text-slate-300 block">
                  Banner Image URL (16:9 ratio, optional)
                </label>
                <input
                  type="text"
                  value={taskData.banner_url || ''}
                  onChange={(e) => setTaskData({ ...taskData, banner_url: e.target.value })}
                  placeholder="https://..."
                  className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 outline-none font-mono"
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs font-semibold text-slate-300 block">
                  Demo Proof Screenshot URL (Optional preview for users)
                </label>
                <input
                  type="text"
                  value={taskData.demo_proof_url || ''}
                  onChange={(e) => setTaskData({ ...taskData, demo_proof_url: e.target.value })}
                  placeholder="https://..."
                  className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 outline-none font-mono"
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: STEPS */}
        {currentStep === 2 && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white font-heading">
                  Step 2: Task Instructions Roadmap (5 Steps)
                </h3>
                <p className="text-xs text-slate-400">
                  Define sequential instructional cards for the user.
                </p>
              </div>
              <button
                type="button"
                onClick={addStep}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-emerald-400 flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add Step
              </button>
            </div>

            <div className="space-y-4">
              {steps.map((s, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3 relative group"
                >
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="text-xs font-mono font-bold text-emerald-400 uppercase">
                      Step {idx + 1}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => moveStep(idx, 'up')}
                        disabled={idx === 0}
                        className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-30"
                      >
                        <MoveUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveStep(idx, 'down')}
                        disabled={idx === steps.length - 1}
                        className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-30"
                      >
                        <MoveDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeStep(idx)}
                        className="p-1 rounded text-rose-400 hover:bg-rose-500/10"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1 sm:col-span-2">
                      <label className="text-[11px] font-semibold text-slate-400 block">
                        Step Title *
                      </label>
                      <input
                        type="text"
                        value={s.title || ''}
                        onChange={(e) => {
                          const updated = [...steps]
                          updated[idx].title = e.target.value
                          setSteps(updated)
                        }}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-100 outline-none"
                      />
                    </div>

                    <div className="space-y-1 sm:col-span-2">
                      <label className="text-[11px] font-semibold text-slate-400 block">
                        Step Description / Instructions
                      </label>
                      <textarea
                        rows={2}
                        value={s.body || ''}
                        onChange={(e) => {
                          const updated = [...steps]
                          updated[idx].body = e.target.value
                          setSteps(updated)
                        }}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-xs text-slate-200 outline-none"
                      />
                    </div>

                    {idx === 3 && (
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-slate-400 block">
                          Minimum Payment Amount (₹)
                        </label>
                        <input
                          type="number"
                          value={s.min_payment_amount || 5}
                          onChange={(e) => {
                            const updated = [...steps]
                            updated[idx].min_payment_amount = Number(e.target.value)
                            setSteps(updated)
                          }}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-100 outline-none"
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP 3: PROOF SETTINGS */}
        {currentStep === 3 && (
          <div className="space-y-4">
            <h3 className="text-base font-bold text-white font-heading">
              Step 3: Proof Submission Requirements
            </h3>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 block">
                  Maximum Screenshots per Submission (1 - 20)
                </label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={taskData.proof_max_images}
                  onChange={(e) =>
                    setTaskData({ ...taskData, proof_max_images: Number(e.target.value) })
                  }
                  className="w-full max-w-xs bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100"
                />
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-slate-400">
                <span className="font-semibold text-slate-200 block mb-1">
                  File Size Restriction
                </span>
                Maximum file size per image is fixed at <strong>5 MB</strong> to ensure smooth uploads and avoid server storage exhaustion.
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 block">
                  Proof Instructions for Users
                </label>
                <textarea
                  rows={3}
                  value={proofInstructions}
                  onChange={(e) => setProofInstructions(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-slate-100 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-2">
                  Accepted Image Formats
                </label>
                <div className="flex gap-3">
                  {['PNG', 'JPG', 'WebP'].map((fmt) => (
                    <label
                      key={fmt}
                      className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={acceptedFormats.includes(fmt)}
                        onChange={(e) => {
                          if (e.target.checked) setAcceptedFormats([...acceptedFormats, fmt])
                          else setAcceptedFormats(acceptedFormats.filter((f) => f !== fmt))
                        }}
                        className="rounded accent-emerald-500"
                      />
                      <span>.{fmt.toLowerCase()}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: TERMS & CONDITIONS */}
        {currentStep === 4 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white font-heading">
                Step 4: Terms and Conditions Cards
              </h3>
              <button
                type="button"
                onClick={addTerm}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-emerald-400 flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add Rule
              </button>
            </div>

            <div className="space-y-3">
              {terms.map((t, idx) => (
                <div key={idx} className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-slate-400">Rule #{idx + 1}</span>
                    <button
                      type="button"
                      onClick={() => removeTerm(idx)}
                      className="text-rose-400 hover:text-rose-300 text-xs"
                    >
                      Remove
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder="Rule title (e.g. Device Limitation)"
                    value={t.title || ''}
                    onChange={(e) => {
                      const updated = [...terms]
                      updated[idx].title = e.target.value
                      setTerms(updated)
                    }}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-100"
                  />
                  <textarea
                    rows={2}
                    placeholder="Rule description..."
                    value={t.body || ''}
                    onChange={(e) => {
                      const updated = [...terms]
                      updated[idx].body = e.target.value
                      setTerms(updated)
                    }}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-xs text-slate-200"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP 5: BADGES & VISIBILITY */}
        {currentStep === 5 && (
          <div className="space-y-5">
            <h3 className="text-base font-bold text-white font-heading">
              Step 5: Badges & Featured Placement
            </h3>

            <div className="space-y-3">
              <span className="text-xs font-bold text-slate-300 block">Offer Badges</span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <label className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between cursor-pointer">
                  <span className="text-xs font-bold text-rose-400">🔥 Hot Offer</span>
                  <input
                    type="checkbox"
                    checked={taskData.badge_hot}
                    onChange={(e) => setTaskData({ ...taskData, badge_hot: e.target.checked })}
                    className="accent-emerald-500 w-4 h-4"
                  />
                </label>

                <label className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between cursor-pointer">
                  <span className="text-xs font-bold text-amber-400">⭐ Exclusive</span>
                  <input
                    type="checkbox"
                    checked={taskData.badge_exclusive}
                    onChange={(e) => setTaskData({ ...taskData, badge_exclusive: e.target.checked })}
                    className="accent-emerald-500 w-4 h-4"
                  />
                </label>

                <label className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between cursor-pointer">
                  <span className="text-xs font-bold text-emerald-400">✨ New</span>
                  <input
                    type="checkbox"
                    checked={taskData.badge_new}
                    onChange={(e) => setTaskData({ ...taskData, badge_new: e.target.checked })}
                    className="accent-emerald-500 w-4 h-4"
                  />
                </label>

                <label className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between cursor-pointer">
                  <span className="text-xs font-bold text-indigo-400">⏱ Limited</span>
                  <input
                    type="checkbox"
                    checked={taskData.badge_limited}
                    onChange={(e) => setTaskData({ ...taskData, badge_limited: e.target.checked })}
                    className="accent-emerald-500 w-4 h-4"
                  />
                </label>
              </div>

              <div className="pt-3 border-t border-slate-800 space-y-3">
                <label className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between cursor-pointer">
                  <div>
                    <span className="text-xs font-bold text-white block">Featured on Home Screen</span>
                    <span className="text-[11px] text-slate-400 block">
                      Promotes this task on user home page top featured carousel
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={taskData.featured}
                    onChange={(e) => setTaskData({ ...taskData, featured: e.target.checked })}
                    className="accent-emerald-500 w-5 h-5"
                  />
                </label>
              </div>
            </div>
          </div>
        )}

        {/* STEP 6: PUBLISH & SCHEDULE */}
        {currentStep === 6 && (
          <div className="space-y-4">
            <h3 className="text-base font-bold text-white font-heading">
              Step 6: Publication Status & Admin Notes
            </h3>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 block">Status *</label>
                <div className="flex gap-3">
                  {(['published', 'draft', 'unpublished'] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() =>
                        setTaskData({
                          ...taskData,
                          status: st,
                          published: st === 'published'
                        })
                      }
                      className={`px-4 py-2 rounded-xl text-xs font-bold capitalize transition-colors ${
                        taskData.status === st
                          ? 'bg-emerald-500 text-slate-950 shadow-md'
                          : 'bg-slate-950 text-slate-400 border border-slate-800'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300 block">
                    Scheduled Publish Date/Time (Optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={taskData.scheduled_publish_at || ''}
                    onChange={(e) =>
                      setTaskData({ ...taskData, scheduled_publish_at: e.target.value })
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300 block">
                    Scheduled Unpublish Date/Time (Optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={taskData.scheduled_unpublish_at || ''}
                    onChange={(e) =>
                      setTaskData({ ...taskData, scheduled_unpublish_at: e.target.value })
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 block">
                  Internal Admin Note (Not shown to users)
                </label>
                <textarea
                  rows={3}
                  value={taskData.internal_note || ''}
                  onChange={(e) => setTaskData({ ...taskData, internal_note: e.target.value })}
                  placeholder="Notes about advertiser payout, affiliate link source, or campaigns..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-slate-200 outline-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 7: REVIEW & SAVE */}
        {currentStep === 7 && (
          <div className="space-y-6">
            <h3 className="text-base font-bold text-white font-heading">
              Step 7: Final Preview & Verification
            </h3>

            {/* Live Card Preview */}
            <div className="p-5 rounded-3xl bg-slate-950 border border-slate-800 space-y-4">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                User Card Preview
              </span>

              <div className="flex items-center gap-4">
                <img
                  src={taskData.logo_url || 'https://via.placeholder.com/80'}
                  alt="Preview"
                  className="w-14 h-14 rounded-2xl object-cover bg-slate-900 border border-slate-800"
                />
                <div className="flex-1 min-w-0">
                  <h4 className="text-base font-bold text-white truncate font-heading">
                    {taskData.name || 'Task Name'}
                  </h4>
                  <p className="text-xs text-slate-400 line-clamp-1">{taskData.title}</p>
                  <span className="text-[10px] text-emerald-400 font-semibold block mt-1">
                    {taskData.category} • Max {taskData.proof_max_images} proof images
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xl font-black text-emerald-400 font-heading block">
                    ₹{taskData.prize_inr}
                  </span>
                  <span className="text-[10px] text-slate-500 uppercase font-bold">Reward</span>
                </div>
              </div>
            </div>

            {/* Validation Checklist */}
            <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2 text-xs">
              <span className="font-bold text-slate-300 block">Pre-flight Validation:</span>
              <div className="flex items-center gap-2 text-emerald-400">
                <Check className="w-4 h-4" />
                <span>Task identity and valid Play Store URL confirmed</span>
              </div>
              <div className="flex items-center gap-2 text-emerald-400">
                <Check className="w-4 h-4" />
                <span>{steps.length} sequential steps configured</span>
              </div>
              <div className="flex items-center gap-2 text-emerald-400">
                <Check className="w-4 h-4" />
                <span>{terms.length} terms and conditions rules saved</span>
              </div>
            </div>
          </div>
        )}

        {/* Wizard Footer Controls */}
        <div className="flex items-center justify-between pt-5 border-t border-slate-800">
          <button
            type="button"
            onClick={handleBack}
            disabled={currentStep === 1}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs disabled:opacity-40 transition-colors"
          >
            Back
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isSaving}
              onClick={() => handleSave(false)}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center gap-1.5 transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Draft</span>
            </button>

            {currentStep < 7 ? (
              <button
                type="button"
                onClick={handleNext}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-md shadow-emerald-500/20 active:scale-95 transition-all"
              >
                <span>Next Step</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                disabled={isSaving}
                onClick={() => handleSave(true)}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-500/25 active:scale-95 transition-all"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isSaving ? 'Publishing...' : 'Publish Task Live'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
