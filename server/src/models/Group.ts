import mongoose, { Document, Schema } from 'mongoose';

export interface IGroup extends Document {
  competitionId: mongoose.Types.ObjectId;
  name: string; 
  category?: string; // 加問號代表可選
  gender?: string;   // 加問號代表可選
  sortOrder: number;
  recorderIds?: string[]; // ★ 新增：儲存被分派到此組別的記錄人員 ID
}

const GroupSchema: Schema = new Schema({
  competitionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Competition',
    required: true
  },
  name: { type: String, required: true },
  
  // 修改重點：移除 required: true，讓匯入程式可以先只存名稱
  category: { 
    type: String, 
    required: false, 
    enum: ['國小', '國中', '高中', '大學', '社會']
  },
  gender: { 
    type: String, 
    required: false, 
    enum: ['男童', '女童', '男子', '女子', '混合']
  },
  sortOrder: { type: Number, default: 0 },

  // ★ 新增：記錄人員列表 (Array of Strings)
  // 這裡存的是 User 的 _id (字串形式)，方便前端比對
  recorderIds: [{ type: String, default: [] }] 
}, {
  timestamps: true
});

export default mongoose.model<IGroup>('Group', GroupSchema);
