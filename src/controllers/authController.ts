import { Request, Response } from "express";
import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";
import { Op } from "sequelize";
import { dbOutput } from "../models";

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const AdminUser = (dbOutput as any).adminUser;
const AdminUserInvitation = (dbOutput as any).adminUserInvitation;

/** Comma-separated bootstrap Super Admin emails from ADMIN_EMAIL */
const getBootstrapAdminEmails = (): string[] => {
  const raw = process.env.ADMIN_EMAIL || "";
  return raw
    .split(",")
    .map((e) => e.toLowerCase().trim())
    .filter(Boolean);
};

const isBootstrapAdmin = (email: string): boolean => {
  return getBootstrapAdminEmails().includes(email.toLowerCase().trim());
};

const findValidInvitation = async (adminUserId: string, inviteToken?: string | null) => {
  const where: any = {
    adminUserId,
    status: "PENDING",
    isDeleted: false,
    expiresAt: { [Op.gt]: new Date() },
  };

  if (inviteToken) {
    where.token = inviteToken;
  }

  return AdminUserInvitation.findOne({
    where,
    order: [["createdAt", "DESC"]],
  });
};

export const verifyInvite = async (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: "No token provided" });

    const invitation = await AdminUserInvitation.findOne({
      where: {
        token,
        status: "PENDING",
        isDeleted: false,
        expiresAt: { [Op.gt]: new Date() },
      },
    });

    if (!invitation) {
      return res.status(400).json({ error: "Invalid or expired invitation" });
    }

    const user = await AdminUser.findByPk(invitation.adminUserId);
    if (!user || user.isDeleted || user.status !== "INVITED") {
      return res.status(400).json({ error: "User is no longer in an invited state" });
    }

    return res.status(200).json({ message: "Valid invite", email: user.email });
  } catch (error) {
    console.error("Error verifying invite:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const googleLogin = async (req: Request, res: Response) => {
  try {
    const { token, inviteToken } = req.body;

    if (!token) {
      return res.status(400).json({ error: "No token provided" });
    }

    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      return res.status(401).json({ error: "Invalid Google token or missing email" });
    }

    const email = payload.email.toLowerCase().trim();
    let userRole = "ADMIN";
    let userId: string | undefined;

    if (AdminUser) {
      // Prefer active user; also check soft-deleted for bootstrap restore
      let existingUser = await AdminUser.findOne({
        where: { email, isDeleted: false },
      });

      if (!existingUser) {
        const deletedUser = await AdminUser.findOne({
          where: { email, isDeleted: true },
        });

        if (deletedUser && isBootstrapAdmin(email)) {
          await deletedUser.update({
            name: payload.name || deletedUser.name,
            role: "SUPER_ADMIN",
            status: "ACTIVE",
            isDeleted: false,
          });
          existingUser = deletedUser;
        } else if (isBootstrapAdmin(email)) {
          existingUser = await AdminUser.create({
            name: payload.name || "System Admin",
            email: email,
            role: "SUPER_ADMIN",
            status: "ACTIVE",
            isDeleted: false,
          });
        } else if (deletedUser) {
          return res.status(403).json({
            error:
              "Your admin account was revoked. Please ask a Super Admin to invite you again.",
          });
        } else {
          return res.status(403).json({
            error:
              "Access denied. Your email has not been invited to access the HRMS Admin Portal.",
          });
        }
      } else if (isBootstrapAdmin(email) && existingUser.role !== "SUPER_ADMIN") {
        // Ensure bootstrap emails keep Super Admin access
        await existingUser.update({
          role: "SUPER_ADMIN",
          status: existingUser.status === "INVITED" ? "ACTIVE" : existingUser.status,
        });
      }

      // Bootstrap Super Admins can always activate without invite token
      if (existingUser.status === "INVITED" && isBootstrapAdmin(email)) {
        await existingUser.update({
          status: "ACTIVE",
          name: payload.name || existingUser.name,
          role: "SUPER_ADMIN",
        });
      }

      if (existingUser.status === "SUSPENDED" || existingUser.status === "INACTIVE") {
        if (isBootstrapAdmin(email)) {
          await existingUser.update({ status: "ACTIVE", isDeleted: false, role: "SUPER_ADMIN" });
        } else {
          return res.status(403).json({
            error: "Access denied. Your admin account is currently inactive or suspended.",
          });
        }
      }

      // Activate invited users: Google SSO already proves email ownership.
      // Prefer the inviteToken from the email link when present; otherwise use any valid pending invite.
      if (existingUser.status === "INVITED") {
        const invitation = await findValidInvitation(existingUser.id, inviteToken || null);

        if (!invitation) {
          return res.status(403).json({
            error: inviteToken
              ? "Your invitation link is invalid or has expired."
              : "Please click the link in your invitation email to activate your account, or ask an admin to resend the invite.",
          });
        }

        await existingUser.update({
          status: "ACTIVE",
          name: payload.name || existingUser.name,
        });
        await invitation.update({ status: "ACCEPTED" });

        // Expire any other pending invites for this user
        await AdminUserInvitation.update(
          { status: "EXPIRED", isDeleted: true },
          {
            where: {
              adminUserId: existingUser.id,
              status: "PENDING",
              id: { [Op.ne]: invitation.id },
            },
          }
        );
      }

      // Reload in case status/role changed above
      await existingUser.reload();
      userRole = existingUser.role || "ADMIN";
      userId = existingUser.id;
    }

    const adminToken = jwt.sign(
      {
        id: userId,
        email: email,
        name: payload.name,
        role: userRole,
      },
      process.env.JWT_SECRET || "default_secret",
      { expiresIn: "24h" }
    );

    return res.status(200).json({
      message: "Login successful",
      token: adminToken,
      user: {
        id: userId,
        email: email,
        name: payload.name,
        picture: payload.picture,
        role: userRole,
      },
    });
  } catch (error) {
    console.error("Google SSO Error:", error);
    return res.status(500).json({ error: "Authentication failed" });
  }
};
