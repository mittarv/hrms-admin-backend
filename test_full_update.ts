import { dbHrms } from "./src/models";

async function testFullUpdate() {
  try {
    const Organization = (dbHrms as any).organization;
    const org = await Organization.findOne();
    if (org) {
      console.log("Found org:", org.name);
      
      const payload = {
        name: org.name,
        subdomain: org.subdomain,
        adminEmail: "newadmin@example.com",
        allowedDomain: org.allowedDomain,
        status: org.status
      };
      
      await org.update(payload);
      console.log("Full update successful");
    } else {
      console.log("No orgs found");
    }
  } catch (error) {
    console.error("Failed to update:", error);
  } finally {
    process.exit(0);
  }
}

testFullUpdate();
