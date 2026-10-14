# Disease image analysis provider

## Upload and privacy behavior

`POST /api/disease/detect` requires a farmer JWT and an `image` multipart field. The route accepts JPEG, PNG, and WebP up to 5 MB (or a smaller positive `MAX_UPLOAD_MB` setting) and allows 20 requests per IP in a 15-minute window. The server checks MIME type and basic container structure before calling any provider. Multer keeps the image in memory; the controller clears its buffer after the request. Neither images nor analysis results are saved in MongoDB or written to local files. Reverse proxies, hosting platforms, and a configured provider may have their own request logging or retention, which must be reviewed separately.

The current validation checks headers and container structure, not a full pixel decode or malware scan. The provider must safely decode untrusted image bytes. Pixel dimensions are capped at 40 megapixels where dimensions can be read from the image header. The provider endpoint comes only from trusted server environment configuration; no request field controls a URL, and provider redirects are disabled. Remote provider endpoints must use HTTPS. HTTP is permitted only for localhost development.

## Compatible provider contract

Configure these variables in `server/.env`:

```dotenv
DISEASE_PROVIDER=http-json
DISEASE_MODEL=your-model-id
DISEASE_API_URL=https://your-provider.example/v1/analyze
DISEASE_API_KEY=your-secret-key
DISEASE_TIMEOUT_MS=20000
```

The backend sends a JSON POST with bearer authentication:

```json
{
  "model": "your-model-id",
  "image": {
    "mimeType": "image/jpeg",
    "data": "BASE64_ENCODED_IMAGE_BYTES"
  }
}
```

The provider must respond with JSON in this shape:

```json
{
  "disease": "Possible leaf spot",
  "crop": "Rice",
  "confidence": 0.82,
  "symptoms": "Optional provider notes"
}
```

Only `disease` is required. `crop` and `symptoms`, if supplied, must be strings within the service limits. `confidence`, if supplied, must be a finite number from 0 through 1. The API rejects malformed responses; it does not transform percentages or infer missing labels. This image-classification adapter does not accept free-form treatment or pesticide instructions from the provider; crop guidance comes from the existing source-attributed crop catalog. This generic contract is an adapter boundary, not a claim that a particular vendor/model endpoint is compatible. Configure a provider-specific adapter if its API differs.

With any required setting missing or an unsupported provider ID, upload validation still works and analysis returns HTTP 503. Provider timeout returns 504; provider failures and invalid responses return safe 502 errors. Provider credentials and image bytes are never included in API errors or application logs.

## Cost and provider review

No paid provider is required for development, and no provider is selected by default. This project has no verified vendor pricing, usage quota, accuracy benchmark, or image-retention commitment. Before enabling a provider, review its current image-inference price, rate limits, data retention/training terms, geographic processing, and applicable privacy requirements. Do not enable it for farmers until those terms are acceptable and the exact endpoint/model has been integration-tested with non-sensitive sample images. Automated tests mock provider requests and never transmit private images.
