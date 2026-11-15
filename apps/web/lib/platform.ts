export type ShortcutOS = "win" | "mac";
export type PlatformSource = { userAgentData?: { platform?: string }; platform?: string; maxTouchPoints?: number };

export function detectOS(source?: PlatformSource): ShortcutOS {
  const platform = (source?.userAgentData?.platform || source?.platform || "").toLowerCase();
  return /mac|iphone|ipad|ipod/.test(platform) ? "mac" : "win";
}

export function isTouchDevice(source?: Pick<PlatformSource, "maxTouchPoints">, hasTouch = false): boolean {
  return Boolean(source?.maxTouchPoints && source.maxTouchPoints > 0) || hasTouch;
}

export function getPlatform(): { os: ShortcutOS; touch: boolean } {
  if (typeof navigator === "undefined") return { os: "win", touch: false };
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  return { os: detectOS(nav), touch: isTouchDevice(nav, "ontouchstart" in globalThis) };
}
