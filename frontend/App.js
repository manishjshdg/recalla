import React, { useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar as RNStatusBar,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
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

export default function App() {
  const [activeTab, setActiveTab] = useState('Operations');
  const [selectedIncidentForDetail, setSelectedIncidentForDetail] = useState(null);
  const [targetIncidentForAI, setTargetIncidentForAI] = useState(null);

  const handleSelectIncidentFromOps = (incident) => {
    setSelectedIncidentForDetail(incident);
    setActiveTab('Incidents');
  };

  const handleInvestigateIncident = (incident) => {
    setTargetIncidentForAI(incident);
    setActiveTab('AI Agent');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" backgroundColor={COLORS.background} />

      {/* Screen Container */}
      <View style={styles.screenContainer}>
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

      {/* Bottom Navigation Bar */}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight : 0,
  },
  screenContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: COLORS.backgroundSecondary,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderSubtle,
    paddingVertical: 8,
    paddingHorizontal: 6,
    justifyContent: 'space-around',
    alignItems: 'center',
    height: 60,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
