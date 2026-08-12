import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthenticatedRequest extends Request {
  user?: {
    id?: string;
    email: string;
    name?: string;
    role?: string;
    organizations?: string[];
  };
}

export const authenticateJWT = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Access denied. No token provided." });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "default_secret") as any;
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid or expired token." });
  }
};

export const requireRole = (roles: string[]) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const rawEmail = req.user?.email;
      const userId = req.user?.id;

      if (!rawEmail && !userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const email = rawEmail ? String(rawEmail).toLowerCase().trim() : null;

      const { dbOutput } = require("../models");
      const AdminUser = dbOutput.adminUser;
      const AdminUserOrganization = dbOutput.adminUserOrganization;

      let adminUser: any = null;

      if (userId) {
        adminUser = await AdminUser.findByPk(userId);
        // Stale JWT id (deleted / replaced user) — fall back to email
        if (adminUser?.isDeleted) {
          adminUser = null;
        }
      }

      if (!adminUser && email) {
        adminUser = await AdminUser.findOne({
          where: { email, isDeleted: false },
        });
      }

      // Fallback for case-sensitive collations / older tokens
      if (!adminUser && email) {
        const candidates = await AdminUser.findAll({
          where: { isDeleted: false },
          limit: 500,
        });
        adminUser =
          candidates.find(
            (u: any) => String(u.email || "").toLowerCase().trim() === email
          ) || null;
      }

      if (!adminUser) {
        return res.status(403).json({
          error: "User account not found. Please sign out and sign in again.",
        });
      }

      if (adminUser.isDeleted) {
        return res.status(403).json({
          error: "User account is inactive or deleted",
        });
      }

      if (adminUser.status !== "ACTIVE") {
        return res.status(403).json({
          error: `User account is ${String(adminUser.status).toLowerCase()}. Please complete invitation or contact a Super Admin.`,
        });
      }

      if (!roles.includes(adminUser.role) && adminUser.role !== "SUPER_ADMIN") {
        return res.status(403).json({
          error: "Forbidden: You do not have the required access role",
        });
      }

      const orgMappings = await AdminUserOrganization.findAll({
        where: { adminUserId: adminUser.id, isDeleted: false },
        attributes: ["organizationId"],
      });

      req.user = {
        ...req.user,
        id: adminUser.id,
        email: adminUser.email,
        role: adminUser.role,
        organizations: orgMappings.map((org: any) => org.organizationId),
      };

      next();
    } catch (error) {
      console.error("Role authorization error:", error);
      res.status(500).json({ error: "Internal server error during authorization" });
    }
  };
};

export const requireSuperAdmin = requireRole(["SUPER_ADMIN"]);
export const requireAdmin = requireRole(["SUPER_ADMIN", "ADMIN"]);
export const requireAnyRole = requireRole(["SUPER_ADMIN", "ADMIN", "VIEWER"]);
