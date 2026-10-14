import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { detect, imageUpload, listDiseases, getDisease } from '../controllers/diseaseController.js';
import { protect } from '../middleware/auth.js';

const router = Router();
const imageAnalysisLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many image analysis attempts. Please try again later.' },
});

router.post('/detect', protect, imageAnalysisLimit, imageUpload, detect);
router.get('/', listDiseases);
router.get('/:id', getDisease);
export default router;
