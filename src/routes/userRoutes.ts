import { Router } from "express";
import { requireAdmin, requireAnyRole } from "../middlewares/authMiddleware";
import {
  getAllUsers,
  getUserById,
  inviteUser,
  updateUser,
  resendInvite,
  deleteUser,
  restoreUser
} from "../controllers/UserController";

const router = Router();

// GET APIs are accessible to all authenticated users
router.get("/", requireAnyRole as any, getAllUsers);
router.get("/:id", requireAnyRole as any, getUserById);

// Mutating APIs require ADMIN or SUPER_ADMIN access
router.post("/", requireAdmin as any, inviteUser);
router.post("/invite", requireAdmin as any, inviteUser);
router.post("/:id/resend-invite", requireAdmin as any, resendInvite);
router.put("/:id", requireAdmin as any, updateUser);
router.patch("/:id", requireAdmin as any, updateUser);
router.patch("/:id/restore", requireAdmin as any, restoreUser);
router.post("/:id/restore", requireAdmin as any, restoreUser);
router.delete("/:id", requireAdmin as any, deleteUser);

export default router;
