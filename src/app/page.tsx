import Link from "next/link";
import { APP_NAME, APP_TAGLINE } from "@/lib/constants";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 px-6">
      <h1 className="text-3xl font-semibold tracking-tight">{APP_NAME}</h1>
      <p className="text-lg text-neutral-600">{APP_TAGLINE}</p>
      <Link href="/dashboard" className="mt-4 text-sm text-neutral-900 underline">
        Naar het dashboard
      </Link>
    </main>
  );
}
