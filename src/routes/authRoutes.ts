import { Router } from "express";
import { googleLogin, verifyInvite } from "../controllers/authController";

const router = Router();

router.post("/google", googleLogin);
router.post("/verify-invite", verifyInvite);

export default router;
