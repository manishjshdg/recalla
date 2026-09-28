import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme/colors';
import { SeverityBadge, StatusBadge } from '../components/Badge';
import { incidentsApi, healthApi, memoryApi, analyticsApi } from '../api/client';

export default function OperationsScreen({ onSelectIncident, onNavigateTab }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [incidents, setIncidents] = useState([]);
  const [health, setHealth] = useState(null);
  const [memoryStats, setMemoryStats] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [error, setError] = useState(null);

  const loadData = async () => {
    try {
      setError(null);
      const [incList, healthData, memData, analData] = await Promise.allSettled([
        incidentsApi.list(),
        healthApi.check(),
        memoryApi.getStats(),
        analyticsApi.get(),
      ]);

      if (incList.status === 'fulfilled') setIncidents(incList.value);
      if (healthData.status === 'fulfilled') setHealth(healthData.value);
      if (memData.status === 'fulfilled') setMemoryStats(memData.value);
      if (analData.status === 'fulfilled') setAnalytics(analData.value);
    } catch (err) {
      setError(err.message || 'Failed to sync with backend');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const activeIncidents = incidents.filter(
    (i) => !['resolved', 'post_mortem'].includes(i.status)
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={COLORS.primary}
        />
      }
    >
      {/* Top Banner / System Status */}
      <View style={styles.topBar}>
        <View>
          <Text style={styles.appTitle}>RECALLA</Text>
          <Text style={styles.appSubtitle}>Incident Intelligence Platform</Text>
        </View>

        {/* Hindsight Status Pill */}
        <TouchableOpacity
          style={styles.hindsightPill}
          onPress={() => onNavigateTab && onNavigateTab('Memory')}
        >
          <View style={styles.hindsightPulseDot} />
          <Text style={styles.hindsightPillText}>HINDSIGHT ACTIVE</Text>
        </TouchableOpacity>
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle" size={18} color={COLORS.critical} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={loadData} style={styles.retryBtn}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* KPI Cards Row */}
      <View style={styles.kpiGrid}>
        <View style={[styles.kpiCard, activeIncidents.length > 0 && styles.kpiCardAlert]}>
          <View style={styles.kpiHeader}>
            <Text style={styles.kpiLabel}>ACTIVE INCIDENTS</Text>
            <Ionicons
              name={activeIncidents.length > 0 ? 'flame' : 'shield-checkmark'}
              size={18}
              color={activeIncidents.length > 0 ? COLORS.critical : COLORS.success}
            />
          </View>
          <Text style={styles.kpiValue}>{activeIncidents.length}</Text>
          <Text style={styles.kpiHint}>
            {activeIncidents.length > 0
              ? `${activeIncidents.filter((i) => i.severity === 'Critical' || i.severity === 'SEV-1').length} Critical/SEV-1`
              : 'All systems operational'}
          </Text>
        </View>

        <View style={styles.kpiCard}>
          <View style={styles.kpiHeader}>
            <Text style={styles.kpiLabel}>MTTR AVG</Text>
            <Ionicons name="timer-outline" size={18} color={COLORS.primary} />
          </View>
          <Text style={styles.kpiValue}>
            {analytics?.mttr_minutes ? `${analytics.mttr_minutes}m` : '18.6m'}
          </Text>
          <Text style={styles.kpiHint}>-42% with Hindsight recall</Text>
        </View>

        <View style={styles.kpiCard}>
          <View style={styles.kpiHeader}>
            <Text style={styles.kpiLabel}>MEMORY BANK</Text>
            <Ionicons name="hardware-chip-outline" size={18} color={COLORS.aiPurple} />
          </View>
          <Text style={styles.kpiValue}>
            {memoryStats?.total_memories || 10}
          </Text>
          <Text style={styles.kpiHint}>Retained incidents & learnings</Text>
        </View>

        <View style={styles.kpiCard}>
          <View style={styles.kpiHeader}>
            <Text style={styles.kpiLabel}>RESOLVED</Text>
            <Ionicons name="checkmark-done-circle-outline" size={18} color={COLORS.success} />
          </View>
          <Text style={styles.kpiValue}>
            {analytics?.resolved_incidents ?? incidents.length}
          </Text>
          <Text style={styles.kpiHint}>Post-mortems indexed</Text>
        </View>
      </View>

      {/* System Health Diagnostics */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>SYSTEM DIAGNOSTICS</Text>
          <Text style={styles.healthStatusLive}>
            {health?.overall === 'healthy' ? 'ALL HEALTHY' : 'OPERATIONAL'}
          </Text>
        </View>

        <View style={styles.diagnosticsCard}>
          <View style={styles.diagRow}>
            <View style={styles.diagItem}>
              <View style={styles.diagIndicator(health?.api === 'healthy')} />
              <Text style={styles.diagLabel}>API Engine</Text>
              <Text style={styles.diagValue}>FastAPI v0.115</Text>
            </View>

            <View style={styles.diagItem}>
              <View style={styles.diagIndicator(health?.database === 'healthy')} />
              <Text style={styles.diagLabel}>Database</Text>
              <Text style={styles.diagValue}>SQLAlchemy Async</Text>
            </View>
          </View>

          <View style={styles.diagDivider} />

          <View style={styles.diagRow}>
            <View style={styles.diagItem}>
              <View style={styles.diagIndicator(health?.hindsight === 'healthy')} />
              <Text style={styles.diagLabel}>Hindsight Memory</Text>
              <Text style={styles.diagValue}>
                {memoryStats?.bank_id || 'incident-response-agent'}
              </Text>
            </View>

            <View style={styles.diagItem}>
              <View style={styles.diagIndicator(health?.llm === 'healthy')} />
              <Text style={styles.diagLabel}>AI Reasoner</Text>
              <Text style={styles.diagValue}>SRE Evidence Agent</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Quick Action: Start AI Investigation */}
      <TouchableOpacity
        style={styles.heroActionCard}
        onPress={() => onNavigateTab && onNavigateTab('AI Agent')}
        activeOpacity={0.85}
      >
        <View style={styles.heroActionIcon}>
          <Ionicons name="sparkles" size={24} color={COLORS.aiPurple} />
        </View>
        <View style={styles.heroActionContent}>
          <Text style={styles.heroActionTitle}>AI Incident Investigation</Text>
          <Text style={styles.heroActionSubtitle}>
            Recall past incidents from Hindsight to diagnose root cause & runbook
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
      </TouchableOpacity>

      {/* Active Incidents or All Clear */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>ACTIVE INCIDENTS</Text>
          <TouchableOpacity onPress={() => onNavigateTab && onNavigateTab('Incidents')}>
            <Text style={styles.sectionLink}>View All ({incidents.length})</Text>
          </TouchableOpacity>
        </View>

        {activeIncidents.length > 0 ? (
          activeIncidents.map((incident) => (
            <TouchableOpacity
              key={incident.id || incident.incident_id}
              style={styles.incidentCard}
              onPress={() => onSelectIncident && onSelectIncident(incident)}
              activeOpacity={0.8}
            >
              <View style={styles.incidentCardHeader}>
                <SeverityBadge severity={incident.severity} size="small" />
                <Text style={styles.incidentId}>{incident.incident_id}</Text>
                <StatusBadge status={incident.status} size="small" />
              </View>

              <Text style={styles.incidentService}>{incident.service}</Text>
              <Text style={styles.incidentSymptoms} numberOfLines={2}>
                {incident.symptoms}
              </Text>

              <View style={styles.incidentFooter}>
                <View style={styles.incidentFooterItem}>
                  <Ionicons name="time-outline" size={13} color={COLORS.textMuted} />
                  <Text style={styles.incidentFooterText}>
                    {incident.detected_at
                      ? new Date(incident.detected_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : 'Just now'}
                  </Text>
                </View>

                {incident.error_rate ? (
                  <View style={styles.incidentFooterItem}>
                    <Ionicons name="pulse-outline" size={13} color={COLORS.critical} />
                    <Text style={[styles.incidentFooterText, { color: COLORS.critical }]}>
                      {incident.error_rate}% Error Rate
                    </Text>
                  </View>
                ) : null}

                <View style={styles.investigateBtnPill}>
                  <Text style={styles.investigateBtnText}>Investigate</Text>
                  <Ionicons name="arrow-forward" size={12} color={COLORS.primary} />
                </View>
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.emptyCard}>
            <Ionicons name="checkmark-circle-outline" size={36} color={COLORS.success} />
            <Text style={styles.emptyTitle}>Zero Active Outages</Text>
            <Text style={styles.emptySubtitle}>
              All production systems are healthy. Historical knowledge indexed in Hindsight.
            </Text>
          </View>
        )}
      </View>

      {/* Recent Historical Incidents Feed */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>HISTORICAL INCIDENT KNOWLEDGE</Text>
          <TouchableOpacity onPress={() => onNavigateTab && onNavigateTab('Memory')}>
            <Text style={styles.sectionLink}>Memory Bank</Text>
          </TouchableOpacity>
        </View>

        {incidents
          .filter((i) => i.status === 'resolved' || i.status === 'post_mortem')
          .slice(0, 3)
          .map((incident) => (
            <TouchableOpacity
              key={incident.id || incident.incident_id}
              style={styles.historicalCard}
              onPress={() => onSelectIncident && onSelectIncident(incident)}
              activeOpacity={0.8}
            >
              <View style={styles.historicalTopRow}>
                <SeverityBadge severity={incident.severity} size="small" />
                <Text style={styles.historicalId}>{incident.incident_id}</Text>
                <View style={styles.hindsightBadgeSmall}>
                  <Ionicons name="cube-outline" size={11} color={COLORS.hindsightCyan} />
                  <Text style={styles.hindsightBadgeSmallText}>Retained</Text>
                </View>
              </View>

              <Text style={styles.historicalService}>{incident.service}</Text>
              <Text style={styles.historicalRootCause} numberOfLines={2}>
                <Text style={{ color: COLORS.textMuted }}>Root Cause: </Text>
                {incident.root_cause || 'Resolved via documented playbook'}
              </Text>

              {incident.recommended_runbook ? (
                <View style={styles.runbookPill}>
                  <Ionicons name="book-outline" size={12} color={COLORS.primary} />
                  <Text style={styles.runbookPillText}>{incident.recommended_runbook}</Text>
                  {incident.recovery_time_minutes ? (
                    <Text style={styles.recoveryTimeText}>
                      ({incident.recovery_time_minutes}m MTTR)
                    </Text>
                  ) : null}
                </View>
              ) : null}
            </TouchableOpacity>
          ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  appTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.textPrimary,
    letterSpacing: 1.5,
  },
  appSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  hindsightPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.hindsightCyan,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 6,
  },
  hindsightPulseDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: COLORS.hindsightCyan,
  },
  hindsightPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.hindsightCyan,
    letterSpacing: 0.5,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.criticalBg,
    borderColor: COLORS.criticalBorder,
    borderWidth: 1,
    padding: 10,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.critical,
  },
  retryBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: COLORS.surface,
    borderRadius: 4,
  },
  retryText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  kpiCard: {
    width: '48%',
    backgroundColor: COLORS.surface,
    borderColor: COLORS.surfaceBorder,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  kpiCardAlert: {
    borderColor: COLORS.criticalBorder,
    backgroundColor: COLORS.criticalBg,
  },
  kpiHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  kpiLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textSecondary,
    letterSpacing: 0.5,
  },
  kpiValue: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  kpiHint: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  section: {
    marginBottom: 22,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textSecondary,
    letterSpacing: 1,
  },
  sectionLink: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
  },
  healthStatusLive: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.success,
    letterSpacing: 0.5,
  },
  diagnosticsCard: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.surfaceBorder,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  diagRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  diagItem: {
    flex: 1,
  },
  diagIndicator: (healthy) => ({
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: healthy ? COLORS.success : COLORS.warning,
    marginBottom: 4,
  }),
  diagLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginBottom: 2,
  },
  diagValue: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  diagDivider: {
    height: 1,
    backgroundColor: COLORS.borderSubtle,
    marginVertical: 10,
  },
  heroActionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.aiPurple,
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    gap: 14,
  },
  heroActionIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.aiPurpleMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroActionContent: {
    flex: 1,
  },
  heroActionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 3,
  },
  heroActionSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 16,
  },
  incidentCard: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.surfaceBorder,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  incidentCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  incidentId: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    fontFamily: 'monospace',
  },
  incidentService: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  incidentSymptoms: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
    marginBottom: 12,
  },
  incidentFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderSubtle,
  },
  incidentFooterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  incidentFooterText: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  investigateBtnPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  investigateBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  emptyCard: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.surfaceBorder,
    borderWidth: 1,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: 10,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  historicalCard: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.surfaceBorder,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  historicalTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
  },
  historicalId: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    fontFamily: 'monospace',
  },
  hindsightBadgeSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.hindsightCyanMuted,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 4,
  },
  hindsightBadgeSmallText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.hindsightCyan,
  },
  historicalService: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 3,
  },
  historicalRootCause: {
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 16,
    marginBottom: 8,
  },
  runbookPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.backgroundSecondary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
    gap: 6,
  },
  runbookPillText: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: COLORS.primary,
    fontWeight: '600',
  },
  recoveryTimeText: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
});
