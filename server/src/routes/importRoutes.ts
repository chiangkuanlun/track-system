import express from 'express';
import { importCompetition } from '../controllers/importController'; // <--- 修正這裡的名稱
import multer from 'multer';

const router = express.Router();

// 設定 Multer (使用記憶體儲存，方便直接解析 Excel)
const upload = multer({ storage: multer.memoryStorage() });

// <--- 修正這裡的名稱
router.post('/', upload.single('file'), importCompetition);

export default router;
