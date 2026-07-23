import { dbHrms } from "./src/models";

async function testUpdateEmail() {
  try {
    const Organization = (dbHrms as any).organization;
    const org = await Organization.findOne();
    if (org) {
      console.log("Found org:", org.name);
      await org.update({ adminEmail: "test@example.com" });
      console.log("Updated adminEmail successfully to:", org.adminEmail);
    } else {
      console.log("No orgs found");
    }
  } catch (error) {
    console.error("Failed to update email:", error);
  } finally {
    process.exit(0);
  }
}

testUpdateEmail();
