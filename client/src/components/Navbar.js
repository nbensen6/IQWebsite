import React from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

function Navbar() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <nav className="navbar">
      <Link to="/" className="nav-brand">
        <svg className="logo-svg" viewBox="0 0 120 60" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style={{stopColor: '#f4d03f'}} />
              <stop offset="50%" style={{stopColor: '#d4af37'}} />
              <stop offset="100%" style={{stopColor: '#b8860b'}} />
            </linearGradient>
          </defs>
          <text x="10" y="45" fontFamily="Arial Black, sans-serif" fontSize="48" fontWeight="bold" fill="url(#goldGradient)" stroke="#000" strokeWidth="1">
            IQ
          </text>
          <path d="M85 15 Q90 10 95 15 Q100 20 95 25 L90 30 L85 25 Q80 20 85 15 M80 25 C75 30 70 35 75 40 L80 38 L78 32 M100 25 C105 30 110 35 105 40 L100 38 L102 32"
                fill="#d4af37" stroke="#b8860b" strokeWidth="0.5" opacity="0.8"/>
        </svg>
        <h1>IQ Team</h1>
      </Link>

      <div className="nav-links">
        <NavLink to="/" end>Home</NavLink>
        <NavLink to="/roster">Roster</NavLink>
        <NavLink to="/announcements">Announcements</NavLink>
        {user && (
          <>
            <NavLink to="/stats">Stats</NavLink>
            <NavLink to="/draft">Draft</NavLink>
            <NavLink to="/notes">Notes</NavLink>
          </>
        )}
      </div>

      <div className="nav-user">
        <button className="theme-toggle" onClick={toggleTheme} title="Toggle theme">
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>

        {user ? (
          <>
            <span>{user.username}</span>
            <button className="btn btn-secondary btn-small" onClick={handleLogout}>
              Logout
            </button>
          </>
        ) : (
          <>
            <Link to="/login" className="btn btn-secondary btn-small">Login</Link>
            <Link to="/register" className="btn btn-primary btn-small">Register</Link>
          </>
        )}
      </div>
    </nav>
  );
}

export default Navbar;
