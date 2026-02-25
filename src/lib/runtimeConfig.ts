/**
 * Runtime config helpers (browser-safe)
 *
 * Problem this solves:
 * - When the app is accessed via IP/domain, calling `http://localhost:3001`
 *   from the browser is blocked (Private Network Access / loopback).
 * - Default to calling the backend on the same hostname at port 3001 instead.
 */

function trimTrailingSlash(url: string) {
  return url.replace(/\/+$/, "");
}

export function getApiBaseUrl(): string {
  const fromEnv = (import.meta.env.VITE_API_BASE_URL as string | undefined) || "";
  if (fromEnv.trim()) {
    const url = trimTrailingSlash(fromEnv.trim());
    console.log('🔗 Using API Base URL from environment:', url);
    return url;
  }

  // Browser-only fallback
  if (typeof window !== "undefined") {
    const { hostname, protocol, port } = window.location;

    // Local development defaults (localhost, 127.0.0.1, or any local port)
    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") {
      const defaultUrl = "http://localhost:3001";
      console.log('🔗 Using default API Base URL for localhost:', defaultUrl);
      return defaultUrl;
    }

    // Check if it's a Vercel domain (vercel.app) or production domain
    // In production, we should use VITE_API_BASE_URL environment variable
    if (hostname.includes("vercel.app") || hostname.includes("vercel.com")) {
      // VITE_API_BASE_URL should be set in Vercel environment variables
      // If not set, show warning and return empty (will cause API calls to fail with clear error)
      if (!fromEnv.trim()) {
        console.error(
          "❌ VITE_API_BASE_URL is not configured!\n" +
          "Please set VITE_API_BASE_URL environment variable in Vercel:\n" +
          "1. Go to Vercel Dashboard → Project Settings → Environment Variables\n" +
          "2. Add: VITE_API_BASE_URL = https://your-backend-url.com\n" +
          "3. Redeploy your project"
        );
      }
      // Return empty string to use relative paths (will fail gracefully with better error message)
      return "";
    }

    // When accessed via IP/domain (not Vercel), hit backend on same host (port 3001)
    return `${protocol}//${hostname}:3001`;
  }

  // Non-browser fallback
  return "http://localhost:3001";
}

