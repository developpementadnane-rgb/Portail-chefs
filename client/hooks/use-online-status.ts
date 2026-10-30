import { useEffect, useState } from "react";

/**
 * Tracks browser online/offline status. This is a signal for UX
 * (showing "hors ligne" banners, disabling network-only actions) —
 * it is intentionally NOT used as the trigger of correctness-critical
 * logic like "is it safe to show cached member data" (that's
 * isDeviceTrusted in offline/deviceTrust.ts). navigator.onLine can be
 * a false positive (connected to a network with no real Internet
 * route) or a false negative on some platforms, so anything that
 * must be correct falls back to actually attempting the network
 * call and handling failure, rather than trusting this value alone.
 */
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return isOnline;
}
