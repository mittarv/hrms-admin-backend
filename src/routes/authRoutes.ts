import { Router } from "express";
import { googleLogin } from "../controllers/authController";

const router = Router();

router.post("/google", googleLogin);

export default router;
