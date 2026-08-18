"use client";

export default function DashboardError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h1 className="text-2xl font-semibold tracking-tight">Er ging iets mis</h1>
      <p className="text-neutral-600">Probeer het opnieuw. Er zijn geen extra details getoond.</p>
      <button
        type="button"
        onClick={reset}
        className="w-fit rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
      >
        Opnieuw
      </button>
    </section>
  );
}
