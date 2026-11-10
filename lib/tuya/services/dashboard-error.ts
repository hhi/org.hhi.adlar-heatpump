/* eslint-disable import/prefer-default-export */
export class DashboardError extends Error {
  constructor(public readonly status: number, public readonly code: string) {
    super(code);
  }
}
