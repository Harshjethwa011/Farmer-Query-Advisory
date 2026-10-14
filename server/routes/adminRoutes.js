import { Router } from 'express'; import { protect, adminOnly } from '../middleware/auth.js'; import { overview, listFarmers } from '../controllers/adminController.js';
const router = Router(); router.use(protect, adminOnly); router.get('/overview', overview); router.get('/farmers', listFarmers); export default router;
