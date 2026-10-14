import mongoose from 'mongoose';
import Crop from '../models/Crop.js';
import cropKnowledge, { reviewedAt } from '../data/cropKnowledge.js';

const ALLOWED_QUERY_KEYS = new Set(['search', 'season', 'page', 'limit']);
const VALID_SEASONS = new Map([['kharif', 'Kharif'], ['rabi', 'Rabi'], ['zaid', 'Zaid']]);
const MAX_PAGE_SIZE = 20;
const MAX_CUSTOM_CROPS = 200;
const unavailable = 'Crop-specific information is unavailable in this catalog. Confirm with your local KVK or agriculture officer.';

function normalize(value) {
  return String(value || '').normalize('NFKC').trim().toLocaleLowerCase();
}

function legacyCropToStructured(value) {
  const crop = typeof value?.toObject === 'function' ? value.toObject() : value;
  const hasSources = Array.isArray(crop.sources) && crop.sources.length > 0;
  return {
    ...crop,
    aliases: crop.aliases || [],
    seasons: crop.seasons || [],
    region: crop.region || 'Not specified',
    soil: crop.soil || { status: crop.suitableConditions ? (hasSources ? 'documented' : 'unverified') : 'unavailable', summary: crop.suitableConditions || unavailable },
    climateWater: crop.climateWater || { status: crop.waterRequirements ? (hasSources ? 'documented' : 'unverified') : 'unavailable', summary: crop.waterRequirements || unavailable },
    sowing: crop.sowing || { status: 'unavailable', seasons: crop.seasons || [], window: null, guidance: unavailable },
    growthDuration: crop.growthDuration || { status: 'unavailable', summary: unavailable },
    harvesting: crop.harvesting || { status: 'unavailable', summary: unavailable },
    nutrition: crop.nutrition || { status: crop.fertilizerInfo ? (hasSources ? 'documented' : 'unverified') : 'unavailable', summary: crop.fertilizerInfo || unavailable },
    pestsDiseases: crop.pestsDiseases || (crop.commonDiseases || []).map((name) => ({ name, type: 'disease', note: hasSources ? '' : 'This legacy entry has no source metadata; confirm locally.' })),
    ipmPractices: crop.ipmPractices || crop.practices || [],
    sources: crop.sources || [],
    lastReviewedAt: crop.lastReviewedAt || null,
  };
}

async function customCrops() {
  if (mongoose.connection.readyState !== 1) return [];
  return Crop.find().sort({ name: 1 }).limit(MAX_CUSTOM_CROPS).lean();
}

export async function listCrops(req, res, next) {
  try {
    const invalidKey = Object.keys(req.query).find((key) => !ALLOWED_QUERY_KEYS.has(key));
    if (invalidKey) return res.status(400).json({ message: `Unsupported crop filter: ${invalidKey}.` });

    let search = '';
    if (req.query.search !== undefined) {
      if (typeof req.query.search !== 'string' || req.query.search.trim().length > 80) return res.status(400).json({ message: 'Search must be text up to 80 characters.' });
      search = normalize(req.query.search);
    }
    let season;
    if (req.query.season !== undefined) {
      if (typeof req.query.season !== 'string' || !VALID_SEASONS.has(normalize(req.query.season))) return res.status(400).json({ message: 'Season must be Kharif, Rabi, or Zaid.' });
      season = VALID_SEASONS.get(normalize(req.query.season));
    }

    const readPositiveInteger = (value, defaultValue, maxValue) => {
      if (value === undefined) return defaultValue;
      if (typeof value !== 'string' || !/^\d+$/.test(value)) return null;
      const parsed = Number(value);
      return Number.isSafeInteger(parsed) && parsed >= 1 ? Math.min(parsed, maxValue) : null;
    };
    const page = readPositiveInteger(req.query.page, 1, Number.MAX_SAFE_INTEGER);
    const limit = readPositiveInteger(req.query.limit, 10, MAX_PAGE_SIZE);
    if (page === null || limit === null) return res.status(400).json({ message: 'Page and limit must be positive integers.' });

    const stored = await customCrops();
    const catalogNames = new Set(cropKnowledge.map((crop) => normalize(crop.name)));
    const combined = [
      ...cropKnowledge,
      ...stored.filter((item) => !catalogNames.has(normalize(item.name))).map(legacyCropToStructured),
    ];
    const filtered = combined.filter((crop) => {
      const matchesSearch = !search || [crop.name, ...(crop.aliases || [])].some((term) => normalize(term).includes(search));
      const matchesSeason = !season || crop.seasons?.includes(season);
      return matchesSearch && matchesSeason;
    }).sort((left, right) => left.name.localeCompare(right.name));
    const total = filtered.length;
    const start = (page - 1) * limit;
    return res.json({ crops: filtered.slice(start, start + limit), page, limit, total, pages: Math.ceil(total / limit) });
  } catch (error) {
    return next(error);
  }
}

export async function getCrop(req, res, next) {
  try {
    const id = req.params.id;
    const curated = cropKnowledge.find((crop) => crop.slug === id);
    if (curated) return res.json({ crop: curated });
    if (!mongoose.isValidObjectId(id) && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(id)) {
      return res.status(400).json({ message: 'Crop ID must be a valid crop slug or identifier.' });
    }
    if (!mongoose.isValidObjectId(id)) return res.status(404).json({ message: 'Crop not found.' });
    if (mongoose.connection.readyState !== 1) return res.status(404).json({ message: 'Crop not found.' });
    const crop = await Crop.findById(id).lean();
    if (!crop) return res.status(404).json({ message: 'Crop not found.' });
    return res.json({ crop: legacyCropToStructured(crop) });
  } catch (error) {
    return next(error);
  }
}

function validateCropInput(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 'Crop data must be a JSON object.' };
  const allowed = new Set(['name', 'aliases', 'seasons', 'region', 'suitableConditions', 'waterRequirements', 'fertilizerInfo', 'commonDiseases', 'practices', 'sources', 'soil', 'climateWater', 'sowing', 'growthDuration', 'harvesting', 'nutrition', 'pestsDiseases', 'ipmPractices', 'lastReviewedAt']);
  if (Object.keys(body).some((key) => !allowed.has(key))) return { error: 'Crop data contains an unsupported field.' };
  if (typeof body.name !== 'string' || !body.name.trim() || body.name.trim().length > 80) return { error: 'Crop name is required and must be under 80 characters.' };
  for (const key of ['region', 'suitableConditions', 'waterRequirements', 'fertilizerInfo', 'lastReviewedAt']) {
    if (body[key] !== undefined && (typeof body[key] !== 'string' || body[key].length > (key === 'region' ? 100 : 3000))) return { error: `${key} must be valid text within its length limit.` };
  }
  for (const key of ['aliases', 'seasons', 'commonDiseases', 'practices', 'ipmPractices', 'pestsDiseases', 'sources']) {
    if (body[key] !== undefined && !Array.isArray(body[key])) return { error: `${key} must be a list.` };
    if (body[key]?.length > (key === 'sources' ? 20 : key === 'pestsDiseases' ? 40 : 50)) return { error: `${key} contains too many entries.` };
  }
  if (body.seasons?.some((value) => typeof value !== 'string' || !['Kharif', 'Rabi', 'Zaid', 'Other'].includes(value))) return { error: 'Crop seasons contain an unsupported value.' };
  for (const key of ['aliases', 'commonDiseases', 'practices', 'ipmPractices']) {
    const maxLength = key === 'aliases' || key === 'commonDiseases' ? 100 : 1500;
    if (body[key]?.some((value) => typeof value !== 'string' || value.trim().length > maxLength)) return { error: `${key} must contain text entries under ${maxLength} characters.` };
  }
  const structuredKeys = ['soil', 'climateWater', 'sowing', 'growthDuration', 'harvesting', 'nutrition'];
  const blockKeys = new Set(['status', 'summary', 'guidance', 'window', 'seasons', 'regionalContext']);
  for (const key of structuredKeys) {
    const block = body[key];
    if (block === undefined) continue;
    if (!block || typeof block !== 'object' || Array.isArray(block) || Object.keys(block).some((field) => !blockKeys.has(field))) return { error: `${key} must be a structured information object.` };
    if (Object.values(block).some((value) => typeof value !== 'string' && !Array.isArray(value))) return { error: `${key} fields must contain text.` };
    if (block.seasons && (!Array.isArray(block.seasons) || block.seasons.some((season) => !['Kharif', 'Rabi', 'Zaid'].includes(season)))) return { error: `${key} seasons contain an unsupported value.` };
  }
  if (body.pestsDiseases?.some((item) => !item || typeof item.name !== 'string' || !['pest', 'disease'].includes(item.type) || (item.note !== undefined && typeof item.note !== 'string'))) return { error: 'Pest and disease entries must include a name and valid type.' };
  if (body.sources?.some((source) => {
    if (!source || typeof source.organization !== 'string' || !source.organization.trim() || typeof source.title !== 'string' || !source.title.trim() || typeof source.url !== 'string') return true;
    try { return new URL(source.url).protocol !== 'https:' || !new URL(source.url).hostname; } catch { return true; }
  })) return { error: 'Each source must include an organization, title, and valid HTTPS URL.' };
  return { data: { ...body, name: body.name.trim() } };
}

export async function createCrop(req, res, next) {
  try {
    const validated = validateCropInput(req.body);
    if (validated.error) return res.status(400).json({ message: validated.error });
    const crop = await Crop.create(validated.data);
    return res.status(201).json({ crop: legacyCropToStructured(crop) });
  } catch (error) {
    return next(error);
  }
}

export { cropKnowledge, reviewedAt, legacyCropToStructured };
