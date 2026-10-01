export function OfflineRetryLink({ label }: { label: string }) {
  return (
    <a
      className="mt-5 inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-5 text-label-md text-on-primary transition hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2 focus:ring-offset-background"
      href=""
    >
      {label}
    </a>
  );
}
