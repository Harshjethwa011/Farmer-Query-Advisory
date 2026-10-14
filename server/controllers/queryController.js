import mongoose from 'mongoose';
import Query from '../models/Query.js';
import { getFarmAdvice } from '../services/aiService.js';
import { getRelevantCropContext } from '../services/cropKnowledgeService.js';

const MAX_QUESTION_LENGTH = 3000;
const MAX_PAGE_SIZE = 100;

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function createQuery(req, res, next) {
  try {
    const question = typeof req.body.question === 'string' ? req.body.question.trim() : '';
    if (!question) return res.status(400).json({ message: 'Please enter a question.' });
    if (question.length > MAX_QUESTION_LENGTH) return res.status(400).json({ message: 'Question must be under 3,000 characters.' });

    const requestedLanguage = req.body.language;
    if (requestedLanguage !== undefined && (typeof requestedLanguage !== 'string' || !/^[\p{L}][\p{L}\p{M} -]{0,39}$/u.test(requestedLanguage.trim()))) {
      return res.status(400).json({ message: 'Enter a valid language name under 40 characters.' });
    }
    const language = requestedLanguage?.trim() || req.user.preferredLanguage || 'English';
    const cropContext = getRelevantCropContext(question);
    const response = await getFarmAdvice({ question, language, location: req.user.location, cropContext });
    const query = await Query.create({ userId: req.user._id, question, response, language });
    return res.status(201).json({ query });
  } catch (error) {
    return next(error);
  }
}

export async function listQueries(req, res, next) {
  try {
    const parsedPage = Number.parseInt(req.query.page, 10);
    const parsedLimit = Number.parseInt(req.query.limit, 10);
    const page = Number.isSafeInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
    const limit = Number.isSafeInteger(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, MAX_PAGE_SIZE) : 20;
    const filter = { userId: req.user._id };
    if (typeof req.query.search === 'string' && req.query.search.trim()) {
      filter.question = { $regex: escapeRegex(req.query.search.trim().slice(0, 100)), $options: 'i' };
    }
    const [queries, total] = await Promise.all([
      Query.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      Query.countDocuments(filter),
    ]);
    return res.json({ queries, page, limit, total, pages: Math.ceil(total / limit) });
  } catch (error) {
    return next(error);
  }
}

export async function getQuery(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Query not found.' });
    const query = await Query.findOne({ _id: req.params.id, userId: req.user._id });
    if (!query) return res.status(404).json({ message: 'Query not found.' });
    return res.json({ query });
  } catch (error) {
    return next(error);
  }
}

export async function deleteQuery(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Query not found.' });
    const result = await Query.deleteOne({ _id: req.params.id, userId: req.user._id });
    if (!result.deletedCount) return res.status(404).json({ message: 'Query not found.' });
    return res.status(204).end();
  } catch (error) {
    return next(error);
  }
}
