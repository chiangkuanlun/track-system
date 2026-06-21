import mongoose, { Schema, Document } from 'mongoose';

export interface IAthlete extends Document {
  competitionId: mongoose.Types.ObjectId;
  eventId: mongoose.Types.ObjectId;
  name: string;
  team: string;
  bibNumber: string;
  personalBest: number;
  score: string;
  lane: number;
  rank: number;
  note: string;
}

const AthleteSchema = new Schema<IAthlete>({
  competitionId: { type: Schema.Types.ObjectId, ref: 'Competition', required: true, index: true },
  eventId: { type: Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
  name: { type: String, required: true, trim: true },
  team: { type: String, required: true, trim: true },
  bibNumber: { type: String, default: '', trim: true },
  personalBest: { type: Number, default: 0 },
  score: { type: String, default: '' },
  lane: { type: Number, default: 0 },
  rank: { type: Number, default: 0 },
  note: { type: String, default: '' }
}, { timestamps: true });

AthleteSchema.index(
  { eventId: 1, bibNumber: 1 },
  { unique: true, partialFilterExpression: { bibNumber: { $type: 'string', $gt: '' } } }
);

export default mongoose.model<IAthlete>('Athlete', AthleteSchema);
