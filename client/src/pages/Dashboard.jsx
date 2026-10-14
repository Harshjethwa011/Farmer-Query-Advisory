import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, MessageCircle, Wheat, CloudSun, ScanLine, Sparkles, Clock3, MapPin, Sprout } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { PageHeading, Alert } from '../components/UI';
import api, { errorMessage } from '../services/api';

const actions = [
  { to: '/assistant', Icon: MessageCircle, title: 'Ask the assistant', text: 'Talk through a question from your field.', label: 'START A CONVERSATION' },
  { to: '/crop-advisory', Icon: Wheat, title: 'Explore crop advice', text: 'Look up growing conditions and crop practices.', label: 'BROWSE CROPS' },
  { to: '/disease-detection', Icon: ScanLine, title: 'Check crop health', text: 'Explore image assisted disease detection.', label: 'LEARN MORE' },
  { to: '/weather', Icon: CloudSun, title: 'Local weather', text: 'See conditions for your growing area.', label: 'CHECK WEATHER' },
];

export default function Dashboard() {
  const { user } = useAuth();
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadRecent = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/queries');
      setRecent(Array.isArray(data.queries) ? data.queries.slice(0, 3) : []);
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadRecent(); }, [loadRecent]);

  return <>
    <PageHeading eyebrow="YOUR FARM DESK · OVERVIEW" title={`Good ${new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}, ${user?.name?.split(' ')[0] || 'farmer'}.`} description="A thoughtful place to find answers and plan your next step." />
    <section className="welcome-banner"><div className="welcome-text"><span className="banner-kicker"><Sparkles size={14} /> HERE WHEN YOU NEED A HAND</span><h2>What’s on your mind today?</h2><p>Start with a question. We’ll help you explore it carefully.</p><Link to="/assistant" className="button button-light">Ask the AI assistant <ArrowRight size={16} /></Link></div><div className="banner-mark"><Sprout size={68} strokeWidth={1.15} /></div></section>
    <div className="section-title"><div><span className="eyebrow">A few useful starting points</span><h2>Your farm toolkit</h2></div>{user?.location && <span className="location-pill"><MapPin size={14} />{user.location}</span>}</div>
    <div className="action-grid">{actions.map(({ to, Icon, title, text, label }) => <Link to={to} className="action-card" key={title}><div className="action-icon"><Icon size={20} /></div><h3>{title}</h3><p>{text}</p><span className="action-label">{label}<ArrowRight size={14} /></span></Link>)}</div>
    <div className="section-title history-title"><div><span className="eyebrow">PICK UP WHERE YOU LEFT OFF</span><h2>Recent questions</h2></div><Link className="text-link" to="/history">View all <ArrowRight size={15} /></Link></div>
    {loading ? <div className="loading-line" role="status">Loading your recent questions…</div>
      : error ? <div aria-live="polite"><Alert>{error}</Alert><button className="button button-secondary dashboard-retry" onClick={loadRecent}>Try again</button></div>
        : recent.length ? <div className="recent-list">{recent.map((query) => <Link className="recent-item" to="/history" key={query._id}><span className="recent-icon"><MessageCircle size={17} /></span><span className="recent-question">{query.question}<small><Clock3 size={12} />{new Date(query.createdAt).toLocaleDateString()}</small></span><ArrowRight size={16} /></Link>)}</div>
          : <div className="empty-state"><div className="empty-icon"><MessageCircle size={22} /></div><strong>Your questions will show up here.</strong><span>Start a conversation whenever you need a hand.</span></div>}
  </>;
}
