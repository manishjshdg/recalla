import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from './src/theme/colors';

// Screens
import OperationsScreen from './src/screens/OperationsScreen';
import IncidentsScreen from './src/screens/IncidentsScreen';
import AIAgentScreen from './src/screens/AIAgentScreen';
import MemoryScreen from './src/screens/MemoryScreen';
import SettingsScreen from './src/screens/SettingsScreen';

const TABS = [
  { id: 'Operations', label: 'Operations', icon: 'pulse' },
  { id: 'Incidents', label: 'Incidents', icon: 'alert-circle' },
  { id: 'AI Agent', label: 'AI Agent', icon: 'sparkles' },
  { id: 'Memory', label: 'Memory', icon: 'hardware-chip' },
  { id: 'Settings', label: 'Settings', icon: 'settings-sharp' },
];

// ── TAB_BAR_CONTENT_HEIGHT: the fixed visual height of the bar itself ──
const TAB_BAR_CONTENT_HEIGHT = 60;

function AppInner() {
  const [activeTab, setActiveTab] = useState('Operations');
  const [selectedIncidentForDetail, setSelectedIncidentForDetail] = useState(null);
  const [targetIncidentForAI, setTargetIncidentForAI] = useState(null);

  // Safe-area insets — gives us the real bottom inset for system nav / gesture bar
  const insets = useSafeAreaInsets();

  // Total height the bottom nav occupies (content + bottom system inset)
  const bottomNavHeight = TAB_BAR_CONTENT_HEIGHT + insets.bottom;

  const handleSelectIncidentFromOps = (incident) => {
    setSelectedIncidentForDetail(incident);
    setActiveTab('Incidents');
  };

  const handleInvestigateIncident = (incident) => {
    setTargetIncidentForAI(incident);
    setActiveTab('AI Agent');
  };

  return (
    <View
      style={[
        styles.root,
        // Push content down below the status bar using the top inset
        { paddingTop: insets.top },
      ]}
    >
      <StatusBar style="light" backgroundColor={COLORS.background} />

      {/* Screen content — grows to fill space above the tab bar */}
      <View style={[styles.screenContainer, { paddingBottom: bottomNavHeight }]}>
        {activeTab === 'Operations' && (
          <OperationsScreen
            onSelectIncident={handleSelectIncidentFromOps}
            onNavigateTab={(tab) => setActiveTab(tab)}
          />
        )}

        {activeTab === 'Incidents' && (
          <IncidentsScreen
            selectedIncidentFromProps={selectedIncidentForDetail}
            onInvestigateIncident={handleInvestigateIncident}
            onNavigateTab={(tab) => setActiveTab(tab)}
          />
        )}

        {activeTab === 'AI Agent' && (
          <AIAgentScreen
            targetIncident={targetIncidentForAI}
            onSelectIncident={(inc) => setTargetIncidentForAI(inc)}
          />
        )}

        {activeTab === 'Memory' && <MemoryScreen />}

        {activeTab === 'Settings' && <SettingsScreen />}
      </View>

      {/* ── Bottom Navigation Bar ─────────────────────────────────────── */}
      {/*
        Position: absolute so it sits on top of the scroll content.
        Height = fixed visual area + system bottom inset.
        The tab buttons live only in the top TAB_BAR_CONTENT_HEIGHT portion;
        the remaining space (insets.bottom) is just background fill so the
        system nav/gesture bar area matches the tab-bar colour.
      */}
      <View
        style={[
          styles.bottomNavWrapper,
          {
            height: bottomNavHeight,
            // Keep it pinned to the very bottom of the screen
            bottom: 0,
          },
        ]}
      >
        {/* Visual tab row — exactly TAB_BAR_CONTENT_HEIGHT tall */}
        <View style={styles.bottomNav}>
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            const isAI = tab.id === 'AI Agent';

            return (
              <TouchableOpacity
                key={tab.id}
                style={styles.tabButton}
                onPress={() => setActiveTab(tab.id)}
                activeOpacity={0.7}
              >
                {isAI ? (
                  <View style={[styles.aiTabPill, isActive && styles.aiTabPillActive]}>
                    <Ionicons
                      name={tab.icon}
                      size={16}
                      color={isActive ? COLORS.textInverse : COLORS.aiPurple}
                    />
                    <Text style={[styles.aiTabText, isActive && styles.aiTabTextActive]}>
                      AI Agent
                    </Text>
                  </View>
                ) : (
                  <>
                    <Ionicons
                      name={tab.icon}
                      size={20}
                      color={isActive ? COLORS.primary : COLORS.textMuted}
                    />
                    <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                      {tab.label}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* System-nav-bar fill — same background, no content */}
        {insets.bottom > 0 && (
          <View
            style={[
              styles.systemNavFill,
              { height: insets.bottom },
            ]}
          />
        )}
      </View>
    </View>
  );
}

// ── Root export — always wrap with SafeAreaProvider ───────────────────────────
export default function App() {
  return (
    <SafeAreaProvider>
      <AppInner />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  screenContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    // paddingBottom injected inline = bottomNavHeight
    // This ensures scroll content never hides behind the tab bar
  },

  // ── Bottom nav wrapper (absolute, full width, pinned to bottom) ──
  bottomNavWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    // 'bottom' injected inline
    backgroundColor: COLORS.backgroundSecondary,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderSubtle,
    // Subtle elevation so it reads as floating above content
    ...Platform.select({
      android: { elevation: 12 },
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
      },
    }),
  },

  // ── The actual row of tab buttons ──
  bottomNav: {
    height: TAB_BAR_CONTENT_HEIGHT,
    flexDirection: 'row',
    paddingHorizontal: 6,
    justifyContent: 'space-around',
    alignItems: 'center',
  },

  // ── Filler that colours the Android gesture / nav-button strip ──
  systemNavFill: {
    backgroundColor: COLORS.backgroundSecondary,
    width: '100%',
  },

  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: TAB_BAR_CONTENT_HEIGHT,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.textMuted,
    marginTop: 3,
  },
  tabLabelActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  aiTabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.aiPurpleMuted,
    borderWidth: 1,
    borderColor: COLORS.aiPurple,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 14,
    gap: 4,
  },
  aiTabPillActive: {
    backgroundColor: COLORS.aiPurple,
    borderColor: COLORS.aiPurple,
  },
  aiTabText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.aiPurple,
  },
  aiTabTextActive: {
    color: COLORS.textInverse,
  },
});
