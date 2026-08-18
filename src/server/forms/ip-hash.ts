import { createHmac } from "node:crypto";

export function hashIp(secret: string, ip: string): string {
  return createHmac("sha256", secret).update(ip.trim(), "utf8").digest("hex");
}
