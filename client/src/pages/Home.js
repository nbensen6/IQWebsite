import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function Home() {
  const { user } = useAuth();

  return (
    <div className="home">
      <div className="home-hero">
        <svg className="logo-svg" viewBox="0 0 200 100" style={{height: '150px', marginBottom: '2rem'}}>
          <defs>
            <linearGradient id="heroGoldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style={{stopColor: '#f4d03f'}} />
              <stop offset="50%" style={{stopColor: '#d4af37'}} />
              <stop offset="100%" style={{stopColor: '#b8860b'}} />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
          <text x="50%" y="65" textAnchor="middle" fontFamily="Arial Black, sans-serif" fontSize="72" fontWeight="bold"
                fill="url(#heroGoldGradient)" stroke="#000" strokeWidth="2" filter="url(#glow)">
            IQ
          </text>
          <path d="M150 25 Q160 15 170 25 Q180 35 170 45 L160 55 L150 45 Q140 35 150 25 M140 45 C130 55 120 65 130 75 L140 72 L137 62 M180 45 C190 55 200 65 190 75 L180 72 L183 62"
                fill="#d4af37" stroke="#b8860b" strokeWidth="1" opacity="0.8" filter="url(#glow)"/>
        </svg>
        <h1>Welcome to IQ Team Hub</h1>
        <p>Your central hub for League of Legends team management, stats tracking, and draft preparation.</p>

        {!user && (
          <div style={{display: 'flex', gap: '1rem', justifyContent: 'center'}}>
            <Link to="/register" className="btn btn-primary">Join the Team</Link>
            <Link to="/login" className="btn btn-secondary">Sign In</Link>
          </div>
        )}
      </div>

      <div className="home-features">
        <div className="card feature-card">
          <h3>Stats Tracking</h3>
          <p>Upload match data via CSV and track your team's performance over time. View individual stats, KDA, vision scores, and more.</p>
        </div>

        <div className="card feature-card">
          <h3>Draft Helper</h3>
          <p>Plan your team compositions with our interactive draft tool. Browse all champions, filter by role, and simulate pick/ban phases.</p>
        </div>

        <div className="card feature-card">
          <h3>Personal Notes</h3>
          <p>Keep notes on champions, strategies, and matchups. Your personal game knowledge base synced to your account.</p>
        </div>

        <div className="card feature-card">
          <h3>Team Roster</h3>
          <p>View team members, their roles, and champion pools. Stay connected with your teammates.</p>
        </div>
      </div>
    </div>
  );
}

export default Home;
