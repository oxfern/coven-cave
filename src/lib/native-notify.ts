/**
 * Thin wrapper around @tauri-apps/plugin-notification.
 * No-ops outside Tauri (e.g. `next dev` in a browser) so the toast path
 * still works without an unhandled dynamic-import error.
 */
export async function nativeNotify(title: string, body?: string): Promise<void> {
  if (typeof window === "undefined") return;
  // @ts-expect-error Tauri injects this at runtime
  if (!window.__TAURI_INTERNALS__) return;
  try {
    const mod = await import("@tauri-apps/plugin-notification");
    let granted = await mod.isPermissionGranted();
    if (!granted) granted = (await mod.requestPermission()) === "granted";
    if (granted) await mod.sendNotification({ title, body });
  } catch {
    /* native notify failure shouldn't break the app */
  }
}
