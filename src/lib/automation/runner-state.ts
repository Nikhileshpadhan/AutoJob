export interface RunnerStatus {
  isRunning: boolean;
  isResting: boolean;
  nextRunAt: string | null;
  activeRunId: number | null;
  abortRequested: boolean;
}

const globalForRunnerState = globalThis as unknown as {
  __autojob_runner_status?: RunnerStatus;
};

export const runnerState: RunnerStatus = globalForRunnerState.__autojob_runner_status ?? {
  isRunning: false,
  isResting: false,
  nextRunAt: null,
  activeRunId: null,
  abortRequested: false,
};

if (process.env.NODE_ENV !== "production") {
  globalForRunnerState.__autojob_runner_status = runnerState;
}

export function getRunnerStatus(): RunnerStatus {
  return { ...runnerState };
}

export function setRunnerStatus(patch: Partial<RunnerStatus>): void {
  Object.assign(runnerState, patch);
}
