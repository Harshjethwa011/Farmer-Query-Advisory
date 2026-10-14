import { Router } from 'express';
import { protect } from '../middleware/auth.js';
import { createQuery, listQueries, getQuery, deleteQuery } from '../controllers/queryController.js';
const router = Router(); router.use(protect); router.route('/').get(listQueries).post(createQuery); router.route('/:id').get(getQuery).delete(deleteQuery); export default router;
