import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity, AlertTriangle, Brain, Clock, ChevronRight,
  Zap, Shield, TrendingUp, RefreshCw, Plus, CheckCircle2
} from 'lucide-react';
import { analyticsApi, incidentsApi, memoryApi } from '../api/client';
import { getSeverityBadgeClass, formatRelativeTime } from '../utils';

export default function OperationsScreen() {
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState(null);
  const [incidents, setIncidents] = useState([]);
  const [memStats, setMemStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const load = async () => {
    try {
      const [analyticsData, incidentsData, memData] = await Promise.all([
        analyticsApi.get().catch(() => null),
        incidentsApi.list({ limit: 5 }).catch(() => []),
        memoryApi.stats().catch(() => null),
      ]);
      setAnalytics(analyticsData);
      setIncidents(incidentsData || []);
      setMemStats(memData);
      setLastRefresh(new Date());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  const activeIncidents = incidents.filter(i =>
    ['detected', 'acknowledged', 'investigating', 'mitigating'].includes(i.status)
  );
  const criticalCount = incidents.filter(i =>
    (i.severity?.toLowerCase().includes('critical') || i.severity === 'SEV-1') &&
    i.status !== 'resolved' && i.status !== 'post_mortem'
  ).length;

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div style={{ padding: '20px 16px 16px', background: '#0a0b0d' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <div>
            <p style={{ fontSize: 11, color: '#4a5568', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 2 }}>
              OPERATIONS CENTER
            </p>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#e8eaf0', letterSpacing: '-0.02em', margin: 0 }}>
              RECALLA
            </h1>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div className="memory-indicator">
              <Brain size={10} />
              {memStats ? `${memStats.total_memories} memories` : 'Memory'}
            </div>
            <button
              onClick={load}
              style={{ background: '#14171e', border: '1px solid #1e2330', borderRadius: 8, padding: '6px 8px', cursor: 'pointer', color: '#4a5568' }}
            >
              <RefreshCw size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* System Status */}
      <div style={{ padding: '0 16px 16px' }}>
        <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className="status-dot status-dot-operational" />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#e8eaf0' }}>System Status</span>
          </div>
          <span style={{ fontSize: 12, color: '#22c55e', fontWeight: 600 }}>Operational</span>
        </div>
      </div>

      {/* Critical Alert */}
      {criticalCount > 0 && (
        <div style={{ padding: '0 16px 16px' }}>
          <div className="alert-critical animate-slide-up">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <AlertTriangle size={14} color="#ef4444" />
              <span style={{ fontSize: 11, fontWeight: 700, color: '#ef4444', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Critical Incident Active
              </span>
            </div>
            {activeIncidents.filter(i => i.severity?.toLowerCase().includes('critical') || i.severity === 'SEV-1').slice(0, 1).map(inc => (
              <div key={inc.incident_id}>
                <p style={{ fontSize: 14, fontWeight: 600, color: '#e8eaf0', margin: '0 0 4px' }}>
                  {inc.service} — Error rate {inc.error_rate ? `${inc.error_rate}%` : 'elevated'}
                </p>
                <p style={{ fontSize: 11, color: '#8892a4', margin: '0 0 10px' }}>
                  {formatRelativeTime(inc.detected_at)}
                </p>
                <button className="btn-danger" onClick={() => navigate(`/incidents/${inc.incident_id}`)}>
                  <Zap size={14} />
                  Investigate
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Metrics Grid */}
      <div style={{ padding: '0 16px 16px' }}>
        <p className="section-label" style={{ padding: 0, marginBottom: 10 }}>Overview</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div className="metric-card">
            <div className="metric-value" style={{ color: activeIncidents.length > 0 ? '#f97316' : '#e8eaf0' }}>
              {loading ? '—' : activeIncidents.length}
            </div>
            <div className="metric-label">Active</div>
          </div>
          <div className="metric-card">
            <div className="metric-value" style={{ color: criticalCount > 0 ? '#ef4444' : '#e8eaf0' }}>
              {loading ? '—' : criticalCount}
            </div>
            <div className="metric-label">Critical</div>
          </div>
          <div className="metric-card">
            <div className="metric-value" style={{ color: '#6366f1' }}>
              {loading ? '—' : memStats?.total_memories ?? '0'}
            </div>
            <div className="metric-label">AI Memories</div>
          </div>
          <div className="metric-card">
            <div className="metric-value" style={{ color: '#10b981' }}>
              {loading ? '—' : analytics?.mttr_minutes != null ? `${analytics.mttr_minutes}m` : '—'}
            </div>
            <div className="metric-label">Avg MTTR</div>
          </div>
        </div>
      </div>

      {/* Hindsight Memory Status */}
      <div style={{ padding: '0 16px 16px' }}>
        <div className="card" style={{ background: '#0d0e20', borderColor: '#1e2060' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Brain size={14} color="#818cf8" />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#818cf8', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              Hindsight Memory
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#a5b4fc', letterSpacing: '-0.02em' }}>
                {memStats?.total_memories ?? 0}
              </div>
              <div style={{ fontSize: 10, color: '#4a5568', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Incident Memories
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{
                fontSize: 11, fontWeight: 600,
                color: memStats?.hindsight_status === 'healthy' ? '#10b981' : '#ef4444',
                marginBottom: 4
              }}>
                ● {memStats?.hindsight_status === 'healthy' ? 'Connected' : 'Offline'}
              </div>
              <div style={{ fontSize: 10, color: '#4a5568' }}>{memStats?.bank_id}</div>
            </div>
          </div>
          {memStats?.recent_learns?.slice(0, 2).map((learn, i) => (
            <div key={i} style={{
              background: '#120d24', borderRadius: 6, padding: '8px 10px', marginBottom: 6,
              borderLeft: '2px solid #4f46e5'
            }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#c4b5fd', marginBottom: 2 }}>
                {learn.incident_id} — {learn.service}
              </div>
              {learn.root_cause && (
                <div style={{ fontSize: 10, color: '#8892a4' }}>
                  Root cause: {learn.root_cause}
                </div>
              )}
            </div>
          ))}
          <button
            onClick={() => navigate('/memory')}
            style={{ width: '100%', textAlign: 'center', fontSize: 11, color: '#6366f1', fontWeight: 600, background: 'none', border: 'none', padding: '6px 0 0', cursor: 'pointer' }}
          >
            View all memories →
          </button>
        </div>
      </div>

      {/* Quick Analyze CTA */}
      <div style={{ padding: '0 16px 16px' }}>
        <button className="btn-primary" onClick={() => navigate('/new')}>
          <Zap size={16} />
          Analyze New Incident
        </button>
      </div>

      {/* Recent Incidents */}
      <div style={{ padding: '0 0 16px' }}>
        <p className="section-label">Recent Incidents</p>
        {loading ? (
          <div style={{ padding: '0 16px' }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ marginBottom: 8 }}>
                <div className="skeleton" style={{ height: 64, borderRadius: 10 }} />
              </div>
            ))}
          </div>
        ) : incidents.length === 0 ? (
          <div className="empty-state">
            <Shield size={32} style={{ margin: '0 auto 8px', display: 'block', opacity: 0.3 }} />
            <p style={{ color: '#4a5568', fontSize: 13 }}>No incidents yet</p>
          </div>
        ) : (
          <div style={{ padding: '0 16px' }}>
            {incidents.slice(0, 5).map(incident => (
              <div
                key={incident.incident_id}
                className="card"
                style={{ marginBottom: 8, cursor: 'pointer' }}
                onClick={() => navigate(`/incidents/${incident.incident_id}`)}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <span className={`badge ${getSeverityBadgeClass(incident.severity)}`}>
                        {incident.severity}
                      </span>
                      {incident.retained_in_hindsight && (
                        <span className="badge badge-memory">
                          <Brain size={8} /> Learned
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#e8eaf0', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {incident.service}
                    </div>
                    <div style={{ fontSize: 11, color: '#8892a4' }}>
                      {formatRelativeTime(incident.detected_at)} · {incident.status}
                    </div>
                  </div>
                  <ChevronRight size={16} color="#4a5568" style={{ marginLeft: 8, flexShrink: 0 }} />
                </div>
              </div>
            ))}
            <button
              onClick={() => navigate('/incidents')}
              style={{ width: '100%', textAlign: 'center', fontSize: 12, color: '#6366f1', fontWeight: 600, background: 'none', border: 'none', padding: '8px 0', cursor: 'pointer' }}
            >
              View all incidents →
            </button>
          </div>
        )}
      </div>

      {/* Bottom padding */}
      <div style={{ height: 20 }} />
    </div>
  );
}
