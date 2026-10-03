export type DevicePerformanceTier = "ultra" | "low" | "normal";

export type DevicePerformanceProfile = {
  tier: DevicePerformanceTier;
  deviceMemoryGB: number | null;
  hardwareConcurrency: number;
  saveData: boolean;
  touchDevice: boolean;
};

let cachedProfile: DevicePerformanceProfile | null = null;

export function getDevicePerformanceProfile(): DevicePerformanceProfile {
  if (cachedProfile) return cachedProfile;

  if (typeof navigator === "undefined") {
    cachedProfile = {
      tier: "normal",
      deviceMemoryGB: null,
      hardwareConcurrency: 8,
      saveData: false,
      touchDevice: false,
    };
    return cachedProfile;
  }

  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean };
  };

  const deviceMemoryGB =
    typeof nav.deviceMemory === "number" && Number.isFinite(nav.deviceMemory)
      ? nav.deviceMemory
      : null;
  const hardwareConcurrency =
    typeof navigator.hardwareConcurrency === "number" && navigator.hardwareConcurrency > 0
      ? navigator.hardwareConcurrency
      : 4;
  const saveData = nav.connection?.saveData === true;
  const touchDevice =
    navigator.maxTouchPoints > 0 ||
    typeof window !== "undefined" && "ontouchstart" in window;

  let tier: DevicePerformanceTier = "normal";

  // Chrome/Android exposes deviceMemory on many tablets. 2 GB or less gets
  // the strongest lightweight profile automatically.
  if (
    (deviceMemoryGB !== null && deviceMemoryGB <= 2) ||
    (deviceMemoryGB === null && touchDevice && hardwareConcurrency <= 4)
  ) {
    tier = "ultra";
  } else if (
    (deviceMemoryGB !== null && deviceMemoryGB <= 4) ||
    hardwareConcurrency <= 4 ||
    saveData
  ) {
    tier = "low";
  }

  cachedProfile = {
    tier,
    deviceMemoryGB,
    hardwareConcurrency,
    saveData,
    touchDevice,
  };
  return cachedProfile;
}

export function getDevicePerformanceTier(): DevicePerformanceTier {
  return getDevicePerformanceProfile().tier;
}

export function applyDevicePerformanceProfile(): DevicePerformanceProfile {
  const profile = getDevicePerformanceProfile();
  if (typeof document !== "undefined") {
    document.documentElement.dataset.perfTier = profile.tier;
    document.documentElement.dataset.perfMemory = profile.deviceMemoryGB
      ? String(profile.deviceMemoryGB)
      : "unknown";
  }
  return profile;
}

export function scheduleIdleTask(
  task: () => void,
  delayMs = 800,
  idleTimeoutMs = 1200
): () => void {
  let cancelled = false;
  const run = () => {
    if (cancelled) return;
    task();
  };

  const idleApi = (
    typeof window !== "undefined"
      ? (window as Window & {
          requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
          cancelIdleCallback?: (handle: number) => void;
        })
      : null
  );

  if (idleApi?.requestIdleCallback) {
    const timer = window.setTimeout(() => {
      if (cancelled) return;
      const handle = idleApi.requestIdleCallback!(run, { timeout: idleTimeoutMs });
      cleanupHandle = () => idleApi.cancelIdleCallback?.(handle);
    }, delayMs);
    let cleanupHandle: () => void = () => {};
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      cleanupHandle();
    };
  }

  const timer = typeof window !== "undefined" ? window.setTimeout(run, delayMs) : null;
  return () => {
    cancelled = true;
    if (timer !== null && typeof window !== "undefined") window.clearTimeout(timer);
  };
}
