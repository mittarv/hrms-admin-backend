import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

import { initAdminUser } from './AdminUserModel';

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

export const seedInitialAdminUsers = async () => {
  const AdminUser = (dbOutput as any).adminUser;
  if (!AdminUser) return;

  const initialAdmins = [
    { name: "Vishal", email: "vishal@mittarv.com", role: "SUPER_ADMIN", status: "ACTIVE" },
    { name: "Amitosh Kumar", email: "amitosh.kumar@mittarv.com", role: "SUPER_ADMIN", status: "ACTIVE" }
  ];

  for (const admin of initialAdmins) {
    try {
      const [user, created] = await AdminUser.findOrCreate({
        where: { email: admin.email },
        defaults: {
          name: admin.name,
          email: admin.email,
          role: admin.role,
          status: admin.status,
          isDeleted: false
        }
      });

      if (created) {
        console.log(`[Seed]: Seeded Super Admin user: ${admin.email}`);
      } else if (user.isDeleted || user.status === "INVITED") {
        await user.update({ status: "ACTIVE", isDeleted: false, role: "SUPER_ADMIN" });
        console.log(`[Seed]: Activated Super Admin user: ${admin.email}`);
      }
    } catch (err) {
      console.error(`[Seed]: Error seeding ${admin.email}:`, err);
    }
  }
};

export const connectDB = async () => {
  try {
    await dbOutput.authenticate();
    console.log('[Database]: Admin (dbOutput) connected successfully.');
    
    await dbHrms.authenticate();
    console.log('[Database]: HRMS (dbHrms) connected successfully.');
    
    // Sync admin models
    await dbOutput.sync();

    // Seed initial Super Admin users
    await seedInitialAdminUsers();
  } catch (error) {
    console.error('[Database]: Unable to connect to the databases:', error);
  }
};

export { dbOutput, dbHrms };
