import { DataTypes, Model, Sequelize } from "sequelize";

export interface AdminUserInvitationAttributes {
  id?: string;
  adminUserId: string;
  token: string;
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED';
  expiresAt: Date;
  isDeleted?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export class AdminUserInvitation extends Model<AdminUserInvitationAttributes, Partial<AdminUserInvitationAttributes>> implements AdminUserInvitationAttributes {
  declare id: string;
  declare adminUserId: string;
  declare token: string;
  declare status: 'PENDING' | 'ACCEPTED' | 'EXPIRED';
  declare expiresAt: Date;
  declare isDeleted: boolean;

  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

export const initAdminUserInvitation = (sequelize: Sequelize, dataTypes: typeof DataTypes) => {
  AdminUserInvitation.init(
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
      token: {
        type: dataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      status: {
        type: dataTypes.ENUM('PENDING', 'ACCEPTED', 'EXPIRED'),
        defaultValue: 'PENDING',
      },
      expiresAt: {
        type: dataTypes.DATE,
        allowNull: false,
      },
      isDeleted: {
        type: dataTypes.BOOLEAN,
        defaultValue: false,
      },
    },
    {
      sequelize,
      modelName: "adminUserInvitation",
      tableName: "admin_user_invitations",
      timestamps: true,
    }
  );

  return AdminUserInvitation;
};
