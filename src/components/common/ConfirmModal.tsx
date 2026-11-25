import React from 'react'
import { AlertTriangle, Info, CheckCircle2 } from 'lucide-react'
import { Modal } from './Modal'

interface ConfirmModalProps {
  isOpen: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: 'danger' | 'warning' | 'success'
  isDestructive?: boolean
  onConfirm: () => void | Promise<void>
  onCancel?: () => void
  onClose?: () => void
  isLoading?: boolean
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant,
  isDestructive = false,
  onConfirm,
  onCancel,
  onClose,
  isLoading = false
}) => {
  const handleClose = onCancel || onClose || (() => {})
  const computedVariant = variant || (isDestructive ? 'danger' : 'warning')

  const getIcon = () => {
    switch (computedVariant) {
      case 'danger':
        return (
          <div className="w-10 h-10 rounded-2xl bg-rose-500/15 text-rose-400 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
        )
      case 'success':
        return (
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        )
      default:
        return (
          <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0">
            <Info className="w-5 h-5" />
          </div>
        )
    }
  }

  const getButtonClass = () => {
    switch (computedVariant) {
      case 'danger':
        return 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30'
      case 'success':
        return 'bg-emerald-600 hover:bg-emerald-500 text-slate-950 shadow-emerald-600/30'
      default:
        return 'bg-amber-600 hover:bg-amber-500 text-slate-950 shadow-amber-600/30'
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={title}>
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          {getIcon()}
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed pt-1.5">{message}</p>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
          <button
            type="button"
            disabled={isLoading}
            onClick={handleClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            {cancelText}
          </button>
          <button
            type="button"
            disabled={isLoading}
            onClick={onConfirm}
            className={`px-5 py-2 rounded-xl text-xs font-bold shadow-lg transition-all active:scale-95 disabled:opacity-50 ${getButtonClass()}`}
          >
            {isLoading ? 'Processing...' : confirmText}
          </button>
        </div>
      </div>
    </Modal>
  )
}
