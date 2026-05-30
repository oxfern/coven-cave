export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const mod = await import("@/lib/inbox-scheduler");
  mod.startScheduler();
}
