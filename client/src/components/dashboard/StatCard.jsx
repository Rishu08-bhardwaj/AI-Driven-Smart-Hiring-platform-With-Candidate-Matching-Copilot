const TONES = {
  blue: 'bg-blue-50 text-blue-600',
  green: 'bg-emerald-50 text-emerald-600',
  amber: 'bg-amber-50 text-amber-600',
  red: 'bg-red-50 text-red-600',
  violet: 'bg-violet-50 text-violet-600',
  slate: 'bg-slate-100 text-slate-600',
};

export default function StatCard({ label, value, icon: Icon, tone = 'blue', hint }) {
  return (
    <div className="card p-4 transition-shadow hover:shadow-card-hover">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-500">{label}</span>
        {Icon && (
          <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${TONES[tone] || TONES.blue}`}>
            <Icon size={18} />
          </span>
        )}
      </div>
      <div className="mt-2 text-2xl font-semibold text-slate-800">{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-400">{hint}</div>}
    </div>
  );
}
