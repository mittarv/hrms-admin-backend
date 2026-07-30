import { DataTypes, Model, Sequelize } from "sequelize";

export interface AdminUserAttributes {
  id?: string;
  name: string;
  email: string;
  role: string;
  status: string;
  invitedBy?: string | null;
  isDeleted?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export class AdminUser extends Model<AdminUserAttributes, Partial<AdminUserAttributes>> implements AdminUserAttributes {
  declare id: string;
  declare name: string;
  declare email: string;
  declare role: string;
  declare status: string;
  declare invitedBy: string | null;
  declare isDeleted: boolean;

  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

export const initAdminUser = (sequelize: Sequelize, dataTypes: typeof DataTypes) => {
  AdminUser.init(
    {
      id: {
        type: dataTypes.UUID,
        defaultValue: dataTypes.UUIDV4,
        primaryKey: true,
      },
      name: {
        type: dataTypes.STRING,
        allowNull: false,
      },
      email: {
        type: dataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      role: {
        type: dataTypes.ENUM("SUPER_ADMIN", "ADMIN", "HR_MANAGER", "VIEWER"),
        defaultValue: "ADMIN",
      },
      status: {
        type: dataTypes.ENUM("ACTIVE", "INVITED", "INACTIVE", "SUSPENDED"),
        defaultValue: "INVITED",
      },
      invitedBy: {
        type: dataTypes.STRING,
        allowNull: true,
      },
      isDeleted: {
        type: dataTypes.BOOLEAN,
        defaultValue: false,
      },
    },
    {
      sequelize,
      modelName: "adminUser",
      tableName: "admin_users",
      timestamps: true,
    }
  );

  return AdminUser;
};
