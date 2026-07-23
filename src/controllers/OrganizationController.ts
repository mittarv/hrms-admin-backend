import { Request, Response } from "express";
import { dbHrms } from "../models";
import { extractDomainFromEmail, generateSlugDomain } from "../utils/domainUtils";

const Organization = (dbHrms as any).organization;

export const createOrganization = async (req: Request, res: Response) => {
  try {
    let { name, subdomain, adminEmail, allowedDomain, status, metadata } = req.body;
    
    if (!allowedDomain && adminEmail) {
      allowedDomain = extractDomainFromEmail(adminEmail) || undefined;
    }
    
    // Check if subdomain already exists
    const existingOrg = await Organization.findOne({ where: { subdomain } });
    if (existingOrg) {
      return res.status(400).json({ error: "Subdomain already exists" });
    }

    // Generate unique slugDomain for CNAME targeting
    const slugDomain = generateSlugDomain(subdomain);

    const org = await Organization.create({
      name,
      subdomain,
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
    } catch (seedErr) {
      console.error("Failed to seed default component configs:", seedErr);
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
    let { name, subdomain, adminEmail, allowedDomain, status, metadata, isHrmsSetup } = req.body;
    
    if (!allowedDomain && adminEmail) {
      allowedDomain = extractDomainFromEmail(adminEmail) || undefined;
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
      adminEmail: adminEmail !== undefined ? adminEmail : org.adminEmail,
      allowedDomain: allowedDomain !== undefined ? allowedDomain : org.allowedDomain,
      metadata: metadata !== undefined ? metadata : org.metadata,
      status: status || org.status,
      isHrmsSetup: isHrmsSetup !== undefined ? isHrmsSetup : org.isHrmsSetup,
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

    await org.update({ status: "SUSPENDED", isDeleted: true });

    res.status(200).json({ message: "Organization deactivated successfully" });
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

    await org.update({ status: "ACTIVE", isDeleted: false });

    res.status(200).json({ message: "Organization restored successfully", data: org });
  } catch (error: any) {
    console.error("Error restoring organization:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
