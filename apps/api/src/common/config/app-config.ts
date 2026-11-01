/**
 * Centralised, typed configuration read once from environment variables.
 * Every tunable lives here so no module reaches into process.env directly.
 */
export const appConfig = {
  port: Number(process.env.PORT ?? 4000),
  instanceId: process.env.INSTANCE_ID ?? `api-${process.pid}`,
  jwtSecret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
  jwtExpiresIn: '7d',
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6380',
  /** How long a buyer may hold a slot while paying. */
  holdTtlMs: Number(process.env.HOLD_TTL_SECONDS ?? 120) * 1000,
  /** How often live prices are pushed to clients. */
  priceTickMs: 2000,
  /** Slots must start at least this far in the future when created. */
  minLeadTimeMs: 10 * 60 * 1000,
  payment: {
    latencyMs: Number(process.env.PAYMENT_LATENCY_MS ?? 700),
    failureRate: Number(process.env.PAYMENT_FAILURE_RATE ?? 0),
  },
} as const;
