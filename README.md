# Cash Reward - Admin Console

Production-grade, dark-themed **Admin Panel** for the **Cash Reward** earning platform. Built with React 18, Vite, TypeScript, Tailwind CSS, Lucide icons, TanStack Table, Recharts, and Supabase.

Connected to the same unified Supabase project (`hkciawrgcqpometjlncb`) as the user mobile web application.

---

## Features & Modules

1. **Dashboard (`/`)**: Live KPI metrics (total users, new users today, pending submissions, pending cashouts, paid amounts), Recharts 7d/30d/1y payout timeline, quick action shortcuts, and Supabase Realtime alerts.
2. **Tasks (`/tasks`)**: Comprehensive task catalog table with inline price/title/status editing, filters, duplication, deletion, and publish toggles.
3. **Task Wizard (`/tasks/new`, `/tasks/:id/edit`)**: 7-step wizard with real-time validation (Basic Info, 5-Step Cards, Proof Settings, Terms & Conditions, Badges & Visibility, Publishing Schedule, and Preview).
4. **Proof Review (`/proof-review`)**: Proof queue with zoomable image viewer (zoom in/out/reset/fullscreen), next/previous navigation, atomic approval (`admin_approve_submission`), and reject modal with pre-configured reason templates.
5. **Withdrawals (`/withdrawals`)**: Cashout request management (UPI, Bank NEFT/IMPS, Google Play Redeem codes) with filters, status transition, mark as paid with bank reference (UTR), and rejection with atomic user wallet refund (`admin_reject_withdrawal`).
6. **Redeem Codes (`/redeem-codes`)**: Voucher & gift code pool manager with random code generator, direct user assignment, and expiry tracking.
7. **Users (`/users`, `/users/:id`)**: Searchable user directory, manual wallet balance adjustment (+/- credit/debit with reason), block/unblock controls, direct in-app messaging, and full JSON audit exports.
8. **Leaderboard & Demo Users (`/leaderboard`)**: Public ranking manager, visibility toggles (hide suspicious users from ranking), and demo user generator to stimulate organic app competition.
9. **Referrals & Milestones (`/referrals`)**: 2-level referral tracking tree, referral settings configuration, and custom milestone bonuses manager.
10. **Banners (`/banners`)**: Homepage hero banner manager with sort ordering, direct Supabase storage image upload, link routing, and active toggle.
11. **Platform Settings (`/settings`)**: Site name, logo, maintenance mode switch, contact channels (WhatsApp/Telegram/Email), reject templates CRUD, custom badges CRUD, and provider-agnostic transactional email gateway.
12. **Notifications (`/notifications`)**: Platform-wide broadcasts to all users and targeted 1-on-1 push messages.
13. **Contact Messages (`/contact`)**: Customer support inquiry inbox with resolution workflow.
14. **Reports & Exports (`/reports`)**: High-level platform health analytics and 1-click CSV/JSON bulk table downloads.
15. **Audit Log (`/audit-log`)**: Tamper-evident admin action log with search, filters, and before/after JSON state inspection.

---

## Local Development & Setup

### Prerequisites
- Node.js (v18+)
- npm or pnpm

### Environment Variables
Create a `.env` file in the project root:
```env
VITE_SUPABASE_URL=https://hkciawrgcqpometjlncb.supabase.co
VITE_SUPABASE_ANON_KEY=<your_supabase_anon_key>
```

### Installation & Run
```bash
# Install dependencies
npm install

# Start local admin dev server on port 5174
node node_modules/vite/bin/vite.js --host --port 5174
```

Visit: `http://localhost:5174`

### Production Build
```bash
node node_modules/typescript/bin/tsc --noEmit && node node_modules/vite/bin/vite.js build
```
The compiled output will be generated in `dist/`.

---

## Admin Credentials

- **Email**: `admin@cashreward.app` (or registered admin email)
- **Password**: Provided during initial admin setup
