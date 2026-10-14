# Database models

- **User**: name, unique indexed normalized email, bcrypt password (excluded from normal query selection), optional phone/location, preferred language, crops array, farmer/admin role, timestamps.
- **Query**: indexed user reference, bounded question and response, language, timestamps. History read/delete queries always scope by owner.
- **Crop**: unique name, optional unique sparse slug, aliases, supported seasons, structured soil/climate/water/sowing/duration/harvest/nutrition blocks, pest/disease notes, integrated practices, and source metadata, timestamps. Existing legacy fields (`suitableConditions`, `waterRequirements`, `fertilizerInfo`, `commonDiseases`, `practices`) remain supported and are labeled unverified when they lack source metadata.
- **Disease**: unique name, affected crops, symptoms, prevention, next steps, timestamps. Disease catalog is empty until curated records are added.

The five source-attributed starter crops are a static read-only catalog in `server/data/cropKnowledge.js`, not database seed rows. This keeps public crop information available when MongoDB is empty or unavailable. When connected, the API appends up to 200 distinct admin-created crop records; curated catalog names take precedence over duplicate database names. The static source `lastReviewedAt` records the date of the current editorial review, not the original publication date.

The user email uniqueness constraint prevents duplicate accounts. Mongoose timestamps supply `createdAt` and `updatedAt`. Query ownership has an index for account history lookups.
