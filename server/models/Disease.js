import mongoose from 'mongoose';
const diseaseSchema = new mongoose.Schema({ name: { type: String, required: true, unique: true, trim: true }, crops: [String], symptoms: [String], prevention: [String], nextSteps: [String] }, { timestamps: true });
export default mongoose.model('Disease', diseaseSchema);
