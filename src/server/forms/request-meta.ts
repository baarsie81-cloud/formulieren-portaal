import "server-only";

import { headers } from "next/headers";

const USER_AGENT_MAX = 512;

export type RequestMeta = {
  ip: string;
  userAgent: string | null;
};

export async function getRequestMeta(): Promise<RequestMeta> {
  const headerList = await headers();
  const forwarded = headerList.get("x-forwarded-for");
  const ip =
    forwarded?.split(",")[0]?.trim() ||
    headerList.get("x-real-ip")?.trim() ||
    "0.0.0.0";
  const userAgent = headerList.get("user-agent")?.trim().slice(0, USER_AGENT_MAX) || null;

  return { ip, userAgent };
}

export async function getPublicOrigin(): Promise<string> {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  const proto = headerList.get("x-forwarded-proto") ?? "http";

  if (!host) {
    return "http://localhost:3000";
  }

  return `${proto}://${host}`;
}

export function publicFormPath(rawToken: string): string {
  return `/f/${rawToken}`;
}

export function publicFormUrl(origin: string, rawToken: string): string {
  return `${origin}${publicFormPath(rawToken)}`;
}
