export default function AppLoading() {
  return (
    <div className="flex min-h-full flex-col gap-6 p-6 lg:p-8">
      <div className="h-9 w-64 animate-pulse rounded-lg bg-secondary/60" />
      <div className="h-4 w-96 max-w-full animate-pulse rounded bg-secondary/40" />
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-32 animate-pulse rounded-2xl border border-border/50 bg-card/50"
          />
        ))}
      </div>
    </div>
  );
}
