import { dbHrms } from "./src/models";
import { Sequelize } from "sequelize";

async function testUpdate() {
  try {
    const Organization = (dbHrms as any).organization;
    const org = await Organization.findOne();
    if (org) {
      console.log("Found org:", org.name);
      await org.update({ status: "ACTIVE" });
      console.log("Updated successfully");
    } else {
      console.log("No orgs found");
    }
  } catch (error) {
    console.error("Failed:", error);
  } finally {
    process.exit(0);
  }
}

testUpdate();
