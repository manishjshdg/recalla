import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, ChevronLeft, AlertTriangle, Zap } from 'lucide-react';
import { incidentsApi } from '../api/client';

const SEVERITY_OPTIONS = ['SEV-1', 'SEV-2', 'SEV-3', 'SEV-4', 'Critical', 'High', 'Medium', 'Low'];
const SERVICE_SUGGESTIONS = ['Payment API', 'Auth Service', 'API Gateway', 'User Service', 'Order Service', 'Notification Service', 'Database', 'Cache Layer'];

export default function NewIncidentScreen() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    service: '',
    severity: 'Critical',
    symptoms: '',
    error_message: '',
    affected_component: '',
    deployment_version: '',
    error_rate: '',
    additional_context: '',
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [mode, setMode] = useState('create'); // 'create' | 'analyze'

  const validate = () => {
    const e = {};
    if (!form.service.trim()) e.service = 'Service name is required';
    if (!form.symptoms.trim() || form.symptoms.length < 10) e.symptoms = 'Describe symptoms (min 10 chars)';
    if (form.error_rate && (isNaN(form.error_rate) || form.error_rate < 0 || form.error_rate > 100))
      e.error_rate = 'Must be 0-100';
    return e;
  };

  const handleSubmit = async () => {
    const e = validate();
    if (Object.keys(e).length > 0) { setErrors(e); return; }

    setSubmitting(true);
    try {
      const payload = {
        ...form,
        error_rate: form.error_rate ? parseFloat(form.error_rate) : undefined,
      };
      // Remove empty strings
      Object.keys(payload).forEach(k => { if (payload[k] === '') delete payload[k]; });

      const incident = await incidentsApi.create(payload);

      if (mode === 'analyze') {
        navigate(`/incidents/${incident.incident_id}?analyze=true`);
      } else {
        navigate(`/incidents/${incident.incident_id}`);
      }
    } catch (err) {
      setErrors({ submit: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const field = (key) => ({
    value: form[key],
    onChange: e => { setForm(f => ({ ...f, [key]: e.target.value })); setErrors(err => ({ ...err, [key]: undefined })); },
    className: `input${errors[key] ? ' border-red-500' : ''}`,
  });

  return (
    <div>
      {/* Header */}
      <div className="screen-header">
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8892a4', display: 'flex', padding: 0 }}>
          <ChevronLeft size={22} />
        </button>
        <h1 className="screen-title">New Incident</h1>
      </div>

      <div style={{ padding: '16px' }}>
        {/* Mode selector */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
          <button
            onClick={() => setMode('create')}
            style={{
              padding: '10px', borderRadius: 8, border: '1px solid',
              borderColor: mode === 'create' ? '#4f46e5' : '#1e2330',
              background: mode === 'create' ? '#0d0e24' : '#14171e',
              color: mode === 'create' ? '#818cf8' : '#4a5568',
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}
          >
            <Plus size={14} style={{ marginBottom: 2 }} />
            <br />Create Only
          </button>
          <button
            onClick={() => setMode('analyze')}
            style={{
              padding: '10px', borderRadius: 8, border: '1px solid',
              borderColor: mode === 'analyze' ? '#4f46e5' : '#1e2330',
              background: mode === 'analyze' ? '#0d0e24' : '#14171e',
              color: mode === 'analyze' ? '#818cf8' : '#4a5568',
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}
          >
            <Zap size={14} style={{ marginBottom: 2 }} />
            <br />Create + Analyze
          </button>
        </div>

        {/* Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Service */}
          <div>
            <label className="form-label">Service *</label>
            <input {...field('service')} list="service-suggestions" placeholder="e.g. Payment API" />
            <datalist id="service-suggestions">
              {SERVICE_SUGGESTIONS.map(s => <option key={s} value={s} />)}
            </datalist>
            {errors.service && <p style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>{errors.service}</p>}
          </div>

          {/* Severity */}
          <div>
            <label className="form-label">Severity *</label>
            <div style={{ position: 'relative' }}>
              <select {...field('severity')} className="select">
                {SEVERITY_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {/* Symptoms */}
          <div>
            <label className="form-label">Symptoms *</label>
            <textarea
              {...field('symptoms')}
              className="textarea"
              placeholder="Describe what you're seeing (e.g., 503 errors, database timeouts, payment failures)"
              rows={3}
            />
            {errors.symptoms && <p style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>{errors.symptoms}</p>}
          </div>

          {/* Error Rate */}
          <div>
            <label className="form-label">Error Rate (%)</label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              {...field('error_rate')}
              className="input"
              placeholder="e.g. 87"
            />
            {errors.error_rate && <p style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>{errors.error_rate}</p>}
          </div>

          {/* Error Message */}
          <div>
            <label className="form-label">Error Message</label>
            <textarea
              {...field('error_message')}
              className="textarea"
              placeholder="Paste the exact error message or log output"
              rows={2}
            />
          </div>

          {/* Affected Component */}
          <div>
            <label className="form-label">Affected Component</label>
            <input {...field('affected_component')} placeholder="e.g. PostgreSQL connection pool" />
          </div>

          {/* Deployment Version */}
          <div>
            <label className="form-label">Recent Deployment</label>
            <input {...field('deployment_version')} placeholder="e.g. v2.4.1" />
          </div>

          {/* Additional Context */}
          <div>
            <label className="form-label">Additional Context</label>
            <textarea
              {...field('additional_context')}
              className="textarea"
              placeholder="Any additional relevant context..."
              rows={2}
            />
          </div>

          {errors.submit && (
            <div style={{ background: '#1f0a0a', border: '1px solid #3d1515', borderRadius: 8, padding: '10px 12px' }}>
              <p style={{ fontSize: 12, color: '#ef4444', margin: 0 }}>{errors.submit}</p>
            </div>
          )}

          {/* Submit button */}
          <button
            className="btn-primary"
            onClick={handleSubmit}
            disabled={submitting}
            style={{ marginTop: 4 }}
          >
            {submitting ? (
              <span className="ai-thinking">Processing...</span>
            ) : mode === 'analyze' ? (
              <><Zap size={16} /> Analyze Incident</>
            ) : (
              <><Plus size={16} /> Create Incident</>
            )}
          </button>

          <p style={{ textAlign: 'center', fontSize: 11, color: '#4a5568' }}>
            {mode === 'analyze'
              ? 'Incident will be created and AI will immediately recall similar historical incidents from Hindsight.'
              : 'Incident will be recorded and you can trigger AI analysis later.'}
          </p>
        </div>
      </div>

      <div style={{ height: 20 }} />
    </div>
  );
}
