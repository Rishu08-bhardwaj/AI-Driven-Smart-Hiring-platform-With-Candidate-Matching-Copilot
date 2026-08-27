import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { payrollService } from '../../services/index.js';
import { errorMessage } from '../../services/apiClient.js';
import { formatCurrency } from '../../constants/index.js';
import Modal from '../../components/common/Modal.jsx';
import Spinner from '../../components/common/Spinner.jsx';

const MONTHS = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Preview-then-generate flow for a month's payroll. */
export default function GenerateModal({ month, year, onClose, onDone }) {
  const [preview, setPreview] = useState(null);
  const [selected, setSelected] = useState(() => new Set());

  const previewMutation = useMutation({
    mutationFn: () => payrollService.preview({ month, year }),
    onSuccess: (res) => {
      setPreview(res.data);
      // Pre-select every employee who doesn't already have a payroll this month.
      setSelected(new Set((res.data?.preview || []).filter((p) => !p.alreadyGenerated).map((p) => p.employee_id)));
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const generateMutation = useMutation({
    mutationFn: () => payrollService.generate({ month, year, employee_ids: Array.from(selected) }),
    onSuccess: (res) => {
      toast.success(res.message || 'Payroll generated.');
      onDone();
      onClose();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const generatable = preview?.preview?.filter((p) => !p.alreadyGenerated) || [];
  const allSelected = generatable.length > 0 && generatable.every((p) => selected.has(p.employee_id));
  const toggle = (empId) => setSelected((s) => {
    const next = new Set(s);
    if (next.has(empId)) next.delete(empId); else next.add(empId);
    return next;
  });
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(generatable.map((p) => p.employee_id)));

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={`Generate Payroll · ${MONTHS[month]} ${year}`}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          {!preview ? (
            <button className="btn-primary" onClick={() => previewMutation.mutate()} disabled={previewMutation.isPending}>
              {previewMutation.isPending && <Spinner size={16} className="text-white" />} Preview
            </button>
          ) : (
            <button className="btn-primary" onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending || selected.size === 0}>
              {generateMutation.isPending && <Spinner size={16} className="text-white" />} Generate {selected.size || ''}
            </button>
          )}
        </>
      }
    >
      {!preview ? (
        <p className="text-sm text-slate-600">
          Preview computes each eligible employee’s salary from attendance, leave, advances and loans — without saving.
          Review it, then confirm to generate. Already-generated and ineligible employees are skipped automatically.
        </p>
      ) : (
        <div>
          <div className="mb-3 flex flex-wrap gap-3 text-sm">
            <span className="rounded-md bg-emerald-50 px-2 py-1 text-emerald-700">{selected.size} selected</span>
            <span className="rounded-md bg-slate-100 px-2 py-1 text-slate-600">{preview.preview.length - generatable.length} already generated</span>
            <span className="rounded-md bg-amber-50 px-2 py-1 text-amber-700">{preview.skipped.length} skipped</span>
          </div>
          <p className="mb-2 text-xs text-slate-500">Tick only the employees you want to generate — untick the rest to generate for specific people.</p>
          <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2 w-8">
                    <input type="checkbox" checked={allSelected} onChange={toggleAll} disabled={generatable.length === 0}
                      className="rounded border-slate-300 text-brand-600 focus:ring-brand-500" title="Select all" />
                  </th>
                  <th className="px-3 py-2">Employee</th>
                  <th className="px-3 py-2 text-right">Gross</th>
                  <th className="px-3 py-2 text-right">Deductions</th>
                  <th className="px-3 py-2 text-right">Net</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {preview.preview.map((p) => (
                  <tr
                    key={p.employee_id}
                    className={p.alreadyGenerated ? 'text-slate-400' : 'cursor-pointer hover:bg-slate-50'}
                    onClick={() => !p.alreadyGenerated && toggle(p.employee_id)}
                  >
                    <td className="px-3 py-2">
                      {!p.alreadyGenerated && (
                        <input type="checkbox" checked={selected.has(p.employee_id)} onChange={() => toggle(p.employee_id)}
                          onClick={(e) => e.stopPropagation()} className="rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
                      )}
                    </td>
                    <td className="px-3 py-2">{p.name}</td>
                    <td className="px-3 py-2 text-right">{formatCurrency(p.gross_amount)}</td>
                    <td className="px-3 py-2 text-right">{formatCurrency(p.total_deductions)}</td>
                    <td className="px-3 py-2 text-right font-medium">{formatCurrency(p.net_amount)}</td>
                    <td className="px-3 py-2 text-xs">
                      {p.alreadyGenerated ? 'exists' : p.voidedSettled ? <span className="text-amber-600">re-issue (void settled)</span> : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {preview.skipped.length > 0 && (
            <p className="mt-2 text-xs text-slate-400">Skipped: {preview.skipped.map((s) => `${s.name || s.employee_id} (${s.reason})`).join(', ')}</p>
          )}
        </div>
      )}
    </Modal>
  );
}
