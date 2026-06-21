import express from 'express';
import {
  authUser, bootstrapAdmin, registerUser, getUserProfile,
  getRecorders, assignGroup, updateUser
} from '../controllers/userController';
import { protect, admin } from '../middleware/authMiddleware';

const router = express.Router();

router.post('/login', authUser);
router.post('/bootstrap', bootstrapAdmin);
router.post('/register', protect, admin, registerUser);
router.get('/profile', protect, getUserProfile);
router.get('/recorders', protect, admin, getRecorders);
router.post('/assign', protect, admin, assignGroup);
router.put('/:id', protect, admin, updateUser);

export default router;
