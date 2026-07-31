import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthenticatedRequest extends Request {
  user?: {
    email: string;
    name?: string;
    role?: string;
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
      const userEmail = req.user?.email;
      if (!userEmail) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Fetch user from DB to ensure role is up-to-date and not revoked
      const { dbOutput } = require("../models");
      const AdminUser = dbOutput.adminUser;
      const AdminUserOrganization = dbOutput.adminUserOrganization;

      const user = await AdminUser.findOne({
        where: { email: userEmail, isDeleted: false, status: 'ACTIVE' },
        include: [{ model: AdminUserOrganization, as: 'organizations', required: false, where: { isDeleted: false } }]
      });

      if (!user) {
        return res.status(403).json({ error: "User account is inactive or deleted" });
      }

      if (!roles.includes(user.role) && user.role !== "SUPER_ADMIN") {
        return res.status(403).json({ error: "Forbidden: You do not have the required access role" });
      }

      // Attach full DB user to request
      req.user = {
        ...req.user,
        role: user.role,
        id: user.id,
        organizations: user.organizations ? user.organizations.map((org: any) => org.organizationId) : []
      } as any;

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
