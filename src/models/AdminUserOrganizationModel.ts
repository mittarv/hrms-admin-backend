import { DataTypes, Model, Sequelize } from "sequelize";

export interface AdminUserOrganizationAttributes {
  id?: string;
  adminUserId: string;
  organizationId: string;
  isDeleted?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export class AdminUserOrganization extends Model<AdminUserOrganizationAttributes, Partial<AdminUserOrganizationAttributes>> implements AdminUserOrganizationAttributes {
  declare id: string;
  declare adminUserId: string;
  declare organizationId: string;
  declare isDeleted: boolean;

  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

export const initAdminUserOrganization = (sequelize: Sequelize, dataTypes: typeof DataTypes) => {
  AdminUserOrganization.init(
    {
      id: {
        type: dataTypes.UUID,
        defaultValue: dataTypes.UUIDV4,
        primaryKey: true,
      },
      adminUserId: {
        type: dataTypes.UUID,
        allowNull: false,
        references: {
          model: 'admin_users',
          key: 'id'
        }
      },
      organizationId: {
        type: dataTypes.STRING,
        allowNull: false,
      },
      isDeleted: {
        type: dataTypes.BOOLEAN,
        defaultValue: false,
      },
    },
    {
      sequelize,
      modelName: "adminUserOrganization",
      tableName: "admin_user_organizations",
      timestamps: true,
      indexes: [
        {
          unique: true,
          fields: ['adminUserId', 'organizationId']
        }
      ]
    }
  );

  return AdminUserOrganization;
};
