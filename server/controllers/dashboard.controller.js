import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';
import * as Dash from '../models/dashboard.model.js';

// GET /api/dashboard/stats
export const stats = asyncHandler(async (req, res) => {
  const [employees, salary, attendance, company] = await Promise.all([
    Dash.employeeStats(),
    Dash.salaryStats(),
    Dash.attendanceStats(),
    Dash.companyStats(),
  ]);
  return sendSuccess(res, { data: { employees, salary, attendance, company } });
});

// GET /api/dashboard/charts?months=6
export const charts = asyncHandler(async (req, res) => {
  const months = Math.min(24, Math.max(3, Number(req.query.months) || 6));
  const [salaryExpense, growth, salaryStatus, deptDistribution] = await Promise.all([
    Dash.monthlySalaryExpense(months),
    Dash.employeeGrowth(months),
    Dash.salaryStatusBreakdown(),
    Dash.departmentDistribution(),
  ]);
  return sendSuccess(res, {
    data: { salaryExpense, employeeGrowth: growth, salaryStatus, departmentDistribution: deptDistribution },
  });
});

// GET /api/dashboard/widgets
export const widgets = asyncHandler(async (req, res) => {
  const [
    recentEmployees, latestPayments, upcomingBirthdays,
    workAnniversaries, recentLeaves, pendingSalaryAlerts, recentActivity,
  ] = await Promise.all([
    Dash.recentEmployees(),
    Dash.latestPayments(),
    Dash.upcomingBirthdays(),
    Dash.workAnniversaries(),
    Dash.recentLeaves(),
    Dash.pendingSalaryAlerts(),
    Dash.recentActivity(),
  ]);
  return sendSuccess(res, {
    data: {
      recentEmployees, latestPayments, upcomingBirthdays,
      workAnniversaries, recentLeaves, pendingSalaryAlerts, recentActivity,
    },
  });
});
