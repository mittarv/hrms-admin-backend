import { Router } from "express";
import { requireAdmin, requireAnyRole } from "../middlewares/authMiddleware";
import { 
  createOrganization, 
  getAllOrganizations, 
  getOrganizationById, 
  updateOrganization, 
  deleteOrganization,
  restoreOrganization,
  checkAvailability
} from "../controllers/OrganizationController";

const router = Router();

// GET APIs are accessible to all authenticated users
router.get("/check-availability", requireAnyRole as any, checkAvailability);
router.get("/", requireAnyRole as any, getAllOrganizations);
router.get("/:id", requireAnyRole as any, getOrganizationById);

// Mutating APIs require ADMIN or SUPER_ADMIN access
router.post("/", requireAdmin as any, createOrganization);
router.patch("/:id/restore", requireAdmin as any, restoreOrganization);
router.post("/:id/restore", requireAdmin as any, restoreOrganization);
router.patch("/:id", requireAdmin as any, updateOrganization);
router.put("/:id", requireAdmin as any, updateOrganization);
router.delete("/:id", requireAdmin as any, deleteOrganization);

export default router;
