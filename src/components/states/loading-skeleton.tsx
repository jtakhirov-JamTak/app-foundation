export function ScreenSkeleton() {
  return (
    <section aria-label="Loading" aria-busy="true" className="space-y-4">
      <div className="card p-5">
        <div className="skeleton h-4 w-24 rounded" />
        <div className="skeleton mt-4 h-8 w-3/4 rounded-lg" />
        <div className="skeleton mt-4 h-4 w-full rounded" />
        <div className="skeleton mt-2 h-4 w-5/6 rounded" />
      </div>
      <div className="card p-5">
        <div className="skeleton h-6 w-36 rounded" />
        <div className="skeleton mt-4 h-12 w-full rounded-xl" />
      </div>
    </section>
  );
}
