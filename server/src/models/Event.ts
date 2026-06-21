import mongoose, { Schema, Document } from 'mongoose';

export type EventType = 'track' | 'field' | 'relay';

export interface IEvent extends Document {
  competitionId: mongoose.Types.ObjectId;
  groupId: mongoose.Types.ObjectId;
  name: string;
  type: EventType;
  rounds: string[];
  currentRound: string;
  laneCount: number;
  advancementCount?: number;
  advancePerHeat?: number;
  roundResults: unknown[];
  heats: unknown[];
}

const laneSchema = new Schema({
  laneNumber: { type: Number, required: true },
  athleteId: { type: Schema.Types.ObjectId, ref: 'Athlete', default: null },
  result: { type: String, default: '' },
  rank: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['Normal', 'DNS', 'DNF', 'DQ', 'NM'],
    default: 'Normal'
  }
}, { _id: false });

const heatSchema = new Schema({
  name: { type: String, required: true },
  lanes: { type: [laneSchema], default: [] }
}, { _id: false });

const EventSchema = new Schema<IEvent>({
  competitionId: { type: Schema.Types.ObjectId, ref: 'Competition', required: true, index: true },
  groupId: { type: Schema.Types.ObjectId, ref: 'Group', required: true, index: true },
  name: { type: String, required: true, trim: true },
  type: { type: String, required: true, enum: ['track', 'field', 'relay'] },
  rounds: { type: [String], default: ['決賽'] },
  currentRound: { type: String, default: '' },
  laneCount: { type: Number, min: 1, max: 12, default: 8 },
  advancementCount: { type: Number, min: 1, max: 128 },
  advancePerHeat: { type: Number, min: 0, max: 12, default: 2 },
  roundResults: [{
    roundName: String,
    heats: { type: [heatSchema], default: [] }
  }],
  heats: { type: [heatSchema], default: [] }
}, { timestamps: true });

EventSchema.index({ groupId: 1, name: 1 }, { unique: true });

export default mongoose.model<IEvent>('Event', EventSchema);
