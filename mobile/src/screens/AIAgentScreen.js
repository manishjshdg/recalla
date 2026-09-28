/**
 * AIAgentScreen — Real conversational AI incident-response chat.
 *
 * Connects to POST /api/agent/chat (backend → Gemini → Hindsight → response).
 * Maintains conversation_id across turns for full multi-turn context.
 * No credentials stored here. All AI/Hindsight keys stay on the backend.
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme/colors';
import { agentApi } from '../api/client';

// ─── Message bubble component ──────────────────────────────────────────────
function MessageBubble({ message }) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  if (isSystem) {
    return (
      <View style={styles.systemMsg}>
        <Ionicons name="information-circle-outline" size={14} color={COLORS.textMuted} />
        <Text style={styles.systemMsgText}>{message.content}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.bubbleRow, isUser && styles.bubbleRowUser]}>
      {!isUser && (
        <View style={styles.agentAvatar}>
          <Ionicons name="sparkles" size={14} color={COLORS.aiPurple} />
        </View>
      )}

      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAgent]}>
        <Text style={[styles.bubbleText, isUser ? styles.bubbleTextUser : styles.bubbleTextAgent]}>
          {message.content}
        </Text>

        {/* Memory provenance badge */}
        {message.memoryCount > 0 && (
          <View style={styles.memoryBadge}>
            <Ionicons name="hardware-chip-outline" size={11} color={COLORS.hindsightCyan} />
            <Text style={styles.memoryBadgeText}>
              {message.memoryCount} Hindsight {message.memoryCount === 1 ? 'memory' : 'memories'} retrieved
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

// ─── Context pill strip ────────────────────────────────────────────────────
function ContextStrip({ context }) {
  if (!context?.service && !context?.severity) return null;
  const pills = [];
  if (context.service) pills.push({ icon: 'layers-outline', label: context.service });
  if (context.severity) pills.push({ icon: 'warning-outline', label: context.severity });
  if (context.timeline) pills.push({ icon: 'time-outline', label: context.timeline });

  return (
    <View style={styles.contextStrip}>
      {pills.map((p, i) => (
        <View key={i} style={styles.contextPill}>
          <Ionicons name={p.icon} size={11} color={COLORS.primary} />
          <Text style={styles.contextPillText} numberOfLines={1}>{p.label}</Text>
        </View>
      ))}
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────
export default function AIAgentScreen({ targetIncident, onSelectIncident }) {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [currentContext, setCurrentContext] = useState(null);
  const [agentStatus, setAgentStatus] = useState(null);  // agent /status check
  const [statusLoading, setStatusLoading] = useState(true);

  const scrollRef = useRef(null);

  // ── Load agent status on mount ─────────────────────────────────────────
  useEffect(() => {
    checkAgentStatus();
  }, []);

  // ── If arriving from Incidents with a targetIncident, pre-seed the chat ─
  useEffect(() => {
    if (targetIncident && messages.length === 0) {
      const seedMessage = buildIncidentSeedMessage(targetIncident);
      sendMessage(seedMessage);
    }
  }, [targetIncident]);

  const checkAgentStatus = async () => {
    try {
      const status = await agentApi.status();
      setAgentStatus(status);
    } catch {
      setAgentStatus(null);
    } finally {
      setStatusLoading(false);
    }
  };

  const buildIncidentSeedMessage = (incident) => {
    const parts = [`Incident ${incident.incident_id}: ${incident.service} is experiencing ${incident.symptoms}`];
    if (incident.severity) parts.push(`Severity: ${incident.severity}`);
    if (incident.error_rate) parts.push(`Error rate: ${incident.error_rate}%`);
    if (incident.deployment_version) parts.push(`Deployment: ${incident.deployment_version}`);
    return parts.join('. ');
  };

  const scrollToBottom = () => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const addMessage = useCallback((role, content, extras = {}) => {
    setMessages((prev) => [...prev, { role, content, id: Date.now() + Math.random(), ...extras }]);
    scrollToBottom();
  }, []);

  const sendMessage = async (text = inputText.trim()) => {
    if (!text || sending) return;
    setInputText('');
    setSending(true);

    // Add user message immediately
    addMessage('user', text);

    try {
      const response = await agentApi.chat(text, conversationId, targetIncident?.incident_id || null);

      // Save conversation_id for subsequent turns
      if (!conversationId) {
        setConversationId(response.conversation_id);
      }

      // Update extracted incident context
      if (response.incident_context) {
        setCurrentContext(response.incident_context);
      }

      // Add agent response
      addMessage('assistant', response.agent_message, {
        memoryCount: response.memory_count,
        hindsightSearched: response.hindsight_searched,
      });

    } catch (err) {
      const errCode = err.errorCode;

      if (errCode === 'llm_not_configured') {
        // Show clear configuration error
        addMessage('system',
          '⚠️ AI not configured. Please set GEMINI_API_KEY in backend/.env and restart the server.\n\n' +
          'Get your free key at: https://aistudio.google.com/app/apikey'
        );
      } else if (err.statusCode === 504) {
        addMessage('system', '⏱️ The agent took too long to respond. Please try again.');
      } else {
        addMessage('system', `❌ Error: ${err.message}`);
      }
    } finally {
      setSending(false);
    }
  };

  const handleNewConversation = () => {
    Alert.alert(
      'New Conversation',
      'Start a fresh conversation? Current context will be cleared.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'New Chat',
          onPress: () => {
            setMessages([]);
            setConversationId(null);
            setCurrentContext(null);
          },
        },
      ]
    );
  };

  const STARTER_PROMPTS = [
    'Production API is returning 500 errors.',
    'Login is failing across all services.',
    'Database queries are timing out.',
    'Deployment is causing high latency.',
  ];

  const isConfigured = agentStatus?.llm_configured;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="sparkles" size={18} color={COLORS.aiPurple} />
          <View>
            <Text style={styles.headerTitle}>RECALLA AGENT</Text>
            <Text style={styles.headerSubtitle}>
              {statusLoading
                ? 'Checking configuration...'
                : isConfigured
                ? `Gemini · Hindsight Memory`
                : '⚠️ API key required — see Settings'}
            </Text>
          </View>
        </View>

        {messages.length > 0 && (
          <TouchableOpacity onPress={handleNewConversation} style={styles.newChatBtn}>
            <Ionicons name="add-circle-outline" size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Extracted incident context strip ───────────────────────────── */}
      <ContextStrip context={currentContext} />

      {/* ── Message list ───────────────────────────────────────────────── */}
      <ScrollView
        ref={scrollRef}
        style={styles.messageList}
        contentContainerStyle={styles.messageListContent}
        keyboardShouldPersistTaps="handled"
      >
        {messages.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="chatbubbles-outline" size={48} color={COLORS.borderSubtle} />
            <Text style={styles.emptyTitle}>Describe your incident</Text>
            <Text style={styles.emptySubtitle}>
              Tell me what's happening in plain language.{'\n'}I'll search Hindsight for similar past incidents{'\n'}and help you resolve it faster.
            </Text>

            {/* Starter prompts */}
            <View style={styles.starterPrompts}>
              {STARTER_PROMPTS.map((prompt, i) => (
                <TouchableOpacity
                  key={i}
                  style={styles.starterPrompt}
                  onPress={() => sendMessage(prompt)}
                  disabled={sending}
                >
                  <Text style={styles.starterPromptText}>{prompt}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : (
          messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)
        )}

        {/* Typing indicator */}
        {sending && (
          <View style={styles.typingRow}>
            <View style={styles.agentAvatar}>
              <Ionicons name="sparkles" size={14} color={COLORS.aiPurple} />
            </View>
            <View style={styles.typingBubble}>
              <ActivityIndicator size="small" color={COLORS.aiPurple} />
              <Text style={styles.typingText}>RECALLA is thinking...</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* ── Input bar ──────────────────────────────────────────────────── */}
      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          placeholder={
            isConfigured
              ? 'Describe the incident...'
              : 'Set GEMINI_API_KEY in backend/.env first'
          }
          placeholderTextColor={COLORS.textMuted}
          value={inputText}
          onChangeText={setInputText}
          multiline
          maxLength={2000}
          returnKeyType="send"
          onSubmitEditing={() => sendMessage()}
          editable={!sending && !statusLoading}
        />
        <TouchableOpacity
          style={[
            styles.sendBtn,
            (!inputText.trim() || sending || statusLoading) && styles.sendBtnDisabled,
          ]}
          onPress={() => sendMessage()}
          disabled={!inputText.trim() || sending || statusLoading}
        >
          {sending ? (
            <ActivityIndicator size="small" color={COLORS.textInverse} />
          ) : (
            <Ionicons name="send" size={18} color={COLORS.textInverse} />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSubtle,
    backgroundColor: COLORS.backgroundSecondary,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.textPrimary,
    letterSpacing: 1,
  },
  headerSubtitle: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  newChatBtn: {
    padding: 4,
  },

  // Context strip
  contextStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
    backgroundColor: COLORS.backgroundSecondary,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSubtle,
  },
  contextPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primaryMuted,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 4,
    maxWidth: 140,
  },
  contextPillText: {
    fontSize: 11,
    color: COLORS.primary,
    fontWeight: '600',
  },

  // Message list
  messageList: {
    flex: 1,
  },
  messageListContent: {
    padding: 16,
    gap: 12,
    paddingBottom: 8,
  },

  // Empty state
  emptyState: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 40,
    paddingHorizontal: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 28,
  },
  starterPrompts: {
    width: '100%',
    gap: 8,
  },
  starterPrompt: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.surfaceBorder,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
  },
  starterPromptText: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },

  // Message bubbles
  bubbleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    maxWidth: '92%',
  },
  bubbleRowUser: {
    alignSelf: 'flex-end',
    flexDirection: 'row-reverse',
  },
  agentAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.aiPurpleMuted,
    borderWidth: 1,
    borderColor: COLORS.aiPurple,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  bubble: {
    borderRadius: 14,
    padding: 12,
    maxWidth: '88%',
  },
  bubbleUser: {
    backgroundColor: COLORS.primary,
    borderBottomRightRadius: 4,
  },
  bubbleAgent: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.surfaceBorder,
    borderWidth: 1,
    borderBottomLeftRadius: 4,
  },
  bubbleText: {
    fontSize: 14,
    lineHeight: 20,
  },
  bubbleTextUser: {
    color: COLORS.textInverse,
    fontWeight: '500',
  },
  bubbleTextAgent: {
    color: COLORS.textPrimary,
  },

  // Memory provenance badge
  memoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderSubtle,
  },
  memoryBadgeText: {
    fontSize: 11,
    color: COLORS.hindsightCyan,
    fontWeight: '600',
  },

  // System messages
  systemMsg: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: 8,
    padding: 10,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.warning,
  },
  systemMsgText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },

  // Typing indicator
  typingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderColor: COLORS.surfaceBorder,
    borderWidth: 1,
    borderRadius: 14,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },
  typingText: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontStyle: 'italic',
  },

  // Input bar
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderSubtle,
    backgroundColor: COLORS.backgroundSecondary,
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 14,
    color: COLORS.textPrimary,
    maxHeight: 120,
    lineHeight: 20,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  sendBtnDisabled: {
    backgroundColor: COLORS.borderSubtle,
  },
});
