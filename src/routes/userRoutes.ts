import { Router } from "express";
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

router.get("/", getAllUsers);
router.post("/", inviteUser);
router.post("/invite", inviteUser);
router.get("/:id", getUserById);
router.put("/:id", updateUser);
router.patch("/:id", updateUser);
router.post("/:id/resend-invite", resendInvite);
router.patch("/:id/restore", restoreUser);
router.post("/:id/restore", restoreUser);
router.delete("/:id", deleteUser);

export default router;
