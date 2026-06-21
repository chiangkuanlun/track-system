import mongoose, { Schema, Document } from 'mongoose';

export interface ICompetition extends Document {
  name: string;
  dateStart: Date;
  dateEnd: Date;
  location: string;
  status: string;
}

const CompetitionSchema: Schema = new Schema({
  name: { type: String, required: true },
  dateStart: { type: Date, required: true },
  dateEnd: { type: Date, required: true },
  location: { type: String, required: true },
  // 修改這裡：確保包含 'pending', 'upcoming', 'ongoing', 'completed'
  status: { 
    type: String, 
    enum: ['pending', 'upcoming', 'ongoing', 'completed'], 
    default: 'pending' 
  }
}, {
  timestamps: true
});

export default mongoose.model<ICompetition>('Competition', CompetitionSchema);
