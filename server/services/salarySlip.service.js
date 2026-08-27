import PDFDocument from 'pdfkit';
import { pool } from '../config/db.js';
import * as Payroll from '../models/payroll.model.js';

const money = (n) => `INR ${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Fetch everything needed to render a slip. */
async function slipData(payrollId) {
  const record = await Payroll.findById(payrollId);
  if (!record) return null;
  const [[employee]] = await pool.query(
    `SELECT e.*, d.department_name, ds.designation_name
     FROM employees e
     LEFT JOIN departments d ON d.id = e.department_id
     LEFT JOIN designations ds ON ds.id = e.designation_id
     WHERE e.id = :id`,
    { id: record.employee_id }
  );
  const [[company]] = await pool.query('SELECT * FROM companies ORDER BY id LIMIT 1');
  const payments = await Payroll.listPayments(payrollId);
  return { record, employee, company: company || {}, payments };
}

const MONTHS = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/**
 * Stream a professional salary-slip PDF to `res`.
 * @returns {Promise<boolean>} false if the payroll wasn't found
 */
export async function streamSalarySlip(payrollId, res) {
  const data = await slipData(payrollId);
  if (!data) return false;
  const { record, employee, company, payments } = data;

  const doc = new PDFDocument({ size: 'A4', margin: 48 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="salary-slip-${employee.employee_code}-${record.month}-${record.year}.pdf"`);
  doc.pipe(res);

  // Header
  doc.fontSize(18).fillColor('#1f2937').text(company.company_name || 'Company', { align: 'left' });
  doc.fontSize(9).fillColor('#6b7280');
  if (company.address) doc.text(company.address);
  const contact = [company.email, company.phone].filter(Boolean).join('  |  ');
  if (contact) doc.text(contact);
  if (company.gst_number) doc.text(`GST: ${company.gst_number}`);

  doc.moveDown(0.5);
  doc.fontSize(13).fillColor('#111827').text(`Salary Slip — ${MONTHS[record.month]} ${record.year}`, { align: 'right' });
  doc.moveTo(48, doc.y + 4).lineTo(547, doc.y + 4).strokeColor('#e5e7eb').stroke();
  doc.moveDown(0.8);

  // Employee block
  const top = doc.y;
  doc.fontSize(9).fillColor('#374151');
  doc.text(`Employee: ${employee.first_name} ${employee.last_name || ''}`, 48, top);
  doc.text(`Code: ${employee.employee_code}`);
  doc.text(`Department: ${employee.department_name || '-'}`);
  doc.text(`Designation: ${employee.designation_name || '-'}`);
  doc.text(`Payment Status: ${record.payment_status}`, 320, top);
  doc.text(`Bank: ${employee.bank_name || '-'}`);
  doc.text(`A/C: ${employee.account_number || '-'}`);
  doc.text(`UPI: ${employee.upi_id || '-'}`);
  doc.moveDown(1);

  // Attendance summary
  doc.fontSize(10).fillColor('#111827').text('Attendance Summary', { underline: true });
  doc.fontSize(9).fillColor('#374151').text(
    `Working Days: ${record.working_days}   Present: ${record.present_days}   Absent: ${record.absent_days}   Half-days: ${record.half_days}   Overtime: ${record.overtime_hours} hrs`
  );
  doc.moveDown(0.8);

  // Earnings / deductions two-column table
  const earnings = [
    ['Basic', record.basic],
    ['House Allowance', record.house_allowance],
    ['Medical Allowance', record.medical_allowance],
    ['Travel Allowance', record.travel_allowance],
    ['Food Allowance', record.food_allowance],
    ['Overtime', record.overtime_amount],
    ['Bonus / Incentives', record.bonus_total],
  ].filter(([, v]) => Number(v) !== 0);
  const deductions = [
    ['Tax', record.tax],
    ['PF', record.pf],
    ['ESI', record.esi],
    ['Advance Recovery', record.advance_recovery],
    ['Loan Recovery', record.loan_recovery],
    ['Late Penalty', record.late_penalty],
    ['Absent Deduction', record.absent_deduction],
    ['Half-day Deduction', record.halfday_deduction],
    ['Other Deductions', record.other_deductions],
  ].filter(([, v]) => Number(v) !== 0);

  const startY = doc.y;
  doc.fontSize(10).fillColor('#065f46').text('Earnings', 48, startY);
  doc.fontSize(10).fillColor('#991b1b').text('Deductions', 320, startY);
  doc.moveDown(0.3);

  let ly = doc.y;
  doc.fontSize(9).fillColor('#374151');
  earnings.forEach(([label, val]) => {
    doc.text(label, 48, ly); doc.text(money(val), 200, ly, { width: 90, align: 'right' });
    ly += 16;
  });
  let ry = startY + 18;
  deductions.forEach(([label, val]) => {
    doc.text(label, 320, ry); doc.text(money(val), 470, ry, { width: 77, align: 'right' });
    ry += 16;
  });

  const tableBottom = Math.max(ly, ry) + 6;
  doc.moveTo(48, tableBottom).lineTo(547, tableBottom).strokeColor('#e5e7eb').stroke();
  doc.y = tableBottom + 6;
  doc.fontSize(9).fillColor('#111827');
  doc.text(`Gross: ${money(record.gross_amount)}`, 48, doc.y);
  doc.text(`Total Deductions: ${money(record.total_deductions)}`, 320, doc.y - 12, { width: 227, align: 'right' });
  doc.moveDown(0.5);

  // Net + payment
  doc.fontSize(12).fillColor('#1d4ed8').text(`Net Salary: ${money(record.net_amount)}`, { align: 'left' });
  doc.fontSize(9).fillColor('#374151');
  doc.text(`Paid: ${money(record.paid_amount)}    Remaining: ${money(record.remaining_amount)}`);
  if (Number(record.previous_pending) > 0) doc.text(`Previous Pending: ${money(record.previous_pending)}    Outstanding: ${money(record.outstanding)}`);
  if (record.last_payment_date) doc.text(`Last Payment: ${record.last_payment_date}`);

  // Payment history
  if (payments.length) {
    doc.moveDown(0.8).fontSize(10).fillColor('#111827').text('Payment History', { underline: true });
    doc.fontSize(8).fillColor('#374151');
    payments.forEach((p) => {
      doc.text(`${p.payment_date}  •  ${money(p.amount)}  •  ${p.payment_method}${p.transaction_id ? `  •  ${p.transaction_id}` : ''}  •  remaining ${money(p.remaining_after)}`);
    });
  }

  // Signature area
  doc.moveDown(2.5);
  const sy = doc.y;
  doc.fontSize(8).fillColor('#6b7280');
  doc.text('_____________________', 48, sy); doc.text('Employee Signature', 48, sy + 12);
  doc.text('_____________________', 380, sy); doc.text('Authorized Signatory', 380, sy + 12);
  doc.moveDown(3).fontSize(7).fillColor('#9ca3af').text('This is a system-generated salary slip.', { align: 'center' });

  doc.end();
  return true;
}
