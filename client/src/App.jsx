import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './routes/ProtectedRoute.jsx';
import DashboardLayout from './layouts/DashboardLayout.jsx';
import FullPageLoader from './components/common/FullPageLoader.jsx';
import { useAuth } from './context/AuthContext.jsx';
import { landingPath } from './utils/permissions.js';

// Lazy-loaded pages → automatic code-splitting per route.
const Login = lazy(() => import('./pages/Login.jsx'));
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const Employees = lazy(() => import('./pages/employees/EmployeeList.jsx'));
const EmployeeForm = lazy(() => import('./pages/employees/EmployeeForm.jsx'));
const EmployeeProfile = lazy(() => import('./pages/employees/EmployeeProfile.jsx'));
const Departments = lazy(() => import('./pages/Departments.jsx'));
const Designations = lazy(() => import('./pages/Designations.jsx'));
const Attendance = lazy(() => import('./pages/attendance/Attendance.jsx'));
const Shifts = lazy(() => import('./pages/attendance/Shifts.jsx'));
const Leaves = lazy(() => import('./pages/leave/Leaves.jsx'));
const LeaveTypes = lazy(() => import('./pages/leave/LeaveTypes.jsx'));
const Holidays = lazy(() => import('./pages/leave/Holidays.jsx'));
const Payroll = lazy(() => import('./pages/payroll/Payroll.jsx'));
const Advances = lazy(() => import('./pages/payroll/Advances.jsx'));
const Loans = lazy(() => import('./pages/payroll/Loans.jsx'));
const Users = lazy(() => import('./pages/Users.jsx'));
const Reports = lazy(() => import('./pages/Reports.jsx'));
const Settings = lazy(() => import('./pages/Settings.jsx'));
const AuditLogs = lazy(() => import('./pages/AuditLogs.jsx'));
// Employee self-service portal
const MyDashboard = lazy(() => import('./pages/me/Dashboard.jsx'));
const MyProfile = lazy(() => import('./pages/me/Profile.jsx'));
const MyAttendance = lazy(() => import('./pages/me/Attendance.jsx'));
const MyLeaves = lazy(() => import('./pages/me/Leaves.jsx'));
const MySalary = lazy(() => import('./pages/me/Salary.jsx'));
const MyDocuments = lazy(() => import('./pages/me/Documents.jsx'));
const NotFound = lazy(() => import('./pages/errors/NotFound.jsx'));
const Forbidden = lazy(() => import('./pages/errors/Forbidden.jsx'));

/** Send each role to the right landing page. */
function HomeRedirect() {
  const { user } = useAuth();
  return <Navigate to={landingPath(user?.role)} replace />;
}

export default function App() {
  return (
    <Suspense fallback={<FullPageLoader />}>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<HomeRedirect />} />
          <Route path="/dashboard" element={<ProtectedRoute permissions={['dashboard:read']}><Dashboard /></ProtectedRoute>} />

          <Route
            path="/employees"
            element={
              <ProtectedRoute permissions={['employee:read']}>
                <Employees />
              </ProtectedRoute>
            }
          />
          <Route
            path="/employees/new"
            element={
              <ProtectedRoute permissions={['employee:create']}>
                <EmployeeForm />
              </ProtectedRoute>
            }
          />
          <Route
            path="/employees/:id/edit"
            element={
              <ProtectedRoute permissions={['employee:update']}>
                <EmployeeForm />
              </ProtectedRoute>
            }
          />
          <Route
            path="/employees/:id"
            element={
              <ProtectedRoute permissions={['employee:read']}>
                <EmployeeProfile />
              </ProtectedRoute>
            }
          />

          <Route
            path="/departments"
            element={
              <ProtectedRoute permissions={['department:read']}>
                <Departments />
              </ProtectedRoute>
            }
          />
          <Route
            path="/designations"
            element={
              <ProtectedRoute permissions={['designation:read']}>
                <Designations />
              </ProtectedRoute>
            }
          />

          <Route path="/attendance" element={<ProtectedRoute permissions={['attendance:read']}><Attendance /></ProtectedRoute>} />
          <Route path="/shifts" element={<ProtectedRoute permissions={['shift:read']}><Shifts /></ProtectedRoute>} />
          <Route path="/leaves" element={<ProtectedRoute permissions={['leave:read']}><Leaves /></ProtectedRoute>} />
          <Route path="/leave-types" element={<ProtectedRoute permissions={['leavetype:read']}><LeaveTypes /></ProtectedRoute>} />
          <Route path="/holidays" element={<ProtectedRoute permissions={['holiday:read']}><Holidays /></ProtectedRoute>} />
          <Route path="/payroll" element={<ProtectedRoute permissions={['payroll:read']}><Payroll /></ProtectedRoute>} />
          <Route path="/advances" element={<ProtectedRoute permissions={['advance:read']}><Advances /></ProtectedRoute>} />
          <Route path="/loans" element={<ProtectedRoute permissions={['loan:read']}><Loans /></ProtectedRoute>} />

          {/* Admin / Super Admin */}
          <Route path="/users" element={<ProtectedRoute permissions={['user:read']}><Users /></ProtectedRoute>} />
          <Route path="/reports" element={<ProtectedRoute permissions={['report:read']}><Reports /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute permissions={['company:read']}><Settings /></ProtectedRoute>} />
          <Route path="/audit-logs" element={<ProtectedRoute permissions={['audit:read']}><AuditLogs /></ProtectedRoute>} />

          {/* Employee self-service */}
          <Route path="/me/dashboard" element={<ProtectedRoute permissions={['self:dashboard:read']}><MyDashboard /></ProtectedRoute>} />
          <Route path="/me/profile" element={<ProtectedRoute permissions={['self:profile:read']}><MyProfile /></ProtectedRoute>} />
          <Route path="/me/attendance" element={<ProtectedRoute permissions={['self:attendance:read']}><MyAttendance /></ProtectedRoute>} />
          <Route path="/me/leaves" element={<ProtectedRoute permissions={['self:leave:read']}><MyLeaves /></ProtectedRoute>} />
          <Route path="/me/salary" element={<ProtectedRoute permissions={['self:salary:read']}><MySalary /></ProtectedRoute>} />
          <Route path="/me/documents" element={<ProtectedRoute permissions={['self:document:read']}><MyDocuments /></ProtectedRoute>} />

          <Route path="/403" element={<Forbidden />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
