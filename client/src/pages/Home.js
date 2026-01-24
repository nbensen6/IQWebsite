import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function Home() {
  const { user } = useAuth();

  return (
    <div className="home">
      <div className="home-hero">
        <img src="/logo.png" alt="IQ Team Logo" className="home-logo" />
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
          <h3>Team Scouting</h3>
          <p>Scout enemy teams with draft screenshots and notes. Organize intel by opponent to prepare for your next match.</p>
        </div>

        <div className="card feature-card">
          <h3>Personal Notes</h3>
          <p>Keep notes on champions, strategies, and matchups. Your personal game knowledge base synced to your account.</p>
        </div>
      </div>
    </div>
  );
}

export default Home;
