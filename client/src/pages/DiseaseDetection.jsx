import { useEffect, useRef, useState } from 'react';
import { Image as ImageIcon, RotateCcw, ScanLine, ShieldAlert, Upload, X } from 'lucide-react';
import api, { errorMessage } from '../services/api';
import { Alert, Button, PageHeading } from '../components/UI';

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export default function DiseaseDetection() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [cropName, setCropName] = useState('');
  const [cropGuidance, setCropGuidance] = useState(null);
  const [crops, setCrops] = useState([]);
  const [dragging, setDragging] = useState(false);
  const abortRef = useRef(null);

  useEffect(() => {
    let active = true;
    api.get('/crops?limit=20').then(({ data }) => {
      if (active) setCrops(data.crops || []);
    }).catch(() => {
      // Guidance is optional and should not block image upload or display.
    });
    return () => {
      active = false;
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  function chooseImage(nextFile) {
    if (busy) return;
    setError('');
    setResult(null);
    setCropGuidance(null);
    setCropName('');
    if (!nextFile) return;
    if (!ACCEPTED_TYPES.includes(nextFile.type)) {
      setError('Choose a JPEG, PNG, or WebP image.');
      return;
    }
    if (nextFile.size > MAX_FILE_SIZE) {
      setError('Image must be 5 MB or smaller.');
      return;
    }
    setFile(nextFile);
    setPreview(URL.createObjectURL(nextFile));
  }

  async function submit(event) {
    event.preventDefault();
    if (!file || busy) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    setProgress(0);
    setError('');
    try {
      const body = new FormData();
      body.append('image', file);
      const { data } = await api.post('/disease/detect', body, {
        signal: controller.signal,
        onUploadProgress: (event) => {
          if (event.total) setProgress(Math.round((event.loaded / event.total) * 100));
        },
      });
      setResult(data.result);
      if (cropName) {
        try {
          const { data: cropData } = await api.get(`/crops/${encodeURIComponent(cropName)}`);
          setCropGuidance(cropData.crop || null);
        } catch { setCropGuidance(null); }
      }
    } catch (requestError) {
      if (requestError.code === 'ERR_CANCELED') setError('Image upload cancelled. You can try again.');
      else setError(errorMessage(requestError));
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
        setBusy(false);
        setProgress(0);
      }
    }
  }

  function clearSelection() {
    const activeRequest = abortRef.current;
    abortRef.current = null;
    activeRequest?.abort();
    setFile(null);
    setPreview('');
    setResult(null);
    setCropGuidance(null);
    setError('');
    setBusy(false);
  }

  async function loadCropGuidance(name) {
    setCropName(name);
    setCropGuidance(null);
    if (!name || !result) return;
    try {
      const { data } = await api.get(`/crops/${encodeURIComponent(name)}`);
      setCropGuidance(data.crop || null);
    } catch { setCropGuidance(null); }
  }

  return <>
    <PageHeading eyebrow="CROP HEALTH · IMAGE SUPPORT" title="Take a closer look." description="Submit a plant photo for a model-assisted check when a provider is configured. An image result is never a confirmed diagnosis." />
    <div className="disease-layout">
      <section className="upload-card" aria-labelledby="image-check-heading">
        <div className="upload-header">
          <div className="feature-icon"><ScanLine size={20} /></div>
          <div><h2 id="image-check-heading">Crop image check</h2><p>Choose or capture a clear photo of the affected leaf or plant.</p></div>
        </div>

        {error && <div className="disease-error"><Alert>{error}</Alert>{file && !busy && <Button className="button-secondary" onClick={submit}><RotateCcw size={15} /> Try again</Button>}</div>}

        {result ? <div className="detection-result" aria-live="polite">
          <div className="result-confirm"><ShieldAlert size={19} /> Possible model indication</div>
          <h3>{result.disease}</h3>
          {result.crop && <p>Model crop label: {result.crop}</p>}
          {result.confidence !== undefined && <p>Model-reported confidence: {Math.round(result.confidence * 100)}%</p>}
          {result.symptoms && <p><strong>Provider notes:</strong> {result.symptoms}</p>}
          <p className="result-caution">This output can be wrong and is not a diagnosis. Confirm with a local KVK or agriculture officer before taking action.</p>
          <label className="crop-guidance-select" htmlFor="crop-guidance">Show existing crop guidance (optional)
            <select id="crop-guidance" value={cropName} onChange={(event) => loadCropGuidance(event.target.value)}>
              <option value="">Select a crop</option>
              {crops.map((crop) => <option key={crop.slug || crop._id} value={crop.slug || crop._id}>{crop.name}</option>)}
            </select>
          </label>
          {cropGuidance && <div className="disease-crop-guidance" aria-live="polite">
            <strong>{cropGuidance.name} · existing advisory</strong>
            <p>{cropGuidance.sowing?.guidance || 'A crop-specific sowing note is not available.'}</p>
            <p>{cropGuidance.ipmPractices?.[0] || 'Crop-specific pest-management guidance is not available.'}</p>
            <a href="/crop-advisory">Open the full crop advisory</a>
          </div>}
          <Button className="button-secondary" onClick={clearSelection}><RotateCcw size={15} /> Check another image</Button>
        </div> : <form onSubmit={submit}>
          <label className={`drop-zone ${preview ? 'has-preview' : ''} ${dragging ? 'is-dragging' : ''}`} htmlFor="crop-image"
            onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => { event.preventDefault(); setDragging(false); chooseImage(event.dataTransfer.files?.[0]); }}>
            {preview ? <img src={preview} alt="Preview of selected crop image" /> : <>
              <div className="upload-symbol"><Upload size={22} /></div><strong>Choose or drop a crop image</strong>
              <span>Mobile users can capture a photo</span><small>JPEG, PNG, or WebP · Up to 5 MB</small>
            </>}
            <input id="crop-image" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" disabled={busy} aria-label="Choose or capture a crop image" onChange={(event) => { chooseImage(event.target.files?.[0]); event.target.value = ''; }} />
          </label>
          {file && <div className="selected-file"><ImageIcon size={15} /><span>Image ready · {(file.size / (1024 * 1024)).toFixed(2)} MB</span><button type="button" onClick={clearSelection} aria-label="Remove selected image"><X size={15} /> Remove</button></div>}
          {busy && <div className="upload-progress" role="status" aria-live="polite"><span>{progress ? `Uploading image · ${progress}%` : 'Preparing secure upload…'}</span><progress max="100" value={progress} aria-label="Image upload progress" /></div>}
          <div className="disease-actions">
            <Button loading={busy} disabled={!file} className="button-primary detect-button"><ScanLine size={16} /> {busy ? 'Checking image…' : 'Analyze image'}</Button>
            {busy && <Button type="button" className="button-secondary" onClick={clearSelection}>Cancel</Button>}
          </div>
          <p className="integration-note">Files are checked and sent only to the configured server-side analysis provider. Images are not saved by this application. Without a provider, analysis remains unavailable.</p>
        </form>}
      </section>
      <aside className="disclaimer-card">
        <div className="disclaimer-icon"><ShieldAlert size={19} /></div><span className="eyebrow">A NOTE ON IMAGE CHECKS</span>
        <h3>One image can’t tell the whole story.</h3><p>Lighting, camera quality, plant age, and similar symptoms can affect a model’s output.</p>
        <div className="disclaimer-rule" /><strong>AI assisted, not a diagnosis.</strong>
        <p>Ask a local Krishi Vigyan Kendra (KVK) or agriculture officer when the crop condition or model result is uncertain.</p>
        <a className="kvk-link" href="https://www.icar.gov.in/en/krishi-vigyan-kendras" target="_blank" rel="noreferrer">Find a local KVK <span aria-hidden="true">↗</span></a>
        <div className="disclaimer-foot">SUPPORTED FORMATS <span>JPEG · PNG · WEBP · 5 MB MAX</span></div>
      </aside>
    </div>
  </>;
}
