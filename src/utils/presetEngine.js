import { determineCallType, getContactSource, getContactLeadOrigin } from "./registrationEngine.js";

// Helper to safely execute regex test against a string
export function safeRegexTest(pattern, text) {
  if (!pattern || typeof pattern !== "string" || !pattern.trim()) return true;
  if (text === undefined || text === null) return false;
  const str = String(text).trim();
  try {
    const rx = new RegExp(pattern.trim(), "i");
    return rx.test(str);
  } catch (e) {
    // Fallback to literal case-insensitive substring search if regex syntax is invalid
    return str.toLowerCase().includes(pattern.trim().toLowerCase());
  }
}

// Extract all programs ever associated with a lead (history, programRelationships, attenderStates)
export function getContactAllPrograms(contact) {
  if (!contact) return [];
  const set = new Set();

  const add = (val) => {
    if (!val) return;
    String(val).split(",").forEach(p => {
      const clean = p.trim();
      if (clean && clean.toLowerCase() !== "unknown") set.add(clean);
    });
  };

  add(contact["Called For"]);
  add(contact.calledFor);
  add(contact.called_for);
  add(contact.programName);
  add(contact.programId);
  add(contact.previousProgram);

  if (Array.isArray(contact.programRelationships)) {
    contact.programRelationships.forEach(pr => add(pr.program || pr.programKey));
  }

  if (Array.isArray(contact.history)) {
    contact.history.forEach(h => add(h.calledFor || h.called_for || h["Called For"]));
  }

  if (contact.attenderStates && typeof contact.attenderStates === "object") {
    Object.values(contact.attenderStates).forEach(st => {
      if (st) add(st.calledFor || st["Called For"] || st.programName);
    });
  }

  return Array.from(set);
}

// Calculate total call attempts logged for a contact
export function getContactCallCount(contact) {
  if (!contact) return 0;
  if (typeof contact.attemptCount === "number") return contact.attemptCount;
  if (Array.isArray(contact.history)) return contact.history.length;
  return 0;
}

// Core Evaluator Function
export function evaluatePresetRule(contact, presetRule) {
  if (!contact || !presetRule) return false;

  // 1a. Independent Lead Origin Filter
  if (presetRule.leadOriginQuery) {
    const originVal = getContactLeadOrigin(contact);
    if (!safeRegexTest(presetRule.leadOriginQuery, originVal)) return false;
  }

  // 1b. Independent Current Source Filter
  if (presetRule.currentSourceQuery) {
    const srcVal = getContactSource(contact);
    if (!safeRegexTest(presetRule.currentSourceQuery, srcVal)) return false;
  }

  // 1c. Legacy Source Filter (Fallback)
  if (presetRule.sourceQuery && !presetRule.leadOriginQuery && !presetRule.currentSourceQuery) {
    const leadSource = getContactSource(contact) || getContactLeadOrigin(contact) || "";
    if (!safeRegexTest(presetRule.sourceQuery, leadSource)) return false;
  }

  // 2. Tag Filter
  if (presetRule.tagQuery) {
    const tagsStr = Array.isArray(contact.tags) ? contact.tags.join(", ") : (contact.Tags || contact.tags || "");
    if (!safeRegexTest(presetRule.tagQuery, tagsStr)) return false;
  }

  // 3. Prior Program / Alumni History Filter
  if (presetRule.priorProgramQuery) {
    const allProgs = getContactAllPrograms(contact);
    const hasPriorMatch = allProgs.some(p => safeRegexTest(presetRule.priorProgramQuery, p));
    if (!hasPriorMatch) return false;
  }

  // 4. Target Program Filter
  if (presetRule.targetProgramQuery) {
    const targetProg = contact["Called For"] || contact.calledFor || contact.programName || "";
    if (!safeRegexTest(presetRule.targetProgramQuery, targetProg)) return false;
  }

  // 5. Exclude Prior Program Filter (For Direct Admissions e.g. Skipped Basic)
  if (presetRule.excludePriorProgramQuery) {
    const allProgs = getContactAllPrograms(contact);
    const targetProg = String(contact["Called For"] || contact.calledFor || contact.programName || "").toLowerCase();
    const hasExcludedPrior = allProgs.some(p => {
      const pLower = String(p).toLowerCase();
      if (pLower === targetProg) return false; // Ignore current target program
      return safeRegexTest(presetRule.excludePriorProgramQuery, p);
    });
    if (hasExcludedPrior) return false;
  }

  // 6. Status / Outcome Filter
  if (presetRule.statusFilter && presetRule.statusFilter !== "ALL") {
    const leadStatus = contact.status || contact.pipelineStage || "";
    if (presetRule.statusFilter === "Reg.Done") {
      const isReg = leadStatus === "Reg.Done" || leadStatus === "Registered" || String(leadStatus).includes("Registered");
      if (!isReg) return false;
    } else {
      if (!safeRegexTest(presetRule.statusFilter, leadStatus)) return false;
    }
  }

  // 7. Activity Filter
  const callCount = getContactCallCount(contact);
  if (presetRule.activityFilter === "UNCALLED" && callCount > 0) return false;
  if (presetRule.activityFilter === "CALLED" && callCount === 0) return false;
  if (presetRule.activityFilter === "MULTI_CALLED" && callCount < 3) return false;

  // 8. Call Direction Filter
  if (presetRule.callDirection && presetRule.callDirection !== "ALL") {
    const resolvedDirection = determineCallType(contact, contact);
    if (presetRule.callDirection === "INCOMING" && resolvedDirection !== "incoming") return false;
    if (presetRule.callDirection === "OUTGOING" && resolvedDirection !== "outgoing") return false;
  }

  // 9. Attender Assignment Filter
  if (presetRule.attenderId && presetRule.attenderId !== "ALL") {
    const attId = presetRule.attenderId;
    const isAssigned = (Array.isArray(contact.assignedTo) && contact.assignedTo.includes(attId)) ||
      contact.attenderId === attId ||
      contact.leadOwner === attId;
    if (!isAssigned) return false;
  }

  return true;
}

// Built-in Default Presets with Clean Design & Clear Naming (No Emojis)
export const BUILT_IN_PRESETS = [
  {
    id: "preset_upsell_cbt",
    title: "CBT Basic → CBT Advanced",
    category: "Program Conversion",
    description: "Tracks CBT Basic alumni who converted or expressed interest in CBT Advanced.",
    iconName: "TrendingUp",
    priorProgramQuery: "CBT.*Basic|Basic",
    targetProgramQuery: "CBT.*Adv|Advanced",
    statusFilter: "ALL",
    activityFilter: "ALL",
    callDirection: "ALL",
    isBuiltIn: true
  },
  {
    id: "preset_direct_adv",
    title: "Direct CBT Advanced Leads",
    category: "Program Conversion",
    description: "Leads enrolled directly in CBT Advanced without prior CBT Basic.",
    iconName: "Zap",
    targetProgramQuery: "CBT.*Adv|Advanced",
    excludePriorProgramQuery: "CBT.*Basic|Basic",
    statusFilter: "Reg.Done",
    activityFilter: "ALL",
    callDirection: "ALL",
    isBuiltIn: true
  },
  {
    id: "preset_fb_leads",
    title: "Facebook Lead Performance",
    category: "Lead Sources",
    description: "Tracks Facebook and Meta ad leads, contact rates, and registrations.",
    iconName: "Globe",
    sourceQuery: "Facebook|FB",
    statusFilter: "ALL",
    activityFilter: "ALL",
    callDirection: "ALL",
    isBuiltIn: true
  },
  {
    id: "preset_ig_leads",
    title: "Instagram Lead Performance",
    category: "Lead Sources",
    description: "Tracks Instagram comments, DMs, and social ad lead contact rates.",
    iconName: "MessageSquare",
    sourceQuery: "Instagram|IG",
    statusFilter: "ALL",
    activityFilter: "ALL",
    callDirection: "ALL",
    isBuiltIn: true
  },
  {
    id: "preset_unresponsive_3calls",
    title: "Unresponsive Leads",
    category: "Pending Leads",
    description: "Leads called 3 or more times who remain uncontacted or unresolved.",
    iconName: "PhoneOff",
    activityFilter: "MULTI_CALLED",
    statusFilter: "ALL",
    callDirection: "ALL",
    isBuiltIn: true
  },
  {
    id: "preset_not_interested",
    title: "Not Interested Leads",
    category: "Call Performance",
    description: "Identifies lost leads and analyzes logged objections.",
    iconName: "AlertCircle",
    statusFilter: "Not Interested|Not possible|Closed / Lost",
    activityFilter: "ALL",
    callDirection: "ALL",
    isBuiltIn: true
  },
  {
    id: "preset_uncalled_leads",
    title: "Uncalled Leads",
    category: "Pending Leads",
    description: "Fresh leads sitting in the CRM with 0 call attempts made.",
    iconName: "Clock",
    activityFilter: "UNCALLED",
    statusFilter: "ALL",
    callDirection: "ALL",
    isBuiltIn: true
  }
];

// Adapter Helper: Convert simple business selections into standard engine rule object
export function createReportFromSimpleInputs({
  title = "",
  templateType = "custom",
  fromProgram = "",
  toProgram = "",
  leadOrigin = "",
  originalSource = "",
  currentSource = "",
  leadSource = "",
  statusFilter = "ALL",
  activityFilter = "ALL",
  attenderId = "ALL",
  // Advanced Escape Hatch Overrides
  tagQuery = "",
  excludePriorProgramQuery = "",
  callDirection = "ALL",
  customRegexSource = "",
  customRegexPrior = "",
  customRegexTarget = ""
}) {
  const resolvedLeadOrigin = leadOrigin || originalSource;
  const resolvedCurrentSource = currentSource || leadSource;

  // Convert exact string selections to escape-safe regex patterns if not already regex
  const toRegexPattern = (val) => {
    if (!val || val === "ALL" || val === "Any") return "";
    // If user typed a custom regex or standard string, escape special characters unless regex pipe/wildcard is used
    if (val.includes("|") || val.includes(".*") || val.includes("^")) return val;
    return val.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  };

  const sourceQuery = customRegexSource.trim() || toRegexPattern(resolvedLeadOrigin);
  const resolvedTagQuery = tagQuery.trim() || toRegexPattern(resolvedCurrentSource);
  const priorProgramQuery = customRegexPrior.trim() || toRegexPattern(fromProgram);
  const targetProgramQuery = customRegexTarget.trim() || toRegexPattern(toProgram);

  let category = "Custom";
  if (templateType === "conversion") category = "Program Conversion";
  if (templateType === "sources") category = "Lead Sources";
  if (templateType === "pending") category = "Pending Leads";
  if (templateType === "performance") category = "Call Performance";

  // Build clean display subtitle summarizing filters
  const subtitleParts = [];
  if (fromProgram && fromProgram !== "ALL" && fromProgram !== "Any") {
    subtitleParts.push(`From: ${fromProgram}`);
  }
  if (toProgram && toProgram !== "ALL" && toProgram !== "Any") {
    subtitleParts.push(`To: ${toProgram}`);
  }
  if (resolvedLeadOrigin && resolvedLeadOrigin !== "ALL" && resolvedLeadOrigin !== "Any") {
    subtitleParts.push(`Origin: ${resolvedLeadOrigin}`);
  }
  if (resolvedCurrentSource && resolvedCurrentSource !== "ALL" && resolvedCurrentSource !== "Any") {
    subtitleParts.push(`Current: ${resolvedCurrentSource}`);
  }

  const generatedTitle = title.trim() || (
    fromProgram && toProgram ? `${fromProgram} → ${toProgram}` :
    toProgram ? `${toProgram} Leads` :
    resolvedLeadOrigin ? `${resolvedLeadOrigin} Leads` :
    resolvedCurrentSource ? `${resolvedCurrentSource} Tag` :
    "Custom Funnel Report"
  );

  return {
    id: `custom_report_${Date.now()}`,
    title: generatedTitle,
    category,
    description: subtitleParts.length > 0 ? subtitleParts.join(" · ") : "Custom funnel filter report",
    iconName: "Sliders",
    templateType,
    fromProgram,
    toProgram,
    leadOrigin: resolvedLeadOrigin,
    originalSource: resolvedLeadOrigin,
    currentSource: resolvedCurrentSource,
    leadSource: resolvedCurrentSource,
    sourceQuery,
    priorProgramQuery,
    targetProgramQuery,
    excludePriorProgramQuery,
    tagQuery: resolvedTagQuery,
    statusFilter,
    activityFilter,
    callDirection,
    attenderId,
    isBuiltIn: false,
    createdAt: new Date().toISOString()
  };
}


export const PRESET_STORAGE_KEY = "crm_custom_presets_v1";

export function loadCustomPresets() {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(PRESET_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCustomPresets(customPresets) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(customPresets));
  } catch (e) {
    console.error("Failed to save custom presets:", e);
  }
}

export function getAllPresets() {
  const custom = loadCustomPresets();
  return [...BUILT_IN_PRESETS, ...custom];
}

// Compute Summary Metrics & Lists for a Preset
export function evaluatePresetSummary(contacts, presetRule) {
  if (!Array.isArray(contacts) || !presetRule) {
    return {
      totalCount: 0,
      calledCount: 0,
      uncalledCount: 0,
      convertedCount: 0,
      matchingContacts: [],
      calledContacts: [],
      uncalledContacts: [],
      convertedContacts: []
    };
  }

  const matchingContacts = contacts.filter(c => evaluatePresetRule(c, presetRule));

  const calledContacts = [];
  const uncalledContacts = [];
  const convertedContacts = [];

  matchingContacts.forEach(c => {
    const count = getContactCallCount(c);
    const status = String(c.status || c.pipelineStage || "").toLowerCase();
    const isReg = status === "reg.done" || status === "registered" || status.includes("registered");

    if (count > 0) calledContacts.push(c);
    else uncalledContacts.push(c);

    if (isReg) convertedContacts.push(c);
  });

  return {
    totalCount: matchingContacts.length,
    calledCount: calledContacts.length,
    uncalledCount: uncalledContacts.length,
    convertedCount: convertedContacts.length,
    matchingContacts,
    calledContacts,
    uncalledContacts,
    convertedContacts
  };
}
