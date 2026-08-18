"use client";

import Link from "next/link";
import { OrganizationSwitcher, UserButton } from "@clerk/nextjs";
import { APP_NAME } from "@/lib/constants";

export function DashboardHeader() {
  return (
    <header className="border-b border-neutral-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="font-semibold tracking-tight">
            {APP_NAME}
          </Link>
          <nav className="flex items-center gap-4 text-sm text-neutral-600">
            <Link href="/dashboard" className="hover:text-neutral-950">
              Overzicht
            </Link>
            <Link href="/dashboard/clients" className="hover:text-neutral-950">
              Cliënten
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <OrganizationSwitcher
            hidePersonal
            afterCreateOrganizationUrl="/dashboard"
            afterSelectOrganizationUrl="/dashboard"
          />
          <UserButton />
        </div>
      </div>
    </header>
  );
}
