import User from '../models/User.js';
import Query from '../models/Query.js';
import Crop from '../models/Crop.js';
import Disease from '../models/Disease.js';
export async function overview(_req, res, next) { try { const [farmers, queryCount, crops, diseases] = await Promise.all([User.countDocuments({ role: 'farmer' }), Query.countDocuments(), Crop.find().sort({ name: 1 }), Disease.find().sort({ name: 1 })]); res.json({ farmers, queryCount, crops, diseases }); } catch (e) { next(e); } }
export async function listFarmers(_req, res, next) { try { res.json({ farmers: await User.find({ role: 'farmer' }).select('name email phone location createdAt').sort({ createdAt: -1 }).limit(200) }); } catch (e) { next(e); } }
