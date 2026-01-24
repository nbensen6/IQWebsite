import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import VideoBackground from '../components/VideoBackground';

function Home() {
  const { user } = useAuth();

  return (
    <VideoBackground videoSrc="/videos/TFLoop.mp4">
      <div className="home">
        {!user && (
          <div className="home-hero">
            <div style={{display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '2rem'}}>
              <Link to="/register" className="btn btn-primary">Join the Team</Link>
              <Link to="/login" className="btn btn-secondary">Sign In</Link>
            </div>
          </div>
        )}

        <div className="home-features">
          <div className="card feature-card">
            <h3>Stats Tracking</h3>
            <p>Upload match data via CSV and track your team's performance over time.</p>
          </div>

          <div className="card feature-card">
            <h3>Draft Helper</h3>
            <p>Plan your team compositions with our interactive draft tool.</p>
          </div>

          <div className="card feature-card">
            <h3>Team Scouting</h3>
            <p>Scout enemy teams with draft screenshots and notes.</p>
          </div>

          <div className="card feature-card">
            <h3>Personal Notes</h3>
            <p>Keep notes on champions, strategies, and matchups.</p>
          </div>
        </div>
      </div>
    </VideoBackground>
  );
}

export default Home;
