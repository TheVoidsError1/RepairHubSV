import type { CorsOptions } from "cors";

type Origin = string | undefined;
type CorsOriginCallback = (err: Error | null, origin?: boolean | string) => void;
export type OriginValidator = (origin: Origin, callback: CorsOriginCallback) => void;

function splitCsv(value: string) {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function parseAllowedOrigins(envValue: string | undefined) {
  const raw = (envValue ?? "").trim();
  const fallback = ["http://localhost:8080"];

  // If FRONTEND_URL isn't set:
  // - In development: allow all origins (reflect Origin) to avoid common LAN/IP/domain setup issues
  // - In production: keep a safe default (localhost only) unless explicitly configured
  if (!raw) {
    const nodeEnv = (process.env.NODE_ENV ?? "").toLowerCase();
    const isProd = nodeEnv === "production";
    return { allowAll: !isProd, allowedOrigins: fallback };
  }

  const values = splitCsv(raw);
  const allowAll = values.includes("*");
  const allowedOrigins = values.filter((v) => v !== "*");

  return { allowAll, allowedOrigins: allowedOrigins.length ? allowedOrigins : fallback };
}

export function makeOriginValidator(envValue: string | undefined): OriginValidator {
  const { allowAll, allowedOrigins } = parseAllowedOrigins(envValue);
  const allowedSet = new Set(allowedOrigins);
  const nodeEnv = (process.env.NODE_ENV ?? "").toLowerCase();
  const isDevelopment = nodeEnv !== "production";

  return (origin: Origin, callback: CorsOriginCallback) => {
    // Allow non-browser clients (curl/postman) that don't send Origin
    if (!origin) return callback(null, true);

    // In development mode, always allow localhost:8080
    if (isDevelopment && origin === "http://localhost:8080") {
      return callback(null, origin);
    }

    // Reflect any origin (safe with credentials because it's not "*")
    if (allowAll) return callback(null, true);

    if (allowedSet.has(origin)) return callback(null, origin);

    return callback(new Error(`CORS blocked for origin: ${origin}`));
  };
}

export function buildExpressCorsOptions(envValue: string | undefined): CorsOptions {
  return {
    origin: makeOriginValidator(envValue),
    credentials: true,
    optionsSuccessStatus: 204,
  };
}

// Helper function to get allowed origins as string/array for Socket.IO
export function getAllowedOrigins(envValue: string | undefined): string | string[] {
  const { allowAll, allowedOrigins } = parseAllowedOrigins(envValue);
  
  // In development, if allowAll is true, use wildcard for Socket.IO
  // Note: Socket.IO v4+ supports function but it's safer to use string/array
  const nodeEnv = (process.env.NODE_ENV ?? "").toLowerCase();
  const isDevelopment = nodeEnv !== "production";
  
  if (isDevelopment) {
    return '*'; // Allow all origins in development
  }
  
  if (allowAll) {
    return '*';
  }
  
  return allowedOrigins.length > 0 ? allowedOrigins : ['http://localhost:8080'];
}
