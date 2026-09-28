import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme/colors';

export default function EngineerConfirmationModal({
  visible,
  actionTitle,
  actionDescription,
  serviceName,
  runbookName,
  riskLevel = 'HIGH',
  onConfirm,
  onCancel,
  loading = false,
}) {
  const [acknowledged, setAcknowledged] = useState(false);

  const handleConfirm = () => {
    if (acknowledged && !loading) {
      onConfirm();
    }
  };

  const handleClose = () => {
    setAcknowledged(false);
    onCancel();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          {/* Header Warning */}
          <View style={styles.header}>
            <View style={styles.warningIconBg}>
              <Ionicons name="shield-checkmark" size={26} color={COLORS.warning} />
            </View>
            <View style={styles.headerText}>
              <Text style={styles.headerTitle}>Engineer Confirmation Required</Text>
              <Text style={styles.headerSubtitle}>Production Safety Guardrail</Text>
            </View>
          </View>

          {/* Action Details */}
          <View style={styles.body}>
            <View style={styles.riskBadge}>
              <Ionicons name="warning-outline" size={14} color={COLORS.critical} />
              <Text style={styles.riskText}>Risk Level: {riskLevel}</Text>
            </View>

            <Text style={styles.actionTitle}>{actionTitle || 'Execute Remediation Action'}</Text>

            {actionDescription ? (
              <Text style={styles.actionDescription}>{actionDescription}</Text>
            ) : null}

            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Target Service:</Text>
              <Text style={styles.metaValue}>{serviceName || 'Production System'}</Text>
            </View>

            {runbookName ? (
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Runbook:</Text>
                <Text style={styles.metaValueCode}>{runbookName}</Text>
              </View>
            ) : null}

            {/* Guardrail Policy Notice */}
            <View style={styles.policyNotice}>
              <Ionicons name="information-circle-outline" size={16} color={COLORS.textSecondary} />
              <Text style={styles.policyText}>
                RECALLA never executes production actions autonomously. You are confirming that you have verified telemetry and authorize this change.
              </Text>
            </View>

            {/* Acknowledgment Switch */}
            <View style={styles.switchRow}>
              <Switch
                value={acknowledged}
                onValueChange={setAcknowledged}
                trackColor={{ false: COLORS.border, true: COLORS.primary }}
                thumbColor={acknowledged ? COLORS.textPrimary : COLORS.textMuted}
              />
              <Text style={styles.switchLabel}>
                I confirm this remediation action on production.
              </Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleClose}
              disabled={loading}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.confirmButton,
                (!acknowledged || loading) && styles.confirmButtonDisabled,
              ]}
              onPress={handleConfirm}
              disabled={!acknowledged || loading}
            >
              {loading ? (
                <ActivityIndicator color={COLORS.textInverse} size="small" />
              ) : (
                <>
                  <Ionicons name="flash" size={16} color={COLORS.textInverse} />
                  <Text style={styles.confirmText}>Authorize & Execute</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 7, 10, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSubtle,
    backgroundColor: COLORS.backgroundSecondary,
  },
  warningIconBg: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(219, 109, 40, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  headerSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  body: {
    padding: 20,
  },
  riskBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.criticalBg,
    borderColor: COLORS.criticalBorder,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 12,
    gap: 6,
  },
  riskText: {
    color: COLORS.critical,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  actionDescription: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
    marginBottom: 14,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSubtle,
  },
  metaLabel: {
    fontSize: 13,
    color: COLORS.textMuted,
  },
  metaValue: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  metaValueCode: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: COLORS.primary,
    backgroundColor: COLORS.backgroundSecondary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  policyNotice: {
    flexDirection: 'row',
    backgroundColor: COLORS.backgroundSecondary,
    padding: 12,
    borderRadius: 10,
    marginTop: 14,
    alignItems: 'flex-start',
    gap: 8,
  },
  policyText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 16,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderSubtle,
    gap: 12,
  },
  switchLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderSubtle,
    backgroundColor: COLORS.backgroundSecondary,
    gap: 12,
  },
  cancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: COLORS.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
    gap: 6,
  },
  confirmButtonDisabled: {
    backgroundColor: COLORS.border,
    opacity: 0.6,
  },
  confirmText: {
    color: COLORS.textInverse,
    fontSize: 13,
    fontWeight: '700',
  },
});
