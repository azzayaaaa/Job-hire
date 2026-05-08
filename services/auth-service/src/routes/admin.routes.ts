import { Router } from 'express';
import { getAdminStats, getAllUsers, updateUserCredits, updateUserRole } from '../controllers/admin.controller';

const router = Router();

router.get('/stats', getAdminStats);
router.get('/users', getAllUsers);
router.post('/update-credits', updateUserCredits);
router.post('/update-role', updateUserRole);

export default router;
