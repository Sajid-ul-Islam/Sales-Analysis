import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50 text-center">
      <div className="w-16 h-16 rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-center text-primary text-2xl font-bold mb-4">
        404
      </div>
      <h2 className="text-xl font-bold font-headline text-slate-900 mb-2">Page Not Found</h2>
      <p className="text-xs text-slate-500 max-w-sm mb-6">
        The requested dashboard view or reconciliation resource could not be found.
      </p>
      <Link
        href="/"
        className="px-4 py-2 rounded-xl bg-primary hover:bg-primary-dark text-white text-xs font-bold transition-all shadow-xs"
      >
        Return to Reconciliation Dashboard
      </Link>
    </div>
  );
}
