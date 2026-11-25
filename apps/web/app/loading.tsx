export default function Loading() {
  return (
    <div className="flex min-h-[60vh] w-full flex-col items-center justify-center gap-[16px] p-[16px]" role="status" aria-live="polite">
      <div className="h-[32px] w-[32px] rounded-full border-[3px] border-solid border-border border-t-primary animate-[spin_0.8s_linear_infinite] motion-reduce:animate-none" aria-hidden="true" />
      <span className="font-ledger-ui text-[0.95rem] text-muted">Loading…</span>
    </div>
  );
}
