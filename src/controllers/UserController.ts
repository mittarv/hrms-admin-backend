import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { dbOutput } from "../models";

const AdminUser = (dbOutput as any).adminUser;

export const getAllUsers = async (req: Request, res: Response) => {
  try {
    const { includeDeleted, isDeleted } = req.query;
    let whereClause: any = {};

    if (isDeleted === 'true') {
      whereClause.isDeleted = true;
    } else if (includeDeleted !== 'true') {
      whereClause.isDeleted = false;
    }

    // Auto-seed super admin bypass users from authenticated request if missing
    const currentUser = (req as any).user;
    const allowedSuperEmails = ["vishal@mittarv.com", "amitosh.kumar@mittarv.com"];

    if (currentUser && currentUser.email && allowedSuperEmails.includes(currentUser.email.toLowerCase().trim()) && AdminUser) {
      try {
        const [user, created] = await AdminUser.findOrCreate({
          where: { email: currentUser.email.toLowerCase().trim() },
          defaults: {
            name: currentUser.name || currentUser.email.split('@')[0],
            email: currentUser.email.toLowerCase().trim(),
            role: "SUPER_ADMIN",
            status: "ACTIVE",
            isDeleted: false
          }
        });

        if (!created && (user.status === "INVITED" || user.isDeleted)) {
          await user.update({ status: "ACTIVE", isDeleted: false });
        }
      } catch (tokenErr) {
        console.error("Error auto-seeding user:", tokenErr);
      }
    }

    const users = await AdminUser.findAll({ 
      where: whereClause,
      order: [['createdAt', 'DESC']]
    });

    res.status(200).json({ data: users });
  } catch (error: any) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getUserById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = await AdminUser.findByPk(id);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.status(200).json({ data: user });
  } catch (error: any) {
    console.error("Error fetching user:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const inviteUser = async (req: Request, res: Response) => {
  try {
    const { name, email, role, organizationId, status } = req.body;

    if (!email || !name) {
      return res.status(400).json({ error: "Name and Email are required" });
    }

    const existingUser = await AdminUser.findOne({ where: { email } });
    if (existingUser) {
      if (existingUser.isDeleted) {
        // Re-activate previously deleted user
        await existingUser.update({
          name,
          role: role || existingUser.role,
          organizationId: organizationId || existingUser.organizationId,
          status: status || "INVITED",
          isDeleted: false
        });
        return res.status(200).json({ message: "User re-invited successfully", data: existingUser });
      }
      return res.status(400).json({ error: "A user with this email already exists" });
    }

    const user = await AdminUser.create({
      name,
      email: email.toLowerCase().trim(),
      role: role || "ADMIN",
      status: status || "INVITED",
      organizationId: organizationId || null,
      isDeleted: false
    });

    res.status(201).json({ message: "User invited successfully", data: user });
  } catch (error: any) {
    console.error("Error inviting user:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const updateUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, role, status, organizationId } = req.body;

    const user = await AdminUser.findByPk(id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    await user.update({
      name: name !== undefined ? name : user.name,
      role: role !== undefined ? role : user.role,
      status: status !== undefined ? status : user.status,
      organizationId: organizationId !== undefined ? organizationId : user.organizationId
    });

    res.status(200).json({ message: "User updated successfully", data: user });
  } catch (error: any) {
    console.error("Error updating user:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const resendInvite = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = await AdminUser.findByPk(id);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    await user.update({ status: "INVITED" });

    res.status(200).json({ message: "Invitation resent successfully", data: user });
  } catch (error: any) {
    console.error("Error resending invite:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const deleteUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = await AdminUser.findByPk(id);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    await user.update({ isDeleted: true, status: "INACTIVE" });

    res.status(200).json({ message: "User access revoked successfully" });
  } catch (error: any) {
    console.error("Error deleting user:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const restoreUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = await AdminUser.findByPk(id);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    await user.update({ isDeleted: false, status: "ACTIVE" });

    res.status(200).json({ message: "User access restored successfully", data: user });
  } catch (error: any) {
    console.error("Error restoring user:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
