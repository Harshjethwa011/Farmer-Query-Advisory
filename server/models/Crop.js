import mongoose from 'mongoose';

const sourceSchema = new mongoose.Schema({
  organization: { type: String, trim: true, maxlength: 160 },
  title: { type: String, trim: true, maxlength: 240 },
  url: { type: String, trim: true, maxlength: 600 },
  publishedAt: { type: String, trim: true, maxlength: 20 },
  lastReviewedAt: { type: String, trim: true, maxlength: 20 },
}, { _id: false });

const textBlockSchema = new mongoose.Schema({
  status: { type: String, enum: ['documented', 'general', 'limited', 'regional-context', 'unavailable', 'unverified'] },
  summary: { type: String, trim: true, maxlength: 3000 },
  guidance: { type: String, trim: true, maxlength: 3000 },
  window: { type: String, trim: true, maxlength: 120 },
  seasons: [{ type: String, enum: ['Kharif', 'Rabi', 'Zaid'] }],
  regionalContext: { type: String, trim: true, maxlength: 1200 },
}, { _id: false });

const pestSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  type: { type: String, enum: ['pest', 'disease'], required: true },
  note: { type: String, trim: true, maxlength: 1000 },
}, { _id: false });

const cropSchema = new mongoose.Schema({
  slug: { type: String, trim: true, lowercase: true, match: /^[a-z0-9-]+$/, unique: true, sparse: true },
  name: { type: String, required: true, unique: true, trim: true, maxlength: 80 },
  aliases: [{ type: String, trim: true, maxlength: 80 }],
  seasons: [{ type: String, enum: ['Kharif', 'Rabi', 'Zaid', 'Other'] }],
  region: { type: String, trim: true, maxlength: 100 },
  soil: textBlockSchema,
  climateWater: textBlockSchema,
  sowing: textBlockSchema,
  growthDuration: textBlockSchema,
  harvesting: textBlockSchema,
  nutrition: textBlockSchema,
  pestsDiseases: [pestSchema],
  ipmPractices: [{ type: String, trim: true, maxlength: 1500 }],
  sources: [sourceSchema],
  lastReviewedAt: { type: String, trim: true, maxlength: 20 },
  // Retained for existing stored crop records and admin integrations.
  suitableConditions: { type: String, trim: true, maxlength: 3000 },
  waterRequirements: { type: String, trim: true, maxlength: 3000 },
  fertilizerInfo: { type: String, trim: true, maxlength: 3000 },
  commonDiseases: [{ type: String, trim: true, maxlength: 100 }],
  practices: [{ type: String, trim: true, maxlength: 1500 }],
}, { timestamps: true });

export default mongoose.model('Crop', cropSchema);
