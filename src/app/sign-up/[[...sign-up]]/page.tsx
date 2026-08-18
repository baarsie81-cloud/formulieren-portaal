import { SignUp } from "@clerk/nextjs";
import { isClerkConfigured } from "@/lib/clerk";

export const dynamic = "force-dynamic";

export default function SignUpPage() {
  if (!isClerkConfigured()) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <p className="text-neutral-600">Authenticatie is nog niet geconfigureerd.</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <SignUp />
    </main>
  );
}
