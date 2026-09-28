import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Brain, CheckCircle2, AlertTriangle } from 'lucide-react';
import { incidentsApi } from '../api/client';

export default function PostMortemScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    incident_summary: '',
    root_cause: '',
    what_happened: '',
    resolution: '',
    failed_attempts: '',
    runbook_used: '',
    recovery_time_minutes: '',
    lessons_learned: '',
    preventive_actions: '',
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const field = (key, required = false) => ({
    value: form[key],
    onChange: e => { setForm(f => ({ ...f, [key]: e.target.value })); setErrors(err => ({ ...err, [key]: undefined })); },
    style: errors[key] ? { borderColor: '#ef4444' } : {},
  });

  const validate = () => {
    const e = {};
    if (!form.incident_summary.trim() || form.incident_summary.length < 20) e.incident_summary = 'Required (min 20 chars)';
    if (!form.root_cause.trim() || form.root_cause.length < 10) e.root_cause = 'Required (min 10 chars)';
    if (!form.what_happened.trim() || form.what_happened.length < 20) e.what_happened = 'Required (min 20 chars)';
    if (!form.resolution.trim() || form.resolution.length < 10) e.resolution = 'Required (min 10 chars)';
    if (!form.lessons_learned.trim() || form.lessons_learned.length < 20) e.lessons_learned = 'Required (min 20 chars)';
    if (form.recovery_time_minutes && (isNaN(form.recovery_time_minutes) || parseInt(form.recovery_time_minutes) <= 0))
      e.recovery_time_minutes = 'Must be positive number';
    return e;
  };

  const handleSubmit = async () => {
    const e = validate();
    if (Object.keys(e).length > 0) { setErrors(e); return; }

    setSubmitting(true);
    setSubmitError(null);
    try {
      const payload = {
        ...form,
        recovery_time_minutes: form.recovery_time_minutes ? parseInt(form.recovery_time_minutes) : undefined,
      };
      Object.keys(payload).forEach(k => { if (payload[k] === '') delete payload[k]; });
      
      await incidentsApi.createPostmortem(id, payload);
      setSaved(true);
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (saved) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 32px', textAlign: 'center', height: '60vh' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🧠</div>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: '#e8eaf0', marginBottom: 8 }}>
          Saved to Hindsight
        </h2>
        <p style={{ fontSize: 13, color: '#8892a4', marginBottom: 24, lineHeight: 1.6 }}>
          The lessons from this post-mortem have been retained in Hindsight's long-term memory. Future similar incidents will benefit from this knowledge.
        </p>
        <div className="memory-indicator" style={{ marginBottom: 24 }}>
          <Brain size={12} /> Memory updated
        </div>
        <button className="btn-primary" onClick={() => navigate(`/incidents/${id}`)}>
          Back to Incident
        </button>
        <button
          className="btn-secondary"
          style={{ marginTop: 10, justifyContent: 'center', width: '100%' }}
          onClick={() => navigate('/')}
        >
          Operations
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="screen-header">
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8892a4', padding: 0 }}>
          <ChevronLeft size={22} />
        </button>
        <div>
          <h1 className="screen-title">Post-Mortem</h1>
          <p style={{ fontSize: 10, color: '#4a5568', margin: 0 }}>{id}</p>
        </div>
        <div className="memory-indicator" style={{ marginLeft: 'auto' }}>
          <Brain size={9} /> Save to Hindsight
        </div>
      </div>

      <div style={{ padding: '12px 16px', background: '#0d0e20', borderBottom: '1px solid #1e2060', marginBottom: 4 }}>
        <p style={{ fontSize: 12, color: '#818cf8', margin: 0, lineHeight: 1.5 }}>
          📘 This post-mortem will be retained in Hindsight memory so future incidents benefit from these lessons.
        </p>
      </div>

      <div style={{ padding: '16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label className="form-label">Incident Summary *</label>
            <textarea className="textarea" {...field('incident_summary')} placeholder="Brief summary of what occurred" rows={2} />
            {errors.incident_summary && <p style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>{errors.incident_summary}</p>}
          </div>

          <div>
            <label className="form-label">Root Cause (Confirmed) *</label>
            <textarea className="textarea" {...field('root_cause')} placeholder="What was the actual root cause?" rows={2} />
            {errors.root_cause && <p style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>{errors.root_cause}</p>}
          </div>

          <div>
            <label className="form-label">What Happened *</label>
            <textarea className="textarea" {...field('what_happened')} placeholder="Detailed timeline of events leading to and during the incident" rows={3} />
            {errors.what_happened && <p style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>{errors.what_happened}</p>}
          </div>

          <div>
            <label className="form-label">How It Was Resolved *</label>
            <textarea className="textarea" {...field('resolution')} placeholder="Exact steps that resolved the incident" rows={2} />
            {errors.resolution && <p style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>{errors.resolution}</p>}
          </div>

          <div>
            <label className="form-label">What Did NOT Work</label>
            <textarea className="textarea" {...field('failed_attempts')} placeholder="Remediation attempts that failed (helps future responders avoid same mistakes)" rows={2} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label className="form-label">Runbook Used</label>
              <input className="input" {...field('runbook_used')} placeholder="e.g. payment-db-recovery" />
            </div>
            <div>
              <label className="form-label">Recovery Time (min)</label>
              <input type="number" className="input" {...field('recovery_time_minutes')} placeholder="e.g. 12" />
              {errors.recovery_time_minutes && <p style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>{errors.recovery_time_minutes}</p>}
            </div>
          </div>

          <div>
            <label className="form-label">Lessons Learned *</label>
            <textarea className="textarea" {...field('lessons_learned')} placeholder="Key takeaways that will prevent or speed up resolution of similar incidents" rows={3} />
            {errors.lessons_learned && <p style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>{errors.lessons_learned}</p>}
          </div>

          <div>
            <label className="form-label">Preventive Actions</label>
            <textarea className="textarea" {...field('preventive_actions')} placeholder="Specific actions to prevent recurrence" rows={2} />
          </div>

          {submitError && (
            <div style={{ background: '#1f0a0a', border: '1px solid #3d1515', borderRadius: 8, padding: '10px 12px' }}>
              <p style={{ fontSize: 12, color: '#ef4444', margin: 0 }}>{submitError}</p>
            </div>
          )}

          <button
            className="btn-success"
            onClick={handleSubmit}
            disabled={submitting}
            style={{ marginTop: 4 }}
          >
            {submitting ? (
              <span className="ai-thinking">Saving to Hindsight Memory...</span>
            ) : (
              <><Brain size={16} /> Save to Hindsight Memory</>
            )}
          </button>

          <p style={{ textAlign: 'center', fontSize: 11, color: '#4a5568' }}>
            Lessons learned will be retained in the Hindsight memory bank and used to improve future incident recommendations.
          </p>
        </div>
      </div>

      <div style={{ height: 30 }} />
    </div>
  );
}
