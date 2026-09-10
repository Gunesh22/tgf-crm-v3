/**
 * Utility functions for multi-program CRM context tracking.
 * Resolves program-specific pipeline stages, call history counts,
 * source attributions, and registration records.
 */

import { getEffectiveStage, PIPELINE_STAGES } from '../../../utils/pipelineEngine.js';

/**
 * Normalizes a program name string into a standard lookup key (e.g. "CBT Basic" -> "cbt-basic")
 */
export function normalizeProgramKey(str) {
  if (!str) return "";
  return String(str)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-");
}

/**
 * Extracts a deduplicated list of all Called For / Program contexts associated with a contact.
 */
export function extractProgramsList(contact = {}) {
  if (!contact) return [];
  const programMap = new Map(); // key -> formatted display name

  const NON_PROGRAM_LABELS = new Set([
    "incoming", "incoming call", "incoming calls", "incoming-calls",
    "outgoing", "outgoing call", "outgoing calls", "outgoing-calls",
    "reminder", "query", "na", "none", "null", "undefined", "[object object]"
  ]);

  const addProgram = (rawProg) => {
    if (!rawProg) return;
    const str = String(rawProg).trim();
    if (!str || str === "[object Object]") return;

    // Handle comma-separated strings
    const parts = str.split(",").map(p => p.trim()).filter(Boolean);
    parts.forEach(p => {
      const lower = p.toLowerCase().trim();
      const key = normalizeProgramKey(p);
      if (key && !NON_PROGRAM_LABELS.has(lower) && !NON_PROGRAM_LABELS.has(key) && !programMap.has(key)) {
        programMap.set(key, p);
      }
    });
  };

  const checkObjPrograms = (obj) => {
    if (!obj || typeof obj !== "object") return;
    addProgram(obj["Called For"]);
    addProgram(obj.calledFor);
    addProgram(obj.called_for);
    addProgram(obj.calledForKey);
    addProgram(obj.program);
    addProgram(obj.programName);
    addProgram(obj.subProgram);
    addProgram(obj["Sub Program"]);
  };

  // 1. Root Called For field(s)
  checkObjPrograms(contact);

  // 2. programRelationships array
  if (Array.isArray(contact.programRelationships)) {
    contact.programRelationships.forEach(rel => checkObjPrograms(rel));
  }

  // 3. attenderStates per attender
  if (contact.attenderStates && typeof contact.attenderStates === "object") {
    Object.values(contact.attenderStates).forEach(st => checkObjPrograms(st));
  }

  // 4. History log entries
  if (Array.isArray(contact.history)) {
    contact.history.forEach(h => checkObjPrograms(h));
  }

  return Array.from(programMap.values());
}

/**
 * Checks whether a contact has an existing registration for a specific program.
 */
export function getProgramRegistrationInfo(contact = {}, programName = "") {
  if (!programName) return { exists: false, registrationId: null, program: "" };
  
  const targetProg = String(programName).trim();
  const targetKey = normalizeProgramKey(targetProg);
  if (!targetKey) return { exists: false, registrationId: null, program: targetProg };

  // 1. Check programRelationships
  const rels = Array.isArray(contact.programRelationships) ? contact.programRelationships : [];
  const foundRel = rels.find(p => {
    if (!p) return false;
    const pStr = typeof p === "string" ? p : (p.calledForKey || p.calledFor || p.program || p["Called For"] || "");
    const pKey = normalizeProgramKey(pStr);
    const pStat = typeof p === "string" ? "" : String(p.status || p.pipelineStage || "").toLowerCase();
    return pKey === targetKey && (pStat.includes("registered") || pStat.includes("reg_done") || pStat.includes("alumni") || pStat.includes("won"));
  });

  if (foundRel) {
    return { exists: true, registrationId: foundRel.registrationId || null, program: targetProg };
  }

  // 2. Check registrations array
  const regs = Array.isArray(contact.registrations) ? contact.registrations : [];
  const foundReg = regs.find(r => {
    if (!r) return false;
    const rStr = typeof r === "string" ? r : (r.calledForKey || r.calledFor || r.program || r["Called For"] || "");
    const rKey = normalizeProgramKey(rStr);
    return rKey === targetKey;
  });

  if (foundReg) {
    return { exists: true, registrationId: foundReg.registrationId || null, program: targetProg };
  }

  // 3. Check call history for Reg.Done call against this program
  const hist = Array.isArray(contact.history) ? contact.history : [];
  const foundHist = hist.find(h => {
    if (!h) return false;
    const hStatus = String(h.status || h.Status || "").trim().toLowerCase();
    if (hStatus !== "reg.done" && hStatus !== "registered") return false;
    const hProgKey = normalizeProgramKey(h.calledFor || h.calledForKey || h.program || h["Called For"]);
    return hProgKey === targetKey;
  });

  if (foundHist) {
    return { exists: true, registrationId: null, program: targetProg };
  }

  return { exists: false, registrationId: null, program: targetProg };
}

/**
 * Calculates program-specific call log count from contact history.
 */
export function getProgramCallCount(contact = {}, programName = "") {
  if (!programName) return 0;
  const targetKey = normalizeProgramKey(programName);
  const history = Array.isArray(contact.history) ? contact.history : [];
  
  if (!targetKey) return history.length;

  const count = history.filter(h => {
    if (!h) return false;
    const hProgKey = normalizeProgramKey(h.calledFor || h["Called For"] || h.called_for || h.program);
    return hProgKey === targetKey || (hProgKey && (hProgKey.includes(targetKey) || targetKey.includes(hProgKey)));
  }).length;

  return count;
}

/**
 * Resolves full program context breakdown for a contact and program name.
 */
export function getProgramContext(contact = {}, programName = "", attenderId = null) {
  const targetProg = String(programName).trim();
  const targetKey = normalizeProgramKey(targetProg);

  // Stage resolution using pipelineEngine
  const stage = getEffectiveStage(contact, targetProg, attenderId) || PIPELINE_STAGES.NEW_LEAD;
  
  // Registration resolution
  const regInfo = getProgramRegistrationInfo(contact, targetProg);
  
  // Call count
  const callCount = getProgramCallCount(contact, targetProg);

  // Source attribution (program-specific or global)
  let source = contact.leadOrigin || contact.original_source || contact.originalSource || contact.Source || contact.source || "Direct Entry";
  
  if (attenderId && contact.attenderStates?.[attenderId]) {
    const attSt = contact.attenderStates[attenderId];
    const stProgKey = normalizeProgramKey(attSt["Called For"] || attSt.calledFor);
    if (stProgKey === targetKey && (attSt.source || attSt.Source)) {
      source = attSt.source || attSt.Source;
    }
  }

  return {
    program: targetProg,
    programKey: targetKey,
    stage,
    callCount,
    isRegistered: regInfo.exists,
    registrationId: regInfo.registrationId,
    source,
  };
}
