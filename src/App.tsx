import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AdminLayout } from './components/layout/AdminLayout'

// Page Imports
import { Login } from './pages/Login'
import { Dashboard } from './pages/Dashboard'
import { Tasks } from './pages/Tasks'
import { TaskWizard } from './pages/TaskWizard'
import { ProofReview } from './pages/ProofReview'
import { Withdrawals } from './pages/Withdrawals'
import { RedeemCodes } from './pages/RedeemCodes'
import { Users } from './pages/Users'
import { UserDetail } from './pages/UserDetail'
import { Leaderboard } from './pages/Leaderboard'
import { Referrals } from './pages/Referrals'
import { Banners } from './pages/Banners'
import { Settings } from './pages/Settings'
import { Notifications } from './pages/Notifications'
import { ContactMessages } from './pages/ContactMessages'
import { Reports } from './pages/Reports'
import { AuditLog } from './pages/AuditLog'

export const App: React.FC = () => {
  return (
    <Routes>
      {/* Public Auth Route */}
      <Route path="/login" element={<Login />} />

      {/* Protected Admin Routes */}
      <Route element={<AdminLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/tasks" element={<Tasks />} />
        <Route path="/tasks/new" element={<TaskWizard />} />
        <Route path="/tasks/:id/edit" element={<TaskWizard />} />
        <Route path="/proof-review" element={<ProofReview />} />
        <Route path="/withdrawals" element={<Withdrawals />} />
        <Route path="/redeem-codes" element={<RedeemCodes />} />
        <Route path="/users" element={<Users />} />
        <Route path="/users/:id" element={<UserDetail />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/referrals" element={<Referrals />} />
        <Route path="/banners" element={<Banners />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/contact" element={<ContactMessages />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/audit-log" element={<AuditLog />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
