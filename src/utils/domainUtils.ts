import crypto from "crypto";

/**
 * Extract domain from an email address.
 * E.g., 'admin@company.com' => 'company.com'
 */
export const extractDomainFromEmail = (email: string | undefined | null): string | null => {
  if (!email) return null;
  const parts = email.split('@');
  if (parts.length === 2 && parts[1]) {
    return parts[1].toLowerCase().trim();
  }
  return null;
};

/**
 * Generate a unique slug domain for CNAME targeting.
 * E.g., 'acme' => 'acme-a1b2c3d4'
 */
export const generateSlugDomain = (subdomain: string): string => {
  const cleanSubdomain = (subdomain || '').toLowerCase().trim();
  const randomSuffix = crypto.randomBytes(4).toString("hex");
  return `${cleanSubdomain}-${randomSuffix}`;
};

/**
 * Extract subdomain from a full host header (e.g., for tenant lookup).
 * E.g., 'acme.mittarv.com:3000' => 'acme'
 */
export const extractSubdomainFromHost = (host: string | undefined | null): string | null => {
  if (!host) return null;
  // Strip port number if present
  const fullHost = host.split(":")[0];
  const parts = fullHost.split(".");
  if (parts.length >= 3) {
    return parts[0];
  }
  return null;
};
