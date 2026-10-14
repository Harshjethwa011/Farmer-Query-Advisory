import { useEffect, useState } from 'react';
import { CloudRain, CloudSun, Crosshair, Droplets, MapPin, Search, Sprout, Thermometer, Wind } from 'lucide-react';
import api, { errorMessage } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Alert, Button, Loading, PageHeading } from '../components/UI';

export default function Weather() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState(user?.location || '');
  const [locations, setLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [weather, setWeather] = useState(null);
  const [advisories, setAdvisories] = useState([]);
  const [cropContext, setCropContext] = useState(null);
  const [crops, setCrops] = useState([]);
  const [cropSlug, setCropSlug] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    let active = true;
    api.get('/crops?limit=20').then(({ data }) => { if (active) setCrops(data.crops || []); }).catch(() => {});
    if (user?.location?.trim()) {
      api.get('/weather/locations', { params: { q: user.location.trim() } }).then(({ data }) => {
        if (active && data.locations?.[0]) loadForecast(data.locations[0], '');
        else if (active) setNotice('Your saved profile location could not be matched. Search for a nearby city or district.');
      }).catch((requestError) => { if (active) setError(errorMessage(requestError)); });
    }
    return () => { active = false; };
  }, [user?.location]);

  async function searchLocations(event) {
    event?.preventDefault();
    const query = searchTerm.trim();
    if (query.length < 2 || query.length > 80) {
      setError('Enter a location name between 2 and 80 characters.');
      return;
    }
    setSearching(true);
    setError('');
    setNotice('');
    setWeather(null);
    setAdvisories([]);
    setCropContext(null);
    setSelectedLocation(null);
    try {
      const { data } = await api.get('/weather/locations', { params: { q: query } });
      setLocations(data.locations || []);
      if (!data.locations?.length) setNotice('No locations matched that name. Try adding a district or state.');
    } catch (requestError) {
      setError(errorMessage(requestError));
      setLocations([]);
    } finally { setSearching(false); }
  }

  async function loadForecast(location, selectedCrop = cropSlug) {
    setSelectedLocation(location);
    setSearchTerm(formatLocation(location));
    setLocations([]);
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const { data } = await api.post('/weather/forecast', {
        latitude: location.latitude,
        longitude: location.longitude,
        locationName: formatLocation(location),
        ...(selectedCrop ? { crop: selectedCrop } : {}),
      });
      setWeather(data.weather);
      setAdvisories(data.advisories || []);
      setCropContext(data.cropContext || null);
    } catch (requestError) {
      setWeather(null);
      setAdvisories([]);
      setError(errorMessage(requestError));
    } finally { setBusy(false); }
  }

  function requestCurrentLocation() {
    setError('');
    setNotice('');
    if (!navigator.geolocation) {
      setError('This browser does not provide location access. Search for a city or district instead.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      setLocating(false);
      setSearchTerm('Your current location');
      loadForecast({ latitude: coords.latitude, longitude: coords.longitude, name: 'Your current location' });
    }, (geolocationError) => {
      setLocating(false);
      if (geolocationError.code === 1) setError('Location permission was denied. Search for a city or district instead.');
      else if (geolocationError.code === 3) setError('Location lookup timed out. Try again or search for a city.');
      else setError('Your location is unavailable. Search for a city or district instead.');
    }, { enableHighAccuracy: false, timeout: 10_000, maximumAge: 5 * 60 * 1000 });
  }

  function handleCropChange(event) {
    const nextCrop = event.target.value;
    setCropSlug(nextCrop);
    if (selectedLocation) loadForecast(selectedLocation, nextCrop);
  }

  return <>
    <PageHeading eyebrow="LOCAL CONDITIONS · WEATHER" title="A little more context for the day." description="View a seven-day forecast alongside cautious field-planning notes. Weather alone cannot establish crop or soil needs." />
    <form className="weather-search" onSubmit={searchLocations} aria-label="Search weather locations">
      <MapPin size={18} aria-hidden="true" />
      <label className="weather-location-label" htmlFor="weather-location">City, district, or town</label>
      <input id="weather-location" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="For example, Raipur" maxLength={80} autoComplete="address-level2" />
      <Button loading={searching} disabled={busy || locating} className="button-primary"><Search size={15} /> Find location</Button>
      <Button type="button" loading={locating} disabled={searching || busy} className="button-secondary location-button" onClick={requestCurrentLocation}><Crosshair size={16} /> Use my location</Button>
    </form>
    <p className="weather-privacy-note">Location access is optional. Browser coordinates are used for this request only and are not saved to your profile.</p>

    {error && <div className="weather-error"><Alert>{error}</Alert><Button className="button-secondary" disabled={busy || searching} onClick={() => selectedLocation ? loadForecast(selectedLocation) : searchLocations()}><Search size={15} /> Retry</Button></div>}
    {notice && <Alert type="info">{notice}</Alert>}

    {locations.length > 0 && <section className="weather-location-results" aria-label="Matching locations">
      <h2>Choose the right place</h2>
      <ul>{locations.map((location) => <li key={location.id || `${location.latitude},${location.longitude}`}>
        <button type="button" onClick={() => loadForecast(location)}>
          <MapPin size={17} aria-hidden="true" /><span><strong>{location.name}</strong><small>{[location.region, location.country].filter(Boolean).join(', ')}</small></span><span aria-hidden="true">›</span>
        </button>
      </li>)}</ul>
    </section>}

    {busy && <div className="weather-loading" aria-live="polite"><Loading /><span>Loading forecast…</span></div>}

    {!weather && !busy && !error && !locations.length && <div className="weather-empty">
      <div className="weather-empty-icon"><CloudSun size={29} /></div><h2>Weather shaped by your place.</h2>
      <p>Search and select a city or district, or choose “Use my location”. Your location is not required for crop information.</p>
    </div>}

    {weather && <div className="weather-results">
      {weather.stale && <Alert type="info">The weather provider is unavailable. Showing the last cached forecast from {formatTimestamp(weather.retrievedAt, weather.timezone)}; it may be out of date.</Alert>}
      <section className="weather-card" aria-label={`Current conditions for ${weather.location.name}`}>
        <div className="weather-main">
          <span className="eyebrow">CURRENT CONDITIONS · {weather.location.name}</span>
          {!weather.current ? <div className="weather-unavailable">Current conditions are unavailable from this forecast response.</div> : <>
            <div className="temperature">{weather.current.temperatureC === null ? 'Unavailable' : Math.round(weather.current.temperatureC)}{weather.current.temperatureC !== null && <sup>{weather.units.temperature}</sup>}</div>
            <div className="weather-condition"><CloudSun size={24} aria-hidden="true" />{weather.current.condition}</div>
            {weather.current.time && <p className="weather-measured">Provider timestamp: {weather.current.time} · {weather.timezone}</p>}
          </>}
        </div>
        {weather.current && <div className="weather-stats">
          <WeatherStat Icon={Droplets} label="Humidity" value={withUnit(weather.current.humidityPercent, weather.units.humidity)} />
          <WeatherStat Icon={Thermometer} label="Feels like" value={withUnit(weather.current.apparentTemperatureC, weather.units.temperature)} />
          <WeatherStat Icon={Wind} label="Wind speed" value={withUnit(weather.current.windSpeedMps, weather.units.windSpeed)} />
          <WeatherStat Icon={CloudRain} label="Precipitation" value={withUnit(weather.current.precipitationMm, weather.units.precipitation)} />
        </div>}
        <div className="weather-sun"><SunIcon /></div>
      </section>

      <div className="weather-data-meta"><span>Retrieved {formatTimestamp(weather.retrievedAt, weather.timezone)} · {weather.timezone}</span><label htmlFor="weather-crop">Crop context <select id="weather-crop" value={cropSlug} onChange={handleCropChange}><option value="">General field planning</option>{crops.map((crop) => <option key={crop.slug} value={crop.slug}>{crop.name}</option>)}</select></label></div>

      <section className="weather-forecast" aria-labelledby="forecast-heading">
        <div className="weather-section-heading"><div><span className="eyebrow">NEXT SEVEN DAYS</span><h2 id="forecast-heading">Forecast at a glance</h2></div><span>Temperature °C · Rain mm · Wind m/s</span></div>
        {weather.daily.length ? <div className="forecast-grid">{weather.daily.map((day) => <article className="forecast-day" key={day.date}>
          <time dateTime={day.date}>{formatForecastDate(day.date)}</time><CloudSun size={22} aria-hidden="true" /><strong>{day.condition}</strong>
          <span className="forecast-temps">{withUnit(day.temperatureMaxC, '°C')} <small>/</small> {withUnit(day.temperatureMinC, '°C')}</span>
          <span><CloudRain size={14} aria-hidden="true" /> {withUnit(day.precipitationMm, 'mm')} rain</span>
          <span><Droplets size={14} aria-hidden="true" /> {withUnit(day.precipitationProbabilityPercent, '%')} chance</span>
          <span><Wind size={14} aria-hidden="true" /> {withUnit(day.windSpeedMaxMps, 'm/s')}</span>
        </article>)}</div> : <div className="weather-forecast-empty">Daily forecast details are unavailable right now.</div>}
      </section>

      <section className="weather-advisories" aria-labelledby="advisory-heading">
        <div className="weather-section-heading"><div><span className="eyebrow">FIELD PLANNING · NOT A WARNING</span><h2 id="advisory-heading">Weather-aware notes</h2></div><Sprout size={21} aria-hidden="true" /></div>
        {advisories.length ? advisories.map((item) => <article className="weather-advisory" key={item.id}>
          <h3>{item.title}</h3><p>{item.message}</p><small>Why: {item.basis}</small><span>This is a general planning note, not an official government warning.</span>
        </article>) : <p className="weather-no-advice">No weather rule applies to the available forecast fields. Use the forecast with local field observations and current official advisories.</p>}
        {cropContext && <div className="crop-weather-context"><strong>{cropContext.name} context</strong><p>{cropContext.message}</p>{cropContext.sources?.length > 0 && <div>Crop references: {cropContext.sources.map((source) => <a key={source.id || source.url} href={source.url} target="_blank" rel="noreferrer">{source.organization}</a>)}</div>}</div>}
        <p className="weather-data-attribution">Weather data from <a href={weather.attributionUrl} target="_blank" rel="noreferrer">Open-Meteo</a> (CC BY 4.0 attribution). Forecasts can be incomplete or change; check local observations and official warnings before important field decisions.</p>
      </section>
    </div>}
  </>;
}

function WeatherStat({ Icon, label, value }) { return <div className="weather-stat"><Icon size={17} aria-hidden="true" /><span>{label}</span><strong>{value}</strong></div>; }
function SunIcon() { return <CloudSun size={92} strokeWidth={1} aria-hidden="true" />; }
function withUnit(value, unit) { return value === null || value === undefined ? 'Unavailable' : `${Number.isInteger(value) ? value : Number(value.toFixed(1))} ${unit}`; }
function formatLocation(location) { return [location.name, location.region, location.country].filter(Boolean).join(', ') || 'Selected location'; }
function formatTimestamp(value, timezone) {
  if (!value || Number.isNaN(Date.parse(value))) return 'time unavailable';
  try { return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short', timeZone: timezone }).format(new Date(value)); }
  catch { return new Date(value).toLocaleString(); }
}
function formatForecastDate(value) {
  return new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`));
}
