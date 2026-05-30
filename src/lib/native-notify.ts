/**
 * Thin wrapper around @tauri-apps/plugin-notification.
 * No-ops outside Tauri (e.g. `next dev` in a browser) so the toast path
 * still works without an unhandled dynamic-import error.
 *
 * `sound` semantics:
 *   undefined  → platform default sound
 *   null       → silent (skip the notification entirely so macOS doesn't ding)
 *   string     → named macOS sound (e.g. "Glass", "Funk", "Pop")
 */
export async function nativeNotify(
  title: string,
  body?: string,
  sound?: string | null,
): Promise<void> {
  if (typeof window === "undefined") return;
  // @ts-expect-error Tauri injects this at runtime
  if (!window.__TAURI_INTERNALS__) return;
  if (sound === null) return; // silent mode: suppress entirely
  try {
    const mod = await import("@tauri-apps/plugin-notification");
    let granted = await mod.isPermissionGranted();
    if (!granted) granted = (await mod.requestPermission()) === "granted";
    if (!granted) return;
    const payload: { title: string; body?: string; sound?: string } = {
      title,
      body,
    };
    if (typeof sound === "string") payload.sound = sound;
    await mod.sendNotification(payload);
  } catch {
    /* native notify failure shouldn't break the app */
  }
}
