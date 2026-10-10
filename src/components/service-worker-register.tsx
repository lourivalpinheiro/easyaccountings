"use client";

import { useEffect } from "react";

/** Registra o service worker que serve /offline quando a navegação falha por falta de internet. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
