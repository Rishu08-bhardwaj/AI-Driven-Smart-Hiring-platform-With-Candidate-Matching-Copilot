import Spinner from './Spinner.jsx';

export default function FullPageLoader() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-slate-100">
      <Spinner size={32} />
    </div>
  );
}
