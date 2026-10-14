import cropKnowledge from '../data/cropKnowledge.js';
import { getWeatherForecast, searchWeatherLocations } from '../services/weatherService.js';
import { buildWeatherAdvisories } from '../services/weatherAdvisoryService.js';

const MAX_LOCATION_LENGTH = 80;

export async function searchLocations(req, res, next) {
  try {
    if (Object.keys(req.query).some((key) => key !== 'q') || typeof req.query.q !== 'string') {
      return res.status(400).json({ message: 'Enter one location name to search.' });
    }
    const query = req.query.q.trim();
    if (query.length < 2 || query.length > MAX_LOCATION_LENGTH || /[\u0000-\u001f]/.test(query)) {
      return res.status(400).json({ message: 'Location search must be 2 to 80 characters.' });
    }
    const locations = await searchWeatherLocations(query);
    return res.json({ locations, provider: 'Open-Meteo' });
  } catch (error) { return next(error); }
}

export async function weather(req, res, next) {
  try {
    if (Object.keys(req.query).some((key) => !['location', 'crop'].includes(key))) {
      return res.status(400).json({ message: 'Unsupported weather query parameter.' });
    }
    if (req.query.location !== undefined && typeof req.query.location !== 'string') return res.status(400).json({ message: 'Enter one valid location name.' });
    if (req.query.crop !== undefined && typeof req.query.crop !== 'string') return res.status(400).json({ message: 'Choose one supported crop.' });
    const locationName = (req.query.location || req.user.location || '').trim();
    if (!isValidLocation(locationName)) return res.status(400).json({ message: 'Enter a location in your profile or search for one.' });
    const crop = findCrop(req.query.crop);
    if (req.query.crop && !crop) return res.status(400).json({ message: 'Choose a crop from the supported crop directory.' });

    const matches = await searchWeatherLocations(locationName);
    if (!matches.length) return res.status(404).json({ message: 'We could not find that location. Check the spelling and try again.' });
    const selected = matches[0];
    const forecast = await getWeatherForecast({ latitude: selected.latitude, longitude: selected.longitude, locationName: formatLocationName(selected) });
    return res.json({ weather: forecast, advisories: buildWeatherAdvisories(forecast), cropContext: makeCropContext(crop) });
  } catch (error) { return next(error); }
}

export async function weatherAtCoordinates(req, res, next) {
  try {
    const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
    const allowed = new Set(['latitude', 'longitude', 'locationName', 'crop']);
    if (Object.keys(body).some((key) => !allowed.has(key))) return res.status(400).json({ message: 'Unsupported weather request field.' });
    if (!validCoordinate(body.latitude, -90, 90) || !validCoordinate(body.longitude, -180, 180)) {
      return res.status(400).json({ message: 'Enter valid latitude and longitude coordinates.' });
    }
    if (body.locationName !== undefined && (typeof body.locationName !== 'string' || body.locationName.trim().length > 120 || /[\u0000-\u001f]/.test(body.locationName))) {
      return res.status(400).json({ message: 'Enter a valid location label.' });
    }
    if (body.crop !== undefined && typeof body.crop !== 'string') return res.status(400).json({ message: 'Choose one supported crop.' });
    const crop = findCrop(body.crop);
    if (body.crop && !crop) return res.status(400).json({ message: 'Choose a crop from the supported crop directory.' });

    const forecast = await getWeatherForecast({ latitude: body.latitude, longitude: body.longitude, locationName: body.locationName?.trim() || 'Selected location' });
    return res.json({ weather: forecast, advisories: buildWeatherAdvisories(forecast), cropContext: makeCropContext(crop) });
  } catch (error) { return next(error); }
}

function isValidLocation(value) { return typeof value === 'string' && value.length >= 2 && value.length <= MAX_LOCATION_LENGTH && !/[\u0000-\u001f]/.test(value); }
function validCoordinate(value, min, max) { return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max; }
function findCrop(slug) { return slug ? cropKnowledge.find((crop) => crop.slug === slug) : null; }
function formatLocationName(location) { return [location.name, location.region, location.country].filter(Boolean).join(', '); }

function makeCropContext(crop) {
  if (!crop) return null;
  return {
    name: crop.name,
    message: `The crop catalog does not contain a verified ${crop.name}-specific weather trigger. Crop stage, soil moisture, and field conditions are unknown; use this forecast only as planning context.`,
    sources: crop.sources,
  };
}
