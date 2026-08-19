import { TIMEZONE } from "@/lib/constants";

const dateTimeFormatter = new Intl.DateTimeFormat("nl-NL", {
  timeZone: TIMEZONE,
  dateStyle: "short",
  timeStyle: "short",
});

export function formatDateTime(date: Date): string {
  return dateTimeFormatter.format(date);
}

export function formatAuditSignedAt(date: Date): string {
  const local = new Intl.DateTimeFormat("nl-NL", {
    timeZone: TIMEZONE,
    dateStyle: "long",
    timeStyle: "medium",
  }).format(date);
  const utc = new Intl.DateTimeFormat("nl-NL", {
    timeZone: "UTC",
    dateStyle: "long",
    timeStyle: "medium",
  }).format(date);

  return `${local} (${TIMEZONE}) / ${utc} (UTC)`;
}
