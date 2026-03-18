import * as core from "@actions/core";

export const log = {
  info(message: string): void {
    core.info(message);
  },

  warn(message: string): void {
    core.warning(message);
  },

  error(message: string): void {
    core.error(message);
  },

  debug(message: string): void {
    core.debug(message);
  },

  async group<T>(name: string, fn: () => Promise<T>): Promise<T> {
    return await core.group(name, fn);
  },

  metadata(label: string, data: unknown): void {
    core.info(`[${label}] ${JSON.stringify(data, null, 2)}`);
  },
};
