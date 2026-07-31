import { Request, Response } from "express";
import { QueryTypes } from "sequelize";
import { randomUUID } from "crypto";
import { dbHrms } from "../models";
import { extractDomainFromEmail, generateSlugDomain } from "../utils/domainUtils";
import { sendSaaSCreationEmail } from "../utils/sendEmail";
import {
  FIND_ORG_BY_SUBDOMAIN,
  CHECK_FIELD_AVAILABILITY,
  INSERT_ORGANIZATION,
  INSERT_DEFAULT_CONFIGS,
  INSERT_UNPAID_LEAVE,
  INSERT_SALARY_CATEGORY,
  GET_ALL_ORGANIZATIONS,
  FIND_ORG_BY_ID,
  UPDATE_ORGANIZATION,
  DEACTIVATE_ORGANIZATION,
  CASCADE_SOFT_DELETE,
  CASCADE_SOFT_DELETE_MAPPING,
  CASCADE_DEACTIVATE_LEAVE,
  ACTIVATE_ORGANIZATION,
  CASCADE_RESTORE,
  CASCADE_ACTIVATE_LEAVE
} from "../queries/organizationQueries";

export const checkAvailability = async (req: Request, res: Response) => {
  try {
    const { field, value, excludeId } = req.query;
    if (!field || !value) return res.status(400).json({ error: "Missing field or value" });
    
    const validFields = ['name', 'subdomain', 'domain', 'adminEmail'];
    if (!validFields.includes(field as string)) return res.status(400).json({ error: "Invalid field" });
    
    let queryStr = CHECK_FIELD_AVAILABILITY(field as string);
    const replacements: any = { value };
    
    if (excludeId) {
      queryStr = queryStr.replace('LIMIT 1', 'AND id != :excludeId LIMIT 1');
      replacements.excludeId = excludeId;
    }
    
    const existing = await dbHrms.query(queryStr, {
      replacements,
      type: QueryTypes.SELECT
    });
    
    const isAvailable = existing.length === 0;
    res.status(200).json({ isAvailable });
  } catch (error) {
    console.error("Error checking field availability:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const createOrganization = async (req: Request, res: Response) => {
  try {
    let { name, subdomain, domain, adminEmail, allowedDomain, status, metadata } = req.body;
    
    if (!allowedDomain && adminEmail) {
      allowedDomain = extractDomainFromEmail(adminEmail) || undefined;
    }

    // Clean domain string if provided
    if (domain) {
      domain = domain.replace(/^https?:\/\//i, '').split('/')[0].split(':')[0].toLowerCase().trim();
    } else if (allowedDomain) {
      domain = allowedDomain.toLowerCase().trim();
    }
    
    // Check if subdomain already exists
    const existingOrgs: any[] = await dbHrms.query(FIND_ORG_BY_SUBDOMAIN, {
      replacements: { subdomain },
      type: QueryTypes.SELECT
    });
    if (existingOrgs && existingOrgs.length > 0) {
      return res.status(400).json({ error: "Subdomain already exists" });
    }

    // Generate unique slugDomain for backwards compatibility in DB
    const slugDomain = generateSlugDomain(subdomain);

    const id = randomUUID();
    const orgStatus = status || "ACTIVE";
    const orgMetadata = metadata || null;
    const orgDomain = domain || null;

    // Use INSERT_ORGANIZATION query
    await dbHrms.query(INSERT_ORGANIZATION, {
      replacements: {
        id,
        name,
        subdomain,
        domain: orgDomain,
        slugDomain,
        adminEmail: adminEmail || null,
        allowedDomain: allowedDomain || null,
        metadata: orgMetadata ? JSON.stringify(orgMetadata) : null,
        status: orgStatus
      }
    });

    const org = {
      id,
      name,
      subdomain,
      domain: orgDomain,
      slugDomain,
      adminEmail: adminEmail || null,
      allowedDomain: allowedDomain || null,
      metadata: orgMetadata,
      status: orgStatus,
      isDeleted: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Seed default dropdown configurations for this new organization
    const defaultConfigs = [
      { type: 'year_of_study', value: '{"0":"1st","1":"2nd","2":"3rd","3":"4th","4":"N/A"}' },
      { type: 'gender_type_dropdown', value: '{"male_key":"Male","female_key":"Female","other_key":"Other"}' },
      { type: 'blood_group_dropdown', value: '{"0":"A+","1":"A-","2":"B+","3":"B-","4":"AB+","5":"AB-","6":"O+","7":"O-"}' },
      { type: 'emergency_contact_relation_dropdown', value: '{"0":"Parent","1":"Spouse","2":"Friend"}' },
      { type: 'marital_status_dropdown', value: '{"0":"Single","1":"Married"}' }
    ];

    try {
      const insertQuery = INSERT_DEFAULT_CONFIGS(org.id, defaultConfigs);
      await dbHrms.query(insertQuery);

      // Seed Unpaid Leave with empty employeeType mapping ({})
      await dbHrms.query(INSERT_UNPAID_LEAVE, {
        replacements: { orgId: org.id }
      });

      // Seed default salary category
      const categoryId = randomUUID();
      await dbHrms.query(INSERT_SALARY_CATEGORY, {
        replacements: { categoryId, orgId: org.id }
      });

      // Seed the Admin role for this org
      await dbHrms.query(
        `INSERT INTO hrms_role (empCompanyId, roleName, description, isDeleted, updatedBy, createdAt, updatedAt) 
         VALUES (:orgId, 'Admin', 'Administrator with full write and edit access to all modules and configurations', 0, 'system', :now, :now)`,
        {
          replacements: { orgId: org.id, now: new Date() },
          type: QueryTypes.INSERT
        }
      );

      // Get the roleId of the newly created Admin role
      const createdRoles: any[] = await dbHrms.query(
        `SELECT roleId FROM hrms_role WHERE empCompanyId = :orgId AND roleName = 'Admin' AND isDeleted = 0 LIMIT 1`,
        {
          replacements: { orgId: org.id },
          type: QueryTypes.SELECT
        }
      );

      if (createdRoles && createdRoles.length > 0) {
        const roleId = createdRoles[0].roleId;

        // Fetch all permissions
        const permissions: any[] = await dbHrms.query(
          `SELECT permissionId FROM hrms_permissions WHERE isDeleted = 0`,
          {
            type: QueryTypes.SELECT
          }
        );

        // Link Admin role to all permissions
        for (const perm of permissions) {
          await dbHrms.query(
            `INSERT INTO hrms_role_permission (roleId, permissionId, isDeleted, updatedBy, createdAt, updatedAt) 
             VALUES (:roleId, :permissionId, 0, 'system', :now, :now)`,
            {
              replacements: { roleId, permissionId: perm.permissionId, now: new Date() },
              type: QueryTypes.INSERT
            }
          );
        }
      }

      // DO NOT seed Loss of Pay component (lopQuery removed as requested)
    } catch (seedErr) {
      console.error("Failed to seed default component/leave/salary configs/roles:", seedErr);
    }

    try {
      // Map all existing SUPER_ADMINs to this new organization
      const { dbOutput } = require("../models");
      const AdminUser = dbOutput.adminUser;
      const AdminUserOrganization = dbOutput.adminUserOrganization;

      const superAdmins = await AdminUser.findAll({ where: { role: 'SUPER_ADMIN', isDeleted: false } });
      if (superAdmins.length > 0) {
        const mappings = superAdmins.map((sa: any) => ({
          adminUserId: sa.id,
          organizationId: org.id,
          isDeleted: false
        }));
        await AdminUserOrganization.bulkCreate(mappings);
      }
    } catch (mapErr) {
      console.error("Failed to map super admins to new org:", mapErr);
    }

    if (adminEmail) {
      try {
        const adminName = req.body.adminName || adminEmail.split('@')[0].split(/[._-]/).map((s: string) => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
        await sendSaaSCreationEmail(adminEmail, subdomain, org.domain, org.name, adminName);
      } catch (emailErr) {
        console.error("Failed to send SaaS creation email:", emailErr);
      }
    }

    res.status(201).json({ message: "Organization created successfully", data: org });
  } catch (error: any) {
    console.error("Error creating organization:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getAllOrganizations = async (req: Request, res: Response) => {
  try {
    const { includeDeleted, isDeleted } = req.query as { includeDeleted?: string, isDeleted?: string };
    const queryStr = GET_ALL_ORGANIZATIONS(isDeleted, includeDeleted);
    const orgs = await dbHrms.query(queryStr, {
      type: QueryTypes.SELECT
    });
    
    let parsedOrgs = orgs.map((org: any) => {
      if (typeof org.metadata === 'string') {
        try {
          org.metadata = JSON.parse(org.metadata);
        } catch (_) {}
      }
      return org;
    });

    const currentUser = (req as any).user;
    if (currentUser) {
      const allowedOrgIds = currentUser.organizations || [];
      parsedOrgs = parsedOrgs.filter((org: any) => allowedOrgIds.includes(org.id));
    }

    res.status(200).json({ data: parsedOrgs });
  } catch (error: any) {
    console.error("Error fetching organizations:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getOrganizationById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const results: any[] = await dbHrms.query(FIND_ORG_BY_ID, {
      replacements: { id },
      type: QueryTypes.SELECT
    });
    
    if (!results || results.length === 0) {
      return res.status(404).json({ error: "Organization not found" });
    }

    const org = results[0];

    const currentUser = (req as any).user;
    if (currentUser) {
      const allowedOrgIds = currentUser.organizations || [];
      if (!allowedOrgIds.includes(org.id)) {
        return res.status(403).json({ error: "Forbidden: You do not have access to this organization" });
      }
    }

    if (typeof org.metadata === 'string') {
      try {
        org.metadata = JSON.parse(org.metadata);
      } catch (_) {}
    }

    res.status(200).json({ data: org });
  } catch (error: any) {
    console.error("Error fetching organization:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const updateOrganization = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    let { name, subdomain, domain, adminEmail, allowedDomain, status, metadata } = req.body;
    
    if (!allowedDomain && adminEmail) {
      allowedDomain = extractDomainFromEmail(adminEmail) || undefined;
    }
    
    if (domain) {
      domain = domain.replace(/^https?:\/\//i, '').split('/')[0].split(':')[0].toLowerCase().trim();
    }
    
    const results: any[] = await dbHrms.query(FIND_ORG_BY_ID, {
      replacements: { id },
      type: QueryTypes.SELECT
    });
    
    if (!results || results.length === 0) {
      return res.status(404).json({ error: "Organization not found" });
    }

    const org = results[0];
    if (typeof org.metadata === 'string') {
      try {
        org.metadata = JSON.parse(org.metadata);
      } catch (_) {}
    }

    if (subdomain && subdomain !== org.subdomain) {
      const existingOrgs: any[] = await dbHrms.query(FIND_ORG_BY_SUBDOMAIN, {
        replacements: { subdomain },
        type: QueryTypes.SELECT
      });
      if (existingOrgs && existingOrgs.length > 0) {
        return res.status(400).json({ error: "Subdomain already exists" });
      }
    }

    const updatedFields = {
      id,
      name: name || org.name,
      subdomain: subdomain || org.subdomain,
      domain: domain !== undefined ? domain : org.domain,
      adminEmail: adminEmail !== undefined ? adminEmail : org.adminEmail,
      allowedDomain: allowedDomain !== undefined ? allowedDomain : org.allowedDomain,
      metadata: metadata !== undefined ? metadata : org.metadata,
      status: status || org.status,
    };

    await dbHrms.query(UPDATE_ORGANIZATION, {
      replacements: {
        id: updatedFields.id,
        name: updatedFields.name,
        subdomain: updatedFields.subdomain,
        domain: updatedFields.domain || null,
        adminEmail: updatedFields.adminEmail || null,
        allowedDomain: updatedFields.allowedDomain || null,
        metadata: updatedFields.metadata ? JSON.stringify(updatedFields.metadata) : null,
        status: updatedFields.status
      }
    });

    res.status(200).json({ message: "Organization updated successfully", data: updatedFields });
  } catch (error: any) {
    console.error("Error updating organization:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const deleteOrganization = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const results: any[] = await dbHrms.query(FIND_ORG_BY_ID, {
      replacements: { id },
      type: QueryTypes.SELECT
    });
    
    if (!results || results.length === 0) {
      return res.status(404).json({ error: "Organization not found" });
    }

    // 1. Deactivate the organization
    await dbHrms.query(DEACTIVATE_ORGANIZATION, {
      replacements: { id }
    });

    // 2. Cascade soft-delete for all organization records across configurator & mapping tables
    const tablesToSoftDelete = [
      "employeecomponentconfigurators",
      "salarycategories",
      "salary_components",
      "employeebasicdetails"
    ];

    for (const table of tablesToSoftDelete) {
      try {
        await dbHrms.query(
          CASCADE_SOFT_DELETE(table),
          { replacements: { orgId: id } }
        );
      } catch (tableErr) {
        console.error(`Error soft-deleting records in ${table}:`, tableErr);
      }
    }

    try {
      await dbHrms.query(
        CASCADE_SOFT_DELETE_MAPPING,
        { replacements: { orgId: id } }
      );
    } catch (mappingErr) {
      console.error(`Error soft-deleting user_organization_mappings for org ${id}:`, mappingErr);
    }

    // employeeleaveconfigurators uses isActive flag
    try {
      await dbHrms.query(
        CASCADE_DEACTIVATE_LEAVE,
        { replacements: { orgId: id } }
      );
    } catch (leaveErr) {
      console.error(`Error deactivating leave configs for org ${id}:`, leaveErr);
    }

    res.status(200).json({ message: "Organization deactivated and related records deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting organization:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const restoreOrganization = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const results: any[] = await dbHrms.query(FIND_ORG_BY_ID, {
      replacements: { id },
      type: QueryTypes.SELECT
    });
    
    if (!results || results.length === 0) {
      return res.status(404).json({ error: "Organization not found" });
    }

    const org = results[0];
    if (typeof org.metadata === 'string') {
      try {
        org.metadata = JSON.parse(org.metadata);
      } catch (_) {}
    }

    // 1. Restore the organization
    await dbHrms.query(ACTIVATE_ORGANIZATION, {
      replacements: { id }
    });

    const restoredOrg = {
      ...org,
      status: "ACTIVE",
      isDeleted: false,
      updatedAt: new Date()
    };

    // 2. Restore all related organization records across configurator & mapping tables
    const tablesToRestore = [
      "employeecomponentconfigurators",
      "salarycategories",
      "salary_components",
      "user_organization_mappings",
      "employeebasicdetails"
    ];

    for (const table of tablesToRestore) {
      try {
        const whereCol = table === "user_organization_mappings" ? "organizationId" : "empCompanyId";
        await dbHrms.query(
          CASCADE_RESTORE(table, whereCol),
          { replacements: { orgId: id } }
        );
      } catch (tableErr) {
        console.error(`Error restoring records in ${table}:`, tableErr);
      }
    }

    // employeeleaveconfigurators uses isActive flag
    try {
      await dbHrms.query(
        CASCADE_ACTIVATE_LEAVE,
        { replacements: { orgId: id } }
      );
    } catch (leaveErr) {
      console.error(`Error activating leave configs for org ${id}:`, leaveErr);
    }

    res.status(200).json({ message: "Organization and related records restored successfully", data: restoredOrg });
  } catch (error: any) {
    console.error("Error restoring organization:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
