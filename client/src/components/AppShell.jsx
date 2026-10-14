import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Sprout, LayoutDashboard, MessageCircle, Wheat, ScanLine, CloudSun, History, UserRound, LogOut, Menu, X, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const items = [
  { to: '/dashboard', label: 'Overview', Icon: LayoutDashboard },
  { to: '/assistant', label: 'AI assistant', Icon: MessageCircle },
  { to: '/crop-advisory', label: 'Crop advisory', Icon: Wheat },
  { to: '/disease-detection', label: 'Disease check', Icon: ScanLine },
  { to: '/weather', label: 'Weather', Icon: CloudSun },
  { to: '/history', label: 'Query history', Icon: History },
  { to: '/profile', label: 'My profile', Icon: UserRound },
];

export default function AppShell() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const menuTrigger = useRef(null);
  const closeButton = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    closeButton.current?.focus();
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
        menuTrigger.current?.focus();
      }
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [open]);

  const closeMenu = () => {
    setOpen(false);
    menuTrigger.current?.focus();
  };
  const signOut = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return <div className="app-shell">
    <aside id="farmer-sidebar" className={`sidebar ${open ? 'sidebar-open' : ''}`} aria-label="Farmer navigation">
      <div className="brand">
        <div className="brand-mark"><Sprout size={21} /></div>
        <div><strong>fieldwise</strong><span>FARMER ADVISORY</span></div>
        <button ref={closeButton} type="button" className="icon-button mobile-close" onClick={closeMenu} aria-label="Close menu"><X size={18} /></button>
      </div>
      <div className="nav-caption">YOUR FARM</div>
      <nav aria-label="Main navigation">
        {items.map(({ to, label, Icon }) => <NavLink key={to} to={to} onClick={closeMenu} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <Icon size={18} /><span>{label}</span>
        </NavLink>)}
        {user?.role === 'admin' && <NavLink to="/admin" onClick={closeMenu} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><ShieldCheck size={18} /><span>Admin panel</span></NavLink>}
      </nav>
      <div className="sidebar-bottom">
        <div className="season-card"><span className="season-dot" /> Your growing season<br /><strong>One step at a time.</strong></div>
        <div className="user-mini">
          <div className="avatar">{user?.name?.[0]?.toUpperCase() || 'F'}</div>
          <div className="user-mini-copy"><strong>{user?.name}</strong><span>{user?.location || 'Farmer account'}</span></div>
          <button type="button" className="icon-button" onClick={signOut} aria-label="Log out"><LogOut size={17} /></button>
        </div>
      </div>
    </aside>
    {open && <button type="button" className="mobile-scrim" onClick={closeMenu} aria-label="Close navigation" />}
    <main className="main-area">
      <header className="topbar">
        <button ref={menuTrigger} type="button" className="icon-button menu-trigger" onClick={() => setOpen(true)} aria-label="Open navigation" aria-expanded={open} aria-controls="farmer-sidebar"><Menu /></button>
        <div className="topbar-label">Your farm, supported</div>
        <div className="topbar-right"><span className="online-dot" /> Practical guidance for every season</div>
      </header>
      <div className="page-content"><Outlet /></div>
      <footer className="footer-note">Fieldwise provides general agricultural information. Confirm important decisions with local agricultural experts.</footer>
    </main>
  </div>;
}
