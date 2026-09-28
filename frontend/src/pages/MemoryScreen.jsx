import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Brain, Search, RefreshCw, Database, BookOpen, ChevronRight, ArrowDown } from 'lucide-react';
import { memoryApi, incidentsApi } from '../api/client';
import { formatRelativeTime, getSeverityBadgeClass } from '../utils';

function MemoryFlowDiagram() {
  const steps = [
    { icon: '🚨', label: 'New Incident', color: '#ef4444' },
    { icon: '🧠', label: 'Hindsight Recall', color: '#6366f1' },
    { icon: '🔍', label: 'Similar Incidents', color: '#8b5cf6' },
    { icon: '📊', label: 'Historical Evidence', color: '#6366f1' },
    { icon: '🤖', label: 'AI Reasoning', color: '#818cf8' },
    { icon: '✅', label: 'Root Cause', color: '#10b981' },
    { icon: '📖', label: 'Runbook', color: '#10b981' },
    { icon: '🔧', label: 'Resolution', color: '#22c55e' },
    { icon: '📝', label: 'Post-Mortem', color: '#8b5cf6' },
    { icon: '🧠', label: 'Memory Updated', color: '#6366f1' },
  ];

  return (
    <div style={{ padding: '16px', background: '#0d0e20', borderRadius: 10, border: '1px solid #1e2060', marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#818cf8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
        Memory Flow
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {steps.map((step, i) => (
          <div key={i}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0' }}>
              <div style={{
                width: 30, height: 30, borderRadius: 8, background: '#14171e',
                border: `1px solid ${step.color}30`, display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: 14, flexShrink: 0
              }}>
                {step.icon}
              </div>
              <span style={{ fontSize: 12, color: step.color, fontWeight: 600 }}>{step.label}</span>
            </div>
            {i < steps.length - 1 && (
              <div style={{ paddingLeft: 14 }}>
                <ArrowDown size={12} color="#2d3449" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function MemoryScreen() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(true);
  const [recentIncidents, setRecentIncidents] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsData, incidentsData] = await Promise.all([
        memoryApi.stats().catch(() => null),
        incidentsApi.list({ limit: 20 }).catch(() => []),
      ]);
      setStats(statsData);
      setRecentIncidents((incidentsData || []).filter(i => i.retained_in_hindsight));
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const results = await memoryApi.search(searchQuery);
      setSearchResults(results);
    } catch (e) {
      setSearchResults({ memories: [], error: e.message });
    } finally {
      setSearching(false);
    }
  };

  return (
    <div>
      <div className="screen-header">
        <Brain size={20} color="#818cf8" />
        <h1 className="screen-title">Hindsight Memory</h1>
        <button onClick={loadData} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#4a5568' }}>
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Stats */}
      <div style={{ padding: '12px 16px' }}>
        <div style={{
          background: '#0d0e20', border: '1px solid #1e2060', borderRadius: 12, padding: '16px',
          display: 'flex', alignItems: 'center', gap: 16
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 36, fontWeight: 800, color: '#a5b4fc', letterSpacing: '-0.03em', lineHeight: 1 }}>
              {loading ? '—' : stats?.total_memories ?? 0}
            </div>
            <div style={{ fontSize: 11, color: '#4a5568', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 4 }}>
              Incident Memories
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{
              fontSize: 12, fontWeight: 700,
              color: stats?.hindsight_status === 'healthy' ? '#10b981' : '#ef4444',
            }}>
              ● {stats?.hindsight_status === 'healthy' ? 'Connected' : 'Offline'}
            </div>
            <div style={{ fontSize: 10, color: '#4a5568', marginTop: 2, fontFamily: 'var(--font-mono)' }}>
              {stats?.bank_id}
            </div>
          </div>
        </div>
      </div>

      {/* Memory Flow */}
      <div style={{ padding: '0 16px 4px' }}>
        <MemoryFlowDiagram />
      </div>

      {/* Search Hindsight */}
      <div style={{ padding: '0 16px 16px' }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
          Search Memory
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            className="input"
            placeholder="e.g. Payment API database timeout"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            style={{ flex: 1 }}
          />
          <button
            className="btn-secondary"
            onClick={handleSearch}
            disabled={searching || !searchQuery.trim()}
          >
            {searching ? '...' : <Search size={15} />}
          </button>
        </div>

        {searchResults && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 11, color: '#4a5568', marginBottom: 8 }}>
              {searchResults.total_count} memories found
            </div>
            {searchResults.memories?.length === 0 ? (
              <p style={{ fontSize: 13, color: '#4a5568', textAlign: 'center', padding: '16px 0' }}>
                No memories found for this query
              </p>
            ) : (
              searchResults.memories?.slice(0, 3).map((mem, i) => (
                <div key={i} className="evidence-card" style={{ marginBottom: 8 }}>
                  <pre style={{
                    fontSize: 11, color: '#e8eaf0', margin: 0, whiteSpace: 'pre-wrap',
                    fontFamily: 'var(--font-mono)', lineHeight: 1.5, wordBreak: 'break-word'
                  }}>
                    {mem}
                  </pre>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Recent Learned Incidents */}
      <div style={{ padding: '0 0 16px' }}>
        <p className="section-label">Retained in Hindsight</p>
        {loading ? (
          <div style={{ padding: '0 16px' }}>
            {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 60, borderRadius: 8, marginBottom: 8 }} />)}
          </div>
        ) : recentIncidents.length === 0 ? (
          <div className="empty-state">
            <Brain size={28} style={{ margin: '0 auto 8px', display: 'block', opacity: 0.2 }} />
            <p style={{ fontSize: 13 }}>No incidents in memory yet</p>
            <p style={{ fontSize: 11, color: '#4a5568', marginTop: 4 }}>Run seed_data.py to populate Hindsight with demo data</p>
          </div>
        ) : (
          <div style={{ padding: '0 16px' }}>
            {recentIncidents.slice(0, 8).map(incident => (
              <div
                key={incident.incident_id}
                style={{
                  background: '#14171e', border: '1px solid #1e2330', borderRadius: 8,
                  padding: '10px 12px', marginBottom: 8, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 10
                }}
                onClick={() => navigate(`/incidents/${incident.incident_id}`)}
              >
                <div style={{
                  width: 28, height: 28, borderRadius: 6, background: '#0d0e24',
                  border: '1px solid #1e2060', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                }}>
                  <Brain size={13} color="#6366f1" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#e8eaf0' }}>{incident.service}</span>
                    <span className={`badge ${getSeverityBadgeClass(incident.severity)}`} style={{ fontSize: 9 }}>
                      {incident.severity}
                    </span>
                  </div>
                  {incident.root_cause && (
                    <div style={{ fontSize: 11, color: '#8892a4', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {incident.root_cause}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                    {incident.recommended_runbook && (
                      <span style={{ fontSize: 10, color: '#4a5568', display: 'flex', alignItems: 'center', gap: 3 }}>
                        <BookOpen size={9} /> {incident.recommended_runbook}
                      </span>
                    )}
                    {incident.recovery_time_minutes && (
                      <span style={{ fontSize: 10, color: '#4a5568' }}>{incident.recovery_time_minutes}min</span>
                    )}
                  </div>
                </div>
                <ChevronRight size={14} color="#4a5568" />
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ height: 20 }} />
    </div>
  );
}
