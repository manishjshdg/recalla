import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme/colors';
import { SeverityBadge, StatusBadge } from '../components/Badge';
import { incidentsApi } from '../api/client';

const SEVERITY_FILTERS = ['All', 'Critical', 'SEV-1', 'SEV-2', 'High', 'Resolved'];

export default function IncidentsScreen({
  selectedIncidentFromProps,
  onInvestigateIncident,
  onNavigateTab,
}) {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');

  // Modals
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [activeIncident, setActiveIncident] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // New incident form state
  const [newService, setNewService] = useState('Payment API');
  const [newSeverity, setNewSeverity] = useState('Critical');
  const [newSymptoms, setNewSymptoms] = useState('');
  const [newErrorMessage, setNewErrorMessage] = useState('');
  const [newComponent, setNewComponent] = useState('');
  const [newVersion, setNewVersion] = useState('');
  const [newErrorRate, setNewErrorRate] = useState('45');
  const [creating, setCreating] = useState(false);

  // Resolve form state
  const [resolveModalVisible, setResolveModalVisible] = useState(false);
  const [resolveNotes, setResolveNotes] = useState('');
  const [resolveRecoveryTime, setResolveRecoveryTime] = useState('12');
  const [resolving, setResolving] = useState(false);

  // Post-Mortem state
  const [postMortemModalVisible, setPostMortemModalVisible] = useState(false);
  const [pmSummary, setPmSummary] = useState('');
  const [pmRootCause, setPmRootCause] = useState('');
  const [pmWhatHappened, setPmWhatHappened] = useState('');
  const [pmResolution, setPmResolution] = useState('');
  const [pmLessons, setPmLessons] = useState('');
  const [savingPm, setSavingPm] = useState(false);

  const fetchIncidents = async () => {
    try {
      const data = await incidentsApi.list();
      setIncidents(data);
      if (activeIncident) {
        const updated = data.find((i) => i.id === activeIncident.id || i.incident_id === activeIncident.incident_id);
        if (updated) setActiveIncident(updated);
      }
    } catch (err) {
      console.warn('Failed to fetch incidents:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchIncidents();
  }, []);

  useEffect(() => {
    if (selectedIncidentFromProps) {
      handleOpenDetail(selectedIncidentFromProps);
    }
  }, [selectedIncidentFromProps]);

  const handleOpenDetail = async (incident) => {
    setActiveIncident(incident);
    setDetailModalVisible(true);
    setDetailLoading(true);
    try {
      const full = await incidentsApi.get(incident.incident_id || incident.id);
      setActiveIncident(full);
    } catch (err) {
      console.warn('Failed to get full incident details:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCreateIncident = async () => {
    if (!newSymptoms.trim() || newSymptoms.trim().length < 10) {
      Alert.alert('Required', 'Please describe the symptoms in detail (at least 10 characters).');
      return;
    }

    setCreating(true);
    try {
      const created = await incidentsApi.create({
        service: newService,
        severity: newSeverity,
        symptoms: newSymptoms,
        error_message: newErrorMessage || null,
        affected_component: newComponent || null,
        deployment_version: newVersion || null,
        error_rate: newErrorRate ? parseFloat(newErrorRate) : null,
      });

      setCreateModalVisible(false);
      resetCreateForm();
      await fetchIncidents();

      // Ask if engineer wants to run AI investigation immediately
      Alert.alert(
        'Incident Logged & Retained in Hindsight',
        `${created.incident_id} created. Would you like to run AI Investigation to recall similar past incidents and recommended runbook?`,
        [
          { text: 'View Incident', onPress: () => handleOpenDetail(created) },
          {
            text: 'Investigate Now',
            style: 'default',
            onPress: () => {
              if (onInvestigateIncident) {
                onInvestigateIncident(created);
              } else {
                handleOpenDetail(created);
              }
            },
          },
        ]
      );
    } catch (err) {
      Alert.alert('Creation Failed', err.message || 'Error creating incident');
    } finally {
      setCreating(false);
    }
  };

  const resetCreateForm = () => {
    setNewSymptoms('');
    setNewErrorMessage('');
    setNewComponent('');
    setNewVersion('');
    setNewErrorRate('45');
  };

  const handleUpdateStatus = async (newStatus) => {
    if (!activeIncident) return;
    try {
      await incidentsApi.updateStatus(activeIncident.incident_id, newStatus, `Status updated to ${newStatus}`);
      await fetchIncidents();
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  };

  const handleResolveIncident = async () => {
    if (!resolveNotes.trim()) {
      Alert.alert('Required', 'Please provide resolution notes.');
      return;
    }
    setResolving(true);
    try {
      await incidentsApi.resolve(activeIncident.incident_id, {
        resolution_notes: resolveNotes,
        recovery_time_minutes: parseInt(resolveRecoveryTime, 10) || 10,
      });
      setResolveModalVisible(false);
      setResolveNotes('');
      await fetchIncidents();
      Alert.alert(
        'Incident Resolved',
        'Resolution recorded. Would you like to document post-mortem lessons to retain in Hindsight memory for future incidents?',
        [
          { text: 'Later', style: 'cancel' },
          {
            text: 'Write Post-Mortem',
            onPress: () => {
              preparePostMortem();
            },
          },
        ]
      );
    } catch (err) {
      Alert.alert('Resolution Failed', err.message);
    } finally {
      setResolving(false);
    }
  };

  const preparePostMortem = () => {
    if (!activeIncident) return;
    setPmSummary(`Outage on ${activeIncident.service} causing ${activeIncident.symptoms}`);
    setPmRootCause(activeIncident.root_cause || 'Identified root cause during investigation');
    setPmWhatHappened(activeIncident.symptoms);
    setPmResolution(activeIncident.resolution_notes || 'Applied mitigation and restored normal traffic');
    setPmLessons('Verify configuration parameters before deployment. Update health check alarms.');
    setPostMortemModalVisible(true);
  };

  const handleSavePostMortem = async () => {
    if (!pmLessons.trim() || pmLessons.trim().length < 20) {
      Alert.alert('Required', 'Please document comprehensive lessons learned (at least 20 characters) so Hindsight can learn.');
      return;
    }
    setSavingPm(true);
    try {
      await incidentsApi.createPostMortem(activeIncident.incident_id, {
        incident_summary: pmSummary,
        root_cause: pmRootCause,
        what_happened: pmWhatHappened,
        resolution: pmResolution,
        lessons_learned: pmLessons,
        runbook_used: activeIncident.recommended_runbook || 'standard-runbook',
        recovery_time_minutes: activeIncident.recovery_time_minutes || 15,
      });
      setPostMortemModalVisible(false);
      await fetchIncidents();
      Alert.alert(
        'Retained in Hindsight Memory',
        'Post-mortem lessons have been retained in the Hindsight memory bank. Future incidents with similar symptoms will now benefit from these learnings!'
      );
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setSavingPm(false);
    }
  };

  const filteredIncidents = incidents.filter((i) => {
    // Search match
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      i.incident_id?.toLowerCase().includes(q) ||
      i.service?.toLowerCase().includes(q) ||
      i.symptoms?.toLowerCase().includes(q) ||
      i.root_cause?.toLowerCase().includes(q);

    // Filter match
    if (!matchesSearch) return false;
    if (activeFilter === 'All') return true;
    if (activeFilter === 'Resolved') return i.status === 'resolved' || i.status === 'post_mortem';
    return i.severity === activeFilter;
  });

  return (
    <View style={styles.container}>
      {/* Top Search & Filter Bar */}
      <View style={styles.header}>
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={16} color={COLORS.textSecondary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search incidents, services, root causes..."
              placeholderTextColor={COLORS.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={16} color={COLORS.textMuted} />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* New Incident Button */}
          <TouchableOpacity
            style={styles.createButton}
            onPress={() => setCreateModalVisible(true)}
          >
            <Ionicons name="add" size={20} color={COLORS.textInverse} />
            <Text style={styles.createButtonText}>Log</Text>
          </TouchableOpacity>
        </View>

        {/* Severity Filters */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={styles.filterContent}
        >
          {SEVERITY_FILTERS.map((filter) => {
            const active = activeFilter === filter;
            return (
              <TouchableOpacity
                key={filter}
                style={[styles.filterChip, active && styles.filterChipActive]}
                onPress={() => setActiveFilter(filter)}
              >
                <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                  {filter}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Incidents List */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Syncing incidents...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredIncidents}
          keyExtractor={(item) => item.id?.toString() || item.incident_id}
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            fetchIncidents();
          }}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => handleOpenDetail(item)}
              activeOpacity={0.8}
            >
              <View style={styles.cardHeader}>
                <SeverityBadge severity={item.severity} size="small" />
                <Text style={styles.cardId}>{item.incident_id}</Text>
                <StatusBadge status={item.status} size="small" />
              </View>

              <Text style={styles.cardService}>{item.service}</Text>
              <Text style={styles.cardSymptoms} numberOfLines={2}>
                {item.symptoms}
              </Text>

              {item.root_cause ? (
                <View style={styles.rootCauseBox}>
                  <Ionicons name="git-branch-outline" size={13} color={COLORS.aiPurple} />
                  <Text style={styles.rootCauseText} numberOfLines={1}>
                    {item.root_cause}
                  </Text>
                </View>
              ) : null}

              <View style={styles.cardFooter}>
                <View style={styles.footerInfo}>
                  <Ionicons name="time-outline" size={13} color={COLORS.textMuted} />
                  <Text style={styles.footerText}>
                    {item.detected_at
                      ? new Date(item.detected_at).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                        })
                      : 'Active'}
                  </Text>
                </View>

                {item.recovery_time_minutes ? (
                  <View style={styles.footerInfo}>
                    <Ionicons name="checkmark-done" size={13} color={COLORS.success} />
                    <Text style={[styles.footerText, { color: COLORS.success }]}>
                      {item.recovery_time_minutes}m MTTR
                    </Text>
                  </View>
                ) : null}

                <View style={styles.actionPill}>
                  <Text style={styles.actionPillText}>View Details</Text>
                  <Ionicons name="chevron-forward" size={12} color={COLORS.primary} />
                </View>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="search-outline" size={40} color={COLORS.textMuted} />
              <Text style={styles.emptyText}>No incidents match your filter</Text>
            </View>
          }
        />
      )}

      {/* ============================================================ */}
      {/* MODAL 1: INCIDENT DETAIL */}
      {/* ============================================================ */}
      <Modal
        visible={detailModalVisible}
        animationType="slide"
        onRequestClose={() => setDetailModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          {activeIncident ? (
            <>
              {/* Detail Header */}
              <View style={styles.detailHeader}>
                <TouchableOpacity
                  style={styles.backButton}
                  onPress={() => setDetailModalVisible(false)}
                >
                  <Ionicons name="close" size={24} color={COLORS.textPrimary} />
                </TouchableOpacity>
                <View style={styles.detailHeaderInfo}>
                  <Text style={styles.detailId}>{activeIncident.incident_id}</Text>
                  <Text style={styles.detailService}>{activeIncident.service}</Text>
                </View>
                <SeverityBadge severity={activeIncident.severity} size="medium" />
              </View>

              <ScrollView style={styles.detailBody} contentContainerStyle={styles.detailContent}>
                {/* Status bar & changer */}
                <View style={styles.statusBox}>
                  <View style={styles.statusRow}>
                    <Text style={styles.statusLabel}>CURRENT STATUS:</Text>
                    <StatusBadge status={activeIncident.status} size="medium" />
                  </View>

                  {/* Status update buttons */}
                  <View style={styles.statusBtnGroup}>
                    {['acknowledged', 'investigating', 'mitigating'].map((st) => (
                      <TouchableOpacity
                        key={st}
                        style={[
                          styles.statusChangeBtn,
                          activeIncident.status === st && styles.statusChangeBtnActive,
                        ]}
                        onPress={() => handleUpdateStatus(st)}
                      >
                        <Text
                          style={[
                            styles.statusChangeText,
                            activeIncident.status === st && styles.statusChangeTextActive,
                          ]}
                        >
                          {st.charAt(0).toUpperCase() + st.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Primary AI Investigation CTA */}
                <TouchableOpacity
                  style={styles.aiInvestigateCTA}
                  onPress={() => {
                    setDetailModalVisible(false);
                    if (onInvestigateIncident) {
                      onInvestigateIncident(activeIncident);
                    }
                  }}
                >
                  <View style={styles.aiInvestigateIcon}>
                    <Ionicons name="sparkles" size={20} color={COLORS.aiPurple} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.aiInvestigateTitle}>
                      Run AI Investigation (Hindsight Recall)
                    </Text>
                    <Text style={styles.aiInvestigateSubtitle}>
                      Query long-term memory for matching past outages & verified fixes
                    </Text>
                  </View>
                  <Ionicons name="arrow-forward" size={18} color={COLORS.primary} />
                </TouchableOpacity>

                {/* Symptoms Card */}
                <View style={styles.detailCard}>
                  <Text style={styles.detailSectionTitle}>SYMPTOMS & TELEMETRY</Text>
                  <Text style={styles.detailText}>{activeIncident.symptoms}</Text>

                  {activeIncident.error_message ? (
                    <View style={styles.codeBlock}>
                      <Text style={styles.codeText}>{activeIncident.error_message}</Text>
                    </View>
                  ) : null}

                  <View style={styles.metricRow}>
                    {activeIncident.error_rate ? (
                      <View style={styles.miniMetric}>
                        <Text style={styles.miniMetricLabel}>Error Rate</Text>
                        <Text style={[styles.miniMetricVal, { color: COLORS.critical }]}>
                          {activeIncident.error_rate}%
                        </Text>
                      </View>
                    ) : null}

                    {activeIncident.deployment_version ? (
                      <View style={styles.miniMetric}>
                        <Text style={styles.miniMetricLabel}>Version</Text>
                        <Text style={styles.miniMetricVal}>
                          {activeIncident.deployment_version}
                        </Text>
                      </View>
                    ) : null}

                    {activeIncident.affected_component ? (
                      <View style={styles.miniMetric}>
                        <Text style={styles.miniMetricLabel}>Component</Text>
                        <Text style={styles.miniMetricVal} numberOfLines={1}>
                          {activeIncident.affected_component}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>

                {/* AI Root Cause & Hindsight Evidence (if already analyzed) */}
                {activeIncident.root_cause ? (
                  <View style={[styles.detailCard, styles.detailCardAI]}>
                    <View style={styles.aiHeader}>
                      <Ionicons name="brain" size={18} color={COLORS.aiPurple} />
                      <Text style={styles.aiTitle}>HINDSIGHT MEMORY INSIGHTS</Text>
                    </View>

                    <Text style={styles.rootCauseBig}>{activeIncident.root_cause}</Text>

                    {activeIncident.recommended_runbook ? (
                      <View style={styles.recommendedRunbookBox}>
                        <Text style={styles.runbookLabel}>Recommended Runbook:</Text>
                        <Text style={styles.runbookName}>
                          {activeIncident.recommended_runbook}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                ) : null}

                {/* Timeline */}
                <View style={styles.detailCard}>
                  <Text style={styles.detailSectionTitle}>INCIDENT TIMELINE</Text>
                  {activeIncident.timeline && activeIncident.timeline.length > 0 ? (
                    activeIncident.timeline.map((event, idx) => (
                      <View key={event.id || idx} style={styles.timelineItem}>
                        <View style={styles.timelineDot} />
                        <View style={styles.timelineContent}>
                          <Text style={styles.timelineEvent}>{event.event}</Text>
                          {event.details ? (
                            <Text style={styles.timelineDetails}>{event.details}</Text>
                          ) : null}
                          <Text style={styles.timelineTime}>
                            {new Date(event.timestamp).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </Text>
                        </View>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.emptyTimelineText}>
                      Incident detected. Timeline updates as remediation progresses.
                    </Text>
                  )}
                </View>
              </ScrollView>

              {/* Bottom Action Footer */}
              <View style={styles.detailFooter}>
                {activeIncident.status !== 'resolved' && activeIncident.status !== 'post_mortem' ? (
                  <TouchableOpacity
                    style={styles.resolveButton}
                    onPress={() => setResolveModalVisible(true)}
                  >
                    <Ionicons name="checkmark-circle" size={18} color={COLORS.textInverse} />
                    <Text style={styles.resolveButtonText}>Resolve Incident</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={styles.postMortemButton}
                    onPress={preparePostMortem}
                  >
                    <Ionicons name="document-text" size={18} color={COLORS.textPrimary} />
                    <Text style={styles.postMortemButtonText}>Post-Mortem Lessons</Text>
                  </TouchableOpacity>
                )}
              </View>
            </>
          ) : null}
        </View>
      </Modal>

      {/* ============================================================ */}
      {/* MODAL 2: CREATE NEW INCIDENT */}
      {/* ============================================================ */}
      <Modal
        visible={createModalVisible}
        animationType="slide"
        onRequestClose={() => setCreateModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.detailHeader}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => setCreateModalVisible(false)}
            >
              <Ionicons name="close" size={24} color={COLORS.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Log New Incident</Text>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView style={styles.detailBody} contentContainerStyle={styles.detailContent}>
            {/* Service Input */}
            <Text style={styles.formLabel}>SERVICE NAME *</Text>
            <TextInput
              style={styles.formInput}
              placeholder="e.g. Payment API, Auth Service, Billing"
              placeholderTextColor={COLORS.textMuted}
              value={newService}
              onChangeText={setNewService}
            />

            {/* Severity Picker */}
            <Text style={styles.formLabel}>SEVERITY LEVEL</Text>
            <View style={styles.severityPickerRow}>
              {['Critical', 'SEV-1', 'SEV-2', 'High'].map((sev) => (
                <TouchableOpacity
                  key={sev}
                  style={[
                    styles.severityOption,
                    newSeverity === sev && styles.severityOptionSelected,
                  ]}
                  onPress={() => setNewSeverity(sev)}
                >
                  <Text
                    style={[
                      styles.severityOptionText,
                      newSeverity === sev && styles.severityOptionTextSelected,
                    ]}
                  >
                    {sev}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Symptoms Input */}
            <Text style={styles.formLabel}>OBSERVED SYMPTOMS *</Text>
            <TextInput
              style={[styles.formInput, styles.formTextArea]}
              placeholder="Describe symptoms, 503 spikes, connection timeouts, customer impact..."
              placeholderTextColor={COLORS.textMuted}
              value={newSymptoms}
              onChangeText={setNewSymptoms}
              multiline
              numberOfLines={4}
            />

            {/* Error Message */}
            <Text style={styles.formLabel}>ERROR MESSAGE / STACK TRACE (OPTIONAL)</Text>
            <TextInput
              style={[styles.formInput, styles.formCodeInput]}
              placeholder="e.g. FATAL: too many connections for role payment_service"
              placeholderTextColor={COLORS.textMuted}
              value={newErrorMessage}
              onChangeText={setNewErrorMessage}
            />

            {/* Component & Version Row */}
            <View style={styles.formRow}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.formLabel}>COMPONENT</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g. DB Pool"
                  placeholderTextColor={COLORS.textMuted}
                  value={newComponent}
                  onChangeText={setNewComponent}
                />
              </View>

              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={styles.formLabel}>VERSION</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g. v2.4.1"
                  placeholderTextColor={COLORS.textMuted}
                  value={newVersion}
                  onChangeText={setNewVersion}
                />
              </View>
            </View>

            {/* Error Rate */}
            <Text style={styles.formLabel}>ESTIMATED ERROR RATE (%)</Text>
            <TextInput
              style={styles.formInput}
              placeholder="e.g. 78"
              placeholderTextColor={COLORS.textMuted}
              keyboardType="numeric"
              value={newErrorRate}
              onChangeText={setNewErrorRate}
            />

            {/* Submit Button */}
            <TouchableOpacity
              style={styles.submitButton}
              onPress={handleCreateIncident}
              disabled={creating}
            >
              {creating ? (
                <ActivityIndicator color={COLORS.textInverse} />
              ) : (
                <>
                  <Ionicons name="flash" size={18} color={COLORS.textInverse} />
                  <Text style={styles.submitButtonText}>Create & Retain in Memory</Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* ============================================================ */}
      {/* MODAL 3: RESOLVE INCIDENT */}
      {/* ============================================================ */}
      <Modal
        visible={resolveModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setResolveModalVisible(false)}
      >
        <View style={styles.promptOverlay}>
          <View style={styles.promptCard}>
            <Text style={styles.promptTitle}>Resolve Incident</Text>
            <Text style={styles.promptSubtitle}>
              Document remediation steps and recovery time.
            </Text>

            <Text style={styles.formLabel}>RESOLUTION NOTES *</Text>
            <TextInput
              style={[styles.formInput, styles.formTextArea]}
              placeholder="e.g. Rolled back v2.4.1 to v2.4.0, restarted pods, pool stabilized."
              placeholderTextColor={COLORS.textMuted}
              value={resolveNotes}
              onChangeText={setResolveNotes}
              multiline
              numberOfLines={3}
            />

            <Text style={styles.formLabel}>RECOVERY TIME (MINUTES)</Text>
            <TextInput
              style={styles.formInput}
              placeholder="e.g. 12"
              placeholderTextColor={COLORS.textMuted}
              keyboardType="numeric"
              value={resolveRecoveryTime}
              onChangeText={setResolveRecoveryTime}
            />

            <View style={styles.promptActions}>
              <TouchableOpacity
                style={styles.promptCancel}
                onPress={() => setResolveModalVisible(false)}
              >
                <Text style={styles.promptCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.promptSubmit}
                onPress={handleResolveIncident}
                disabled={resolving}
              >
                {resolving ? (
                  <ActivityIndicator color={COLORS.textInverse} size="small" />
                ) : (
                  <Text style={styles.promptSubmitText}>Mark Resolved</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ============================================================ */}
      {/* MODAL 4: POST-MORTEM & HINDSIGHT RETAIN */}
      {/* ============================================================ */}
      <Modal
        visible={postMortemModalVisible}
        animationType="slide"
        onRequestClose={() => setPostMortemModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.detailHeader}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => setPostMortemModalVisible(false)}
            >
              <Ionicons name="close" size={24} color={COLORS.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Post-Mortem Learning</Text>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView style={styles.detailBody} contentContainerStyle={styles.detailContent}>
            <View style={styles.hindsightNotice}>
              <Ionicons name="bulb-outline" size={20} color={COLORS.hindsightCyan} />
              <Text style={styles.hindsightNoticeText}>
                Lessons saved here will be retained in Hindsight memory to accelerate future incident resolution!
              </Text>
            </View>

            <Text style={styles.formLabel}>INCIDENT SUMMARY</Text>
            <TextInput
              style={styles.formInput}
              value={pmSummary}
              onChangeText={setPmSummary}
            />

            <Text style={styles.formLabel}>CONFIRMED ROOT CAUSE</Text>
            <TextInput
              style={styles.formInput}
              value={pmRootCause}
              onChangeText={setPmRootCause}
            />

            <Text style={styles.formLabel}>RESOLUTION STEPS</Text>
            <TextInput
              style={[styles.formInput, styles.formTextArea]}
              value={pmResolution}
              onChangeText={setPmResolution}
              multiline
              numberOfLines={3}
            />

            <Text style={styles.formLabel}>LESSONS LEARNED (CRITICAL FOR HINDSIGHT) *</Text>
            <TextInput
              style={[styles.formInput, styles.formTextArea, { borderColor: COLORS.hindsightCyan }]}
              placeholder="What must future responders know? (e.g. Always check DB pool max_overflow before scaling)"
              placeholderTextColor={COLORS.textMuted}
              value={pmLessons}
              onChangeText={setPmLessons}
              multiline
              numberOfLines={4}
            />

            <TouchableOpacity
              style={[styles.submitButton, { backgroundColor: COLORS.hindsightCyan }]}
              onPress={handleSavePostMortem}
              disabled={savingPm}
            >
              {savingPm ? (
                <ActivityIndicator color={COLORS.textInverse} />
              ) : (
                <>
                  <Ionicons name="save" size={18} color={COLORS.textInverse} />
                  <Text style={styles.submitButtonText}>Retain in Hindsight Bank</Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSubtle,
    backgroundColor: COLORS.backgroundSecondary,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderColor: COLORS.surfaceBorder,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 42,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 13,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingHorizontal: 14,
    height: 42,
    gap: 4,
  },
  createButtonText: {
    color: COLORS.textInverse,
    fontWeight: '700',
    fontSize: 13,
  },
  filterScroll: {
    flexDirection: 'row',
  },
  filterContent: {
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  filterChipTextActive: {
    color: COLORS.textInverse,
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.surfaceBorder,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  cardId: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    fontFamily: 'monospace',
  },
  cardService: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  cardSymptoms: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
    marginBottom: 10,
  },
  rootCauseBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.aiPurpleMuted,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 10,
    gap: 6,
  },
  rootCauseText: {
    flex: 1,
    fontSize: 11,
    color: COLORS.aiPurple,
    fontWeight: '600',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderSubtle,
  },
  footerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  footerText: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 60,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.textMuted,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSubtle,
    backgroundColor: COLORS.backgroundSecondary,
  },
  backButton: {
    padding: 6,
    marginRight: 10,
  },
  detailHeaderInfo: {
    flex: 1,
  },
  detailId: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    fontFamily: 'monospace',
  },
  detailService: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  modalTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  detailBody: {
    flex: 1,
  },
  detailContent: {
    padding: 16,
    paddingBottom: 40,
  },
  statusBox: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
    marginBottom: 16,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  statusBtnGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  statusChangeBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: COLORS.backgroundSecondary,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    alignItems: 'center',
  },
  statusChangeBtnActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  statusChangeText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  statusChangeTextActive: {
    color: COLORS.textInverse,
    fontWeight: '700',
  },
  aiInvestigateCTA: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.aiPurple,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    gap: 12,
  },
  aiInvestigateIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: COLORS.aiPurpleMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  aiInvestigateTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  aiInvestigateSubtitle: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  detailCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
    marginBottom: 16,
  },
  detailCardAI: {
    borderColor: COLORS.aiPurple,
    backgroundColor: COLORS.surfaceElevated,
  },
  detailSectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  detailText: {
    fontSize: 13,
    color: COLORS.textPrimary,
    lineHeight: 18,
    marginBottom: 10,
  },
  codeBlock: {
    backgroundColor: COLORS.backgroundSecondary,
    padding: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    marginBottom: 10,
  },
  codeText: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: COLORS.critical,
  },
  metricRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 6,
  },
  miniMetric: {
    flex: 1,
    backgroundColor: COLORS.backgroundSecondary,
    padding: 8,
    borderRadius: 6,
  },
  miniMetricLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginBottom: 2,
  },
  miniMetricVal: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  aiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  aiTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.aiPurple,
    letterSpacing: 0.5,
  },
  rootCauseBig: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
    lineHeight: 20,
    marginBottom: 12,
  },
  recommendedRunbookBox: {
    backgroundColor: COLORS.backgroundSecondary,
    padding: 10,
    borderRadius: 6,
  },
  runbookLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginBottom: 2,
  },
  runbookName: {
    fontSize: 13,
    fontFamily: 'monospace',
    fontWeight: '700',
    color: COLORS.primary,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 14,
  },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
    marginTop: 5,
    marginRight: 10,
  },
  timelineContent: {
    flex: 1,
  },
  timelineEvent: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  timelineDetails: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  timelineTime: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  emptyTimelineText: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontStyle: 'italic',
  },
  detailFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderSubtle,
    backgroundColor: COLORS.backgroundSecondary,
  },
  resolveButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.success,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  resolveButtonText: {
    color: COLORS.textInverse,
    fontWeight: '700',
    fontSize: 14,
  },
  postMortemButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceElevated,
    borderColor: COLORS.hindsightCyan,
    borderWidth: 1,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  postMortemButtonText: {
    color: COLORS.hindsightCyan,
    fontWeight: '700',
    fontSize: 14,
  },
  formLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  formInput: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.surfaceBorder,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: COLORS.textPrimary,
    fontSize: 13,
    marginBottom: 16,
  },
  formTextArea: {
    height: 90,
    textAlignVertical: 'top',
  },
  formCodeInput: {
    fontFamily: 'monospace',
    fontSize: 12,
  },
  formRow: {
    flexDirection: 'row',
  },
  severityPickerRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  severityOption: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
    alignItems: 'center',
  },
  severityOptionSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  severityOptionText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  severityOptionTextSelected: {
    color: COLORS.textInverse,
    fontWeight: '700',
  },
  submitButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 8,
    gap: 8,
    marginTop: 8,
  },
  submitButtonText: {
    color: COLORS.textInverse,
    fontWeight: '700',
    fontSize: 14,
  },
  promptOverlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 7, 10, 0.85)',
    justifyContent: 'center',
    padding: 20,
  },
  promptCard: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.surfaceBorder,
    borderWidth: 1,
    borderRadius: 14,
    padding: 20,
  },
  promptTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  promptSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 16,
  },
  promptActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 8,
  },
  promptCancel: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: 8,
  },
  promptCancelText: {
    color: COLORS.textSecondary,
    fontWeight: '600',
    fontSize: 13,
  },
  promptSubmit: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    backgroundColor: COLORS.success,
    borderRadius: 8,
  },
  promptSubmitText: {
    color: COLORS.textInverse,
    fontWeight: '700',
    fontSize: 13,
  },
  hindsightNotice: {
    flexDirection: 'row',
    backgroundColor: COLORS.hindsightCyanMuted,
    padding: 12,
    borderRadius: 8,
    gap: 8,
    marginBottom: 16,
    alignItems: 'center',
  },
  hindsightNoticeText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.hindsightCyan,
    lineHeight: 16,
    fontWeight: '600',
  },
});
