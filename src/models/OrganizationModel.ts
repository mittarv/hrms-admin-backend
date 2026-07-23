import { DataTypes, Model, Sequelize } from "sequelize";

export interface OrganizationAttributes {
  id?: string;
  name: string;
  subdomain: string;
  domain?: string | null;
  slugDomain?: string | null;
  adminEmail?: string | null;
  allowedDomain?: string | null;
  metadata?: object | null;
  status?: string;
  isDeleted?: boolean;
  isHrmsSetup?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export class Organization extends Model<OrganizationAttributes, Partial<OrganizationAttributes>> implements OrganizationAttributes {
  declare id: string;
  declare name: string;
  declare subdomain: string;
  declare domain: string | null;
  declare slugDomain: string | null;
  declare adminEmail: string | null;
  declare allowedDomain: string | null;
  declare metadata: object | null;
  declare status: string;
  declare isDeleted: boolean;
  declare isHrmsSetup: boolean;
  
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

export const initOrganization = (sequelize: Sequelize, dataTypes: typeof DataTypes) => {
  Organization.init(
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
      subdomain: {
        type: dataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      domain: {
        type: dataTypes.STRING,
        allowNull: true,
      },
      slugDomain: {
        type: dataTypes.STRING,
        allowNull: true,
        unique: true,
      },
      adminEmail: {
        type: dataTypes.STRING,
        allowNull: true,
      },
      allowedDomain: {
        type: dataTypes.STRING,
        allowNull: true,
      },
      metadata: {
        type: dataTypes.JSON,
        allowNull: true,
      },
      status: {
        type: dataTypes.ENUM("ACTIVE", "INACTIVE", "SUSPENDED"),
        defaultValue: "ACTIVE",
      },
      isDeleted: {
        type: dataTypes.BOOLEAN,
        defaultValue: false,
      },
      isHrmsSetup: {
        type: dataTypes.BOOLEAN,
        defaultValue: false,
      },
    },
    {
      sequelize,
      modelName: "organization",
      tableName: "organizations",
      timestamps: true,
    }
  );

  return Organization;
};
