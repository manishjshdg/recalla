// Shared utility functions and helpers

export function getSeverityBadgeClass(severity) {
  const s = severity?.toLowerCase();
  if (s?.includes('critical') || s === 'sev-1') return 'badge-critical';
  if (s?.includes('high') || s === 'sev-2') return 'badge-high';
  if (s?.includes('medium') || s === 'sev-3') return 'badge-medium';
  return 'badge-low';
}

export function getStatusColor(status) {
  switch (status) {
    case 'detected': return 'text-red-400';
    case 'acknowledged': return 'text-yellow-400';
    case 'investigating': return 'text-indigo-400';
    case 'mitigating': return 'text-orange-400';
    case 'resolved': return 'text-green-400';
    case 'post_mortem': return 'text-purple-400';
    default: return 'text-gray-400';
  }
}

export function getStatusDotClass(severity) {
  const s = severity?.toLowerCase();
  if (s?.includes('critical') || s === 'sev-1') return 'status-dot-critical';
  if (s?.includes('high') || s === 'sev-2') return 'status-dot-high';
  if (s?.includes('medium') || s === 'sev-3') return 'status-dot-medium';
  return 'status-dot-low';
}

export function formatRelativeTime(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export function formatTimestamp(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleString([], {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

export function getConfidenceColor(confidence) {
  if (confidence === 'High') return '#10b981';
  if (confidence === 'Medium') return '#eab308';
  return '#ef4444';
}

export function getConfidenceScore(confidence) {
  if (confidence === 'High') return 0.9;
  if (confidence === 'Medium') return 0.6;
  return 0.3;
}

export function formatStatusLabel(status) {
  const labels = {
    detected: 'Detected',
    acknowledged: 'Acknowledged',
    investigating: 'Investigating',
    mitigating: 'Mitigating',
    resolved: 'Resolved',
    post_mortem: 'Post-Mortem',
  };
  return labels[status] || status;
}
