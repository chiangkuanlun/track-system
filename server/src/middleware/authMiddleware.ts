import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import User, { IUser } from '../models/User';
import Group from '../models/Group';
import Event from '../models/Event';
import Athlete from '../models/Athlete';

export interface AuthRequest extends Request {
  user?: IUser;
}

export const protect = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) {
    res.status(401).json({ message: '請先登入' });
    return;
  }

  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET 尚未設定');
    const decoded = jwt.verify(token, secret) as { id: string };
    const user = await User.findById(decoded.id).select('-password');
    if (!user || !user.active) {
      res.status(401).json({ message: '帳號不存在或已停用' });
      return;
    }
    req.user = user;
    next();
  } catch {
    res.status(401).json({ message: '登入憑證無效或已過期' });
  }
};

export const admin = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ message: '此功能僅限系統管理員' });
    return;
  }
  next();
};

const canAccessGroup = (user: IUser, groupId: unknown): boolean =>
  user.role === 'admin' ||
  (user.role === 'recorder' &&
    user.assignedGroupIds.some(id => id && id.toString() === String(groupId)));

export const groupAccess = (source: 'group' | 'event' | 'athlete') =>
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ message: '請先登入' });
      return;
    }
    if (req.user.role === 'admin') {
      next();
      return;
    }

    try {
      let groupId: unknown;
      if (source === 'group') {
        groupId = req.params.groupId || req.params.id || req.body.groupId;
      } else if (source === 'event') {
        const eventId = req.params.eventId || req.params.id || req.body.eventId;
        const event = await Event.findById(eventId).select('groupId');
        groupId = event?.groupId;
      } else {
        const athleteId = req.params.id;
        const athlete = athleteId
          ? await Athlete.findById(athleteId).select('eventId')
          : null;
        const eventId = athlete?.eventId || req.body.eventId;
        const event = await Event.findById(eventId).select('groupId');
        groupId = event?.groupId;
      }

      if (!groupId || !canAccessGroup(req.user, groupId)) {
        res.status(403).json({ message: '您未被分派此競賽組別' });
        return;
      }
      next();
    } catch {
      res.status(400).json({ message: '無法驗證競賽組別權限' });
    }
  };

export const filterAssignedGroups = async (req: AuthRequest): Promise<string[] | null> => {
  if (!req.user || req.user.role === 'viewer') return [];
  if (req.user.role === 'admin') return null;
  return req.user.assignedGroupIds.filter(Boolean).map(id => id.toString());
};
