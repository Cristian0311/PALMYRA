import { getDevicePerformanceProfile } from "./devicePerformance";

export type PerformanceAuditSnapshot = {
  profile: ReturnType<typeof getDevicePerformanceProfile>;
  startedAt: number;
  longTaskCount: number;
  lastLongTaskMs: number;
  maxLongTaskMs: number;
};

const snapshot: PerformanceAuditSnapshot = {
  profile: getDevicePerformanceProfile(),
  startedAt: typeof performance !== "undefined" ? performance.now() : 0,
  longTaskCount: 0,
  lastLongTaskMs: 0,
  maxLongTaskMs: 0,
};

let started = false;

export function startPerformanceAudit(): PerformanceAuditSnapshot {
  if (started || typeof window === "undefined") return snapshot;
  started = true;

  const PerformanceObserverCtor = window.PerformanceObserver;
  if (PerformanceObserverCtor) {
    try {
      const observer = new PerformanceObserverCtor((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType !== "longtask") continue;
          snapshot.longTaskCount += 1;
          snapshot.lastLongTaskMs = Math.round(entry.duration);
          snapshot.maxLongTaskMs = Math.max(snapshot.maxLongTaskMs, entry.duration);
        }
      });
      observer.observe({ entryTypes: ["longtask"] });
    } catch {
      // Older Android WebViews may expose PerformanceObserver without longtask.
    }
  }

  (window as Window & { __OMNI_POS_PERF__?: PerformanceAuditSnapshot }).__OMNI_POS_PERF__ = snapshot;
  return snapshot;
}

export function getPerformanceAuditSnapshot(): PerformanceAuditSnapshot {
  return snapshot;
}
