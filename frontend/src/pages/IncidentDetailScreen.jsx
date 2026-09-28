import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ChevronLeft, Brain, Zap, Clock, AlertTriangle, CheckCircle2,
  BookOpen, Shield, ChevronDown, ChevronUp, Activity, User,
  MoreVertical, Copy
} from 'lucide-react';
import { incidentsApi, runbooksApi } from '../api/client';
import {
  getSeverityBadgeClass, formatRelativeTime, formatTimestamp,
  formatStatusLabel, getStatusColor, getConfidenceColor
} from '../utils';

function TimelineEvent({ event }) {
  const colors = {
    critical: '#ef4444', ai: '#6366f1', memory: '#8b5cf6',
    success: '#10b981', error: '#ef4444', info: '#8892a4',
  };
  const dotColor = colors[event.event_type] || '#4a5568';

  return (
    <div className="timeline-item" style={{ marginBottom: 16 }}>
      <div style={{ paddingTop: 4 }}>
        <div className="timeline-dot" style={{ background: dotColor, boxShadow: event.event_type === 'critical' ? `0 0 6px ${dotColor}80` : 'none' }} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#e8eaf0', marginBottom: 2 }}>
          {event.event}
        </div>
        {event.details && (
          <div style={{ fontSize: 11, color: '#8892a4', lineHeight: 1.4 }}>{event.details}</div>
        )}
        <div style={{ fontSize: 10, color: '#4a5568', marginTop: 3 }}>
          {formatTimestamp(event.timestamp)}
        </div>
      </div>
    </div>
  );
}

function SimilarIncidentCard({ si }) {
  return (
    <div style={{
      background: '#0d1020', border: '1px solid #1e2060', borderRadius: 8,
      padding: '10px 12px', marginBottom: 8
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#6366f1', fontWeight: 600 }}>
          {si.incident_id}
        </span>
        <span style={{
          fontSize: 10, fontWeight: 700, color: '#10b981',
          background: '#071a13', borderRadius: 4, padding: '1px 6px'
        }}>
          {si.relevance_label}
        </span>
      </div>
      <div style={{ fontSize: 12, color: '#8892a4', marginBottom: 4 }}>
        <span style={{ color: '#e8eaf0', fontWeight: 600 }}>{si.service}</span> · {si.severity}
      </div>
      {si.root_cause && (
        <div style={{ fontSize: 11, color: '#8892a4', marginBottom: 4 }}>
          Root cause: <span style={{ color: '#c4b5fd' }}>{si.root_cause}</span>
        </div>
      )}
      {si.recovery_time_minutes && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#4a5568' }}>
          <Clock size={10} /> Recovery: {si.recovery_time_minutes} min
        </div>
      )}
    </div>
  );
}

export default function IncidentDetailScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [incident, setIncident] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [runbook, setRunbook] = useState(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [showEvidence, setShowEvidence] = useState(false);
  const [resolveModal, setResolveModal] = useState(false);
  const [resolveForm, setResolveForm] = useState({ resolution_notes: '', recovery_time_minutes: '' });
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState(null);

  const load = async () => {
    try {
      const data = await incidentsApi.get(id);
      setIncident(data);
      
      // If incident already has analysis, restore it
      if (data.root_cause) {
        setAnalysis({
          likely_root_cause: data.root_cause,
          confidence: data.confidence,
          confidence_score: data.confidence === 'High' ? 0.9 : data.confidence === 'Medium' ? 0.6 : 0.3,
          similar_incidents: data.similar_incidents || [],
          recommended_actions: data.recommended_actions || [],
          recommended_runbook: data.recommended_runbook,
          why_this_recommendation: '',
          historical_evidence: data.evidence || '',
          risk_warnings: [],
          retrieved_memories_raw: [],
          ai_generated_reasoning: data.ai_reasoning || '',
          memory_count_used: (data.similar_incidents || []).length,
        });
        if (data.recommended_runbook) loadRunbook(data.recommended_runbook);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const loadRunbook = async (name) => {
    try {
      const rb = await runbooksApi.get(name);
      setRunbook(rb);
    } catch {}
  };

  useEffect(() => {
    load();
    // If ?analyze=true, auto-trigger analysis
    if (searchParams.get('analyze') === 'true') {
      setTimeout(() => triggerAnalysis(), 800);
    }
  }, [id]);

  const triggerAnalysis = async () => {
    setAnalyzing(true);
    setActiveTab('analysis');
    try {
      const result = await incidentsApi.analyze(id);
      setAnalysis(result);
      if (result.recommended_runbook) loadRunbook(result.recommended_runbook);
      await load(); // refresh incident
    } catch (e) {
      setError(`Analysis failed: ${e.message}`);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleResolve = async () => {
    if (!resolveForm.resolution_notes.trim() || !resolveForm.recovery_time_minutes) return;
    setResolving(true);
    try {
      await incidentsApi.resolve(id, {
        resolution_notes: resolveForm.resolution_notes,
        recovery_time_minutes: parseInt(resolveForm.recovery_time_minutes),
      });
      setResolveModal(false);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setResolving(false);
    }
  };

  if (loading) return (
    <div>
      <div className="screen-header">
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8892a4', padding: 0 }}>
          <ChevronLeft size={22} />
        </button>
        <div className="skeleton" style={{ width: 200, height: 18 }} />
      </div>
      <div style={{ padding: 16 }}>
        {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 80, borderRadius: 10, marginBottom: 8 }} />)}
      </div>
    </div>
  );

  if (error && !incident) return (
    <div>
      <div className="screen-header">
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8892a4', padding: 0 }}>
          <ChevronLeft size={22} />
        </button>
        <h1 className="screen-title">Error</h1>
      </div>
      <div className="empty-state">
        <p style={{ color: '#ef4444', fontSize: 13 }}>{error}</p>
      </div>
    </div>
  );

  const isActive = ['detected', 'acknowledged', 'investigating', 'mitigating'].includes(incident?.status);
  const isResolved = ['resolved', 'post_mortem'].includes(incident?.status);
  const confidenceColor = analysis ? getConfidenceColor(analysis.confidence) : '#4a5568';

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'analysis', label: 'AI Analysis' },
    { id: 'timeline', label: 'Timeline' },
    { id: 'runbook', label: 'Runbook' },
  ];

  return (
    <div>
      {/* Header */}
      <div className="screen-header">
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8892a4', padding: 0 }}>
          <ChevronLeft size={22} />
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <span className={`badge ${getSeverityBadgeClass(incident.severity)}`}>{incident.severity}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#4a5568' }}>{incident.incident_id}</span>
          </div>
          <h1 style={{ fontSize: 16, fontWeight: 700, color: '#e8eaf0', margin: 0, letterSpacing: '-0.01em' }}>
            {incident.service}
          </h1>
        </div>
      </div>

      {/* Status bar */}
      <div style={{ padding: '0 16px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 600 }} className={getStatusColor(incident.status)}>
          ● {formatStatusLabel(incident.status)}
        </span>
        <span style={{ fontSize: 11, color: '#4a5568' }}>{formatRelativeTime(incident.detected_at)}</span>
        {incident.hindsight_recalled && (
          <span className="memory-indicator" style={{ marginLeft: 'auto' }}>
            <Brain size={9} /> Memory recalled
          </span>
        )}
      </div>

      {/* CTA */}
      {isActive && (
        <div style={{ padding: '0 16px 12px', display: 'flex', gap: 8 }}>
          {!analysis ? (
            <button className="btn-primary" onClick={triggerAnalysis} disabled={analyzing} style={{ flex: 1 }}>
              {analyzing ? <span className="ai-thinking">🧠 Recalling Hindsight Memory...</span> : <><Zap size={14} /> AI Investigate</>}
            </button>
          ) : (
            <button className="btn-success" onClick={() => setResolveModal(true)} style={{ flex: 1 }}>
              <CheckCircle2 size={14} /> Resolve Incident
            </button>
          )}
        </div>
      )}

      {isResolved && !incident.postmortem && (
        <div style={{ padding: '0 16px 12px' }}>
          <button
            className="btn-secondary"
            style={{ width: '100%', justifyContent: 'center', borderColor: '#2d1f60', color: '#a78bfa' }}
            onClick={() => navigate(`/incidents/${id}/postmortem`)}
          >
            <Brain size={14} /> Create Post-Mortem & Learn
          </button>
        </div>
      )}

      {/* Tabs */}
      <div style={{ padding: '0 16px', display: 'flex', gap: 0, borderBottom: '1px solid #1e2330', marginBottom: 0, overflowX: 'auto' }}>
        {tabs.map(({ id: tabId, label }) => (
          <button
            key={tabId}
            onClick={() => setActiveTab(tabId)}
            style={{
              padding: '10px 14px', fontSize: 12, fontWeight: 600,
              border: 'none', background: 'none', cursor: 'pointer',
              color: activeTab === tabId ? '#818cf8' : '#4a5568',
              borderBottom: `2px solid ${activeTab === tabId ? '#6366f1' : 'transparent'}`,
              marginBottom: -1, whiteSpace: 'nowrap',
              transition: 'all 0.15s',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div style={{ padding: '16px' }}>
        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="animate-fade-in">
            <div className="card" style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                Symptoms
              </div>
              <p style={{ fontSize: 13, color: '#e8eaf0', margin: 0, lineHeight: 1.6 }}>{incident.symptoms}</p>
            </div>

            {incident.error_message && (
              <div className="card" style={{ marginBottom: 10, background: '#0a0c14', borderColor: '#1a1e30' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                  Error Message
                </div>
                <pre style={{ fontSize: 11, color: '#e8eaf0', margin: 0, fontFamily: 'var(--font-mono)', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                  {incident.error_message}
                </pre>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
              {incident.error_rate != null && (
                <div className="card">
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#ef4444', letterSpacing: '-0.02em' }}>
                    {incident.error_rate}%
                  </div>
                  <div style={{ fontSize: 10, color: '#4a5568', fontWeight: 600, textTransform: 'uppercase' }}>Error Rate</div>
                </div>
              )}
              {incident.deployment_version && (
                <div className="card">
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#e8eaf0', fontFamily: 'var(--font-mono)' }}>
                    {incident.deployment_version}
                  </div>
                  <div style={{ fontSize: 10, color: '#4a5568', fontWeight: 600, textTransform: 'uppercase' }}>Deployment</div>
                </div>
              )}
            </div>

            {incident.affected_component && (
              <div className="card" style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: '#4a5568', textTransform: 'uppercase', fontWeight: 600, marginBottom: 4 }}>Component</div>
                <div style={{ fontSize: 13, color: '#e8eaf0' }}>{incident.affected_component}</div>
              </div>
            )}

            {incident.assigned_to && (
              <div className="card" style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                <User size={14} color="#4a5568" />
                <div>
                  <div style={{ fontSize: 10, color: '#4a5568', textTransform: 'uppercase', fontWeight: 600 }}>Assigned to</div>
                  <div style={{ fontSize: 13, color: '#e8eaf0' }}>{incident.assigned_to}</div>
                </div>
              </div>
            )}

            {isResolved && incident.resolution_notes && (
              <div className="card" style={{ background: '#071a13', borderColor: '#0d3320', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <CheckCircle2 size={14} color="#10b981" />
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Resolution
                  </span>
                </div>
                <p style={{ fontSize: 13, color: '#e8eaf0', margin: 0, lineHeight: 1.6 }}>{incident.resolution_notes}</p>
                {incident.recovery_time_minutes && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 8, fontSize: 11, color: '#10b981' }}>
                    <Clock size={11} /> Recovery time: {incident.recovery_time_minutes} minutes
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ANALYSIS TAB */}
        {activeTab === 'analysis' && (
          <div className="animate-fade-in">
            {analyzing && (
              <div style={{ textAlign: 'center', padding: '32px 16px' }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>🧠</div>
                <p className="ai-thinking" style={{ fontSize: 14, fontWeight: 600, color: '#818cf8', marginBottom: 8 }}>
                  Querying Hindsight Memory...
                </p>
                <p style={{ fontSize: 12, color: '#4a5568' }}>
                  Recalling similar incidents • Analyzing root cause • Generating recommendation
                </p>
              </div>
            )}

            {!analyzing && !analysis && (
              <div className="empty-state">
                <Brain size={32} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.3 }} />
                <p style={{ fontSize: 14, color: '#4a5568', marginBottom: 16 }}>No analysis yet</p>
                <button className="btn-primary" onClick={triggerAnalysis} style={{ width: 'auto', margin: '0 auto', padding: '10px 24px' }}>
                  <Zap size={14} /> Run AI Investigation
                </button>
              </div>
            )}

            {!analyzing && analysis && (
              <div>
                {/* Memory recalled badge */}
                {analysis.memory_count_used > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div className="memory-indicator">
                      <Brain size={10} />
                      {analysis.memory_count_used} memories recalled from Hindsight
                    </div>
                  </div>
                )}

                {/* Root Cause */}
                <div className="card" style={{ marginBottom: 10, background: '#0d1020', borderColor: '#1e2060' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <Brain size={14} color="#818cf8" />
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#818cf8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      Likely Root Cause
                    </span>
                  </div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: '#e8eaf0', margin: '0 0 10px', lineHeight: 1.5 }}>
                    {analysis.likely_root_cause}
                  </p>
                  
                  {/* Confidence */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 10, color: '#4a5568', textTransform: 'uppercase', fontWeight: 600 }}>Confidence</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: confidenceColor }}>
                      {analysis.confidence}
                    </span>
                    <div className="confidence-bar" style={{ flex: 1 }}>
                      <div className="confidence-fill" style={{
                        width: `${(analysis.confidence_score || 0) * 100}%`,
                        background: confidenceColor
                      }} />
                    </div>
                  </div>
                </div>

                {/* Similar Incidents */}
                {analysis.similar_incidents?.length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      <Activity size={12} color="#4a5568" />
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        Similar Incidents
                      </span>
                    </div>
                    {analysis.similar_incidents.map((si, i) => (
                      <SimilarIncidentCard key={i} si={si} />
                    ))}
                  </div>
                )}

                {/* Recommended Actions */}
                {analysis.recommended_actions?.length > 0 && (
                  <div className="card" style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                      Recommended Actions
                    </div>
                    {analysis.recommended_actions.map((action, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
                        <div style={{
                          width: 20, height: 20, borderRadius: 4, background: '#0d0e24',
                          border: '1px solid #1e2060', display: 'flex', alignItems: 'center',
                          justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#6366f1', flexShrink: 0
                        }}>
                          {i + 1}
                        </div>
                        <p style={{ fontSize: 13, color: '#e8eaf0', margin: 0, lineHeight: 1.5, flex: 1 }}>{action}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Runbook */}
                {analysis.recommended_runbook && (
                  <div style={{
                    background: '#071a13', border: '1px solid #0d3320', borderRadius: 8,
                    padding: '12px 14px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10
                  }}>
                    <BookOpen size={16} color="#10b981" />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 10, color: '#4a5568', textTransform: 'uppercase', fontWeight: 600, marginBottom: 2 }}>
                        Recommended Runbook
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#10b981', fontFamily: 'var(--font-mono)' }}>
                        {analysis.recommended_runbook}
                      </div>
                    </div>
                    <button
                      onClick={() => setActiveTab('runbook')}
                      style={{ background: '#0d3320', border: '1px solid #10b98130', borderRadius: 6, padding: '4px 10px', fontSize: 11, color: '#10b981', fontWeight: 600, cursor: 'pointer' }}
                    >
                      View →
                    </button>
                  </div>
                )}

                {/* Risk Warnings */}
                {analysis.risk_warnings?.length > 0 && (
                  <div style={{
                    background: '#1a1400', border: '1px solid #352c00', borderRadius: 8,
                    padding: '12px 14px', marginBottom: 10
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      <AlertTriangle size={12} color="#eab308" />
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#eab308', textTransform: 'uppercase' }}>Caution</span>
                    </div>
                    {analysis.risk_warnings.map((w, i) => (
                      <p key={i} style={{ fontSize: 12, color: '#ca8a04', margin: '0 0 4px', lineHeight: 1.5 }}>{w}</p>
                    ))}
                  </div>
                )}

                {/* Evidence toggle */}
                <button
                  onClick={() => setShowEvidence(!showEvidence)}
                  style={{
                    width: '100%', background: '#0d1020', border: '1px solid #1e2060', borderRadius: 8,
                    padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    cursor: 'pointer', color: '#818cf8', fontSize: 12, fontWeight: 600, marginBottom: 8
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Shield size={13} />
                    Why This Recommendation?
                  </span>
                  {showEvidence ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>

                {showEvidence && (
                  <div className="evidence-card animate-slide-up" style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#818cf8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                      Historical Evidence (from Hindsight)
                    </div>
                    {analysis.why_this_recommendation && (
                      <p style={{ fontSize: 12, color: '#e8eaf0', lineHeight: 1.6, marginBottom: 10 }}>
                        {analysis.why_this_recommendation}
                      </p>
                    )}
                    {analysis.historical_evidence && (
                      <>
                        <div style={{ height: 1, background: '#1e2060', margin: '8px 0' }} />
                        <div style={{ fontSize: 10, color: '#4a5568', textTransform: 'uppercase', fontWeight: 600, marginBottom: 6 }}>
                          Retrieved Memories
                        </div>
                        <p style={{ fontSize: 11, color: '#8892a4', lineHeight: 1.6, fontFamily: 'var(--font-mono)', margin: 0 }}>
                          {analysis.historical_evidence}
                        </p>
                      </>
                    )}
                    <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#6366f1' }} />
                      <span style={{ fontSize: 10, color: '#4a5568' }}>
                        Evidence from Hindsight · AI reasoning applied on top
                      </span>
                    </div>
                  </div>
                )}

                {/* Estimated Recovery */}
                {analysis.estimated_recovery_time && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#14171e', borderRadius: 8, fontSize: 12, color: '#8892a4' }}>
                    <Clock size={13} color="#4a5568" />
                    Estimated recovery: <span style={{ color: '#e8eaf0', fontWeight: 600 }}>{analysis.estimated_recovery_time}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TIMELINE TAB */}
        {activeTab === 'timeline' && (
          <div className="animate-fade-in">
            {(!incident.timeline || incident.timeline.length === 0) ? (
              <div className="empty-state">
                <p style={{ fontSize: 13 }}>No timeline events yet</p>
              </div>
            ) : (
              <div>
                {[...incident.timeline].reverse().map(event => (
                  <TimelineEvent key={event.id} event={event} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* RUNBOOK TAB */}
        {activeTab === 'runbook' && (
          <div className="animate-fade-in">
            {!runbook && !analysis?.recommended_runbook ? (
              <div className="empty-state">
                <BookOpen size={32} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.3 }} />
                <p style={{ fontSize: 13 }}>Run AI investigation to get runbook recommendation</p>
              </div>
            ) : runbook ? (
              <div>
                <div className="card" style={{ marginBottom: 12, background: '#071a13', borderColor: '#0d3320' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <BookOpen size={16} color="#10b981" />
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#10b981', fontFamily: 'var(--font-mono)' }}>
                      {runbook.name}
                    </span>
                  </div>
                  <p style={{ fontSize: 12, color: '#8892a4', margin: '0 0 10px' }}>{runbook.purpose}</p>
                  <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#4a5568' }}>
                    <span>Success rate: <span style={{ color: '#10b981' }}>{runbook.success_rate}%</span></span>
                    <span>Used: {runbook.total_uses}x</span>
                  </div>
                </div>

                <p style={{ fontSize: 11, fontWeight: 700, color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                  Steps
                </p>

                {runbook.steps?.map((step, i) => (
                  <div key={i} style={{
                    background: '#14171e', border: '1px solid #1e2330', borderRadius: 8,
                    padding: '12px 14px', marginBottom: 8
                  }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <div style={{
                        width: 22, height: 22, borderRadius: 4, background: '#0d1020',
                        border: '1px solid #1e2060', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#6366f1', flexShrink: 0
                      }}>
                        {i + 1}
                      </div>
                      <p style={{ fontSize: 13, color: '#e8eaf0', margin: 0, lineHeight: 1.5, fontFamily: step.includes('SELECT') || step.includes('kubectl') ? 'var(--font-mono)' : 'inherit', fontSize: step.includes('SELECT') || step.includes('kubectl') ? 11 : 13 }}>
                        {step}
                      </p>
                    </div>
                  </div>
                ))}

                {runbook.warnings?.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    {runbook.warnings.map((w, i) => (
                      <div key={i} style={{
                        background: '#1a1400', border: '1px solid #352c00', borderRadius: 6,
                        padding: '8px 12px', marginBottom: 6, fontSize: 11, color: '#ca8a04', lineHeight: 1.4
                      }}>
                        {w}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="card" style={{ background: '#071a13', borderColor: '#0d3320', textAlign: 'center' }}>
                <p style={{ fontSize: 13, color: '#8892a4' }}>
                  Recommended runbook: <strong style={{ color: '#10b981' }}>{analysis.recommended_runbook}</strong>
                </p>
                <p style={{ fontSize: 11, color: '#4a5568' }}>Runbook not found in database</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Resolve Modal */}
      {resolveModal && (
        <div style={{
          position: 'fixed', inset: 0, background: '#00000090', display: 'flex',
          alignItems: 'flex-end', zIndex: 100
        }}>
          <div style={{
            width: '100%', maxWidth: 430, margin: '0 auto',
            background: '#111318', borderRadius: '16px 16px 0 0',
            padding: '20px 16px 40px', border: '1px solid #1e2330'
          }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#e8eaf0', marginBottom: 16 }}>
              Resolve Incident
            </h2>
            <div style={{ marginBottom: 12 }}>
              <label className="form-label">Resolution Notes *</label>
              <textarea
                className="textarea"
                rows={3}
                placeholder="How was the incident resolved?"
                value={resolveForm.resolution_notes}
                onChange={e => setResolveForm(f => ({ ...f, resolution_notes: e.target.value }))}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label className="form-label">Recovery Time (minutes) *</label>
              <input
                type="number"
                className="input"
                placeholder="e.g. 12"
                value={resolveForm.recovery_time_minutes}
                onChange={e => setResolveForm(f => ({ ...f, recovery_time_minutes: e.target.value }))}
              />
            </div>
            <button
              className="btn-success"
              onClick={handleResolve}
              disabled={resolving || !resolveForm.resolution_notes || !resolveForm.recovery_time_minutes}
              style={{ marginBottom: 10 }}
            >
              {resolving ? 'Resolving...' : <><CheckCircle2 size={14} /> Mark Resolved</>}
            </button>
            <button
              className="btn-secondary"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={() => setResolveModal(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div style={{ height: 30 }} />
    </div>
  );
}
