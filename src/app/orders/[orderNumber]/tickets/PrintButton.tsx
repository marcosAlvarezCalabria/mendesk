"use client";

export function PrintButton({ label }: { label: string }) {
  return (
    <button
      className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2"
      type="button"
      onClick={() => window.print()}
    >
      {label}
    </button>
  );
}
