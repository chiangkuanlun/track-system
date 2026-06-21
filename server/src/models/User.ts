import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

export type UserRole = 'admin' | 'recorder' | 'viewer';
export type EventSpecialty = 'track' | 'field' | 'relay';

export interface IUser extends Document {
  username: string;
  password: string;
  name: string;
  role: UserRole;
  assignedGroupIds: mongoose.Types.ObjectId[];
  specialties: EventSpecialty[];
  active: boolean;
  matchPassword(enteredPassword: string): Promise<boolean>;
}

const UserSchema = new Schema<IUser>({
  username: { type: String, required: true, unique: true, trim: true, lowercase: true },
  password: { type: String, required: true, minlength: 8 },
  name: { type: String, required: true, trim: true },
  role: {
    type: String,
    enum: ['admin', 'recorder', 'viewer'],
    default: 'viewer'
  },
  assignedGroupIds: [{
    type: Schema.Types.ObjectId,
    ref: 'Group'
  }],
  specialties: [{
    type: String,
    enum: ['track', 'field', 'relay']
  }],
  active: { type: Boolean, default: true }
}, { timestamps: true });

UserSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
});

UserSchema.methods.matchPassword = function (enteredPassword: string) {
  return bcrypt.compare(enteredPassword, this.password);
};

export default mongoose.model<IUser>('User', UserSchema);
