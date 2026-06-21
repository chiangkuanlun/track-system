import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import { AuthRequest } from '../middleware/authMiddleware';

const generateToken = (id: string): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET 尚未設定');
  return jwt.sign({ id }, secret, { expiresIn: '12h' });
};

const userPayload = (user: any, withToken = false) => ({
  _id: user._id,
  name: user.name,
  username: user.username,
  role: user.role,
  assignedGroupIds: user.assignedGroupIds || [],
  specialties: user.specialties || [],
  active: user.active,
  ...(withToken ? { token: generateToken(user._id.toString()) } : {})
});

export const authUser = async (req: Request, res: Response): Promise<void> => {
  const username = String(req.body.username || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const user = await User.findOne({ username });
  if (!user || !user.active || !(await user.matchPassword(password))) {
    res.status(401).json({ message: '帳號或密碼錯誤' });
    return;
  }
  res.json(userPayload(user, true));
};

export const bootstrapAdmin = async (req: Request, res: Response): Promise<void> => {
  if (await User.exists({})) {
    res.status(403).json({ message: '系統已完成初始化，請由管理員建立帳號' });
    return;
  }
  const { name, username, password } = req.body;
  if (!name || !username || !password || String(password).length < 8) {
    res.status(400).json({ message: '姓名、帳號及至少 8 碼密碼為必填' });
    return;
  }
  const user = await User.create({ name, username, password, role: 'admin', active: true });
  res.status(201).json(userPayload(user, true));
};

export const registerUser = async (req: AuthRequest, res: Response): Promise<void> => {
  const { name, username, password, role = 'recorder', specialties = [] } = req.body;
  if (!name || !username || !password || String(password).length < 8) {
    res.status(400).json({ message: '姓名、帳號及至少 8 碼密碼為必填' });
    return;
  }
  if (!['recorder', 'viewer'].includes(role)) {
    res.status(400).json({ message: '只能建立記錄員或檢視者帳號' });
    return;
  }
  if (await User.exists({ username: String(username).trim().toLowerCase() })) {
    res.status(409).json({ message: '帳號已存在' });
    return;
  }
  const user = await User.create({
    name, username, password, role, specialties,
    assignedGroupIds: [], active: true
  });
  res.status(201).json(userPayload(user));
};

export const getUserProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  res.json(userPayload(req.user));
};

export const getRecorders = async (_req: Request, res: Response): Promise<void> => {
  const users = await User.find({ role: 'recorder' }).select('-password').sort({ name: 1 });
  res.json(users);
};

export const assignGroup = async (req: Request, res: Response): Promise<void> => {
  const { userId, groupId, action } = req.body;
  const user = await User.findOne({ _id: userId, role: 'recorder' });
  if (!user) {
    res.status(404).json({ message: '找不到記錄員' });
    return;
  }
  const ids = new Set(user.assignedGroupIds.map(id => id.toString()));
  if (action === 'add') ids.add(String(groupId));
  else if (action === 'remove') ids.delete(String(groupId));
  else {
    res.status(400).json({ message: 'action 必須是 add 或 remove' });
    return;
  }
  user.assignedGroupIds = [...ids] as any;
  await user.save();
  res.json(userPayload(user));
};

export const updateUser = async (req: Request, res: Response): Promise<void> => {
  const user = await User.findById(req.params.id);
  if (!user) {
    res.status(404).json({ message: '找不到使用者' });
    return;
  }
  if (req.body.name !== undefined) user.name = req.body.name;
  if (req.body.active !== undefined) user.active = Boolean(req.body.active);
  if (req.body.specialties !== undefined) user.specialties = req.body.specialties;
  if (req.body.assignedGroupIds !== undefined && user.role === 'recorder') {
    user.assignedGroupIds = req.body.assignedGroupIds;
  }
  await user.save();
  res.json(userPayload(user));
};
