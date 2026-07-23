import { Router } from 'express';
import authRoutes from './authRoutes';
import organizationRoutes from './organizationRoutes';
import userRoutes from './userRoutes';
import { authenticateJWT } from '../middlewares/authMiddleware';

const router = Router();

// Public auth routes (Google SSO / login)
router.use('/auth', authRoutes);

// Protected Admin API routes
router.use('/organizations', authenticateJWT as any, organizationRoutes);
router.use('/users', authenticateJWT as any, userRoutes);

export default router;
