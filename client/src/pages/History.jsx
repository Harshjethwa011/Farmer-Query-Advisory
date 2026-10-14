import { useEffect, useState } from 'react';
import { Search, MessageCircle, Trash2, CalendarDays, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import api, { errorMessage } from '../services/api';
import { Alert, Button, PageHeading, Loading } from '../components/UI';

const PAGE_SIZE = 20;

export default function History() {
  const [queries, setQueries] = useState([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [expanded, setExpanded] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function refresh(targetPage = page) {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/queries', { params: { page: targetPage, limit: PAGE_SIZE, ...(search.trim() ? { search: search.trim() } : {}) } });
      setQueries(data.queries);
      setPages(data.pages || 1);
      setPage(data.page || targetPage);
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => refresh(page), search ? 250 : 0);
    return () => window.clearTimeout(timeout);
  }, [page, search]);

  async function remove(id) {
    if (!window.confirm('Delete this question from your history?')) return;
    setError('');
    try {
      await api.delete(`/queries/${id}`);
      if (expanded === id) setExpanded(null);
      await refresh(queries.length === 1 && page > 1 ? page - 1 : page);
    } catch (requestError) {
      setError(errorMessage(requestError));
    }
  }

  function updateSearch(value) {
    setSearch(value);
    setPage(1);
  }

  return <>
    <PageHeading eyebrow="YOUR NOTES · QUERY HISTORY" title="Questions you’ve explored." description="Your conversations are kept here so you can return to them when it’s useful." />
    <label className="filter-search" htmlFor="history-search">
      <Search size={17} aria-hidden="true" />
      <input id="history-search" value={search} onChange={(event) => updateSearch(event.target.value)} placeholder="Search your questions…" />
    </label>
    {error && <div className="history-error"><Alert>{error}</Alert><Button className="button-secondary" onClick={() => refresh()}><RotateCcw size={15} /> Try again</Button></div>}
    {loading ? <Loading /> : queries.length ? <>
      <div className="history-list">{queries.map((query) => <article className="history-card" key={query._id}>
        <button className="history-question" aria-expanded={expanded === query._id} onClick={() => setExpanded(expanded === query._id ? null : query._id)}>
          <span className="history-icon"><MessageCircle size={17} /></span>
          <span className="history-question-copy"><strong>{query.question}</strong><small><CalendarDays size={13} />{new Date(query.createdAt).toLocaleString()} <span>·</span> {query.language}</small></span>
          {expanded === query._id ? <ChevronUp size={18} aria-hidden="true" /> : <ChevronDown size={18} aria-hidden="true" />}
        </button>
        {expanded === query._id && <div className="history-answer"><div className="answer-label">FIELDWISE RESPONSE</div><p>{query.response}</p><button className="delete-link" onClick={() => remove(query._id)}><Trash2 size={14} /> Delete this conversation</button></div>}
      </article>)}</div>
      {pages > 1 && <nav className="history-pagination" aria-label="Conversation history pages"><Button className="button-ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button><span>Page {page} of {pages}</span><Button className="button-ghost" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</Button></nav>}
    </> : <div className="empty-state history-empty"><div className="empty-icon"><MessageCircle size={22} /></div><strong>{search ? 'No questions match your search.' : 'Your question history is quiet for now.'}</strong><span>{search ? 'Try a different search term.' : 'Conversations with the assistant will appear here.'}</span></div>}
  </>;
}
