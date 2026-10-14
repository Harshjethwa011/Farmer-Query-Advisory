export function notFound(_req, res) { res.status(404).json({ message: 'The requested resource was not found.' }); }
export function errorHandler(err, _req, res, _next) {
  if (err.name === 'MulterError') return res.status(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ message: err.code === 'LIMIT_FILE_SIZE' ? 'Image exceeds the upload size limit.' : 'Invalid image upload.' });
  if (err.status === 415) return res.status(415).json({ message: err.message });
  if (err.status === 400 && err.message === 'Malformed multipart image upload.') return res.status(400).json({ message: err.message });
  if (err.status && err.code?.startsWith('DISEASE_PROVIDER_')) return res.status(err.status).json({ message: err.message, code: err.code });
  if (err.status && err.code?.startsWith('WEATHER_')) return res.status(err.status).json({ message: err.message, code: err.code });
  if (err.name === 'ValidationError') return res.status(400).json({ message: Object.values(err.errors).map((item) => item.message).join(' ') });
  if (err.code === 11000 && err.keyPattern?.email) return res.status(409).json({ message: 'An account with this email already exists.' });
  if (err.code === 11000) return res.status(409).json({ message: 'A record with this value already exists.' });
  console.error('Unhandled request error:', err.name || 'Error');
  res.status(err.status || 500).json({ message: err.status ? err.message : 'Something went wrong. Please try again.' });
}
