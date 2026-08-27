const TONES = {
  green: 'bg-emerald-100 text-emerald-700 ring-emerald-600/20',
  red: 'bg-red-100 text-red-700 ring-red-600/20',
  amber: 'bg-amber-100 text-amber-700 ring-amber-600/20',
  blue: 'bg-blue-100 text-blue-700 ring-blue-600/20',
  gray: 'bg-slate-100 text-slate-600 ring-slate-500/20',
  slate: 'bg-slate-200 text-slate-700 ring-slate-600/20',
};

/** Small pill badge. Pass a tone, or a {label, tone} map + value. */
export default function StatusBadge({ tone = 'gray', children, map, value }) {
  let label = children;
  let resolvedTone = tone;
  if (map && value != null) {
    label = map[value]?.label ?? value;
    resolvedTone = map[value]?.tone ?? 'gray';
  }
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
        TONES[resolvedTone] || TONES.gray
      }`}
    >
      {label}
    </span>
  );
}
