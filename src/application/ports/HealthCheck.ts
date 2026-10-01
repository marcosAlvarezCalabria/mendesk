export type HealthStatus = {
  ok: boolean;
  detail?: string;
};

export interface HealthCheck {
  check(): Promise<HealthStatus>;
}