import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { Activity, AlertTriangle, Plus, Brain, History, Settings, BarChart3, Zap } from 'lucide-react';
import './index.css';

// Import Google Fonts
const fontLink = document.createElement('link');
fontLink.rel = 'stylesheet';
fontLink.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap';
document.head.appendChild(fontLink);

// Pages
import OperationsScreen from './pages/OperationsScreen';
import IncidentsScreen from './pages/IncidentsScreen';
import NewIncidentScreen from './pages/NewIncidentScreen';
import IncidentDetailScreen from './pages/IncidentDetailScreen';
import MemoryScreen from './pages/MemoryScreen';
import PostMortemScreen from './pages/PostMortemScreen';

function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const path = location.pathname;

  const tabs = [
    { id: '/', icon: Activity, label: 'Ops' },
    { id: '/incidents', icon: AlertTriangle, label: 'Incidents' },
    { id: '/new', icon: Plus, label: 'Analyze' },
    { id: '/memory', icon: Brain, label: 'Memory' },
    { id: '/history', icon: History, label: 'History' },
  ];

  const isActive = (id) => {
    if (id === '/') return path === '/';
    return path.startsWith(id);
  };

  return (
    <nav className="bottom-nav">
      {tabs.map(({ id, icon: Icon, label }) => (
        <button
          key={id}
          className={`nav-item ${isActive(id) ? 'active' : ''}`}
          onClick={() => navigate(id)}
        >
          <Icon size={20} strokeWidth={isActive(id) ? 2 : 1.5} />
          {label}
        </button>
      ))}
    </nav>
  );
}

function App() {
  return (
    <Router>
      <div className="app-shell">
        <div className="screen">
          <Routes>
            <Route path="/" element={<OperationsScreen />} />
            <Route path="/incidents" element={<IncidentsScreen />} />
            <Route path="/incidents/:id" element={<IncidentDetailScreen />} />
            <Route path="/incidents/:id/postmortem" element={<PostMortemScreen />} />
            <Route path="/new" element={<NewIncidentScreen />} />
            <Route path="/memory" element={<MemoryScreen />} />
            <Route path="/history" element={<IncidentsScreen showAll />} />
          </Routes>
        </div>
        <BottomNav />
      </div>
    </Router>
  );
}

export default App;
