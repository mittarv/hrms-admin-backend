import { Request, Response } from "express";
import { dbOutput } from "../models";
import { sendInviteEmail } from "../utils/sendEmail";
import { createInviteToken, buildInviteLink } from "../utils/inviteToken";

const AdminUser = (dbOutput as any).adminUser;
const AdminUserOrganization = (dbOutput as any).adminUserOrganization;
const AdminUserInvitation = (dbOutput as any).adminUserInvitation;

const createPendingInvitation = async (adminUserId: string) => {
  const inviteToken = createInviteToken();
  await AdminUserInvitation.update(
    { status: "EXPIRED", isDeleted: true },
    { where: { adminUserId, status: "PENDING" } }
  );
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);
  await AdminUserInvitation.create({
    adminUserId,
    token: inviteToken,
    status: "PENDING",
    expiresAt,
  });
  return inviteToken;
};

const sendInviteOrReturnLink = async (
  email: string,
  name: string,
  role: string,
  inviteToken: string
) => {
  const inviteLink = buildInviteLink(inviteToken);
  try {
    await sendInviteEmail(email, name, role, inviteToken);
    return { emailSent: true, inviteLink };
  } catch (emailError: any) {
    console.error("Invite email failed:", emailError);
    return {
      emailSent: false,
      inviteLink,
      emailError: emailError.message,
    };
  }
};

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
      include: [
        {
          model: AdminUserOrganization,
          as: 'organizations',
          where: { isDeleted: false },
          required: false,
          attributes: ['organizationId']
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    let filteredUsers = users;
    if (currentUser) {
      const allowedOrgIds = currentUser.organizations || [];
      filteredUsers = users.filter((u: any) => {
        if (u.id === currentUser.id) return true;
        if (!u.organizations || u.organizations.length === 0) return false;
        return u.organizations.some((org: any) => allowedOrgIds.includes(org.organizationId));
      });
    }

    res.status(200).json({ data: filteredUsers });
  } catch (error: any) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getUserById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = await AdminUser.findByPk(id, {
      include: [
        {
          model: AdminUserOrganization,
          as: 'organizations',
          where: { isDeleted: false },
          required: false,
          attributes: ['organizationId']
        }
      ]
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const currentUser = (req as any).user;
    if (currentUser && user.id !== currentUser.id) {
      const allowedOrgIds = currentUser.organizations || [];
      const userOrgIds = user.organizations ? user.organizations.map((org: any) => org.organizationId) : [];
      const hasAccess = userOrgIds.some((orgId: string) => allowedOrgIds.includes(orgId));
      
      if (!hasAccess) {
        return res.status(403).json({ error: "Forbidden: You do not have access to view this user" });
      }
    }

    res.status(200).json({ data: user });
  } catch (error: any) {
    console.error("Error fetching user:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const inviteUser = async (req: Request, res: Response) => {
  try {
    let { name, email, role, organizationIds, organizationId, status } = req.body;

    if (!organizationIds && organizationId) {
      organizationIds = [organizationId];
    }

    if (!email || !name) {
      return res.status(400).json({ error: "Name and Email are required" });
    }

    const existingUser = await AdminUser.findOne({ where: { email } });
    if (existingUser) {
      if (existingUser.isDeleted) {
        const newRole = role || existingUser.role;
        // Re-activate previously deleted user
        await existingUser.update({
          name,
          role: newRole,
          status: status || "INVITED",
          isDeleted: false
        });
        
        if (organizationIds && Array.isArray(organizationIds)) {
          await AdminUserOrganization.update({ isDeleted: true }, { where: { adminUserId: existingUser.id } });
          if (newRole !== "SUPER_ADMIN") {
            const mappings = organizationIds.map((orgId: string) => ({
              adminUserId: existingUser.id,
              organizationId: orgId,
              isDeleted: false
            }));
            await AdminUserOrganization.bulkCreate(mappings, { updateOnDuplicate: ["isDeleted"] });
          }
        }
        
        if (existingUser.status === "INVITED") {
          const inviteToken = await createPendingInvitation(existingUser.id);
          const emailResult = await sendInviteOrReturnLink(
            existingUser.email,
            existingUser.name,
            existingUser.role,
            inviteToken
          );

          if (!emailResult.emailSent) {
            return res.status(200).json({
              message:
                "User re-invited, but the invitation email failed to send. Share the invite link manually or fix SMTP and resend.",
              data: existingUser,
              ...emailResult,
            });
          }
        }
        
        return res.status(200).json({ message: "User re-invited successfully", data: existingUser, emailSent: true });
      }
      return res.status(400).json({ error: "A user with this email already exists" });
    }

    const newRole = role || "ADMIN";
    const user = await AdminUser.create({
      name,
      email: email.toLowerCase().trim(),
      role: newRole,
      status: status || "INVITED",
      isDeleted: false
    });

    if (newRole === "SUPER_ADMIN") {
      const { dbHrms } = require("../models");
      const { QueryTypes } = require("sequelize");
      const { GET_ALL_ORGANIZATIONS } = require("../queries/organizationQueries");
      const allOrgs: any[] = await dbHrms.query(GET_ALL_ORGANIZATIONS('false', 'false'), { type: QueryTypes.SELECT });
      const mappings = allOrgs.map((org: any) => ({
        adminUserId: user.id,
        organizationId: org.id,
        isDeleted: false
      }));
      await AdminUserOrganization.bulkCreate(mappings);
    } else if (organizationIds && Array.isArray(organizationIds)) {
      const mappings = organizationIds.map((orgId: string) => ({
        adminUserId: user.id,
        organizationId: orgId
      }));
      await AdminUserOrganization.bulkCreate(mappings);
    }

    if (user.status === "INVITED") {
      const inviteToken = await createPendingInvitation(user.id);
      const emailResult = await sendInviteOrReturnLink(
        user.email,
        user.name,
        user.role,
        inviteToken
      );

      if (!emailResult.emailSent) {
        return res.status(201).json({
          message:
            "User created as INVITED, but the invitation email failed to send. Share the invite link manually or fix SMTP and resend.",
          data: user,
          ...emailResult,
        });
      }
    }

    res.status(201).json({ message: "User invited successfully", data: user, emailSent: true });
  } catch (error: any) {
    console.error("Error inviting user:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
};

export const updateUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    let { name, role, status, organizationIds, organizationId } = req.body;

    if (!organizationIds && organizationId) {
      organizationIds = [organizationId];
    }

    const user = await AdminUser.findByPk(id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    await user.update({
      name: name !== undefined ? name : user.name,
      role: role !== undefined ? role : user.role,
      status: status !== undefined ? status : user.status
    });

    if (user.role === "SUPER_ADMIN") {
      await AdminUserOrganization.update({ isDeleted: true }, { where: { adminUserId: user.id } });
      const { dbOutput } = require("../models");
      const Organization = dbOutput.organization;
      const allOrgs = await Organization.findAll({ where: { isDeleted: false } });
      const mappings = allOrgs.map((org: any) => ({
        adminUserId: user.id,
        organizationId: org.id,
        isDeleted: false
      }));
      await AdminUserOrganization.bulkCreate(mappings, { updateOnDuplicate: ["isDeleted"] });
    } else if (organizationIds && Array.isArray(organizationIds)) {
      await AdminUserOrganization.update({ isDeleted: true }, { where: { adminUserId: user.id } });
      const mappings = organizationIds.map((orgId: string) => ({
        adminUserId: user.id,
        organizationId: orgId,
        isDeleted: false
      }));
      await AdminUserOrganization.bulkCreate(mappings, { updateOnDuplicate: ["isDeleted"] });
    }

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
    const inviteToken = await createPendingInvitation(user.id);
    const emailResult = await sendInviteOrReturnLink(
      user.email,
      user.name,
      user.role,
      inviteToken
    );

    if (!emailResult.emailSent) {
      return res.status(200).json({
        message:
          "Invitation updated, but the email failed to send. Share the invite link manually or fix SMTP.",
        data: user,
        ...emailResult,
      });
    }

    res.status(200).json({
      message: "Invitation resent successfully",
      data: user,
      emailSent: true,
      inviteLink: emailResult.inviteLink,
    });
  } catch (error: any) {
    console.error("Error resending invite:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
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
