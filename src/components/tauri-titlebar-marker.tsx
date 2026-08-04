"use client";

/**
 * Global owner of the `data-tauri-titlebar` root marker.
 *
 * The macOS desktop shell renders the main window's native title bar as an
 * Overlay (lib.rs), so the traffic lights float over web content on EVERY
 * route of the window — not just the workspace shell. The marker used to be
 * set by <Shell>, which meant full-window routes (/settings, /dashboard,
 * analytics, reports) lost it the moment the shell unmounted and their title
 * bands slid their leading controls underneath the lights.
 *
 * Mounted once in the root layout; the overlay title bar is a property of
 * the window, not of a route, so the marker is never removed. globals.css
 * (and dashboard.css) key their traffic-light insets and titlebar glass off
 * `:root[data-tauri-titlebar]`. Development shells also publish a dedicated
 * marker for their in-app frame treatment. Browser, Windows, Linux, Tauri-mobile,
 * and production builds never receive the combined development selector.
 */

import { isMacDesktopShell } from "@/lib/tauri-platform";
import { useMountEffect } from "@/lib/use-mount-effect";

const IS_DEVELOPMENT = process.env.NODE_ENV === "development";

function useTauriTitlebarMarker() {
  useMountEffect(() => {
    if (!isMacDesktopShell()) return;

    const root = document.documentElement;
    root.dataset.tauriTitlebar = "";
    if (IS_DEVELOPMENT) root.dataset.caveDevelopment = "";
  });
}

export function TauriTitlebarMarker() {
  useTauriTitlebarMarker();
  return null;
}
