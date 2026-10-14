const reviewedAt = '2026-10-12';

const sources = {
  icarChhattisgarh: {
    id: 'icar-chhattisgarh-profile',
    organization: 'Indian Council of Agricultural Research (ICAR)',
    title: 'Chhattisgarh: State agriculture profile',
    url: 'https://www.icar.gov.in/en/node/17261',
    publishedAt: null,
    lastReviewedAt: reviewedAt,
  },
  igkvRaipurRabi: {
    id: 'igkv-raipur-rabi-2021',
    organization: 'Indira Gandhi Krishi Vishwavidyalaya (IGKV), Department of Agrometeorology',
    title: 'Integrated Agromet Advisory Services, Raipur District, Bulletin 30/91 (16 November 2021)',
    url: 'https://igkv.ac.in/_Attachment/web/news_notificaiton/2021/0/7/AGROMET%20ADVISORY_-_1700_20211117111610_0_6f56c5.pdf',
    publishedAt: '2021-11-16',
    lastReviewedAt: reviewedAt,
  },
  igkvJagdalpurKharif: {
    id: 'igkv-jagdalpur-kharif-2022',
    organization: 'Indira Gandhi Krishi Vishwavidyalaya (IGKV), Shaheed Gundadhoor College of Agriculture and Research Station',
    title: 'Block-level Agromet Advisory Bulletin 53, Darbha (5 July 2022)',
    url: 'https://igkv.ac.in/_Attachment/web/news_notificaiton/2022/0/7/AGROMET%20ADVISORY_-_3179_20220706114732_7_73addb65.pdf',
    publishedAt: '2022-07-05',
    lastReviewedAt: reviewedAt,
  },
  igkvSoybeanPlains: {
    id: 'igkv-soybean-cg-plains-2021',
    organization: 'Indira Gandhi Krishi Vishwavidyalaya (IGKV), Department of Agrometeorology',
    title: 'Integrated Agromet Advisory Services, Raipur District (13 July 2021)',
    url: 'https://igkv.ac.in/_Attachment/web/news_notificaiton/2021/0/7/AGROMET%20ADVISORY_-_1216_20210714114812_6_c04adca2.pdf',
    publishedAt: '2021-07-13',
    lastReviewedAt: reviewedAt,
  },
  icarKharif2025: {
    id: 'icar-chhattisgarh-kharif-2025',
    organization: 'Indian Council of Agricultural Research (ICAR)',
    title: 'ICAR Kharif Agro-Advisories for Farmers 2025: Chhattisgarh',
    url: 'https://icar.gov.in/sites/default/files/Circulars/ICAR-En-Kharif-Agro-Advisories-for-Farmers-2025.pdf',
    publishedAt: '2025-05-31',
    lastReviewedAt: reviewedAt,
  },
};

const soilNote = 'ICAR reports that red and yellow soils occur in Chhattisgarh and may be deficient in nitrogen, phosphorus, zinc, and boron. This is state-level context, not a crop-specific diagnosis. Test the field soil and confirm crop-specific amendments with the local KVK or agriculture officer.';
const notVerified = 'Crop-specific guidance was not verified in the sources listed for this record. Confirm with the local Krishi Vigyan Kendra (KVK) or agriculture officer.';

const cropKnowledge = [
  {
    _id: 'rice', slug: 'rice', name: 'Rice', aliases: ['paddy', 'dhan', 'धान', 'paddy rice'], seasons: ['Kharif'], region: 'Chhattisgarh',
    soil: { status: 'unavailable', summary: notVerified, regionalContext: soilNote },
    climateWater: { status: 'regional-context', summary: 'ICAR describes Chhattisgarh rice as mostly rain-fed across uplands and shallow lowlands. The suitable method and water management depend on the field land situation; no irrigation amount is prescribed here.' },
    sowing: { seasons: ['Kharif'], window: null, guidance: 'A current district- and land-type-specific sowing window was not verified. Check the current IGKV/IMD block advisory before planting.' },
    growthDuration: { status: 'unavailable', summary: notVerified },
    harvesting: { status: 'limited', summary: 'An IGKV Raipur advisory says to harvest mature rice and protect harvested crop from forecast rain. Its drying advice was tied to the 2021 weather forecast and is not presented here as a current fixed duration.' },
    nutrition: { status: 'general', summary: 'Use a field soil test and crop- and land-type-specific local recommendation. The ICAR soil note is regional context only; no fertilizer rate is provided.' },
    pestsDiseases: [
      { name: 'Gall midge', type: 'pest', note: 'Listed by ICAR as a Chhattisgarh rice production constraint.' },
      { name: 'Bacterial leaf blight', type: 'disease', note: 'Listed by ICAR as a Chhattisgarh rice production constraint.' },
      { name: 'Rice blast', type: 'disease', note: 'Mentioned in a 2022 IGKV Bastar monsoon advisory; confirm current local presence and diagnosis.' },
    ],
    ipmPractices: [notVerified],
    sources: [sources.icarChhattisgarh, sources.igkvRaipurRabi, sources.igkvJagdalpurKharif, sources.icarKharif2025],
  },
  {
    _id: 'wheat', slug: 'wheat', name: 'Wheat', aliases: ['gehun', 'गेहूं'], seasons: ['Rabi'], region: 'Chhattisgarh',
    soil: { status: 'unavailable', summary: notVerified, regionalContext: soilNote },
    climateWater: { status: 'limited', summary: 'An IGKV Raipur advisory discusses conserving residual soil moisture after rice harvest for Rabi sowing and suggests light irrigation only when moisture is insufficient for germination. This is a dated local advisory, not a general irrigation schedule.' },
    sowing: { seasons: ['Rabi'], window: null, guidance: 'The IGKV Raipur bulletin discusses wheat after rice harvest, but a current district-specific sowing window was not verified. Confirm timing locally.' },
    growthDuration: { status: 'unavailable', summary: notVerified },
    harvesting: { status: 'unavailable', summary: notVerified },
    nutrition: { status: 'general', summary: 'Use a field soil test and crop-specific local recommendation. The ICAR soil note is regional context only; no fertilizer rate is provided.' },
    pestsDiseases: [],
    ipmPractices: [notVerified],
    sources: [sources.icarChhattisgarh, sources.igkvRaipurRabi],
  },
  {
    _id: 'maize', slug: 'maize', name: 'Maize', aliases: ['corn', 'makka', 'मक्का', 'मकई'], seasons: ['Kharif'], region: 'Chhattisgarh',
    soil: { status: 'unavailable', summary: notVerified, regionalContext: soilNote },
    climateWater: { status: 'unavailable', summary: notVerified },
    sowing: { seasons: ['Kharif'], window: null, guidance: 'A 2022 IGKV Bastar block advisory covers Kharif maize during the monsoon. Its week-specific advice is not a current sowing date; use the latest block advisory.' },
    growthDuration: { status: 'unavailable', summary: notVerified },
    harvesting: { status: 'unavailable', summary: notVerified },
    nutrition: { status: 'general', summary: 'Use a field soil test and crop-specific local recommendation. The ICAR soil note is regional context only; no fertilizer rate is provided.' },
    pestsDiseases: [{ name: 'Fall armyworm', type: 'pest', note: 'An IGKV Bastar advisory identifies early-stage fall armyworm risk. This catalog provides no pesticide or treatment instruction.' }],
    ipmPractices: ['Scout for unusual leaf damage and seek prompt local identification. Current thresholds and control options were not verified for this record.'],
    sources: [sources.icarChhattisgarh, sources.igkvJagdalpurKharif],
  },
  {
    _id: 'chickpea', slug: 'chickpea', name: 'Chickpea', aliases: ['gram', 'chana', 'चना', 'bengal gram'], seasons: ['Rabi'], region: 'Chhattisgarh',
    soil: { status: 'unavailable', summary: notVerified, regionalContext: soilNote },
    climateWater: { status: 'unavailable', summary: notVerified },
    sowing: { seasons: ['Rabi'], window: null, guidance: 'IGKV advisories place chickpea among Rabi crops and advise timely sowing, but a current block-specific sowing window was not verified. Confirm locally.' },
    growthDuration: { status: 'unavailable', summary: notVerified },
    harvesting: { status: 'unavailable', summary: notVerified },
    nutrition: { status: 'general', summary: 'Use a field soil test and crop-specific local recommendation. The ICAR soil note is regional context only; no fertilizer rate is provided.' },
    pestsDiseases: [
      { name: 'Wilt', type: 'disease', note: 'IGKV Raipur advises attention to timely sowing in connection with wilt risk.' },
      { name: 'Collar rot', type: 'disease', note: 'IGKV Raipur discusses this disease where it recurs in chickpea fields.' },
    ],
    ipmPractices: ['For fields with recurring wilt or collar rot, an IGKV Raipur advisory recommends crop rotation; seek local guidance to select a suitable rotation for the field and season.'],
    sources: [sources.icarChhattisgarh, sources.igkvRaipurRabi],
  },
  {
    _id: 'soybean', slug: 'soybean', name: 'Soybean', aliases: ['soya', 'सोयाबीन'], seasons: ['Kharif'], region: 'Chhattisgarh',
    soil: { status: 'unavailable', summary: notVerified, regionalContext: soilNote },
    climateWater: { status: 'limited', summary: 'IGKV advisories issued during monsoon sowing discuss providing drainage where rainfall is high. No general crop water quantity or irrigation schedule was verified.' },
    sowing: { seasons: ['Kharif'], window: null, guidance: 'IGKV identifies soybean among Kharif crops in Chhattisgarh. The dated advisories are not a current sowing calendar; check the current block advisory.' },
    growthDuration: { status: 'unavailable', summary: notVerified },
    harvesting: { status: 'unavailable', summary: notVerified },
    nutrition: { status: 'general', summary: 'Use a field soil test and crop-specific local recommendation. The ICAR soil note is regional context only; no fertilizer rate is provided.' },
    pestsDiseases: [],
    ipmPractices: [notVerified],
    sources: [sources.icarChhattisgarh, sources.igkvSoybeanPlains],
  },
];

export { reviewedAt };
export default cropKnowledge;
