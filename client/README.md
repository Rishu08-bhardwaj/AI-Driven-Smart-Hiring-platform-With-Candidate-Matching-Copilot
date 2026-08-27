# HRMS Client

React + Vite frontend for the Business Employee & Payroll Management System.

## Stack
React 18 · Vite · React Router · TanStack Query · React Hook Form + Yup ·
Tailwind CSS · Chart.js · Framer Motion · React Hot Toast · React Icons · Axios

## Setup

```bash
cd client
npm install
npm run dev        # http://localhost:5173  (proxies /api → http://localhost:5000)
```

The backend (`../server`) must be running for data to load. The dev server
proxies `/api` and `/uploads` to `http://localhost:5000` (see `vite.config.js`).

```bash
npm run build      # production build → dist/
npm run preview    # serve the production build
```

## Sign in (seeded accounts)
| Role | Email | Password |
|------|-------|----------|
| Admin | admin@hrms.local | `Admin@123` |
| HR | hr@hrms.local | `Hr@12345` |
| Accountant | accounts@hrms.local | `Acc@12345` |

## Structure

```
src/
 ├── components/
 │    ├── common/      Spinner, Modal, ConfirmDialog, StatusBadge, Pagination,
 │    │                EmptyState, ErrorState, PageHeader, Avatar, FullPageLoader
 │    ├── forms/       RHF-friendly Input/Select/Textarea + Options
 │    ├── tables/      DataTable (sticky header, loading/empty/error states)
 │    ├── dashboard/   StatCard, ChartCard, chartSetup
 │    └── layout/      Sidebar, Navbar, navConfig
 ├── context/          AuthContext (login, refresh-aware, permission checks)
 ├── hooks/            useDebounce
 ├── layouts/          DashboardLayout (responsive sidebar + navbar)
 ├── pages/            Login, Dashboard, employees/*, Departments, Designations, errors/*
 ├── routes/           ProtectedRoute (auth + permission gating)
 ├── services/         apiClient (axios + token refresh) + service modules
 ├── utils/            permissions (client mirror)
 ├── validations/      Yup schemas
 ├── constants/        option maps, currency/date formatters
 ├── App.jsx           lazy-loaded routes
 └── main.jsx          providers (Query, Router, Auth, Toaster)
```

## Implemented
- JWT auth flow with silent access-token refresh + role-based route guards
- Responsive dashboard shell (sidebar drawer on mobile, top navbar, notifications)
- **Dashboard**: stat cards, 4 Chart.js charts, activity/widget panels
- **Employees**: list (search, filters, sort, pagination), add/edit (sectioned form
  + photo upload), profile (tabs: profile, salary, attendance, leave, documents, timeline)
- **Departments** & **Designations**: full CRUD with modal forms
- **Attendance**: daily list with filters, single + bulk marking, corrections (auto late/OT/hours), Shifts CRUD
- **Leave**: requests list, apply, approve/reject/cancel, Leave Types CRUD, Holidays CRUD
- **Payroll**: dashboard (KPIs + charts), period selector, preview→generate flow, detail modal
  (breakdown, partial payment, bonus/deduction, lock/unlock, **PDF slip download**), Advances + Loans
- Reusable table, modal, confirm dialog, toasts, loading/empty/error states throughout

Reports & Settings (Part 4) remain — those nav items are marked “Soon”.
