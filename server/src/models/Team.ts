import mongoose, { Schema, Document } from 'mongoose';

export interface ITeam extends Document {
  name: string;
  competitionId: mongoose.Types.ObjectId;
  leader?: string; // 領隊或聯絡人
  phone?: string;  // 聯絡電話
}

const TeamSchema: Schema = new Schema({
  name: { type: String, required: true },
  competitionId: { type: Schema.Types.ObjectId, ref: 'Competition', required: true },
  leader: { type: String, default: '' },
  phone: { type: String, default: '' }
}, { timestamps: true });

export default mongoose.model<ITeam>('Team', TeamSchema);
