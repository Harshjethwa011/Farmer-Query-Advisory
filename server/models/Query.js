import mongoose from 'mongoose';
const querySchema = new mongoose.Schema({ userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true }, question: { type: String, required: true, trim: true, maxlength: 3000 }, response: { type: String, required: true, maxlength: 12000 }, language: { type: String, default: 'English' } }, { timestamps: true });
export default mongoose.model('Query', querySchema);
