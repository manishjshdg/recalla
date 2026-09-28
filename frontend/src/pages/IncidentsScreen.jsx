import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ChevronRight, Filter, Search, Clock, CheckCircle2, Brain, Zap } from 'lucide-react';
import { incidentsApi } from '../api/client';
import { getSeverityBadgeClass, formatRelativeTime, formatStatusLabel, getStatusColor } from '../utils';

export default function IncidentsScreen({ showAll = false }) {
  const navigate = useNavigate();
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('active');
  const [search, setSearch] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    loadIncidents();
  }, [filter]);

  const loadIncidents = async () => {
    setLoading(true);
    try {
      const params = { limit: 100 };
      if (filter === 'active') params.status = undefined;
      const data = await incidentsApi.list(params);
      setIncidents(data || []);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const filtered = incidents.filter(inc => {
    const matchesSearch = !search || 
      inc.service.toLowerCase().includes(search.toLowerCase()) ||
      inc.incident_id.toLowerCase().includes(search.toLowerCase());
    
    if (showAll) return matchesSearch;
    
    const isActive = ['detected', 'acknowledged', 'investigating', 'mitigating'].includes(inc.status);
    const isResolved = ['resolved', 'post_mortem'].includes(inc.status);
    
    if (filter === 'active') return matchesSearch && isActive;
    if (filter === 'resolved') return matchesSearch && isResolved;
    return matchesSearch;
  });

  const tabs = showAll
    ? [{ id: 'all', label: 'All' }, { id: 'active', label: 'Active' }, { id: 'resolved', label: 'Resolved' }]
    : [{ id: 'active', label: 'Active' }, { id: 'resolved', label: 'Resolved' }, { id: 'all', label: 'All' }];

  const statusIcon = (status) => {
    if (['resolved', 'post_mortem'].includes(status)) return <CheckCircle2 size={12} color="#22c55e" />;
    if (status === 'investigating') return <Zap size={12} color="#6366f1" />;
    return <AlertTriangle size={12} color="#f97316" />;
  };

  return (
    <div>
      {/* Header */}
      <div className="screen-header">
        <AlertTriangle size={20} color="#f97316" />
        <h1 className="screen-title">{showAll ? 'History' : 'Incidents'}</h1>
        <div style={{ marginLeft: 'auto', fontSize: 11, color: '#4a5568' }}>
          {filtered.length} incidents
        </div>
      </div>

      {/* Search */}
      <div style={{ padding: '10px 16px' }}>
        <div style={{ position: 'relative' }}>
          <Search size={14} color="#4a5568" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            className="input"
            style={{ paddingLeft: 32 }}
            placeholder="Search service or incident ID..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{ padding: '0 16px 12px', display: 'flex', gap: 6 }}>
        {tabs.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setFilter(id)}
            style={{
              padding: '6px 14px',
              borderRadius: 20,
              border: '1px solid',
              borderColor: filter === id ? '#4f46e5' : '#1e2330',
              background: filter === id ? '#0d0e24' : '#14171e',
              color: filter === id ? '#818cf8' : '#4a5568',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div style={{ padding: '0 16px' }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="skeleton" style={{ height: 80, borderRadius: 10, marginBottom: 8 }} />
          ))}
        </div>
      ) : error ? (
        <div className="empty-state">
          <p style={{ color: '#ef4444', fontSize: 13 }}>Failed to load: {error}</p>
          <button onClick={loadIncidents} className="btn-secondary" style={{ margin: '12px auto', display: 'flex' }}>Retry</button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <AlertTriangle size={32} style={{ margin: '0 auto 8px', display: 'block', opacity: 0.3 }} />
          <p style={{ fontSize: 13 }}>No incidents found</p>
          <button
            onClick={() => navigate('/new')}
            className="btn-primary"
            style={{ width: 'auto', margin: '12px auto', padding: '10px 20px' }}
          >
            Create Incident
          </button>
        </div>
      ) : (
        <div style={{ padding: '0 16px' }}>
          {filtered.map(incident => (
            <div
              key={incident.incident_id}
              className="card"
              style={{ marginBottom: 8, cursor: 'pointer' }}
              onClick={() => navigate(`/incidents/${incident.incident_id}`)}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5, flexWrap: 'wrap' }}>
                    <span className={`badge ${getSeverityBadgeClass(incident.severity)}`}>
                      {incident.severity}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: '#4a5568' }}>
                      {statusIcon(incident.status)}
                      <span className={getStatusColor(incident.status)} style={{ fontWeight: 600 }}>
                        {formatStatusLabel(incident.status)}
                      </span>
                    </span>
                    {incident.hindsight_recalled && (
                      <span className="badge badge-ai">
                        <Brain size={8} /> AI
                      </span>
                    )}
                  </div>
                  
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#e8eaf0', marginBottom: 2 }}>
                    {incident.service}
                  </div>
                  
                  <div style={{ fontSize: 11, color: '#8892a4', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {incident.symptoms}
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 10, color: '#4a5568', fontFamily: 'var(--font-mono)' }}>
                      {incident.incident_id}
                    </span>
                    <span style={{ fontSize: 10, color: '#4a5568' }}>
                      {formatRelativeTime(incident.detected_at)}
                    </span>
                    {incident.recovery_time_minutes && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: '#4a5568' }}>
                        <Clock size={9} />
                        {incident.recovery_time_minutes}m
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight size={16} color="#4a5568" style={{ flexShrink: 0, marginTop: 2 }} />
              </div>
            </div>
          ))}
          <div style={{ height: 20 }} />
        </div>
      )}
    </div>
  );
}
