import * as core from "@actions/core";

export class ActionError extends Error {
  public readonly fatal: boolean;

  constructor(message: string, fatal = true) {
    super(message);
    this.name = "ActionError";
    this.fatal = fatal;
  }
}

export function handleError(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);

  if (error instanceof ActionError && !error.fatal) {
    core.warning(`Alia Action warning: ${message}`);
  } else {
    core.setFailed(`Alia Action failed: ${message}`);
  }
}
