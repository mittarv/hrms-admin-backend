import { Request, Response } from "express";
import { dbHrms } from "../models";
import { extractDomainFromEmail, generateSlugDomain } from "../utils/domainUtils";
import { sendSaaSCreationEmail } from "../utils/sendEmail";

const Organization = (dbHrms as any).organization;

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
    const existingOrg = await Organization.findOne({ where: { subdomain } });
    if (existingOrg) {
      return res.status(400).json({ error: "Subdomain already exists" });
    }

    // Generate unique slugDomain for backwards compatibility in DB
    const slugDomain = generateSlugDomain(subdomain);

    const org = await Organization.create({
      name,
      subdomain,
      domain: domain || null,
      slugDomain,
      adminEmail,
      allowedDomain,
      metadata: metadata || null,
      status: status || "ACTIVE",
    });

    // Seed default dropdown configurations for this new organization
    const defaultConfigs = [
      { type: 'year_of_study', value: '{"0":"1st","1":"2nd","2":"3rd","3":"4th","4":"N/A"}' },
      { type: 'gender_type_dropdown', value: '{"male_key":"Male","female_key":"Female","other_key":"Other"}' },
      { type: 'blood_group_dropdown', value: '{"0":"A+","1":"A-","2":"B+","3":"B-","4":"AB+","5":"AB-","6":"O+","7":"O-"}' },
      { type: 'emergency_contact_relation_dropdown', value: '{"0":"Parent","1":"Spouse","2":"Friend"}' },
      { type: 'marital_status_dropdown', value: '{"0":"Single","1":"Married"}' }
    ];

    try {
      const insertQuery = `
        INSERT INTO employeecomponentconfigurators 
        (empCompanyId, componentType, componentValue, isDeleted, createdAt, updatedAt)
        VALUES 
        ${defaultConfigs.map(c => `('${org.id}', '${c.type}', '${c.value}', false, NOW(), NOW())`).join(',')}
      `;
      await dbHrms.query(insertQuery);

      // Seed Unpaid Leave with empty employeeType mapping ({})
      const leaveQuery = `
        INSERT INTO employeeleaveconfigurators 
        (leaveConfigId, empCompanyId, leaveType, employeeType, accuralFrequency, totalAllotedLeaves, accuralRate, minimumNoticePeriod, maximumNoticePeriod, continuousLeavesLimit, excludePaidWeekend, appliedGender, isHalfDayAllowed, isProofRequired, isReasonRequired, effectiveDate, isActive, isDefault, allotAllLeaves, createdAt, updatedAt)
        VALUES 
        (UUID(), '${org.id}', 'Unpaid Leave', '{}', 'monthly_key', 0, 0, 0, 0, 0, false, 'All', true, false, false, NOW(), true, false, false, NOW(), NOW())
      `;
      await dbHrms.query(leaveQuery);

      // Seed default salary category and Loss of Pay deduction component for this org
      const categoryId = require('crypto').randomUUID();
      const salaryCatQuery = `
        INSERT INTO salarycategories
        (salaryCategoryId, empCompanyId, employeeType, employeeLocation, employeeLevel, department, yearOfStudy, isDeleted, createdAt, updatedAt)
        VALUES
        ('${categoryId}', '${org.id}', 'All', 'All', 'All', NULL, NULL, false, NOW(), NOW())
      `;
      await dbHrms.query(salaryCatQuery);

      const lopQuery = `
        INSERT INTO salarycomponents
        (componentId, empCompanyId, salaryCategoryId, componentName, componentType, amount, isVariable, includeinLop, isDeleted, isDefault, createdBy, updatedBy, createdAt, updatedAt)
        VALUES
        (UUID(), '${org.id}', '${categoryId}', 'Loss of Pay(per day)', 'defaultDeduction', 0, false, false, false, true, 'system', 'system', NOW(), NOW())
      `;
      await dbHrms.query(lopQuery);
    } catch (seedErr) {
      console.error("Failed to seed default component/leave/salary configs:", seedErr);
    }

    if (adminEmail) {
      try {
        await sendSaaSCreationEmail(adminEmail, subdomain, org.domain);
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
    const { includeDeleted, isDeleted } = req.query;
    let whereClause: any = {};

    if (isDeleted === 'true') {
      whereClause.isDeleted = true;
    } else if (includeDeleted !== 'true') {
      whereClause.isDeleted = false;
    }

    const orgs = await Organization.findAll({ where: whereClause });
    res.status(200).json({ data: orgs });
  } catch (error: any) {
    console.error("Error fetching organizations:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getOrganizationById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const org = await Organization.findOne({
      where: { id }
    });
    
    if (!org) {
      return res.status(404).json({ error: "Organization not found" });
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
    
    const org = await Organization.findByPk(id);
    if (!org) {
      return res.status(404).json({ error: "Organization not found" });
    }

    if (subdomain && subdomain !== org.subdomain) {
      const existingOrg = await Organization.findOne({ where: { subdomain } });
      if (existingOrg) {
        return res.status(400).json({ error: "Subdomain already exists" });
      }
    }

    await org.update({
      name: name || org.name,
      subdomain: subdomain || org.subdomain,
      domain: domain !== undefined ? domain : org.domain,
      adminEmail: adminEmail !== undefined ? adminEmail : org.adminEmail,
      allowedDomain: allowedDomain !== undefined ? allowedDomain : org.allowedDomain,
      metadata: metadata !== undefined ? metadata : org.metadata,
      status: status || org.status,
    });

    res.status(200).json({ message: "Organization updated successfully", data: org });
  } catch (error: any) {
    console.error("Error updating organization:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const deleteOrganization = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const org = await Organization.findByPk(id);
    
    if (!org) {
      return res.status(404).json({ error: "Organization not found" });
    }

    // 1. Deactivate the organization
    await org.update({ status: "SUSPENDED", isDeleted: true });

    // 2. Cascade soft-delete for all organization records across configurator & mapping tables
    const tablesToSoftDelete = [
      "employeecomponentconfigurators",
      "salarycategories",
      "salarycomponents",
      "user_organization_mappings",
      "employeebasicdetails"
    ];

    for (const table of tablesToSoftDelete) {
      try {
        const whereCol = table === "user_organization_mappings" ? "organizationId" : "empCompanyId";
        await dbHrms.query(
          `UPDATE ${table} SET isDeleted = true, updatedAt = NOW() WHERE ${whereCol} = :orgId`,
          { replacements: { orgId: id } }
        );
      } catch (tableErr) {
        console.error(`Error soft-deleting records in ${table}:`, tableErr);
      }
    }

    // employeeleaveconfigurators uses isActive flag
    try {
      await dbHrms.query(
        `UPDATE employeeleaveconfigurators SET isActive = false, updatedAt = NOW() WHERE empCompanyId = :orgId`,
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
    const org = await Organization.findByPk(id);
    
    if (!org) {
      return res.status(404).json({ error: "Organization not found" });
    }

    // 1. Restore the organization
    await org.update({ status: "ACTIVE", isDeleted: false });

    // 2. Restore all related organization records across configurator & mapping tables
    const tablesToRestore = [
      "employeecomponentconfigurators",
      "salarycategories",
      "salarycomponents",
      "user_organization_mappings",
      "employeebasicdetails"
    ];

    for (const table of tablesToRestore) {
      try {
        const whereCol = table === "user_organization_mappings" ? "organizationId" : "empCompanyId";
        await dbHrms.query(
          `UPDATE ${table} SET isDeleted = false, updatedAt = NOW() WHERE ${whereCol} = :orgId`,
          { replacements: { orgId: id } }
        );
      } catch (tableErr) {
        console.error(`Error restoring records in ${table}:`, tableErr);
      }
    }

    // employeeleaveconfigurators uses isActive flag
    try {
      await dbHrms.query(
        `UPDATE employeeleaveconfigurators SET isActive = true, updatedAt = NOW() WHERE empCompanyId = :orgId`,
        { replacements: { orgId: id } }
      );
    } catch (leaveErr) {
      console.error(`Error activating leave configs for org ${id}:`, leaveErr);
    }

    res.status(200).json({ message: "Organization and related records restored successfully", data: org });
  } catch (error: any) {
    console.error("Error restoring organization:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
