import { Router } from 'express'; import { listCrops, getCrop, createCrop } from '../controllers/cropController.js'; import { protect, adminOnly } from '../middleware/auth.js';
const router = Router(); router.get('/', listCrops); router.get('/:id', getCrop); router.post('/', protect, adminOnly, createCrop); export default router;
