import { FiAlertTriangle } from 'react-icons/fi';

export default function ErrorState({ message = 'Failed to load data.', onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-500">
        <FiAlertTriangle size={26} />
      </div>
      <h3 className="text-sm font-semibold text-slate-700">Something went wrong</h3>
      <p className="mt-1 max-w-sm text-sm text-slate-500">{message}</p>
      {onRetry && (
        <button className="btn-secondary mt-4" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}
