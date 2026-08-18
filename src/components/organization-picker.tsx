"use client";

import { OrganizationList } from "@clerk/nextjs";

export function OrganizationPicker() {
  return (
    <OrganizationList
      hidePersonal
      afterCreateOrganizationUrl="/dashboard"
      afterSelectOrganizationUrl="/dashboard"
    />
  );
}
