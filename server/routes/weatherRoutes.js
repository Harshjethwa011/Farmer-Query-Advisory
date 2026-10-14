import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { protect } from '../middleware/auth.js';
import { searchLocations, weather, weatherAtCoordinates } from '../controllers/weatherController.js';

const router = Router();
const weatherRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many weather requests. Please try again later.' },
});

router.use(protect, weatherRateLimit);
router.get('/locations', searchLocations);
router.post('/forecast', weatherAtCoordinates);
router.get('/', weather);
export default router;
