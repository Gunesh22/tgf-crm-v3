# Future Architecture & Code Simplification Roadmap

This document outlines the architectural blueprints, technical designs, and step-by-step implementations to transition the CRM's pipeline engine into a radically simpler, unified, and 1-click extensible system.

---

## 1. Executive Summary & Goals

### Current Challenges
1. **Dual Implementation**: Pipeline rules, ranks, and stage calculations are duplicated between the frontend (`src/utils/pipelineEngine.js`) and the backend serverless API (`api/_contacts/log-call.js`).
2. **Defensive Casing Checks**: Years of historical data entry created variations (`"Info Given"`, `"Info given"`, `"info given"`), forcing 20+ components to execute continuous `.toLowerCase()` and regex checks on every render.
3. **Hardcoded Stage Setup**: Adding a new stage currently requires updating 4–5 files across frontend and backend code.
4. **Deep `if/else` Logic Trees**: Stage transition validation relies on multi-branch conditional checks that are harder to visually audit.

### Target Vision
* **Single Source of Truth**: One shared configuration drives the entire system (frontend UI, backend API, validation, colors).
* **Ingress Sanitization**: Data is cleaned and canonicalized strictly "at the door" (on API receipt), keeping the database and downstream UI 100% clean.
* **Declarative Transition Matrix**: Replace nested `if/else` logic with a visual, self-documenting lookup table.
* **Dynamic Admin UI (1-Click Stages)**: Allow admins to create, color, and sequence new stages directly in the CRM without writing code.

---

## 2. Implementation 1: Unified Single Source of Truth Blueprint

### Objective
Eliminate duplicate pipeline definitions between frontend and backend by establishing a single, shared configuration file.

### Proposed Architecture
Create `src/config/pipeline.config.js` (or a shared JSON/ESM module readable by Vite and Vercel Serverless Functions):

```javascript
export const PIPELINE_CONFIG = {
  stages: [
    {
      id: "new_lead",
      name: "1. New Lead",
      rank: 1,
      type: "funnel",
      badge: { bg: "bg-slate-100", text: "text-slate-800", border: "border-slate-200" },
      allowedTransitions: ["attempting", "info_given", "interested", "alumni", "closed_lost", "closed_invalid"],
      defaultStatuses: []
    },
    {
      id: "attempting",
      name: "2. Attempting Contact",
      rank: 2,
      type: "funnel",
      badge: { bg: "bg-amber-100", text: "text-amber-900", border: "border-amber-300" },
      allowedTransitions: ["info_given", "interested", "alumni", "closed_lost", "closed_invalid"],
      defaultStatuses: ["Not Connected", "Busy", "Call Cut", "switched off", "no answer"]
    },
    {
      id: "info_given",
      name: "3. Information Given",
      rank: 3,
      type: "funnel",
      badge: { bg: "bg-blue-100", text: "text-blue-900", border: "border-blue-300" },
      allowedTransitions: ["previous_program_pending", "interested", "future_pool", "registered", "alumni", "closed_lost"],
      defaultStatuses: ["Info Given"]
    },
    {
      id: "previous_program_pending",
      name: "Previous Program Pending",
      rank: 3.2,
      type: "funnel",
      badge: { bg: "bg-indigo-100", text: "text-indigo-900", border: "border-indigo-300" },
      allowedTransitions: ["interested", "future_pool", "registered", "alumni", "closed_lost"],
      defaultStatuses: ["Previous Program Pending"]
    },
    {
      id: "interested",
      name: "4. Nurture / Interested",
      rank: 4,
      type: "funnel",
      badge: { bg: "bg-purple-100", text: "text-purple-900", border: "border-purple-300" },
      allowedTransitions: ["future_pool", "registered", "alumni", "closed_lost"],
      defaultStatuses: ["Interested"]
    },
    {
      id: "future_pool",
      name: "5. Future Pool",
      rank: 5,
      type: "funnel",
      badge: { bg: "bg-sky-100", text: "text-sky-900", border: "border-sky-300" },
      allowedTransitions: ["interested", "registered", "alumni", "closed_lost"],
      defaultStatuses: ["Next Time"]
    },
    {
      id: "registered",
      name: "6. Registered / Won",
      rank: 6,
      type: "funnel",
      badge: { bg: "bg-emerald-100", text: "text-emerald-900", border: "border-emerald-300" },
      allowedTransitions: ["registered", "alumni"],
      defaultStatuses: ["Reg.Done"]
    },
    {
      id: "alumni",
      name: "Existing Alumni",
      rank: 6,
      type: "alumni",
      badge: { bg: "bg-violet-100", text: "text-violet-900", border: "border-violet-300" },
      allowedTransitions: ["*"], // Bidirectional with all stages
      defaultStatuses: ["Already Reg.d", "Shivir done"]
    },
    {
      id: "closed_lost",
      name: "Closed / Lost",
      rank: 7,
      type: "terminal",
      badge: { bg: "bg-rose-100", text: "text-rose-900", border: "border-rose-300" },
      allowedTransitions: ["interested", "future_pool", "registered"],
      defaultStatuses: ["Not Interested"]
    },
    {
      id: "closed_invalid",
      name: "Closed / Invalid",
      rank: 7,
      type: "terminal",
      badge: { bg: "bg-gray-200", text: "text-gray-900", border: "border-gray-400" },
      allowedTransitions: ["attempting", "info_given"],
      defaultStatuses: ["Invalid Number"]
    }
  ]
};
```

### Benefits
* When a stage is modified, added, or reordered, changes are made in **one single file**.
* Frontend components (`ContactTable`, `CallEntryTab`, `StatusStageMappingCard`) and Backend APIs (`log-call.js`, `stats.js`) consume the exact same object.

---

## 3. Implementation 2: "Clean at the Door" Ingress Sanitization

### Objective
Stop dirty/cased data before it enters MongoDB, eliminating hundreds of `.toLowerCase()` checks across UI renderers.

### Proposed Ingress Architecture
Create an API Middleware/Sanitizer `api/_lib/sanitizeIngress.js`:

```
Incoming Request (Form / Webhook / CSV Import)
                    │
                    ▼
       ┌─────────────────────────┐
       │ sanitizeCallEvent(body) │
       └────────────┬────────────┘
                    │
   1. Status Normalization:   "info given"     ➔ "Info Given"
                              "already reg"    ➔ "Already Reg.d"
                              "shivir done"    ➔ "Shivir done"
   2. Purpose Normalization:  "sales"          ➔ "SALES"
   3. Phone Sanitization:     "+91 98-690..."  ➔ "919869001572"
   4. Name Capitalization:    "pradnya shah"   ➔ "Pradnya Shah"
                    │
                    ▼
     Clean Canonical Record Written to DB
```

### Impact
* The database becomes 100% uniform.
* UI components can use simple strict equality `===` instead of regex and lowercase fallbacks.

---

## 4. Implementation 3: Declarative State Transition Matrix

### Objective
Replace 150+ lines of nested `if/else` logic with a clean, lookup-based state machine.

### Proposed Transition Function
Instead of:
```javascript
// Complex nested conditions
if (sLower === "reg.done") { ... }
else if (["already reg.d", "shivir done"].includes(sLower)) { ... }
else if (isUnconnected) {
  if (attemptCount >= 5 && currentRank <= 2) { ... }
  else { ... }
}
```

Implement a table-driven transition resolver:
```javascript
export function resolveTransition(currentStage, callEvent, config = PIPELINE_CONFIG) {
  // 1. Independent Purpose Bypass
  if (callEvent.callPurpose === "QUERY") {
    return { targetStage: currentStage, queryStatus: resolveQueryStatus(callEvent) };
  }
  if (callEvent.callPurpose === "REMINDER") {
    return { targetStage: currentStage, reminderStatus: "Logged" };
  }

  // 2. Map Outcome to Target Stage
  const targetStageObj = config.stages.find(s => s.defaultStatuses.includes(callEvent.status))
    || config.stages.find(s => s.name === callEvent.status)
    || config.stages[0]; // fallback: New Lead

  // 3. Unconnected No-Regression Check
  if (isUnconnectedStatus(callEvent.status)) {
    if (callEvent.attemptCount >= 5 && getStageRank(currentStage) <= 2) {
      return { targetStage: "Closed / Invalid", closedReason: "5 Unanswered Dials" };
    }
    return { targetStage: currentStage }; // Freeze stage
  }

  // 4. Validate Allowed Forward Transition
  const currentStageObj = config.stages.find(s => s.name === currentStage);
  const isAllowed = currentStageObj?.allowedTransitions.includes("*") 
    || currentStageObj?.allowedTransitions.includes(targetStageObj.id)
    || targetStageObj.rank >= (currentStageObj?.rank || 0);

  return {
    targetStage: isAllowed ? targetStageObj.name : currentStage
  };
}
```

---

## 5. Implementation 4: Database-Driven Dynamic Stage Management (Admin UI 1-Click)

### Objective
Allow Admins to create, edit, reorder, or color stages directly from the web interface without developer intervention.

### Proposed Schema: MongoDB `pipeline_stages` Collection
```json
{
  "_id": "custom_sales_funnel",
  "version": 2,
  "stages": [
    { "order": 1, "key": "new_lead", "label": "1. New Lead", "color": "slate", "rank": 1 },
    { "order": 2, "key": "attempting", "label": "2. Attempting Contact", "color": "amber", "rank": 2 },
    { "order": 3, "key": "info_given", "label": "3. Information Given", "color": "blue", "rank": 3 },
    { "order": 4, "key": "trial_attended", "label": "Trial Attended", "color": "teal", "rank": 3.5 },
    { "order": 5, "key": "interested", "label": "4. Nurture / Interested", "color": "purple", "rank": 4 },
    { "order": 6, "key": "registered", "label": "6. Registered / Won", "color": "emerald", "rank": 6 },
    { "order": 7, "key": "alumni", "label": "Existing Alumni", "color": "violet", "rank": 6 }
  ],
  "updatedAt": "2026-09-10T14:45:00.000Z"
}
```

### Admin UI Flow
1. Admin navigates to **Admin Dashboard ➔ Settings ➔ Pipeline Stages**.
2. Sees a **Drag-and-Drop** list of all stages with their badge colors and ranks.
3. Clicks **"+ Add Stage"**:
   - Inputs Name: e.g., *"Trial Attended"*
   - Selects Position: Between *"3. Information Given"* and *"4. Nurture / Interested"*
   - Selects Color: Teal
   - Selects Mapped Outcomes: e.g., *"Attended Free Session"*
4. Clicks **Save**.
5. Server writes to `pipeline_stages`, and both frontend and backend instantly adopt the new stage.

---

## 6. Implementation 5: Registration Deduplication Optimization

### Objective
Simplify `registrationEngine.js` by standardizing the identity key across database queries and UI aggregations.

### Proposed Single Identity Formula
Every program registration must strictly follow:
$$\text{Registration Key} = \text{contactId} + \text{"\_"} + \text{programKey}$$

* **Pre-computed Index**: Add a unique compound index in MongoDB on `registrations`:
  `{ contactId: 1, programKey: 1 }`
* **Zero Duplication**: MongoDB automatically rejects duplicate registration records for the same contact and program.
* **Instant Counting**: Aggregation pipelines can count true registrations with a single `$count` query rather than in-memory JavaScript loops.

---

## 7. Recommended Phased Implementation Plan

| Phase | Initiative | Risk | Estimated Effort | Impact |
| :--- | :--- | :--- | :--- | :--- |
| **Phase 1** | **Unified Shared Config (`pipeline.config.js`)** | Low | 1 Day | Eliminates frontend/backend code drift. |
| **Phase 2** | **Ingress Normalization (`sanitizeIngress.js`)** | Low | 1 Day | Stops dirty casing at the API layer. |
| **Phase 3** | **Declarative Transition Matrix** | Medium | 1–2 Days | Replaces nested if/else with clear rules table. |
| **Phase 4** | **Admin Dynamic Stage Builder (UI + MongoDB)** | Medium | 2–3 Days | Enables 1-click stage management for admins. |

---

*Document finalized and preserved in CRM repository for future execution.*
