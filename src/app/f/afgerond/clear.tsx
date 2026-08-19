"use client";

import { useEffect } from "react";
import { clearSignedCookieAction } from "./actions";

export function ClearSignedCookie() {
  useEffect(() => {
    clearSignedCookieAction().catch(() => undefined);
  }, []);

  return null;
}
