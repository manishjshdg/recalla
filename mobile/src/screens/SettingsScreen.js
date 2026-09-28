import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme/colors';
import { getApiBaseUrl, setApiBaseUrl, healthApi } from '../api/client';

export default function SettingsScreen() {
  const [apiUrl, setApiUrl] = useState(getApiBaseUrl());
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  useEffect(() => {
    setApiUrl(getApiBaseUrl());
  }, []);

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    const start = Date.now();
    try {
      setApiBaseUrl(apiUrl);
      const res = await healthApi.check();
      const latency = Date.now() - start;
      setTestResult({
        success: true,
        latency,
        data: res,
      });
    } catch (err) {
      setTestResult({
        success: false,
        error: err.message,
      });
    } finally {
      setTesting(false);
    }
  };

  const handleApplyPreset = (url) => {
    setApiUrl(url);
    setApiBaseUrl(url);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Ionicons name="settings-sharp" size={20} color={COLORS.primary} />
          <Text style={styles.headerTitle}>SETTINGS & CONFIGURATION</Text>
        </View>
        <Text style={styles.headerSubtitle}>
          Backend API endpoints, Hindsight connection, and safety policies
        </Text>
      </View>

      {/* Backend API Configuration */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>BACKEND SERVER URL</Text>

        <View style={styles.card}>
          <Text style={styles.cardHint}>
            Configure the FastAPI server endpoint. For Android emulators use 10.0.2.2:8000.
          </Text>

          <TextInput
            style={styles.input}
            value={apiUrl}
            onChangeText={setApiUrl}
            placeholder="http://localhost:8000"
            placeholderTextColor={COLORS.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
          />

          {/* Quick presets */}
          <View style={styles.presetRow}>
            <TouchableOpacity
              style={styles.presetBtn}
              onPress={() => handleApplyPreset('http://localhost:8000')}
            >
              <Text style={styles.presetText}>localhost:8000</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.presetBtn}
              onPress={() => handleApplyPreset('http://10.0.2.2:8000')}
            >
              <Text style={styles.presetText}>10.0.2.2:8000 (Android)</Text>
            </TouchableOpacity>
          </View>

          {/* Test Connection Button */}
          <TouchableOpacity
            style={styles.testBtn}
            onPress={handleTestConnection}
            disabled={testing}
          >
            {testing ? (
              <ActivityIndicator color={COLORS.textInverse} size="small" />
            ) : (
              <>
                <Ionicons name="wifi" size={16} color={COLORS.textInverse} />
                <Text style={styles.testBtnText}>Test Server Connection</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Test Result feedback */}
          {testResult ? (
            <View
              style={[
                styles.resultBox,
                testResult.success ? styles.resultBoxSuccess : styles.resultBoxError,
              ]}
            >
              <Ionicons
                name={testResult.success ? 'checkmark-circle' : 'alert-circle'}
                size={16}
                color={testResult.success ? COLORS.success : COLORS.critical}
              />
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.resultTitle,
                    { color: testResult.success ? COLORS.success : COLORS.critical },
                  ]}
                >
                  {testResult.success
                    ? `Connected (${testResult.latency}ms)`
                    : 'Connection Failed'}
                </Text>
                <Text style={styles.resultDetails}>
                  {testResult.success
                    ? `API: ${testResult.data.api} | DB: ${testResult.data.database} | Hindsight: ${testResult.data.hindsight}`
                    : testResult.error}
                </Text>
              </View>
            </View>
          ) : null}
        </View>
      </View>

      {/* Hindsight Memory Config */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>HINDSIGHT BY VECTORIZE</Text>

        <View style={styles.card}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Memory Bank ID</Text>
            <Text style={styles.infoValue}>incident-response-agent</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Multi-Strategy Mode</Text>
            <Text style={styles.infoValue}>Semantic + BM25 + Recency</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Synthesis Mode</Text>
            <Text style={styles.infoValue}>Reflect (Root Cause Reasoning)</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Learning Pipeline</Text>
            <Text style={styles.infoValue}>Post-Mortem Retain</Text>
          </View>
        </View>
      </View>

      {/* SRE Production Guardrails */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ENTERPRISE SAFETY POLICIES</Text>

        <View style={styles.card}>
          <View style={styles.policyItem}>
            <Ionicons name="shield-checkmark" size={18} color={COLORS.success} />
            <View style={{ flex: 1 }}>
              <Text style={styles.policyTitle}>Human-in-the-Loop Confirmation</Text>
              <Text style={styles.policyDesc}>
                Remediation actions require explicit engineer authorization before execution.
              </Text>
            </View>
          </View>

          <View style={styles.policyDivider} />

          <View style={styles.policyItem}>
            <Ionicons name="eye-outline" size={18} color={COLORS.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.policyTitle}>Provenance Separation</Text>
              <Text style={styles.policyDesc}>
                Historical evidence from Hindsight is strictly separated from AI-generated reasoning.
              </Text>
            </View>
          </View>

          <View style={styles.policyDivider} />

          <View style={styles.policyItem}>
            <Ionicons name="repeat-outline" size={18} color={COLORS.aiPurple} />
            <View style={{ flex: 1 }}>
              <Text style={styles.policyTitle}>Continuous Retain Cycle</Text>
              <Text style={styles.policyDesc}>
                Every resolved incident produces post-mortem learnings to accelerate future recoveries.
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* App Version Info */}
      <View style={styles.appInfo}>
        <Text style={styles.appInfoText}>RECALLA Incident Intelligence Platform • v1.0.0</Text>
        <Text style={styles.appInfoSub}>Native React Native & Expo • Android + iOS</Text>
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
  header: {
    marginBottom: 20,
  },
  headerRow: {
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
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.textSecondary,
    letterSpacing: 1,
    marginBottom: 10,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.surfaceBorder,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  cardHint: {
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 16,
    marginBottom: 12,
  },
  input: {
    backgroundColor: COLORS.backgroundSecondary,
    borderColor: COLORS.borderSubtle,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: COLORS.textPrimary,
    fontSize: 13,
    fontFamily: 'monospace',
    marginBottom: 10,
  },
  presetRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  presetBtn: {
    backgroundColor: COLORS.surfaceElevated,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
  },
  presetText: {
    fontSize: 11,
    color: COLORS.primary,
    fontWeight: '600',
  },
  testBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  testBtnText: {
    color: COLORS.textInverse,
    fontWeight: '700',
    fontSize: 13,
  },
  resultBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 10,
    borderRadius: 8,
    marginTop: 12,
    gap: 8,
  },
  resultBoxSuccess: {
    backgroundColor: COLORS.successBg,
    borderColor: COLORS.successBorder,
    borderWidth: 1,
  },
  resultBoxError: {
    backgroundColor: COLORS.criticalBg,
    borderColor: COLORS.criticalBorder,
    borderWidth: 1,
  },
  resultTitle: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  resultDetails: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSubtle,
  },
  infoLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  infoValue: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textPrimary,
    fontFamily: 'monospace',
  },
  policyItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 4,
  },
  policyTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  policyDesc: {
    fontSize: 11,
    color: COLORS.textSecondary,
    lineHeight: 16,
  },
  policyDivider: {
    height: 1,
    backgroundColor: COLORS.borderSubtle,
    marginVertical: 10,
  },
  appInfo: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  appInfoText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  appInfoSub: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 2,
  },
});
