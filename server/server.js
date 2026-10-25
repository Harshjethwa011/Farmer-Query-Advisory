import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { fileURLToPath } from 'node:url';

const envPath = fileURLToPath(new URL('.env', import.meta.url));
const env = dotenv.config({ path: envPath });
if (!process.env.JWT_SECRET?.trim() && env.parsed?.JWT_SECRET?.trim()) {
  process.env.JWT_SECRET = env.parsed.JWT_SECRET;
}

const { default: app } = await import('./app.js');

const port = process.env.PORT || 5000;
if (!process.env.MONGODB_URI) console.warn('MONGODB_URI is not configured; database features will be unavailable.');
else mongoose.connect(process.env.MONGODB_URI).then(() => console.log('MongoDB connected')).catch((error) => console.error(`MongoDB connection failed (${error.name || 'Error'}). Check MONGODB_URI and database availability.`));
if (!process.env.JWT_SECRET?.trim()) console.warn('JWT_SECRET is not configured; registration and login will be unavailable.');
const server = app.listen(port, () => console.log(`Farmer advisory API listening on port ${port}`));
server.on('error', (error) => {
  const message = error.code === 'EADDRINUSE'
    ? `Port ${port} is already in use. Stop the existing service or set PORT to another available port.`
    : `Farmer advisory API failed to start (${error.code || error.name || 'Error'}).`;
  console.error(message);
  mongoose.disconnect().finally(() => process.exit(1));
});
