import { useCallback, useEffect, useState } from 'react';
import { Search, Droplets, Sun, Sprout, Leaf, ChevronRight, FlaskConical, MapPin, CalendarDays, Clock3, Wheat, BookOpenCheck, ExternalLink, RotateCcw } from 'lucide-react';
import api, { errorMessage } from '../services/api';
import { Alert, Button, PageHeading, Loading } from '../components/UI';

const PAGE_SIZE = 10;
const unavailable = 'Crop-specific detail is not available in this catalog. Please confirm with your local KVK or agriculture officer.';

export default function CropAdvisory() {
  const [crops, setCrops] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState(null);
  const [detailRefresh, setDetailRefresh] = useState(0);
  const [search, setSearch] = useState('');
  const [season, setSeason] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [listLoading, setListLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [listError, setListError] = useState('');
  const [detailError, setDetailError] = useState('');

  const loadCrops = useCallback(async (signal) => {
    setListLoading(true);
    setListError('');
    try {
      const { data } = await api.get('/crops', { params: { page, limit: PAGE_SIZE, ...(search.trim() ? { search: search.trim() } : {}), ...(season ? { season } : {}) }, signal });
      setCrops(data.crops);
      setPages(data.pages || 1);
      setTotal(data.total || 0);
      setSelectedId((current) => data.crops.some((crop) => String(crop._id) === current) ? current : String(data.crops[0]?._id || ''));
    } catch (requestError) {
      if (requestError.code !== 'ERR_CANCELED') {
        setListError(errorMessage(requestError));
        setCrops([]);
        setTotal(0);
        setPages(1);
        setSelectedId('');
      }
    } finally {
      if (!signal?.aborted) setListLoading(false);
    }
  }, [page, search, season]);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => loadCrops(controller.signal), search ? 250 : 0);
    return () => { window.clearTimeout(timeout); controller.abort(); };
  }, [loadCrops, search]);

  useEffect(() => {
    if (!selectedId) { setDetail(null); setDetailError(''); setDetailLoading(false); return undefined; }
    const controller = new AbortController();
    setDetail(null);
    setDetailLoading(true);
    setDetailError('');
    api.get(`/crops/${encodeURIComponent(selectedId)}`, { signal: controller.signal })
      .then(({ data }) => setDetail(data.crop))
      .catch((requestError) => { if (requestError.code !== 'ERR_CANCELED') setDetailError(errorMessage(requestError)); })
      .finally(() => { if (!controller.signal.aborted) setDetailLoading(false); });
    return () => controller.abort();
  }, [selectedId, detailRefresh]);

  function updateSearch(value) { setPage(1); setSearch(value); }
  function updateSeason(value) { setPage(1); setSeason(value); }
  const selectedSummary = crops.find((crop) => String(crop._id) === selectedId);

  return <>
    <PageHeading eyebrow="CROP KNOWLEDGE · GENERAL INFORMATION" title="Know what you’re growing." description="Explore source-attributed crop information. Local varieties and advice can differ by district, field, and season." />
    <div className="crop-filters">
      <label className="filter-search" htmlFor="crop-search"><Search size={17} aria-hidden="true" /><input id="crop-search" value={search} onChange={(event) => updateSearch(event.target.value)} placeholder="Search crop names or aliases…" /></label>
      <label className="crop-season-filter" htmlFor="crop-season">Season <select id="crop-season" value={season} onChange={(event) => updateSeason(event.target.value)}><option value="">All supported seasons</option><option value="Kharif">Kharif</option><option value="Rabi">Rabi</option><option value="Zaid">Zaid</option></select></label>
    </div>
    {listError && <div className="crop-load-error"><Alert>{listError}</Alert><Button className="button-secondary" onClick={() => loadCrops()}><RotateCcw size={15} /> Retry loading crops</Button></div>}
    {listLoading ? <Loading /> : total === 0 ? <div className="empty-state crop-empty"><div className="empty-icon"><Sprout size={22} /></div><strong>No crops match these filters.</strong><span>Try a crop name, alias, or another season.</span><Button className="button-secondary" onClick={() => { updateSearch(''); updateSeason(''); }}>Clear filters</Button></div> : <>
      <p className="crop-result-count">{total} crop {total === 1 ? 'record' : 'records'} · curated information is available without an AI provider.</p>
      <div className="crop-layout">
        <nav className="crop-list" aria-label="Crop directory">{crops.map((crop, index) => <button type="button" className={`crop-list-item ${selectedId === String(crop._id) ? 'selected' : ''}`} key={crop._id || crop.slug || crop.name} aria-pressed={selectedId === String(crop._id)} onClick={() => setSelectedId(String(crop._id))}><span className={`crop-thumb crop-${index % 4}`}><Sprout size={19} /></span><span className="crop-choice-copy"><strong>{crop.name}</strong><small>{crop.seasons?.join(' · ') || 'Season not specified'}</small></span><ChevronRight size={17} aria-hidden="true" /></button>)}</nav>
        <div className="crop-detail-column">
          {detailError && <div className="crop-load-error"><Alert>{detailError}</Alert><Button className="button-secondary" onClick={() => setDetailRefresh((current) => current + 1)}><RotateCcw size={15} /> Retry crop detail</Button></div>}
          {detailLoading ? <Loading /> : detail && <CropDetail crop={detail} />}
          {!detailLoading && !detail && selectedSummary && !detailError && <CropDetail crop={selectedSummary} />}
        </div>
      </div>
      {pages > 1 && <nav className="crop-pagination" aria-label="Crop directory pages"><Button className="button-ghost" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</Button><span>Page {page} of {pages}</span><Button className="button-ghost" disabled={page >= pages} onClick={() => setPage((current) => current + 1)}>Next</Button></nav>}
    </>}
    <p className="crop-safety-note"><MapPin size={16} /> Information is educational and source-attributed. Verify current sowing windows, soil results, nutrient decisions, pest identification, and control options with your local KVK or agriculture officer. No pesticide dose is provided in this guide.</p>
  </>;
}

function CropDetail({ crop }) {
  const sources = crop.sources || [];
  return <article className="crop-detail">
    <div className="crop-detail-cover"><span className="eyebrow">FIELD GUIDE · {crop.region || 'GENERAL'}</span><div className="crop-illustration"><Sprout size={76} strokeWidth={1} /></div><h2>{crop.name}</h2><p>{crop.aliases?.length ? `Also searched as ${crop.aliases.join(', ')}` : 'A general starting point for crop planning.'}</p><div className="crop-season-tags">{crop.seasons?.length ? crop.seasons.map((item) => <span key={item}>{item}</span>) : <span>Season not verified</span>}</div></div>
    <div className="crop-facts">
      <Fact Icon={Sun} title="Soil" block={crop.soil} />
      <Fact Icon={Droplets} title="Climate and water" block={crop.climateWater} />
      <Fact Icon={CalendarDays} title="Sowing" block={{ ...crop.sowing, summary: crop.sowing?.guidance || crop.sowing?.summary }} />
      <Fact Icon={Clock3} title="Growth duration" block={crop.growthDuration} />
      <Fact Icon={Wheat} title="Harvesting" block={crop.harvesting} />
      <Fact Icon={FlaskConical} title="Nutrient management" block={crop.nutrition} />
      {crop.soil?.regionalContext && <div className="crop-regional-note"><MapPin size={16} /><div><strong>Chhattisgarh soil context</strong><p>{crop.soil.regionalContext}</p></div></div>}
      <div className="fact-block crop-wide"><div className="fact-heading"><Leaf size={16} /><strong>Common pests and diseases</strong></div>{crop.pestsDiseases?.length ? <ul className="crop-pest-list">{crop.pestsDiseases.map((item) => <li key={`${item.type}-${item.name}`}><strong>{item.name}</strong><span>{item.type}</span>{item.note && <p>{item.note}</p>}</li>)}</ul> : <p>{unavailable}</p>}</div>
      <div className="fact-block crop-wide"><div className="fact-heading"><Sprout size={16} /><strong>Preventive and integrated practices</strong></div>{crop.ipmPractices?.length ? <ul className="practice-list">{crop.ipmPractices.map((practice, index) => <li key={index}>{practice}</li>)}</ul> : <p>{unavailable}</p>}</div>
      <section className="crop-sources crop-wide" aria-labelledby="crop-sources-heading"><div className="fact-heading"><BookOpenCheck size={16} /><strong id="crop-sources-heading">Sources and review</strong></div>{sources.length ? <ul>{sources.map((source) => <li key={source.id || source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.title} <ExternalLink size={13} aria-hidden="true" /></a><span>{source.organization}{source.publishedAt ? ` · Published ${source.publishedAt}` : ''} · Reviewed {source.lastReviewedAt || crop.lastReviewedAt || 'date unavailable'}</span></li>)}</ul> : <p className="crop-unverified-note">No source metadata was stored for this legacy crop record. Confirm the information with a local extension professional before applying it.</p>}</section>
      <div className="crop-note"><MapPin size={16} /><span>These are general information points, not a guaranteed crop-specific prescription. Ask a local agricultural expert when the region, crop stage, or diagnosis is uncertain.</span></div>
    </div>
  </article>;
}

function Fact({ Icon, title, block }) {
  const text = block?.summary || block?.guidance || unavailable;
  return <div className="fact-block"><div className="fact-heading"><Icon size={16} /><strong>{title}</strong></div><p>{text}</p>{block?.window && <span className="soft-tag">Sowing window: {block.window}</span>}{block?.status && block.status !== 'documented' && <small className="fact-status">{block.status === 'unavailable' ? 'Needs local confirmation' : block.status === 'unverified' ? 'Source not verified' : 'Context-specific'}</small>}</div>;
}
