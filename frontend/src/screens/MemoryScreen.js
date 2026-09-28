import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme/colors';
import { memoryApi } from '../api/client';

const SAMPLE_QUERIES = [
  'payment database connection timeout',
  'JWT secret rotation grace period',
  'API gateway upstream timeout JVM',
  'bulk migration deadlock postgres',
];

export default function MemoryScreen() {
  const [stats, setStats] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMemoryStats();
  }, []);

  const loadMemoryStats = async () => {
    try {
      const data = await memoryApi.getStats();
      setStats(data);
      // Run initial search
      handleSearch('database connection timeout');
    } catch (err) {
      console.warn('Failed to load memory stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (queryText = searchQuery) => {
    const q = (queryText || searchQuery).trim();
    if (!q) return;

    setSearching(true);
    setSearchQuery(q);
    try {
      const res = await memoryApi.search(q);
      setSearchResults(res.memories || []);
    } catch (err) {
      console.warn('Memory search error:', err);
    } finally {
      setSearching(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.iconBox}>
            <Ionicons name="hardware-chip" size={20} color={COLORS.hindsightCyan} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>HINDSIGHT MEMORY EXPLORER</Text>
            <Text style={styles.headerSubtitle}>
              Continuous long-term memory system by Vectorize
            </Text>
          </View>
        </View>

        {/* Bank Details */}
        <View style={styles.bankInfoCard}>
          <View style={styles.bankInfoItem}>
            <Text style={styles.bankInfoLabel}>MEMORY BANK ID</Text>
            <Text style={styles.bankInfoValue}>{stats?.bank_id || 'incident-response-agent'}</Text>
          </View>
          <View style={styles.bankInfoDivider} />
          <View style={styles.bankInfoItem}>
            <Text style={styles.bankInfoLabel}>TOTAL MEMORIES</Text>
            <Text style={[styles.bankInfoValue, { color: COLORS.hindsightCyan }]}>
              {stats?.total_memories || 10} Units
            </Text>
          </View>
          <View style={styles.bankInfoDivider} />
          <View style={styles.bankInfoItem}>
            <Text style={styles.bankInfoLabel}>STATUS</Text>
            <Text style={[styles.bankInfoValue, { color: COLORS.success }]}>
              {stats?.hindsight_status?.toUpperCase() || 'HEALTHY'}
            </Text>
          </View>
        </View>
      </View>

      {/* Memory to Decision Visualization Flow */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>HINDSIGHT AGENTIC MEMORY CYCLE</Text>

        <View style={styles.flowContainer}>
          <View style={styles.flowStep}>
            <View style={[styles.flowIconBox, { borderColor: COLORS.critical }]}>
              <Ionicons name="alert-circle" size={18} color={COLORS.critical} />
            </View>
            <Text style={styles.flowStepTitle}>New Incident</Text>
            <Text style={styles.flowStepDesc}>Telemetry & Symptoms</Text>
          </View>

          <Ionicons name="arrow-forward" size={14} color={COLORS.textMuted} style={styles.flowArrow} />

          <View style={styles.flowStep}>
            <View style={[styles.flowIconBox, { borderColor: COLORS.primary }]}>
              <Ionicons name="search" size={18} color={COLORS.primary} />
            </View>
            <Text style={styles.flowStepTitle}>Recall</Text>
            <Text style={styles.flowStepDesc}>BM25 + Semantic</Text>
          </View>

          <Ionicons name="arrow-forward" size={14} color={COLORS.textMuted} style={styles.flowArrow} />

          <View style={styles.flowStep}>
            <View style={[styles.flowIconBox, { borderColor: COLORS.aiPurple }]}>
              <Ionicons name="bulb" size={18} color={COLORS.aiPurple} />
            </View>
            <Text style={styles.flowStepTitle}>Reflect</Text>
            <Text style={styles.flowStepDesc}>Root Cause Synthesis</Text>
          </View>

          <Ionicons name="arrow-forward" size={14} color={COLORS.textMuted} style={styles.flowArrow} />

          <View style={styles.flowStep}>
            <View style={[styles.flowIconBox, { borderColor: COLORS.hindsightCyan }]}>
              <Ionicons name="save" size={18} color={COLORS.hindsightCyan} />
            </View>
            <Text style={styles.flowStepTitle}>Retain</Text>
            <Text style={styles.flowStepDesc}>Post-Mortem Lessons</Text>
          </View>
        </View>
      </View>

      {/* Interactive Search Bar */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>SEARCH LONG-TERM MEMORY</Text>

        <View style={styles.searchBox}>
          <Ionicons name="search" size={16} color={COLORS.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search symptoms, root causes, runbooks..."
            placeholderTextColor={COLORS.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={() => handleSearch()}
          />
          {searching ? (
            <ActivityIndicator size="small" color={COLORS.hindsightCyan} />
          ) : (
            <TouchableOpacity onPress={() => handleSearch()} style={styles.searchActionBtn}>
              <Text style={styles.searchActionText}>Recall</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Preset Query Chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.queryChips}>
          {SAMPLE_QUERIES.map((sample) => (
            <TouchableOpacity
              key={sample}
              style={styles.queryChip}
              onPress={() => handleSearch(sample)}
            >
              <Text style={styles.queryChipText}>{sample}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Recalled Memory Units Feed */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>RECALLED MEMORIES ({searchResults.length})</Text>
          <Text style={styles.multiStrategyBadge}>Multi-Strategy BM25 + Vector</Text>
        </View>

        {searchResults.map((memoryText, idx) => {
          const isPostMortem = memoryText.startsWith('POST-MORTEM');
          return (
            <View key={idx} style={[styles.memoryCard, isPostMortem && styles.memoryCardPM]}>
              <View style={styles.memoryCardHeader}>
                <View style={[styles.typeBadge, isPostMortem && styles.typeBadgePM]}>
                  <Ionicons
                    name={isPostMortem ? 'school' : 'alert-circle'}
                    size={12}
                    color={isPostMortem ? COLORS.hindsightCyan : COLORS.primary}
                  />
                  <Text style={[styles.typeText, isPostMortem && styles.typeTextPM]}>
                    {isPostMortem ? 'POST-MORTEM LEARNING' : 'RETAINED INCIDENT'}
                  </Text>
                </View>
                <Text style={styles.memoryIndex}>#{idx + 1}</Text>
              </View>

              <Text style={styles.memoryContent}>{memoryText}</Text>
            </View>
          );
        })}
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
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: COLORS.hindsightCyanMuted,
    justifyContent: 'center',
    alignItems: 'center',
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
    marginTop: 2,
  },
  bankInfoCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderColor: COLORS.surfaceBorder,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  bankInfoItem: {
    flex: 1,
    alignItems: 'center',
  },
  bankInfoLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.textMuted,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  bankInfoValue: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  bankInfoDivider: {
    width: 1,
    backgroundColor: COLORS.borderSubtle,
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
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.textSecondary,
    letterSpacing: 1,
    marginBottom: 10,
  },
  multiStrategyBadge: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.hindsightCyan,
  },
  flowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    borderColor: COLORS.surfaceBorder,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  flowStep: {
    alignItems: 'center',
    flex: 1,
  },
  flowIconBox: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    backgroundColor: COLORS.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  flowStepTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  flowStepDesc: {
    fontSize: 9,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 2,
  },
  flowArrow: {
    marginHorizontal: -4,
    marginBottom: 16,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderColor: COLORS.surfaceBorder,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 13,
  },
  searchActionBtn: {
    backgroundColor: COLORS.hindsightCyanMuted,
    borderColor: COLORS.hindsightCyan,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  searchActionText: {
    color: COLORS.hindsightCyan,
    fontWeight: '700',
    fontSize: 11,
  },
  queryChips: {
    flexDirection: 'row',
  },
  queryChip: {
    backgroundColor: COLORS.surfaceElevated,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    marginRight: 8,
  },
  queryChipText: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  memoryCard: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.surfaceBorder,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  memoryCardPM: {
    borderColor: 'rgba(57, 197, 207, 0.4)',
    backgroundColor: COLORS.surfaceElevated,
  },
  memoryCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primaryMuted,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 6,
  },
  typeBadgePM: {
    backgroundColor: COLORS.hindsightCyanMuted,
  },
  typeText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.primary,
    letterSpacing: 0.5,
  },
  typeTextPM: {
    color: COLORS.hindsightCyan,
  },
  memoryIndex: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontFamily: 'monospace',
  },
  memoryContent: {
    fontSize: 12,
    color: COLORS.textPrimary,
    lineHeight: 18,
    fontFamily: 'monospace',
  },
});
