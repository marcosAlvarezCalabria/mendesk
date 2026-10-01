type SegmentLoadingProps = {
  variant: "list" | "detail" | "form";
};

export function SegmentLoading({ variant }: SegmentLoadingProps) {
  return (
    <main
      aria-busy="true"
      aria-live="polite"
      className="min-h-screen bg-background text-on-surface"
      data-variant={variant}
    >
      <div className="border-b border-outline-variant bg-background">
        <div className="mx-auto flex min-h-16 w-full max-w-[720px] items-center gap-3 px-margin-mobile py-3">
          <Skeleton className="size-11 shrink-0 rounded-full" />
          <div className="grid flex-1 gap-2">
            <Skeleton className="h-5 w-36 rounded-md" />
            <Skeleton className="h-3 w-24 rounded-md" />
          </div>
        </div>
      </div>

      <div className="mx-auto grid min-h-[calc(100vh-64px)] w-full max-w-[720px] gap-4 px-margin-mobile pb-24 pt-5 md:pb-8">
        {variant === "list" ? <ListSkeleton /> : null}
        {variant === "detail" ? <DetailSkeleton /> : null}
        {variant === "form" ? <FormSkeleton /> : null}
      </div>
    </main>
  );
}

function ListSkeleton() {
  return (
    <>
      <div className="flex gap-2 overflow-hidden">
        <Skeleton className="h-10 w-24 shrink-0 rounded-full" />
        <Skeleton className="h-10 w-28 shrink-0 rounded-full" />
        <Skeleton className="h-10 w-24 shrink-0 rounded-full" />
      </div>
      <Skeleton className="h-14 rounded-2xl" />
      <div className="grid content-start gap-3">
        {Array.from({ length: 4 }, (_, index) => (
          <div className="min-h-28 rounded-xl bg-surface-container-lowest p-card-padding" key={index}>
            <Skeleton className="h-5 w-2/5 rounded-md" />
            <Skeleton className="mt-3 h-4 w-3/5 rounded-md" />
            <Skeleton className="mt-5 h-4 w-full rounded-md" />
          </div>
        ))}
      </div>
    </>
  );
}

function DetailSkeleton() {
  return (
    <div className="grid content-start gap-4">
      <Skeleton className="h-28 rounded-xl" />
      <Skeleton className="h-48 rounded-xl" />
      <Skeleton className="h-40 rounded-xl" />
    </div>
  );
}

function FormSkeleton() {
  return (
    <div className="grid content-start gap-5">
      <Skeleton className="h-40 rounded-xl" />
      <Skeleton className="h-64 rounded-xl" />
      <Skeleton className="h-12 rounded-xl" />
    </div>
  );
}

function Skeleton({ className }: { className: string }) {
  return <div aria-hidden="true" className={`animate-pulse bg-surface-container motion-reduce:animate-none ${className}`} />;
}
