import { useEffect, useRef, useState } from 'react';
import { Bot, Send, UserRound, Sprout, RotateCcw } from 'lucide-react';
import api, { errorMessage } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Alert, Button, PageHeading } from '../components/UI';
import MarkdownContent from '../components/MarkdownContent';

const starters = [
  'What should I consider before fertilizing wheat?',
  'My tomato leaves are turning yellow. What could be happening?',
  'How can I think about irrigation during a dry spell?',
];

export default function Assistant() {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState('');
  const [failedQuestion, setFailedQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const bottom = useRef(null);

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  async function send(text = question, retry = false) {
    if (typeof text !== 'string' || !text.trim() || busy) return;
    const submittedQuestion = text.trim();
    setQuestion('');
    setError('');
    setFailedQuestion('');
    if (!retry) setMessages((current) => [...current, { role: 'farmer', text: submittedQuestion }]);
    setBusy(true);
    try {
      const { data } = await api.post('/queries', { question: submittedQuestion });
      setMessages((current) => [...current, { role: 'assistant', text: data.query.response }]);
    } catch (requestError) {
      setError(errorMessage(requestError));
      setFailedQuestion(submittedQuestion);
    } finally {
      setBusy(false);
    }
  }

  return <>
    <PageHeading eyebrow="FIELDWISE ASSISTANT · GENERAL GUIDANCE" title="Let’s think it through." description="Share what you’re seeing. A little more context can help make the guidance more useful." />
    <section className="assistant-shell" aria-label="Agricultural assistant conversation">
      <div className="chat-topline"><div className="assistant-avatar"><Sprout size={19} /></div><div><strong>Fieldwise assistant</strong><span><i /> Ready when you are</span></div><div className="language-tag">{user?.preferredLanguage || 'English'}</div></div>
      <div className="chat-messages" aria-live="polite" aria-relevant="additions text">
        {messages.length === 0 ? <div className="chat-welcome"><div className="chat-welcome-mark"><Bot size={27} /></div><h2>What’s happening in your field?</h2><p>Ask a question in your own words. We’ll work through the possibilities together.</p><div className="prompt-list">{starters.map((starter) => <button key={starter} type="button" onClick={() => send(starter)}>{starter}<span aria-hidden="true">↗</span></button>)}</div></div> : messages.map((message, index) => <div key={`${index}-${message.role}`} className={`message-row ${message.role === 'farmer' ? 'message-mine' : ''}`}><div className={`message-avatar ${message.role === 'farmer' ? 'farmer-avatar' : ''}`}>{message.role === 'farmer' ? <UserRound size={16} /> : <Sprout size={17} />}</div><div className="message-content"><span className="message-author">{message.role === 'farmer' ? 'YOU' : 'FIELDWISE ASSISTANT'}</span><div className={`message-bubble ${message.role === 'assistant' ? 'assistant-markdown' : ''}`}>{message.role === 'assistant' ? <MarkdownContent>{message.text}</MarkdownContent> : message.text}</div></div></div>)}
        {busy && <div className="message-row" role="status" aria-label="Assistant is preparing a response"><div className="message-avatar"><Sprout size={17} /></div><div className="typing"><i /><i /><i /></div></div>}
        <div ref={bottom} />
      </div>
      {error && <div className="chat-error"><Alert>{error}</Alert>{failedQuestion && <Button className="button-secondary" onClick={() => send(failedQuestion, true)} loading={busy}><RotateCcw size={15} /> Retry sending</Button>}</div>}
      <form className="chat-composer" onSubmit={(event) => { event.preventDefault(); send(); }}>
        <label className="sr-only" htmlFor="assistant-question">Describe your agricultural question</label>
        <textarea id="assistant-question" rows="1" maxLength="3000" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Describe what you’d like help with…" onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(); } }} />
        <button className="send-button" type="submit" disabled={!question.trim() || busy} aria-label="Send question"><Send size={18} /></button>
        <span className="composer-hint">Enter to send · Shift + Enter for a new line</span>
      </form>
      <div className="chat-disclaimer">General information, not a substitute for local expert advice. Always follow product labels and local regulations.</div>
    </section>
  </>;
}
