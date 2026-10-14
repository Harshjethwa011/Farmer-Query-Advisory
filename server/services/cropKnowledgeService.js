import cropKnowledge from '../data/cropKnowledge.js';

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function findRelevantCrops(question, { limit = 2 } = {}) {
  if (typeof question !== 'string' || !question.trim()) return [];
  const normalizedQuestion = question.normalize('NFKC').toLocaleLowerCase();
  return cropKnowledge
    .filter((crop) => [crop.name, ...crop.aliases].some((term) => {
      const normalizedTerm = term.normalize('NFKC').toLocaleLowerCase().trim();
      const matcher = new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegex(normalizedTerm)}(?=$|[^\\p{L}\\p{N}])`, 'u');
      return matcher.test(normalizedQuestion);
    }))
    .slice(0, limit);
}

export function formatCropContext(crops) {
  return crops.map((crop) => {
    const facts = [
      `Crop: ${crop.name} (region: ${crop.region}; season reported: ${crop.seasons.join(', ') || 'not verified'})`,
      `Soil: ${crop.soil.summary}`,
      `Climate and water: ${crop.climateWater.summary}`,
      `Sowing: ${crop.sowing.guidance}`,
      `Nutrition: ${crop.nutrition.summary}`,
      `Pests and diseases: ${crop.pestsDiseases.map((item) => `${item.name} (${item.type}; ${item.note})`).join('; ') || 'not verified in the selected sources'}`,
      `Harvest: ${crop.harvesting.summary}`,
      `Sources: ${crop.sources.map((source) => `${source.organization}, ${source.title} (${source.url})`).join('; ')}`,
    ];
    return facts.join('\n');
  }).join('\n\n').slice(0, 6500);
}

export function getRelevantCropContext(question) {
  return formatCropContext(findRelevantCrops(question));
}
