import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

import { initAdminUser } from './AdminUserModel';
import { initAdminUserOrganization } from './AdminUserOrganizationModel';
import { initAdminUserInvitation } from './AdminUserInvitationModel';

// Database for Admin UAM
const dbOutput = new Sequelize(
  process.env.DATABASE_OUTPUT_NAME as string,
  process.env.DATABASE_OUTPUT_USER as string,
  process.env.DATABASE_OUTPUT_PASSWORD as string,
  {
    host: process.env.DATABASE_OUTPUT_HOST,
    port: parseInt(process.env.DATABASE_OUTPUT_PORT as string, 10),
    dialect: (process.env.DATABASE_OUTPUT_DIALECT as any) || 'mysql',
    logging: false,
  }
);

// Database for HRMS (Organizations, Details)
const dbHrms = new Sequelize(
  process.env.DATABASE_HRMS_NAME as string,
  process.env.DATABASE_HRMS_USER as string,
  process.env.DATABASE_HRMS_PASSWORD as string,
  {
    host: process.env.DATABASE_HRMS_HOST,
    port: parseInt(process.env.DATABASE_HRMS_PORT as string, 10),
    dialect: (process.env.DATABASE_HRMS_DIALECT as any) || 'mysql',
    logging: false,
  }
);

(dbOutput as any).adminUser = initAdminUser(dbOutput, require('sequelize').DataTypes);
(dbOutput as any).adminUserOrganization = initAdminUserOrganization(dbOutput, require('sequelize').DataTypes);
(dbOutput as any).adminUserInvitation = initAdminUserInvitation(dbOutput, require('sequelize').DataTypes);

// Define associations
const AdminUser = (dbOutput as any).adminUser;
const AdminUserOrganization = (dbOutput as any).adminUserOrganization;
const AdminUserInvitation = (dbOutput as any).adminUserInvitation;

AdminUser.hasMany(AdminUserOrganization, { foreignKey: 'adminUserId', as: 'organizations' });
AdminUserOrganization.belongsTo(AdminUser, { foreignKey: 'adminUserId', as: 'user' });

AdminUser.hasMany(AdminUserInvitation, { foreignKey: 'adminUserId', as: 'invitations' });
AdminUserInvitation.belongsTo(AdminUser, { foreignKey: 'adminUserId', as: 'user' });



export const connectDB = async () => {
  try {
    await dbOutput.authenticate();
    console.log('[Database]: Admin (dbOutput) connected successfully.');
    
    await dbHrms.authenticate();
    console.log('[Database]: HRMS (dbHrms) connected successfully.');
    
    // Sync admin models
    await dbOutput.sync({ alter: { drop: false } });


  } catch (error) {
    console.error('[Database]: Unable to connect to the databases:', error);
  }
};

export { dbOutput, dbHrms };
