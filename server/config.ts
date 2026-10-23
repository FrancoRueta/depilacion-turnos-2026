import "dotenv/config";

function booleanFromEnv(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return value === "true" || value === "1";
}

export const config = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  isProduction: process.env.NODE_ENV === "production",
  port: Number(process.env.PORT ?? 8787),
  host: process.env.HOST ?? "0.0.0.0",
  cookieSecure: booleanFromEnv(process.env.COOKIE_SECURE, process.env.NODE_ENV === "production"),
  trustProxy: booleanFromEnv(process.env.TRUST_PROXY, process.env.NODE_ENV === "production"),
  callMeBotPhone: process.env.CALLMEBOT_PHONE,
  callMeBotApiKey: process.env.CALLMEBOT_API_KEY,
};

export function getPort(): number {
  const parsed = Number(process.env.PORT ?? config.port);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 8787;
}
