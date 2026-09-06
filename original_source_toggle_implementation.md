# Original Source Toggle Implementation & Diff Reference

This document preserves the complete implementation, component changes, and diffs for the **Original Source Mode Toggle** feature in the CRM Admin Panel.

---

## 1. Feature Overview

The **Original Source Mode Toggle** allows CRM Admins to switch between:
- **`Current Source Mode` (Default)**: Evaluates and displays lead activity by the current active workstream source.
- **`Original Source Mode` (Toggle ON)**: Dynamically evaluates and displays lead activity, analytics charts, tables, and reports using the lead's **Original Acquisition Source** (first ingestion source / initial history entry).

---

## 2. Code Changes by File

### `src/features/admin/AdminDashboard.jsx`

Added `useOriginalSource` state and rendered a toggle button in the sidebar and top toolbar:

```jsx
// 1. State Declaration
const [useOriginalSource, setUseOriginalSource] = useState(false);

// 2. Sidebar Toggle UI Button
<div className="px-3 pt-3 pb-1 border-b border-slate-100">
  <button
    onClick={() => setUseOriginalSource(prev => !prev)}
    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
      useOriginalSource
        ? "bg-indigo-600 border-indigo-600 text-white shadow-sm shadow-indigo-600/30"
        : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
    }`}
    title="Toggle between Current Source and Original Lead Source"
  >
    <span className="flex items-center gap-2">
      <span className={`w-2 h-2 rounded-full ${useOriginalSource ? "bg-emerald-400 animate-pulse" : "bg-slate-400"}`} />
      {useOriginalSource ? "Original Source" : "Current Source"}
    </span>
    <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded ${useOriginalSource ? "bg-indigo-800 text-indigo-100" : "bg-slate-200 text-slate-600"}`}>
      {useOriginalSource ? "ON" : "OFF"}
    </span>
  </button>
</div>

// 3. Passing prop to tab components
<DashboardTab ... useOriginalSource={useOriginalSource} />
<PipelineCallsTab ... useOriginalSource={useOriginalSource} />
<AllAttendersSheetTab ... useOriginalSource={useOriginalSource} />
<MonthlyReportTab ... useOriginalSource={useOriginalSource} />
```

---

### `src/features/admin/components/AllAttendersSheetTab.jsx`

Updated `flattenedLogs` and `filteredLogs` to dynamically set the effective `Source` field based on `useOriginalSource`:

```javascript
// In flattenedLogs:
const origSourceVal = log.original_source || log.originalSource ||
  (Array.isArray(log.history) && log.history[0] ? (log.history[0].original_source || log.history[0].originalSource || log.history[0].callSource || log.history[0].Source || log.history[0].source) : "") ||
  sourceVal || "Direct Entry";

// Push object:
original_source: origSourceVal,
Source: useOriginalSource ? origSourceVal : (state.Source || state.source || sourceVal),

// Dependency array:
}, [callLogs, useOriginalSource]);
```

---

### `src/features/admin/components/DashboardTab.jsx`

Updated `flattenedLogs` mapping and dependency array:

```javascript
// In flattenedLogs:
const origSourceVal = log.original_source || log.originalSource ||
  (Array.isArray(log.history) && log.history[0] ? (log.history[0].original_source || log.history[0].originalSource || log.history[0].callSource || log.history[0].Source || log.history[0].source) : "") ||
  sourceVal || "Direct Entry";

// Push object:
source: useOriginalSource ? origSourceVal : (h.source || log.Source || log.source || sourceVal),

// Dependency array:
}, [callLogs, useOriginalSource]);
```

---

### `src/features/admin/components/MonthlyReportTab.jsx`

Passed `useOriginalSource` to `getCanonicalPhysicalCalls`:

```javascript
const allHistoricalAttempts = React.useMemo(() => {
  return getCanonicalPhysicalCalls(callLogs, {
    startDate,
    endDate,
    selectedAttenderIds,
    selectedProgramIds,
    selectedSources,
    selectedCalledFors,
    selectedStatuses,
    selectedCallTypes,
    selectedKhojiStatuses,
    useOriginalSource
  });
}, [callLogs, startDate, endDate, selectedAttenderIds, selectedProgramIds, selectedSources, selectedCalledFors, selectedStatuses, selectedCallTypes, selectedKhojiStatuses, useOriginalSource]);
```

---

### `src/features/admin/utils.jsx`

Updated `getCanonicalPhysicalCalls` and `cleanExportRow`:

```javascript
// 1. getCanonicalPhysicalCalls
export function getCanonicalPhysicalCalls(contacts = [], filters = {}) {
  const {
    ...,
    selectedOriginalSources = [],
    useOriginalSource = false
  } = filters;

  const curSourceVal = c.source || getContactValue(c, ["source", "sourse", "source of information", "source of informiton"]);
  const origSourceVal = c.original_source || c.originalSource ||
    (Array.isArray(c.history) && c.history[0] ? (c.history[0].original_source || c.history[0].originalSource || c.history[0].callSource || c.history[0].Source || c.history[0].source) : "") ||
    curSourceVal || "Direct Entry";

  const sourceVal = useOriginalSource ? origSourceVal : curSourceVal;

  physicalCalls.push({
    ...,
    source: useOriginalSource ? origSourceVal : (h.source || curSourceVal),
  });
}

// 2. cleanExportRow
const origSourceVal = log.original_source || log.originalSource ||
  (Array.isArray(log.history) && log.history[0] ? (log.history[0].original_source || log.history[0].originalSource || log.history[0].callSource || log.history[0].Source || log.history[0].source) : "") ||
  sourceVal || "Direct Entry";

row["Original Source"] = origSourceVal;
```

---

## 4. Git Diff Patch

```diff
diff --git a/src/features/admin/AdminDashboard.jsx b/src/features/admin/AdminDashboard.jsx
index 1018596..4327045 100644
--- a/src/features/admin/AdminDashboard.jsx
+++ b/src/features/admin/AdminDashboard.jsx
@@ -18,6 +18,7 @@ import dataResearchAnimation from "../../assets/data_research_analysis.json";
 
 export default function AdminPanel({ onExit, onAttendersChange }) {
   const [activeTab, setActiveTab] = useState("dashboard");
+  const [useOriginalSource, setUseOriginalSource] = useState(false);
   const [programs, setPrograms] = useState([]);
   const [attenders, setAttenders] = useState([]);
   const [isLoading, setIsLoading] = useState(true);
@@ -238,6 +239,26 @@ export default function AdminPanel({ onExit, onAttendersChange }) {
           </div>
         </div>
 
+        <div className="px-3 pt-3 pb-1 border-b border-slate-100">
+          <button
+            onClick={() => setUseOriginalSource(prev => !prev)}
+            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
+              useOriginalSource
+                ? "bg-indigo-600 border-indigo-600 text-white shadow-sm shadow-indigo-600/30"
+                : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
+            }`}
+            title="Toggle between Current Source and Original Lead Source"
+          >
+            <span className="flex items-center gap-2">
+              <span className={`w-2 h-2 rounded-full ${useOriginalSource ? "bg-emerald-400 animate-pulse" : "bg-slate-400"}`} />
+              {useOriginalSource ? "Original Source" : "Current Source"}
+            </span>
+            <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded ${useOriginalSource ? "bg-indigo-800 text-indigo-100" : "bg-slate-200 text-slate-600"}`}>
+              {useOriginalSource ? "ON" : "OFF"}
+            </span>
+          </button>
+        </div>
+
         <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
           {TAB_ITEMS.map(item => (
             <button
```
