# RECALLA — Incident Intelligence Platform

> **Remember incidents. Resolve faster.**
> A native mobile application (iOS & Android) that remembers past production incidents, learns from post-mortems, and uses **Hindsight by Vectorize** as long-term memory to accelerate future incident response.

---

## 📱 Mobile Architecture

```
React Native + Expo Mobile App (iOS / Android / Expo Go)
        ↓ HTTP / REST API (Platform-aware: 10.0.2.2 for Android, localhost for iOS)
FastAPI Backend (Python 3.12)
    ├── Hindsight by Vectorize (Long-Term Memory Engine)
    │       ├── retain()  → Stores incidents, resolutions, and post-mortem lessons
    │       ├── recall()  → Multi-strategy retrieval (BM25 + Semantic + Recency)
    │       └── reflect() → Synthesizes root cause insights and evidence
    ├── AI Incident Agent (LLM Reasoning grounded in memories)
    │       └── Strict provenance: Factual evidence separated from AI reasoning
    ├── SRE Safety Guardrails
    │       └── Human-in-the-loop: Explicit engineer confirmation required before execution
    └── SQLite Database (Async SQLAlchemy for application state & timelines)
```

---

## 🧭 Mobile App Navigation

The application is structured into **5 enterprise SRE mobile tabs**:

1. **Operations**:
   - Active incident count and status alerts
   - Severity breakdown
   - System health diagnostics (FastAPI, Database, Hindsight, AI Reasoner)
   - MTTR KPI metric card
   - Live Hindsight memory bank status pill
   - Quick "Investigate Now" trigger

2. **Incidents**:
   - Full incident list with search and severity filter chips (All, Critical, SEV-1, SEV-2, High, Resolved)
   - Detailed incident viewer with status updater, timeline log, and error rate telemetry
   - **Log New Incident** modal with immediate option to retain in Hindsight
   - **Resolve Incident** modal capturing resolution notes and recovery time
   - **Post-Mortem Creator** capturing root cause, what didn't work, and lessons learned to retain in Hindsight

3. **AI Agent (Hindsight Investigator)**:
   - Target incident selector
   - Real-time animated 4-stage diagnosis flow:
     1. Hindsight Long-term Memory Bank Query
     2. Multi-Strategy Scoring (Semantic Vector + BM25)
     3. Reflecting on Root Cause from Past Post-Mortems
     4. Synthesizing Evidence-Grounded Runbook Recommendation
   - Confidence score badge (e.g. `HIGH CONFIDENCE (94%)`)
   - "Why this recommendation?" explanation
   - Similar historical incidents cards with similarity % and past MTTR
   - Recommended runbook with step-by-step checklist
   - **CRITICAL SAFETY GUARDRAIL**: Runbook production actions require explicit engineer authorization modal with policy warning and acknowledgment switch before execution.

4. **Memory (Hindsight Explorer)**:
   - Live Hindsight bank stats (`incident-response-agent` bank)
   - Memory → Decision visual workflow diagram:
     `New Incident → Recall (BM25+Semantic) → Reflect (Root Cause) → Retain (Post-Mortem)`
   - Multi-strategy memory search across historical incidents and post-mortems
   - Preset quick queries (e.g., `"payment database connection timeout"`, `"JWT secret rotation"`)
   - Card view of each retained memory with provenance, tags, and learnings

5. **Settings**:
   - Configurable Backend Server URL (with quick presets for `localhost:8000` and Android emulator `10.0.2.2:8000`)
   - Real-time connection test with latency ping
   - Hindsight memory bank metadata
   - Production safety policies and guardrail documentation

---

## ⚡ Quick Start

### 1. Start the Backend

```bash
cd backend
# Activate Python 3.12 virtual environment
call venv\Scripts\activate

# Start the FastAPI server
uvicorn app.main:app --reload --port 8000
```
Backend will be live at `http://localhost:8000` (API documentation at `http://localhost:8000/docs`).

### 2. Seed Demo Data

```bash
cd backend
python seed_data.py
```
This populates:
- 5 historical production incidents
- 5 battle-tested runbooks
- 5 post-mortems with lessons learned
- 10 Hindsight memory units in the long-term memory bank

### 3. Start the Native Mobile App

```bash
cd mobile
npx expo start
```

From the Expo CLI menu:
- **Expo Go (Physical Phone)**: Scan the QR code with the Expo Go app (iOS Camera or Android Expo Go).
- **Android Emulator**: Press `a`.
- **iOS Simulator**: Press `i` (macOS only).
- **Web Preview**: Press `w`.

Or simply run `start.bat` from the root directory to launch both backend and mobile app simultaneously!

---

## 🧠 Hindsight Capabilities Demonstrated

| Hindsight Feature | Where & How Used |
| :--- | :--- |
| **Retain** | When creating an incident and saving post-mortem lessons, `retain_memory()` stores rich narrative context in the bank. |
| **Recall** | When investigating an incident, `recall_memories()` executes multi-strategy search (BM25 + Semantic + Tags) to find relevant past outages. |
| **Reflect** | The AI agent uses `reflect_on_memories()` to synthesize historical patterns, proven fixes, and root causes into structured advice. |
| **Safety Guardrail** | Explicit engineer confirmation required before any remediation step touches production. |
| **Continuous Learning** | Every resolved incident produces post-mortem learnings, making future recoveries faster. |

---

## 🧪 Testing Backend Integrity

Run the backend test suite anytime:
```bash
cd backend
venv\Scripts\pytest.exe
```
Result: **10 passed in 13.95s (100% pass rate)**.
