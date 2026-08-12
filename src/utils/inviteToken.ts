import crypto from "crypto";

/** Short opaque invite token — safe for email URLs and DB storage (avoids long JWT truncation). */
export const createInviteToken = (): string => {
  return crypto.randomBytes(32).toString("hex");
};

/**
 * Normalize FRONTEND_URL so we never emit broken links like:
 * http://https://example.com/...
 */
export const normalizeFrontendBaseUrl = (raw?: string | null): string => {
  let base = (raw || "http://localhost:5173").trim().replace(/\/+$/, "");

  // Fix accidental double-scheme values from misconfigured env
  base = base.replace(/^https?:\/\/https:\/\//i, "https://");
  base = base.replace(/^https?:\/\/http:\/\//i, "http://");

  // If scheme is missing, default to https for non-localhost hosts
  if (!/^https?:\/\//i.test(base)) {
    const isLocal = /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(base.split("/")[0]);
    base = `${isLocal ? "http" : "https"}://${base}`;
  }

  return base.replace(/\/+$/, "");
};

export const buildInviteLink = (inviteToken: string): string => {
  const baseUrl = normalizeFrontendBaseUrl(process.env.FRONTEND_URL);
  return `${baseUrl}/accept-invite?token=${encodeURIComponent(inviteToken)}`;
};
