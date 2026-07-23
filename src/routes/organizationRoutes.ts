import { Router } from "express";
import { 
  createOrganization, 
  getAllOrganizations, 
  getOrganizationById, 
  updateOrganization, 
  deleteOrganization,
  restoreOrganization
} from "../controllers/OrganizationController";

const router = Router();

router.post("/", createOrganization);
router.get("/", getAllOrganizations);
router.get("/:id", getOrganizationById);
router.patch("/:id/restore", restoreOrganization);
router.post("/:id/restore", restoreOrganization);
router.patch("/:id", updateOrganization);
router.put("/:id", updateOrganization);
router.delete("/:id", deleteOrganization);

export default router;
