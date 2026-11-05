/**
 * AutoJob Human-Like Pacing & Active Operating Window Utility
 * 
 * Enforces:
 * 1. Active Operating Window (customizable, default 09:00 AM to 11:00 PM local time or 24/7).
 * 2. Randomized rest intervals between applications.
 * 3. Smart clamping to fit remaining daily applications before window close.
 * 4. Interruptible sleep so user aborts trigger immediately.
 */

export interface WindowOpenResult {
  ms: number;
  nextOpenTime: Date;
}

export interface RestTimeResult {
  restMs: number;
  nextRunAt: Date;
  formattedDuration: string;
}

/**
 * Formats a 24-hour integer (0..24) into a friendly 12-hour string (e.g. 9 -> "9:00 AM", 23 -> "11:00 PM", 24 -> "12:00 AM (Midnight)").
 */
export function formatHour12(hour: number): string {
  const normalized = hour % 24;
  if (normalized === 0) {
    return hour === 24 ? "12:00 AM (Midnight)" : "12:00 AM (Midnight)";
  }
  if (normalized === 12) return "12:00 PM (Noon)";
  if (normalized < 12) return `${normalized}:00 AM`;
  return `${normalized - 12}:00 PM`;
}

/**
 * Checks whether the current local time is within the active operating window [startHour, endHour).
 * Supports:
 * - Normal daytime ranges (e.g., 9 to 23 -> 9:00 AM to 11:00 PM).
 * - Wrap-around midnight ranges (e.g., 18 to 2 -> 6:00 PM to 2:00 AM).
 * - Full 24/7 mode (0 to 24 or startHour === endHour).
 * - Direct ignoreTimeWindow bypass flag.
 */
export function isWithinActiveWindow(
  now: Date = new Date(),
  startHour: number = 9,
  endHour: number = 23,
  ignoreTimeWindow: boolean = false
): boolean {
  if (ignoreTimeWindow) {
    return true;
  }

  // 24/7 continuous operation
  if ((startHour === 0 && endHour >= 24) || (startHour === endHour && startHour === 0)) {
    return true;
  }

  const currentHour = now.getHours();

  if (startHour < endHour) {
    // Normal window: e.g. 9:00 to 23:00
    return currentHour >= startHour && currentHour < endHour;
  } else if (startHour > endHour) {
    // Wrap-around midnight window: e.g. 18:00 to 02:00
    return currentHour >= startHour || currentHour < endHour;
  }

  // startHour === endHour != 0 -> 24h
  return true;
}

/**
 * Calculates the exact duration (in ms) until the next window opens at startHour.
 * Adds 1 to 15 minutes of random jitter so automation never wakes at the exact second.
 */
export function getMsUntilNextWindowOpen(
  now: Date = new Date(),
  startHour: number = 9,
  endHour: number = 23
): WindowOpenResult {
  const currentHour = now.getHours();
  const nextOpen = new Date(now);

  // Random jitter between 1 and 15 minutes (in ms)
  const jitterMs = Math.floor(Math.random() * (15 - 1 + 1) + 1) * 60 * 1000;

  if (startHour <= endHour) {
    if (currentHour < startHour) {
      // Before startHour today (e.g. 7 AM -> 9 AM today)
      nextOpen.setHours(startHour, 0, 0, 0);
      const ms = Math.max(0, nextOpen.getTime() - now.getTime()) + jitterMs;
      return {
        ms,
        nextOpenTime: new Date(nextOpen.getTime() + jitterMs),
      };
    }

    // At or after endHour today (e.g. 11 PM -> 9 AM tomorrow)
    nextOpen.setDate(nextOpen.getDate() + 1);
    nextOpen.setHours(startHour, 0, 0, 0);
    const ms = Math.max(0, nextOpen.getTime() - now.getTime()) + jitterMs;

    return {
      ms,
      nextOpenTime: new Date(nextOpen.getTime() + jitterMs),
    };
  } else {
    // Wrap-around window (e.g. 18:00 to 02:00): outside is between endHour and startHour (e.g. 02:00 and 18:00)
    nextOpen.setHours(startHour, 0, 0, 0);
    const ms = Math.max(0, nextOpen.getTime() - now.getTime()) + jitterMs;
    return {
      ms,
      nextOpenTime: new Date(nextOpen.getTime() + jitterMs),
    };
  }
}

/**
 * Formats milliseconds into human-readable minutes and seconds (e.g. "42m 18s").
 */
export function formatDurationMs(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  return `${minutes}m ${seconds}s`;
}

/**
 * Calculates a random rest time r so remaining applications are distributed naturally
 * within the remaining operating window before windowEndHour.
 */
export function calculateRandomRestTimeMs(params: {
  remainingQuotaToday: number;
  minRestMinutes?: number;
  maxRestMinutes?: number;
  windowEndHour?: number;
  now?: Date;
}): RestTimeResult {
  const now = params.now || new Date();
  const remainingSlots = Math.max(1, params.remainingQuotaToday);
  const defaultMinMinutes = params.minRestMinutes ?? 20;
  const defaultMaxMinutes = params.maxRestMinutes ?? 60;
  const endHour = params.windowEndHour ?? 23;

  // Calculate minutes remaining today before windowEndHour (e.g., 23:00)
  const windowClose = new Date(now);
  if (endHour <= now.getHours() && endHour !== 24) {
    windowClose.setDate(windowClose.getDate() + 1);
  }
  windowClose.setHours(endHour === 24 ? 23 : endHour, endHour === 24 ? 59 : 0, 0, 0);
  const msRemainingInWindow = Math.max(0, windowClose.getTime() - now.getTime());
  const minutesRemainingInWindow = Math.floor(msRemainingInWindow / (60 * 1000));

  let effectiveMinMinutes = defaultMinMinutes;
  let effectiveMaxMinutes = defaultMaxMinutes;

  if (minutesRemainingInWindow > 0) {
    // If we have remaining applications and limited time, dynamically adapt rest interval
    const idealPacingMinutes = Math.floor(minutesRemainingInWindow / remainingSlots);
    if (idealPacingMinutes > defaultMinMinutes) {
      // Enough time remaining: center random interval around ideal spacing
      effectiveMaxMinutes = Math.min(defaultMaxMinutes, Math.floor(idealPacingMinutes * 1.25));
      effectiveMinMinutes = Math.max(10, Math.floor(idealPacingMinutes * 0.75));
    } else {
      // Time is tight: clamp to lower bound so remaining applications have a chance
      effectiveMaxMinutes = Math.max(15, Math.min(defaultMaxMinutes, idealPacingMinutes));
      effectiveMinMinutes = Math.min(effectiveMaxMinutes, Math.max(10, Math.floor(effectiveMaxMinutes * 0.6)));
    }
  }

  // Ensure bounds are consistent
  if (effectiveMaxMinutes < effectiveMinMinutes) {
    effectiveMaxMinutes = effectiveMinMinutes + 5;
  }

  const minMs = effectiveMinMinutes * 60 * 1000;
  const maxMs = effectiveMaxMinutes * 60 * 1000;

  // Pick random duration within [minMs, maxMs]
  const randomRestMs = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;

  const nextRunAt = new Date(now.getTime() + randomRestMs);

  return {
    restMs: randomRestMs,
    nextRunAt,
    formattedDuration: formatDurationMs(randomRestMs),
  };
}

/**
 * Sleeps for ms in small 1-second chunks, checking shouldAbort() on each tick.
 * Returns true if completed fully, or false if aborted early by user.
 */
export async function interruptibleSleep(
  ms: number,
  shouldAbort: () => boolean,
  checkIntervalMs: number = 1000
): Promise<boolean> {
  const startTime = Date.now();
  const targetEndTime = startTime + ms;

  while (Date.now() < targetEndTime) {
    if (shouldAbort()) {
      return false; // Aborted
    }

    const remaining = targetEndTime - Date.now();
    const sleepChunk = Math.min(remaining, checkIntervalMs);
    if (sleepChunk <= 0) break;

    await new Promise((resolve) => setTimeout(resolve, sleepChunk));
  }

  return !shouldAbort();
}
