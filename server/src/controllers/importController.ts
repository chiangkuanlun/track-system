import { Request, Response } from 'express';

// 舊版匯入入口已停用；正式匯入位於 POST /api/competitions/:id/import。
export const importCompetition = async (_req: Request, res: Response): Promise<void> => {
  res.status(410).json({
    message: '此匯入入口已停用，請先建立賽事，再使用 /api/competitions/:id/import'
  });
};
