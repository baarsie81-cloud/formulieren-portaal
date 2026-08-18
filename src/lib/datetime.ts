import { TIMEZONE } from "@/lib/constants";

const dateTimeFormatter = new Intl.DateTimeFormat("nl-NL", {
  timeZone: TIMEZONE,
  dateStyle: "short",
  timeStyle: "short",
});

export function formatDateTime(date: Date): string {
  return dateTimeFormatter.format(date);
}
