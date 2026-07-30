/**
 * Raw SQL queries for Organization management in hrmsadmin-backend.
 */

export const FIND_ORG_BY_SUBDOMAIN = `
  SELECT id, name, subdomain, domain, slugDomain, adminEmail, allowedDomain, metadata, status, isDeleted, createdAt, updatedAt
  FROM organizations
  WHERE subdomain = :subdomain LIMIT 1
`;

export const CHECK_FIELD_AVAILABILITY = (field: string) => `
  SELECT id FROM organizations 
  WHERE ${field} = :value 
  AND isDeleted = false
  LIMIT 1
`;

export const INSERT_ORGANIZATION = `
  INSERT INTO organizations 
  (id, name, subdomain, domain, slugDomain, adminEmail, allowedDomain, metadata, status, isDeleted, createdAt, updatedAt)
  VALUES 
  (:id, :name, :subdomain, :domain, :slugDomain, :adminEmail, :allowedDomain, :metadata, :status, false, NOW(), NOW())
`;

export const INSERT_DEFAULT_CONFIGS = (orgId: string, configs: { type: string, value: string }[]) => {
  const values = configs.map(c => `('${orgId}', '${c.type}', '${c.value}', false, NOW(), NOW())`).join(',');
  return `
    INSERT INTO employeecomponentconfigurators 
    (empCompanyId, componentType, componentValue, isDeleted, createdAt, updatedAt)
    VALUES 
    ${values}
  `;
};

export const INSERT_UNPAID_LEAVE = `
  INSERT INTO employeeleaveconfigurators 
  (leaveConfigId, empCompanyId, leaveType, employeeType, accuralFrequency, totalAllotedLeaves, accuralRate, minimumNoticePeriod, maximumNoticePeriod, continuousLeavesLimit, excludePaidWeekend, appliedGender, isHalfDayAllowed, isProofRequired, isReasonRequired, effectiveDate, isActive, isDefault, allotAllLeaves, createdAt, updatedAt)
  VALUES 
  (UUID(), :orgId, 'Unpaid Leave', '{}', 'monthly_key', 0, 0, 0, 0, 0, false, 'All', true, false, false, NOW(), true, false, false, NOW(), NOW())
`;

export const INSERT_SALARY_CATEGORY = `
  INSERT INTO salarycategories
  (salaryCategoryId, empCompanyId, employeeType, employeeLocation, employeeLevel, department, yearOfStudy, isDeleted, createdAt, updatedAt)
  VALUES
  (:categoryId, :orgId, 'All', 'All', 'All', NULL, NULL, false, NOW(), NOW())
`;

export const GET_ALL_ORGANIZATIONS = (isDeleted?: string, includeDeleted?: string) => {
  let sql = `
    SELECT id, name, subdomain, domain, slugDomain, adminEmail, allowedDomain, metadata, status, isDeleted, createdAt, updatedAt
    FROM organizations
    WHERE 1=1
  `;
  if (isDeleted === 'true') {
    sql += ` AND isDeleted = true`;
  } else if (includeDeleted !== 'true') {
    sql += ` AND isDeleted = false`;
  }
  sql += ` ORDER BY createdAt DESC`;
  return sql;
};

export const FIND_ORG_BY_ID = `
  SELECT id, name, subdomain, domain, slugDomain, adminEmail, allowedDomain, metadata, status, isDeleted, createdAt, updatedAt
  FROM organizations
  WHERE id = :id LIMIT 1
`;

export const UPDATE_ORGANIZATION = `
  UPDATE organizations
  SET
    name = :name,
    subdomain = :subdomain,
    domain = :domain,
    adminEmail = :adminEmail,
    allowedDomain = :allowedDomain,
    metadata = :metadata,
    status = :status,
    updatedAt = NOW()
  WHERE id = :id
`;

export const DEACTIVATE_ORGANIZATION = `
  UPDATE organizations
  SET status = 'SUSPENDED', isDeleted = true, updatedAt = NOW()
  WHERE id = :id
`;

export const CASCADE_SOFT_DELETE = (table: string) => {
  return `UPDATE ${table} SET isDeleted = true, updatedAt = NOW() WHERE empCompanyId = :orgId`;
};

export const CASCADE_SOFT_DELETE_MAPPING = `
  UPDATE user_organization_mappings 
  SET isDeleted = true, updatedAt = NOW() 
  WHERE organizationId = :orgId
`;

export const CASCADE_DEACTIVATE_LEAVE = `
  UPDATE employeeleaveconfigurators 
  SET isActive = false, updatedAt = NOW() 
  WHERE empCompanyId = :orgId
`;

export const ACTIVATE_ORGANIZATION = `
  UPDATE organizations
  SET status = 'ACTIVE', isDeleted = false, updatedAt = NOW()
  WHERE id = :id
`;

export const CASCADE_RESTORE = (table: string, whereCol: string) => {
  return `UPDATE ${table} SET isDeleted = false, updatedAt = NOW() WHERE ${whereCol} = :orgId`;
};

export const CASCADE_ACTIVATE_LEAVE = `
  UPDATE employeeleaveconfigurators 
  SET isActive = true, updatedAt = NOW() 
  WHERE empCompanyId = :orgId
`;
