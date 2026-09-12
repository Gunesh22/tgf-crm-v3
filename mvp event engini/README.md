# TGF CRM — Event-Driven State Machine MVP

An isolated, reference-grade implementation of an **Event-Driven State Machine Pipeline** for the TGF Call Center CRM.

---

## 🎯 What Problem Does This Solve?

In traditional CRM architectures, pipeline progression often relies on long, procedural `if / else if / else` ladders scattered across multiple files. This leads to common bugs:
1. **Unintended Side-Effects**: For example, marking someone "Already Reg.d" or "Shivir done" accidentally triggering a registration count increment or attender sales bonus.
2. **Backward Regression**: A lead who is already in `"4. Nurture / Interested"` being demoted back to `"2. Attempting Contact"` just because a follow-up call disconnected or was busy.
3. **Purpose Collisions**: Query/support calls resetting the sales funnel progression.
4. **Maintenance Friction**: Adding a new stage or program requires modifying nested branches in 5+ files.

---

## 💡 The Event-Driven State Machine Solution

This MVP demonstrates a **Pure Reducer Architecture**:
```
(Current State, Incoming Event) ➔ { Next State, Emitted Actions, Audit Log }
```

### Key Principles:
- **Zero Side-Effects Inside the Engine**: The engine performs **zero** direct database writes or metric updates. It only calculates the next state and emits discrete, auditable actions (e.g., `RECORD_TRUE_REGISTRATION`, `ADD_PROGRAM_RELATIONSHIP`, `SET_STAGE`).
- **Separation of Concerns**:
  - `Reg.Done` emits `[SET_STAGE, RECORD_TRUE_REGISTRATION]`.
  - `Already Reg.d` / `Shivir done` emits `[SET_STAGE, ADD_PROGRAM_RELATIONSHIP]`. It is mathematically impossible for false registration credit to be created.
- **Auditable Transition Map**: All allowed state transitions and their resulting stages are declared in a single, human-readable table (`machineConfig.js`).
- **Non-Regression Guard**: High-rank leads (Rank > 2) are automatically protected against demotion from busy/dropped dials.

---

## 📁 File Structure

```
tgf-crm-v3/mvp event engini/
├── index.html         # Interactive Web UI Studio (CRM V2 Light SaaS Theme)
├── serve.js           # Lightweight zero-dependency server for the Web Studio (Port 5055)
├── constants.js       # Stage names, rank weights, event types, and action definitions
├── machineConfig.js   # Declarative transition rules matrix and outcome mappings
├── eventEngine.js     # Pure state reducer function processPipelineEvent()
├── demo.js            # Interactive CLI simulation demonstrating 5 core journeys
└── README.md          # Architecture overview and documentation (this file)
```

---

## 🖥️ Launching the Interactive Web UI

The UI is styled to **100% match the TGF CRM V2 Light SaaS design system**:
- Inter font family & Slate-50 background (`#f8fafc`)
- Indigo primary buttons & official stage badge colors (`bg-emerald-50`, `bg-amber-50`, `bg-purple-50`, etc.)
- Interactive Call Logging / Event Dispatcher modal-style card
- Real-time pipeline track visualizer with live stage highlighting
- Discrete Emitted Actions inspector and audit log timeline

### Option A: Via Local Server (Port 5055)
```bash
node "mvp event engini/serve.js"
```
Open **[http://localhost:5055](http://localhost:5055)** in your browser. (Does not interfere with your running CRM on port 53/5173).

### Option B: Direct in Browser
Double-click [`mvp event engini/index.html`](file:///d:/tgf%20call%20center%20crm/tgf-crm-v3/mvp%20event%20engini/index.html) or open it with any web browser.

---

## 🚀 Running the Terminal CLI Demo

From the project root (`tgf-crm-v3`), run:

```bash
node "mvp event engini/demo.js"
```

### Simulated Scenarios Covered:
1. **Scenario 1: The Pradnya Shah Alumni Protection**
   - Caller says they already completed the shivir previously.
   - Stage moves to `"Existing Alumni"`.
   - Action `ADD_PROGRAM_RELATIONSHIP` emitted.
   - Action `RECORD_TRUE_REGISTRATION` is **omitted** (Zero false registration credit).
2. **Scenario 2: Non-Regression Guard**
   - Lead in `"4. Nurture / Interested"` has a dropped or busy follow-up call.
   - Stage is safely preserved at `"4. Nurture / Interested"`.
3. **Scenario 3: 5-Attempt Auto-Close**
   - A fresh lead receives 5 consecutive unanswered dials (`Not Connected`, `No Answer`, `Switched Off`, etc.).
   - Automatically moves to `"Closed / Invalid"` on the 5th attempt.
4. **Scenario 4: True Registration (Won)**
   - Lead progresses through `"3. Information Given"` ➔ `"4. Nurture / Interested"` ➔ `"Reg.Done"`.
   - Emits `RECORD_TRUE_REGISTRATION` with sales attribution.
5. **Scenario 5: Multi-Track Isolation (Query / Support Calls)**
   - Lead in `"3. Information Given"` calls with a query.
   - Query status updates to `"Solved"`, while the sales stage remains completely undisturbed.

---

## 🔒 Isolation Guarantee

This entire folder is **100% standalone and decoupled**. None of the existing production codebase (`src/`, `api/`, `tests/`) was touched or modified.

