import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme/colors';
import { SeverityBadge } from '../components/Badge';
import EngineerConfirmationModal from '../components/EngineerConfirmationModal';
import { incidentsApi, runbooksApi } from '../api/client';

export default function AIAgentScreen({ targetIncident, onSelectIncident }) {
  const [incidents, setIncidents] = useState([]);
  const [selectedIncident, setSelectedIncident] = useState(targetIncident || null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState(0);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [selectedRunbook, setSelectedRunbook] = useState(null);

  // Safety confirmation modal state
  const [safetyModalVisible, setSafetyModalVisible] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [executingAction, setExecutingAction] = useState(false);
  const [completedActions, setCompletedActions] = useState([]);

  useEffect(() => {
    fetchIncidents();
  }, []);

  useEffect(() => {
    if (targetIncident) {
      setSelectedIncident(targetIncident);
      // Auto-analyze if fresh
      if (!analysisResult) {
        runInvestigation(targetIncident);
      }
    }
  }, [targetIncident]);

  const fetchIncidents = async () => {
    try {
      const list = await incidentsApi.list();
      setIncidents(list);
      if (!selectedIncident && list.length > 0) {
        setSelectedIncident(list[0]);
      }
    } catch (err) {
      console.warn('Failed to fetch incidents in AI Agent:', err);
    }
  };

  const runInvestigation = async (incidentToAnalyze = selectedIncident) => {
    if (!incidentToAnalyze) {
      Alert.alert('Selection Required', 'Please select an incident to investigate.');
      return;
    }

    setAnalyzing(true);
    setAnalysisStep(1);
    setAnalysisResult(null);
    setCompletedActions([]);

    // Staged progression animation
    const stepTimer1 = setTimeout(() => setAnalysisStep(2), 500);
    const stepTimer2 = setTimeout(() => setAnalysisStep(3), 1100);

    try {
      const result = await incidentsApi.analyze(incidentToAnalyze.incident_id || incidentToAnalyze.id);
      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);
      setAnalysisStep(4);
      setTimeout(() => {
        setAnalysisResult(result);
        setAnalyzing(false);

        // Fetch runbook if recommended
        if (result.recommended_runbook) {
          fetchRunbook(result.recommended_runbook);
        }
      }, 400);
    } catch (err) {
      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);
      setAnalyzing(false);
      Alert.alert('Analysis Failed', err.message || 'Error communicating with Hindsight AI Agent');
    }
  };

  const fetchRunbook = async (name) => {
    try {
      const rb = await runbooksApi.get(name);
      setSelectedRunbook(rb);
    } catch (err) {
      console.debug('Runbook details fetch error:', err);
    }
  };

  // Trigger safety confirmation before any remediation step
  const handleRequestActionExecution = (actionText, index) => {
    setPendingAction({ text: actionText, index });
    setSafetyModalVisible(true);
  };

  const handleConfirmActionExecution = () => {
    setExecutingAction(true);
    setTimeout(() => {
      setExecutingAction(false);
      setSafetyModalVisible(false);
      if (pendingAction) {
        setCompletedActions((prev) => [...prev, pendingAction.index]);
        Alert.alert(
          'Remediation Action Authorized',
          `Executed: "${pendingAction.text}". Production telemetry is being monitored for latency recovery.`
        );
      }
    }, 1000);
  };

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Ionicons name="sparkles" size={20} color={COLORS.aiPurple} />
          <Text style={styles.headerTitle}>HINDSIGHT AI INVESTIGATOR</Text>
        </View>
        <Text style={styles.headerSubtitle}>
          Memory-augmented root cause analysis & evidence-based runbooks
        </Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Incident Selector Drawer / Picker */}
        <View style={styles.selectorCard}>
          <Text style={styles.selectorLabel}>TARGET PRODUCTION INCIDENT</Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.incidentChips}>
            {incidents.map((inc) => {
              const active = selectedIncident?.incident_id === inc.incident_id;
              return (
                <TouchableOpacity
                  key={inc.id || inc.incident_id}
                  style={[styles.incidentChip, active && styles.incidentChipActive]}
                  onPress={() => {
                    setSelectedIncident(inc);
                    setAnalysisResult(null);
                  }}
                >
                  <Text style={[styles.incidentChipId, active && styles.incidentChipIdActive]}>
                    {inc.incident_id}
                  </Text>
                  <Text style={styles.incidentChipService} numberOfLines={1}>
                    {inc.service}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {selectedIncident ? (
            <View style={styles.selectedIncidentPreview}>
              <View style={styles.previewTop}>
                <SeverityBadge severity={selectedIncident.severity} size="small" />
                <Text style={styles.previewService}>{selectedIncident.service}</Text>
                <Text style={styles.previewId}>{selectedIncident.incident_id}</Text>
              </View>
              <Text style={styles.previewSymptoms} numberOfLines={2}>
                {selectedIncident.symptoms}
              </Text>
            </View>
          ) : null}

          {/* Investigate CTA Button */}
          <TouchableOpacity
            style={[styles.investigateBtn, analyzing && styles.investigateBtnDisabled]}
            onPress={() => runInvestigation(selectedIncident)}
            disabled={analyzing}
          >
            {analyzing ? (
              <ActivityIndicator color={COLORS.textInverse} size="small" />
            ) : (
              <>
                <Ionicons name="hardware-chip-outline" size={18} color={COLORS.textInverse} />
                <Text style={styles.investigateBtnText}>
                  {analysisResult ? 'Re-Run Memory Investigation' : 'Recall Past Incidents & Diagnose'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Live Multi-Stage Investigation Progress */}
        {analyzing ? (
          <View style={styles.progressCard}>
            <Text style={styles.progressTitle}>AGENTIC RETRIEVAL IN PROGRESS</Text>
            <View style={styles.stepList}>
              <View style={styles.stepRow}>
                <View style={styles.stepDot(analysisStep >= 1)}>
                  {analysisStep > 1 ? (
                    <Ionicons name="checkmark" size={10} color={COLORS.textInverse} />
                  ) : (
                    <ActivityIndicator size="small" color={COLORS.primary} />
                  )}
                </View>
                <Text style={styles.stepText(analysisStep >= 1)}>
                  1. Querying Hindsight Long-term Memory Bank (Retained Incidents)
                </Text>
              </View>

              <View style={styles.stepRow}>
                <View style={styles.stepDot(analysisStep >= 2)}>
                  {analysisStep > 2 ? (
                    <Ionicons name="checkmark" size={10} color={COLORS.textInverse} />
                  ) : analysisStep === 2 ? (
                    <ActivityIndicator size="small" color={COLORS.primary} />
                  ) : null}
                </View>
                <Text style={styles.stepText(analysisStep >= 2)}>
                  2. Multi-Strategy Scoring (Semantic Vector + BM25 Keywords)
                </Text>
              </View>

              <View style={styles.stepRow}>
                <View style={styles.stepDot(analysisStep >= 3)}>
                  {analysisStep > 3 ? (
                    <Ionicons name="checkmark" size={10} color={COLORS.textInverse} />
                  ) : analysisStep === 3 ? (
                    <ActivityIndicator size="small" color={COLORS.primary} />
                  ) : null}
                </View>
                <Text style={styles.stepText(analysisStep >= 3)}>
                  3. Reflecting on Root Cause & Post-Mortem Learnings
                </Text>
              </View>

              <View style={styles.stepRow}>
                <View style={styles.stepDot(analysisStep >= 4)}>
                  {analysisStep >= 4 ? (
                    <Ionicons name="checkmark" size={10} color={COLORS.textInverse} />
                  ) : null}
                </View>
                <Text style={styles.stepText(analysisStep >= 4)}>
                  4. Synthesizing Evidence-Grounded Runbook Recommendation
                </Text>
              </View>
            </View>
          </View>
        ) : null}

        {/* Investigation Results */}
        {analysisResult && !analyzing ? (
          <View style={styles.resultsContainer}>
            {/* Root Cause & Confidence Banner */}
            <View style={styles.rootCauseCard}>
              <View style={styles.confidenceRow}>
                <View style={styles.confidencePill(analysisResult.confidence)}>
                  <Ionicons name="shield-checkmark" size={13} color={COLORS.success} />
                  <Text style={styles.confidencePillText}>
                    {analysisResult.confidence?.toUpperCase()} CONFIDENCE (
                    {Math.round(analysisResult.confidence_score * 100)}%)
                  </Text>
                </View>

                {analysisResult.estimated_recovery_time ? (
                  <View style={styles.mttrPill}>
                    <Ionicons name="timer-outline" size={13} color={COLORS.primary} />
                    <Text style={styles.mttrPillText}>
                      Est: {analysisResult.estimated_recovery_time}
                    </Text>
                  </View>
                ) : null}
              </View>

              <Text style={styles.rootCauseHeading}>LIKELY ROOT CAUSE</Text>
              <Text style={styles.rootCauseValue}>{analysisResult.likely_root_cause}</Text>

              {analysisResult.why_this_recommendation ? (
                <View style={styles.whyBox}>
                  <Text style={styles.whyLabel}>WHY THIS RECOMMENDATION:</Text>
                  <Text style={styles.whyText}>{analysisResult.why_this_recommendation}</Text>
                </View>
              ) : null}
            </View>

            {/* Recalled Similar Incidents from Hindsight */}
            <View style={styles.resultSection}>
              <View style={styles.resultSectionHeader}>
                <Ionicons name="hardware-chip-outline" size={16} color={COLORS.hindsightCyan} />
                <Text style={styles.resultSectionTitle}>
                  HINDSIGHT RECALLED HISTORICAL INCIDENTS ({analysisResult.similar_incidents?.length || 0})
                </Text>
              </View>

              {analysisResult.similar_incidents?.map((similar, idx) => (
                <View key={similar.incident_id || idx} style={styles.similarCard}>
                  <View style={styles.similarHeader}>
                    <SeverityBadge severity={similar.severity} size="small" />
                    <Text style={styles.similarId}>{similar.incident_id}</Text>
                    <View style={styles.relevanceBadge}>
                      <Text style={styles.relevanceText}>{similar.relevance_label}</Text>
                    </View>
                  </View>

                  <Text style={styles.similarService}>{similar.service}</Text>
                  <Text style={styles.similarSymptoms} numberOfLines={2}>
                    {similar.symptoms}
                  </Text>

                  {similar.root_cause ? (
                    <Text style={styles.similarRootCause}>
                      <Text style={{ fontWeight: '700', color: COLORS.textSecondary }}>Cause: </Text>
                      {similar.root_cause}
                    </Text>
                  ) : null}

                  {similar.resolution ? (
                    <View style={styles.provenFixBox}>
                      <Ionicons name="checkmark-circle-outline" size={13} color={COLORS.success} />
                      <Text style={styles.provenFixText} numberOfLines={2}>
                        <Text style={{ fontWeight: '700' }}>Proven Fix: </Text>
                        {similar.resolution}
                      </Text>
                    </View>
                  ) : null}
                </View>
              ))}
            </View>

            {/* Recommended Runbook & Step-by-Step Remediation Actions */}
            <View style={styles.resultSection}>
              <View style={styles.resultSectionHeader}>
                <Ionicons name="book-outline" size={16} color={COLORS.primary} />
                <Text style={styles.resultSectionTitle}>RECOMMENDED RUNBOOK ACTIONS</Text>
              </View>

              {analysisResult.recommended_runbook ? (
                <View style={styles.runbookBanner}>
                  <View>
                    <Text style={styles.runbookBannerLabel}>ACTIVE RUNBOOK</Text>
                    <Text style={styles.runbookBannerTitle}>
                      {analysisResult.recommended_runbook}
                    </Text>
                  </View>
                  <Ionicons name="shield-checkmark-outline" size={22} color={COLORS.primary} />
                </View>
              ) : null}

              {/* Guardrail Safety Warning */}
              <View style={styles.guardrailNotice}>
                <Ionicons name="lock-closed" size={14} color={COLORS.warning} />
                <Text style={styles.guardrailText}>
                  Human-in-the-Loop: Production changes require engineer authorization.
                </Text>
              </View>

              {/* Action Execution Checklist */}
              {analysisResult.recommended_actions?.map((action, idx) => {
                const isCompleted = completedActions.includes(idx);
                return (
                  <View key={idx} style={styles.actionItem}>
                    <View style={styles.actionNumberBox(isCompleted)}>
                      {isCompleted ? (
                        <Ionicons name="checkmark" size={12} color={COLORS.textInverse} />
                      ) : (
                        <Text style={styles.actionNumber}>{idx + 1}</Text>
                      )}
                    </View>

                    <Text style={[styles.actionItemText, isCompleted && styles.actionItemTextDone]}>
                      {action}
                    </Text>

                    <TouchableOpacity
                      style={[
                        styles.executeStepBtn,
                        isCompleted && styles.executeStepBtnDone,
                      ]}
                      onPress={() => handleRequestActionExecution(action, idx)}
                      disabled={isCompleted}
                    >
                      <Text
                        style={[
                          styles.executeStepText,
                          isCompleted && styles.executeStepTextDone,
                        ]}
                      >
                        {isCompleted ? 'Authorized' : 'Authorize'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>

            {/* Historical Evidence & Provenance */}
            <View style={styles.resultSection}>
              <View style={styles.resultSectionHeader}>
                <Ionicons name="document-text-outline" size={16} color={COLORS.textSecondary} />
                <Text style={styles.resultSectionTitle}>HISTORICAL EVIDENCE & PROVENANCE</Text>
              </View>

              <View style={styles.evidenceBox}>
                <Text style={styles.evidenceText}>
                  {analysisResult.historical_evidence ||
                    'All insights derived directly from Hindsight memory bank memories.'}
                </Text>
              </View>
            </View>
          </View>
        ) : null}
      </ScrollView>

      {/* Engineer Production Confirmation Modal */}
      <EngineerConfirmationModal
        visible={safetyModalVisible}
        actionTitle={pendingAction?.text}
        serviceName={selectedIncident?.service}
        runbookName={analysisResult?.recommended_runbook}
        riskLevel="CRITICAL CHANGE"
        loading={executingAction}
        onConfirm={handleConfirmActionExecution}
        onCancel={() => setSafetyModalVisible(false)}
      />
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
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.textPrimary,
    letterSpacing: 1,
  },
  headerSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  selectorCard: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.surfaceBorder,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  selectorLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  incidentChips: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  incidentChip: {
    backgroundColor: COLORS.backgroundSecondary,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    minWidth: 100,
  },
  incidentChipActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryMuted,
  },
  incidentChipId: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
    fontFamily: 'monospace',
  },
  incidentChipIdActive: {
    color: COLORS.primary,
  },
  incidentChipService: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginTop: 2,
  },
  selectedIncidentPreview: {
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: 8,
    padding: 12,
    marginBottom: 14,
  },
  previewTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  previewService: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  previewId: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: COLORS.textMuted,
  },
  previewSymptoms: {
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 16,
  },
  investigateBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  investigateBtnDisabled: {
    opacity: 0.6,
  },
  investigateBtnText: {
    color: COLORS.textInverse,
    fontWeight: '700',
    fontSize: 13,
  },
  progressCard: {
    backgroundColor: COLORS.surfaceElevated,
    borderColor: COLORS.aiPurple,
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  progressTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.aiPurple,
    letterSpacing: 1,
    marginBottom: 14,
  },
  stepList: {
    gap: 12,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepDot: (active) => ({
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: active ? COLORS.primary : COLORS.borderSubtle,
    justifyContent: 'center',
    alignItems: 'center',
  }),
  stepText: (active) => ({
    flex: 1,
    fontSize: 12,
    fontWeight: active ? '600' : '400',
    color: active ? COLORS.textPrimary : COLORS.textMuted,
  }),
  resultsContainer: {
    gap: 16,
  },
  rootCauseCard: {
    backgroundColor: COLORS.surfaceElevated,
    borderColor: COLORS.surfaceBorder,
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
  },
  confidenceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  confidencePill: (conf) => ({
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.successBg,
    borderColor: COLORS.successBorder,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 6,
  }),
  confidencePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.success,
  },
  mttrPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primaryMuted,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  mttrPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
  },
  rootCauseHeading: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.textMuted,
    letterSpacing: 1,
    marginBottom: 4,
  },
  rootCauseValue: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    lineHeight: 22,
    marginBottom: 12,
  },
  whyBox: {
    backgroundColor: COLORS.backgroundSecondary,
    padding: 12,
    borderRadius: 8,
  },
  whyLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.aiPurple,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  whyText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 17,
  },
  resultSection: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.surfaceBorder,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  resultSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  resultSectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textSecondary,
    letterSpacing: 0.5,
  },
  similarCard: {
    backgroundColor: COLORS.backgroundSecondary,
    borderColor: COLORS.borderSubtle,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  similarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  similarId: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'monospace',
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  relevanceBadge: {
    backgroundColor: COLORS.primaryMuted,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  relevanceText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
  },
  similarService: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  similarSymptoms: {
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 16,
    marginBottom: 6,
  },
  similarRootCause: {
    fontSize: 12,
    color: COLORS.textPrimary,
    lineHeight: 16,
    marginBottom: 8,
  },
  provenFixBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: 8,
    borderRadius: 6,
    gap: 6,
  },
  provenFixText: {
    flex: 1,
    fontSize: 11,
    color: COLORS.success,
  },
  runbookBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.backgroundSecondary,
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  runbookBannerLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.primary,
    letterSpacing: 0.5,
  },
  runbookBannerTitle: {
    fontSize: 14,
    fontFamily: 'monospace',
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: 2,
  },
  guardrailNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.warningBg,
    padding: 8,
    borderRadius: 6,
    marginBottom: 12,
    gap: 6,
  },
  guardrailText: {
    fontSize: 11,
    color: COLORS.warning,
    fontWeight: '600',
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSubtle,
    gap: 10,
  },
  actionNumberBox: (done) => ({
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: done ? COLORS.success : COLORS.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
  }),
  actionNumber: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  actionItemText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.textPrimary,
    lineHeight: 18,
  },
  actionItemTextDone: {
    textDecorationLine: 'line-through',
    color: COLORS.textMuted,
  },
  executeStepBtn: {
    backgroundColor: COLORS.primaryMuted,
    borderColor: COLORS.primary,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  executeStepBtnDone: {
    backgroundColor: COLORS.surfaceElevated,
    borderColor: COLORS.borderSubtle,
  },
  executeStepText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
  },
  executeStepTextDone: {
    color: COLORS.textMuted,
  },
  evidenceBox: {
    backgroundColor: COLORS.backgroundSecondary,
    padding: 12,
    borderRadius: 8,
  },
  evidenceText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
});
