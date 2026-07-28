import { Request, Response } from "express";
import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";
import { dbOutput } from "../models";

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const AdminUser = (dbOutput as any).adminUser;

export const googleLogin = async (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    
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

    if (AdminUser) {
      // Check if email exists in admin_users table
      let existingUser = await AdminUser.findOne({
        where: { email, isDeleted: false }
      });

      if (!existingUser) {
        const envAdminEmail = process.env.ADMIN_EMAIL ? process.env.ADMIN_EMAIL.toLowerCase().trim() : null;
        if (envAdminEmail && email === envAdminEmail) {
          // Auto-seed/create the admin user in the database
          existingUser = await AdminUser.create({
            name: payload.name || "System Admin",
            email: email,
            role: "SUPER_ADMIN",
            status: "ACTIVE",
            isDeleted: false
          });
        } else {
          return res.status(403).json({
            error: "Access denied. Your email has not been invited to access the HRMS Admin Portal."
          });
        }
      }

      if (existingUser.status === "SUSPENDED" || existingUser.status === "INACTIVE") {
        return res.status(403).json({
          error: "Access denied. Your admin account is currently inactive or suspended."
        });
      }

      // Activate invited user upon first successful SSO login
      if (existingUser.status === "INVITED") {
        await existingUser.update({ status: "ACTIVE", name: payload.name || existingUser.name });
      }

      userRole = existingUser.role || "ADMIN";
    }

    const adminToken = jwt.sign(
      { 
        email: payload.email, 
        name: payload.name, 
        role: userRole 
      },
      process.env.JWT_SECRET || "default_secret",
      { expiresIn: "24h" }
    );

    return res.status(200).json({
      message: "Login successful",
      token: adminToken,
      user: {
        email: payload.email,
        name: payload.name,
        picture: payload.picture,
        role: userRole
      }
    });
  } catch (error) {
    console.error("Google SSO Error:", error);
    return res.status(500).json({ error: "Authentication failed" });
  }
};
