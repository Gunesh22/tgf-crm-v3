import React, { useState, useEffect, useRef, useMemo } from "react";
import { toast } from "react-hot-toast";
import {
  Phone, Plus, X, Tag, User, MapPin, MessageSquare,
  Hash, Clock, CheckCircle2, AlertCircle, Trash2,
  CalendarDays, Loader, Flame, Edit3, ArrowLeft, Users, RotateCw, Undo2, Info
} from "lucide-react";
import {
  addIncomingCallLog, updateCallLog, checkGlobalDuplicate, findMatchingAttenderState
} from "../../../lib/db";
import { searchCRMByPhone } from "../../../lib/ghl";
import {
  STATUS_OPTIONS,
  SOURCE_OPTIONS,
  CALLED_FOR_OPTIONS,
  isKhojiField,
  getFieldWithFallback,
  formatContactName,
  isNotConnectedStatus,
  getSharedAttenders
} from "../utils";

import SearchableDropdown from "../components/edit-modal/SearchableDropdown";
import DuplicateBanner from "../components/edit-modal/DuplicateBanner";
import SharedBanner from "../components/edit-modal/SharedBanner";
import HistoryTimeline from "../components/edit-modal/HistoryTimeline";
import CityAutofillInput from "../components/edit-modal/CityAutofillInput";
import EditHistoryModal from "../components/edit-modal/EditHistoryModal";
import ProgramContextSelector from "../components/edit-modal/ProgramContextSelector";
import { extractProgramsList, getProgramContext } from "../utils/programContextHelper";
import { getEffectiveStage, PIPELINE_STAGES, getProgramSpecificStatus } from "../../../utils/pipelineEngine";

function parseTimestamp(t) {
  if (!t) return null;
  if (t instanceof Date) return t;
  if (typeof t.toDate === "function") return t.toDate();
  if (typeof t === "object" && t.seconds !== undefined) {
    return new Date(t.seconds * 1000 + Math.round((t.nanoseconds || 0) / 1000000));
  }
  return new Date(t);
}

export default function MobileEditModal({
  row,
  attenderId,
  attenderName = "Unknown",
  programs = [],
  onSave,
  onDelete,
  onClose,
  onRefreshLead,
  isFetchingShared = false,
  freshSharedLead = null
}) {
  const getNormalizedRow = () => {
    const normalized = { ...row };
    if (normalized.callType) {
      normalized.callType = String(normalized.callType).toLowerCase();
    }
    
    const profileFields = ["Name", "Phone", "Mobile", "Email", "City", "State", "Khoji", "Tags", "Source"];
    profileFields.forEach(col => {
      normalized[col] = getFieldWithFallback(row, col, attenderId, attenderName);
    });

    const rootSource = normalized.Source || getFieldWithFallback(row, "Source", attenderId, attenderName) || "";
    normalized.Source = rootSource;
    normalized.source = rootSource;

    if (row._isNew && !normalized.Khoji) {
      normalized.Khoji = "No";
    }

    const attState = findMatchingAttenderState(normalized.attenderStates, attenderId, attenderName);
    
    const rootCallbackDate = attState?.callbackDate || row.callbackDate || row["Callback Date"] || row.callback_date || row.nextCallDate || row.next_call_date || row.callback || null;
    const rootCallbackTime = attState?.callbackTime || row.callbackTime || row["Callback Time"] || row.callback_time || "";
    const rootCallbackStatus = attState?.callbackStatus || row.callbackStatus || (rootCallbackDate ? "pending" : null);

    if (attState) {
      normalized["Called For"] = attState.calledFor || attState["Called For"] || "";
      normalized.calledFor = normalized["Called For"];
      normalized.Source = attState.source || attState.Source || rootSource;
      normalized.source = normalized.Source;
      normalized.status = attState.status || "";
      normalized.remark = "";
      normalized.callbackDate = rootCallbackDate;
      normalized.callbackStatus = rootCallbackStatus;
      normalized.callbackTime = rootCallbackTime;
    } else {
      normalized["Called For"] = "";
      normalized.calledFor = "";
      normalized.Source = rootSource;
      normalized.source = rootSource;
      normalized.status = "";
      normalized.remark = "";
      normalized.callbackDate = rootCallbackDate;
      normalized.callbackStatus = rootCallbackStatus;
      normalized.callbackTime = rootCallbackTime;
    }

    normalized.callStatus = "";
    normalized.queryStatus = "";

    normalized.pipelineStage = normalized.pipelineStage || row.pipelineStage;

    return normalized;
  };

  const [savedRow, setSavedRow] = useState(() => getNormalizedRow());
  const [edited, setEdited] = useState(() => getNormalizedRow());
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [isAddingNext, setIsAddingNext] = useState(false);
  const [tempDate, setTempDate] = useState("");
  const [tempTime, setTempTime] = useState("");
  const [prevFollowupState, setPrevFollowupState] = useState(null);

  const saveFollowupSnapshot = () => {
    setPrevFollowupState({
      callbackDate: edited.callbackDate || "",
      callbackTime: edited.callbackTime || "",
      callbackStatus: edited.callbackStatus || "pending"
    });
  };

  const handleUndoFollowup = () => {
    if (prevFollowupState) {
      handleChange("callbackDate", prevFollowupState.callbackDate);
      handleChange("callbackTime", prevFollowupState.callbackTime);
      handleChange("callbackStatus", prevFollowupState.callbackStatus);
      setPrevFollowupState(null);
      setIsRescheduling(false);
      setIsAddingNext(false);
      toast.success("Follow-up action undone");
    } else {
      handleChange("callbackStatus", "pending");
      setIsRescheduling(false);
      setIsAddingNext(false);
      toast.success("Restored follow-up to Pending");
    }
  };

  const formatFollowupDateStr = (dateVal) => {
    if (!dateVal) return "";
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return String(dateVal);
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  };

  const rawCbStatus = String(edited.callbackStatus || "").toLowerCase().trim();
  const isFollowupCompleted = rawCbStatus === "done" || rawCbStatus === "completed";
  const isFollowupCancelled = rawCbStatus === "cancelled";
  const hasActivePendingFollowup = !!edited.callbackDate && !isFollowupCompleted && !isFollowupCancelled;

  useEffect(() => {
    const norm = getNormalizedRow();
    setSavedRow(norm);
    setEdited(norm);
    setIsRescheduling(false);
    setIsAddingNext(false);
    setTempDate("");
    setTempTime("");
    setPrevFollowupState(null);
  }, [row]);

  const calledForField = useMemo(() => {
    if (edited["Called For"] !== undefined) return "Called For";
    return "calledFor";
  }, [edited]);

  const sourceField = useMemo(() => {
    if (edited.Source !== undefined) return "Source";
    if (edited.Sourse !== undefined) return "Sourse";
    return "source";
  }, [edited]);

  const programRegInfo = useMemo(() => {
    const rawProgram = String(edited[calledForField] || "").trim();
    if (!rawProgram) return { exists: false, program: "" };
    const progArr = rawProgram.split(",").map(p => p.trim()).filter(Boolean);
    const targetProg = progArr[0] || rawProgram;
    const targetKey = targetProg.toLowerCase().replace(/[^a-z0-9]/g, "-");
    
    // Check programRelationships
    const rels = Array.isArray(edited.programRelationships) ? edited.programRelationships : Array.isArray(row.programRelationships) ? row.programRelationships : [];
    const foundRel = rels.find(p => {
      const pKey = (p.calledForKey || p.calledFor || p.program || "").toLowerCase().replace(/[^a-z0-9]/g, "-");
      return pKey === targetKey && (p.status === "Registered / Won" || p.status === "Registered" || p.status === "reg_done");
    });
    if (foundRel) {
      return { exists: true, registrationId: foundRel.registrationId || null, program: targetProg };
    }

    // Check registrations
    const regs = Array.isArray(edited.registrations) ? edited.registrations : Array.isArray(row.registrations) ? row.registrations : [];
    const foundReg = regs.find(r => {
      const rKey = (r.calledForKey || r.calledFor || r.program || "").toLowerCase().replace(/[^a-z0-9]/g, "-");
      return rKey === targetKey;
    });
    if (foundReg) {
      return { exists: true, registrationId: foundReg.registrationId || null, program: targetProg };
    }

    // Check pipeline stage
    const canCalledFor = (edited["Called For"] || edited.calledFor || row["Called For"] || row.calledFor || "").toLowerCase().replace(/[^a-z0-9]/g, "-");
    const canStage = edited.pipelineStage || row.pipelineStage || "";
    if (canCalledFor === targetKey && (canStage === "6. Registered / Won" || canStage === "Registered / Won")) {
      return { exists: true, registrationId: null, program: targetProg };
    }

    return { exists: false, program: targetProg };
  }, [edited, row, calledForField]);

  const [activeTab, setActiveTab] = useState(() => (row && row._isNew ? "profile" : "call"));
  const [saving, setSaving] = useState(false);
  const [showEditHistory, setShowEditHistory] = useState(false);
  const [showCalledForPrompt, setShowCalledForPrompt] = useState(false);
  const [promptSelection, setPromptSelection] = useState("");
  const [pendingSave, setPendingSave] = useState(false);
  const programsList = useMemo(() => extractProgramsList(edited), [edited]);

  const [activeProgram, setActiveProgram] = useState(() => {
    const list = extractProgramsList(row || {});
    return list[0] || row[calledForField] || row["Called For"] || row.calledFor || "";
  });

  useEffect(() => {
    const freshNorm = getNormalizedRow();
    const list = extractProgramsList(row || {});
    const firstProg = list[0] || freshNorm[calledForField] || freshNorm["Called For"] || freshNorm.calledFor || "";
    if (firstProg) {
      const attId = activeAttenderId || freshNorm.attenderId || row?.attenderId || null;
      freshNorm[calledForField] = firstProg;
      freshNorm.calledFor = firstProg;
      freshNorm["Called For"] = firstProg;
      freshNorm.called_for = firstProg;
      freshNorm.status = getProgramSpecificStatus(freshNorm, firstProg, attId);
      freshNorm.pipelineStage = getEffectiveStage(freshNorm, firstProg, attId) || PIPELINE_STAGES.NEW_LEAD;
    }
    setSavedRow(freshNorm);
    setEdited(freshNorm);
    setShowCalledForPrompt(false);
    setPromptSelection("");
    setPendingSave(false);
    setActiveProgram(firstProg);
  }, [row]);

  const handleSelectProgram = (programName) => {
    if (!programName) return;
    const targetProg = String(programName).split(",")[0].trim();
    setActiveProgram(targetProg);

    const attId = activeAttenderId || edited.attenderId || row?.attenderId || null;
    const targetStatus = getProgramSpecificStatus(savedRow || row || edited, targetProg, attId);

    setEdited(prev => ({
      ...prev,
      [calledForField]: targetProg,
      calledFor: targetProg,
      "Called For": targetProg,
      called_for: targetProg,
      status: targetStatus
    }));
  };

  const [globalDup, setGlobalDup] = useState(null);
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false);
  const [isSearchingCRM, setIsSearchingCRM] = useState(false);

  const newNoteRef = useRef(null);
  const isSavingRef = useRef(false);

  const handleChange = (field, val) => {
    setEdited(prev => {
      const next = { ...prev, [field]: val };
      const isCalledFor = field === calledForField ||
        ["called for", "called_for", "calledfor"].includes(String(field || "").toLowerCase());
      if (isCalledFor) {
        next["Called For"] = val;
        next.calledFor = val;
        next.called_for = val;
        if (val) {
          setActiveProgram(val);
          const attId = activeAttenderId || prev.attenderId || row?.attenderId || null;
          next.pipelineStage = getEffectiveStage(row || prev, val, attId) || PIPELINE_STAGES.NEW_LEAD;
        }
      }
      if (field === "status" && val === "Reg.Done") {
        next.callbackDate = null;
        next.callbackStatus = null;
      }
      return next;
    });
  };

  const handleCallTypeChange = (ct) => {
    setEdited(prev => ({ ...prev, callType: ct }));
  };

  const phoneVal = useMemo(() => String(edited.Phone || "").trim(), [edited.Phone]);
  const mobileVal = useMemo(() => String(edited.Mobile || "").trim(), [edited.Mobile]);
  const dupTimerRef = useRef(null);

  useEffect(() => {
    const searchVal = phoneVal || mobileVal;
    const cleanSearch = String(searchVal || "").replace(/\D/g, "");
    if (cleanSearch.length < 10) {
      setGlobalDup(null);
      return;
    }

    if (dupTimerRef.current) clearTimeout(dupTimerRef.current);

    dupTimerRef.current = setTimeout(async () => {
      try {
        setIsCheckingDuplicate(true);
        const alreadyFetched = !!(edited.GHL_ID || row.GHL_ID || edited.ghl_id || row.ghl_id);
        const shouldQueryCRM = (row._isNew || !edited.Name) && !alreadyFetched;

        const [dupRes, crmRes] = await Promise.all([
          checkGlobalDuplicate(searchVal, row.id).catch(() => null),
          shouldQueryCRM ? searchCRMByPhone(searchVal).catch(() => []) : Promise.resolve([])
        ]);

        if (dupRes && dupRes.matches && dupRes.matches.length > 0) {
          setGlobalDup(dupRes);
          const dup = dupRes.first;
          if (dup) {
            setEdited(prev => ({
              ...prev,
              Name: prev.Name || dup.name || dup.Name || "",
              Email: prev.Email || dup.email || dup.Email || "",
              City: prev.City || dup.city || dup.City || "",
              State: prev.State || dup.state || dup.State || "",
              Tags: prev.Tags || (Array.isArray(dup.tags) ? dup.tags.join(", ") : dup.Tags || "")
            }));
            toast.success("Duplicate lead found! Profile info auto-filled.");
          }
        } else {
          setGlobalDup(null);
          const crmContact = Array.isArray(crmRes) ? crmRes[0] : crmRes;
          if (crmContact) {
            const name = crmContact.contactName || crmContact.name || [crmContact.firstName, crmContact.lastName].filter(Boolean).join(" ") || crmContact.Name || "";
            const email = crmContact.email || crmContact.Email || "";
            const city = crmContact.city || crmContact.location?.city || crmContact.City || "";
            const state = crmContact.state || crmContact.location?.state || crmContact.State || "";
            const source = crmContact.source || crmContact.Source || "";
            const tags = Array.isArray(crmContact.tags) ? crmContact.tags.join(", ") : (crmContact.tags || crmContact.Tags || "");
            const ghlId = crmContact.id || crmContact.GHL_ID || crmContact.ghl_id || "";

            setEdited(prev => ({
              ...prev,
              Name: name || prev.Name,
              Email: email || prev.Email,
              City: city || prev.City,
              State: state || prev.State,
              Source: source || prev.Source,
              Tags: tags || prev.Tags,
              GHL_ID: ghlId || prev.GHL_ID
            }));
            toast.success(`Lead "${name || searchVal}" found in CRM! Details auto-filled.`);
          }
        }
      } catch (err) {
        console.error("[MobileEditModal Dup Error]", err);
      } finally {
        setIsCheckingDuplicate(false);
        setIsSearchingCRM(false);
      }
    }, 200);

    return () => {
      if (dupTimerRef.current) clearTimeout(dupTimerRef.current);
    };
  }, [phoneVal, mobileVal, row._isNew, row.id]);

  const getEditable = (field) => {
    if (row._isNew) return true;
    const attState = findMatchingAttenderState(row.attenderStates, attenderId, attenderName);
    if (!attState) return true;
    return true;
  };

  const handleSaveAndClose = async (overrideFields = null) => {
    if (saving || isSavingRef.current) return;
    isSavingRef.current = true;
    setSaving(true);

    const targetEdited = (overrideFields && typeof overrideFields === "object" && !overrideFields.target)
      ? { ...edited, ...overrideFields }
      : { ...edited };

    if (targetEdited.status === "Reg.Done") {
      targetEdited.callbackDate = null;
      targetEdited.callbackStatus = null;
    }

    try {
      const { id, _callbackDue, _isNew, ...rest } = targetEdited;
      const updates = { ...rest };
      if (updates.Name) updates.Name = formatContactName(updates.Name);

      delete updates.attenderStates;
      delete updates.assignedTo;
      delete updates.assignedName;

      updates.lastEditedBy = attenderName || "Unknown";

      // Preserve history entries across all attenders so past comments are synced and visible
      let baseHistory = Array.isArray(targetEdited.history) 
        ? [...targetEdited.history] 
        : (Array.isArray(savedRow.history) ? [...savedRow.history] : []);

      const oldStatus = String(savedRow.status || "").trim();
      const newStatus = String(targetEdited.status || "").trim();
      const statusChanged = oldStatus !== newStatus;

      const oldPurpose = String(savedRow.callPurpose || "").trim();
      const newPurpose = String(targetEdited.callPurpose || "").trim();
      const purposeChanged = oldPurpose !== newPurpose;

      const oldCallStatus = String(savedRow.callStatus || "").trim();
      const newCallStatus = String(targetEdited.callStatus || "").trim();
      const callStatusChanged = oldCallStatus !== newCallStatus;

      const oldRemark = String(savedRow.remark || "").trim();
      const newRemark = String(targetEdited.remark || "").trim();
      const remarkChanged = oldRemark !== newRemark;

      const isCallAttemptUpdated = statusChanged || remarkChanged || purposeChanged || callStatusChanged;
      if (isCallAttemptUpdated) {
        const newHist = {
          callPurpose: targetEdited.callPurpose || "SALES",
          callStatus: targetEdited.callStatus || "",
          status: targetEdited.status || "Call Log Added",
          queryStatus: targetEdited.queryStatus || null,
          remark: targetEdited.remark || "",
          attenderName: attenderName || "Unknown",
          timestamp: new Date().toISOString(),
          calledFor: targetEdited[calledForField] || targetEdited["Called For"] || targetEdited.calledFor || "",
          source: targetEdited[sourceField] || targetEdited.Source || targetEdited.source || "",
          callType: targetEdited.callType || "outgoing"
        };
        updates.history = [...baseHistory, newHist];
      } else {
        updates.history = baseHistory;
      }

      const targetDocId = targetEdited.contactId || targetEdited.id || row.id;
      const isNewWithoutDoc = row._isNew && !targetEdited.contactId && !targetEdited.id;

      console.log(`[MOBILE ATTENDER ISOLATED SAVE] Attender: "${attenderName}" (${attenderId})`, {
        contactId: targetDocId,
        leadName: targetEdited.Name || savedRow.Name,
        previousIsolatedHistoryCount: baseHistory.length,
        isCallAttemptUpdated,
        finalHistoryCount: updates.history ? updates.history.length : baseHistory.length,
        savedHistoryEntries: updates.history || baseHistory
      });

      let savedDocId = targetDocId;
      if (isNewWithoutDoc) {
        delete updates._isNew;
        const resId = await addIncomingCallLog(
          attenderId || row.attenderId, attenderName || row.attenderName, updates, targetEdited.programId, targetEdited.programName
        );
        savedDocId = resId;
      } else {
        const existingContext = globalDup?.first
          ? { ...globalDup.first, ...row, ...targetEdited }
          : { ...row, ...targetEdited };
        await updateCallLog(targetDocId, updates, attenderId, attenderName, existingContext);
      }

      const finalSavedPayload = {
        ...targetEdited,
        ...updates,
        id: savedDocId,
        history: updates.history || baseHistory
      };

      if (onSave) onSave(finalSavedPayload, false);

      toast.success("Saved!", { duration: 3000, position: 'top-center' });
      if (onClose) onClose();
    } catch (err) {
      console.error("Save error:", err);
      toast.error("Save failed. Please check connection.", { duration: 4000, position: 'top-center' });
    } finally {
      setSaving(false);
      isSavingRef.current = false;
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (onClose) onClose();
      } else if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        handleSaveAndClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, handleSaveAndClose]);

  const handleDelete = async () => {
    if (!window.confirm("Remove this entry from sheet?")) return;
    if (onDelete) onDelete(row.id);
    if (onClose) onClose();
  };

  const getLogName = () => edited.Name || edited.name || row.Name || row.name || "";
  const getCallbackDateStr = () => {
    if (!edited.callbackDate) return "";
    const d = parseTimestamp(edited.callbackDate);
    return d && !isNaN(d.getTime()) ? d.toISOString().split("T")[0] : "";
  };

  const mergedHistory = useMemo(() => {
    const list = [];

    // 1. Current contact's history entries
    const currentHist = Array.isArray(edited.history) ? edited.history : (Array.isArray(savedRow.history) ? savedRow.history : []);
    currentHist.forEach((h, idx) => {
      list.push({
        status: h.status || "",
        remark: h.remark || "",
        calledFor: h.calledFor || h.called_for || h["Called For"] || "",
        source: h.source || h.sourse || h.Source || "",
        callType: h.callType || "outgoing",
        attenderName: h.attenderName || "Unknown",
        timestamp: h.timestamp || new Date().toISOString(),
        isCurrentDoc: true,
        originalIndex: idx,
        sourceProgram: savedRow.programName || "This Sheet"
      });
    });

    // 1b. Standalone remark
    if (savedRow.remark && String(savedRow.remark).trim()) {
      const remarkStr = String(savedRow.remark).trim();
      const alreadyInHistory = list.some(h => h.remark === remarkStr && h.isCurrentDoc);
      if (!alreadyInHistory) {
        list.push({
          status: savedRow.status || "",
          remark: remarkStr,
          calledFor: savedRow["Called For"] || savedRow.calledFor || "",
          source: savedRow.Source || savedRow.source || "",
          callType: savedRow.callType || "outgoing",
          attenderName: savedRow.attenderName || savedRow.assignedName || "Unknown",
          timestamp: savedRow.updatedAt?.toDate?.()?.toISOString?.() || savedRow.updatedAt || savedRow.createdAt?.toDate?.()?.toISOString?.() || savedRow.createdAt || new Date().toISOString(),
          isCurrentDoc: true,
          originalIndex: -1,
          sourceProgram: savedRow.programName || "This Sheet"
        });
      }
    }

    // 2. All other attenders' histories from savedRow.attenderStates
    if (savedRow.attenderStates) {
      Object.keys(savedRow.attenderStates).forEach(otherAttenderId => {
        const state = savedRow.attenderStates[otherAttenderId];
        const isMe = otherAttenderId === attenderId || 
                     otherAttenderId === attenderName || 
                     (state && (state.attenderId === attenderId || state.attenderName === attenderName));
        if (isMe) return; // Already included in currentHist above
        if (state) {
          const progName = state.programName || "Other Attender";
          if (Array.isArray(state.history)) {
            state.history.forEach(h => {
              list.push({
                status: h.status || "",
                remark: h.remark || "",
                calledFor: h.calledFor || h.called_for || h["Called For"] || state["Called For"] || state.calledFor || "",
                source: h.source || h.sourse || h.Source || state.Source || state.source || "",
                callType: h.callType || state.callType || "outgoing",
                attenderName: h.attenderName || state.attenderName || "Unknown",
                timestamp: h.timestamp || new Date().toISOString(),
                isCurrentDoc: false,
                sourceProgram: progName
              });
            });
          }
          if (state.remark && String(state.remark).trim()) {
            const attRemark = String(state.remark).trim();
            const alreadyInHistory = Array.isArray(state.history) && state.history.some(h => h.remark === attRemark);
            if (!alreadyInHistory) {
              list.push({
                status: state.status || "",
                remark: attRemark,
                calledFor: state["Called For"] || state.calledFor || "",
                source: state.Source || state.source || "",
                callType: state.callType || "outgoing",
                attenderName: state.attenderName || "Unknown",
                timestamp: state.updatedAt || new Date().toISOString(),
                isCurrentDoc: false,
                sourceProgram: progName
              });
            }
          }
        }
      });
    }

    const getMs = (val) => {
      if (!val) return 0;
      if (val instanceof Date) return val.getTime();
      if (typeof val === "string") return new Date(val).getTime() || 0;
      if (val.toDate && typeof val.toDate === "function") return val.toDate().getTime() || 0;
      if (typeof val === "object" && val.seconds !== undefined) return val.seconds * 1000;
      try {
        const d = new Date(val);
        return isNaN(d.getTime()) ? 0 : d.getTime();
      } catch (e) {
        return 0;
      }
    };

    list.sort((a, b) => getMs(a.timestamp) - getMs(b.timestamp));

    // Semantic Deduplication: Filter out any entries with identical remarks or close timestamps/statuses
    const uniqueList = [];
    const clean = s => String(s || "").trim().toLowerCase();

    list.forEach(item => {
      const itemRemark = clean(item.remark);
      const itemStatus = clean(item.status);
      const itemMs = getMs(item.timestamp);

      const isDuplicate = uniqueList.some(ex => {
        const exRemark = clean(ex.remark);
        const exStatus = clean(ex.status);
        const exMs = getMs(ex.timestamp);

        const timeDiff = (itemMs > 0 && exMs > 0) ? Math.abs(itemMs - exMs) : 0;
        const isTimeUnknown = itemMs === 0 || exMs === 0;

        // Rule 1: Identical non-empty remarks logged within 30 minutes of each other (or unknown timestamp)
        if (itemRemark && exRemark && itemRemark === exRemark) {
          if (isTimeUnknown || timeDiff < 1800000) return true;
        }

        // Rule 2: Same status logged within 3 minutes of each other
        if (itemStatus && exStatus && itemStatus === exStatus && itemMs > 0 && exMs > 0) {
          if (timeDiff < 180000) return true;
        }

        return false;
      });

      if (!isDuplicate) {
        uniqueList.push(item);
      }
    });

    return uniqueList;
  }, [edited.history, savedRow.history, savedRow.remark, savedRow.status, savedRow.programName, savedRow.attenderName, savedRow.assignedName, savedRow.updatedAt, savedRow.createdAt, savedRow.attenderStates, attenderId]);

  return (
    <div className="fixed inset-0 z-50 bg-white sm:bg-black/60 sm:backdrop-blur-sm flex flex-col justify-between sm:justify-center animate-fade-in h-[100dvh] w-full sm:h-auto sm:min-h-0">
      <div className="bg-[#009669] rounded-none sm:rounded-3xl w-full h-[100dvh] sm:h-auto sm:max-w-lg sm:max-h-[92vh] flex flex-col overflow-hidden shadow-2xl animate-slide-up">
        
        {/* 1. Header Card - Emerald Green */}
        <div className="bg-[#009669] rounded-t-none sm:rounded-t-3xl px-5 py-4 text-white flex flex-col gap-3.5 relative shrink-0 pt-6 sm:pt-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-full bg-white/20 text-white flex items-center justify-center font-bold shrink-0">
                <User size={22} />
              </div>
              <div className="min-w-0">
                <h3 className="text-white font-extrabold text-lg leading-tight truncate">
                  {getLogName() || "Unknown Entry"}
                </h3>
                <div className="text-[10px] font-bold text-white/80 uppercase tracking-wider mt-0.5 truncate">
                  {edited.createdAt && (
                    <span>ASSIGNED: {(edited.createdAt?.toDate ? edited.createdAt.toDate() : new Date(edited.createdAt)).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                  )}
                  {edited.lastCalledAt && (
                    <span> - LAST CALLED: {new Date(edited.lastCalledAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  if (typeof onRefreshLead === "function") {
                    onRefreshLead(edited || row);
                  }
                }}
                disabled={isFetchingShared}
                className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition active:scale-95 disabled:opacity-50"
                title="Force fetch fresh lead from database & update local cache"
              >
                <RotateCw size={17} className={isFetchingShared ? "animate-spin text-amber-300" : ""} />
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition active:scale-95"
                title="Close modal"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Action Buttons Row: Call & WhatsApp */}
          <div className="flex items-center gap-2.5 pt-1">
            <a
              href={`tel:${edited.Phone || edited.Mobile}`}
              className="flex-1 py-2.5 px-4 rounded-full border border-white/40 bg-white/10 hover:bg-white/20 active:bg-white/30 text-white font-bold text-xs flex items-center justify-center gap-2 transition"
            >
              <Phone size={15} /> Call
            </a>
            <a
              href={`https://wa.me/${(edited.Phone || edited.Mobile || "").replace(/\D/g, "")}`}
              target="_blank"
              rel="noreferrer"
              className="flex-1 py-2.5 px-4 rounded-full bg-[#10b981] hover:bg-[#059669] active:bg-[#047857] text-white font-bold text-xs flex items-center justify-center gap-2 transition shadow-md"
            >
              <MessageSquare size={15} /> WhatsApp
            </a>
          </div>
        </div>

        {/* 2. Fit 3 Tabs Side-by-Side (Zero Scroll) */}
        <div className="grid grid-cols-3 w-full border-b border-slate-200 px-2 pt-2.5 bg-white shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab("call")}
            className={`pb-2.5 text-[11px] font-extrabold tracking-tight uppercase flex items-center justify-center gap-1 border-b-2 transition-all ${
              activeTab === "call"
                ? "border-[#009669] text-[#009669]"
                : "border-transparent text-gray-400 hover:text-gray-600"
            }`}
          >
            <Phone size={13} className={activeTab === "call" ? "text-[#009669]" : "text-gray-400"} />
            Call Entry
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("profile")}
            className={`pb-2.5 text-[11px] font-extrabold tracking-tight uppercase flex items-center justify-center gap-1 border-b-2 transition-all ${
              activeTab === "profile"
                ? "border-[#009669] text-[#009669]"
                : "border-transparent text-gray-400 hover:text-gray-600"
            }`}
          >
            <User size={13} className={activeTab === "profile" ? "text-[#009669]" : "text-gray-400"} />
            Profile
          </button>

          <button
            type="button"
            onClick={() => setShowEditHistory(true)}
            className="pb-2.5 text-[11px] font-extrabold tracking-tight uppercase flex items-center justify-center gap-1 border-b-2 border-transparent text-amber-600 hover:text-amber-700 transition-all"
          >
            <Edit3 size={13} className="text-amber-600" />
            Past Logs
          </button>
        </div>

        {/* 3. Modal Body Content */}
        <div className="overflow-y-auto flex-1 px-5 py-5 space-y-5 bg-white">
          <SharedBanner
            edited={edited}
            row={row}
            globalDup={globalDup}
            freshSharedLead={freshSharedLead}
            currentAttenderName={attenderName}
            onRefreshLead={onRefreshLead}
            isFetchingShared={isFetchingShared}
          />
          {activeTab === "call" ? (
            <div className="space-y-4">
              {/* Call Type pills */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                  CALL TYPE
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {["outgoing", "incoming", "outgoing f", "incoming f"].map(opt => {
                    const isSelected = edited.callType === opt;
                    const labelText = opt === "outgoing f" ? "Outgoing (F)" : opt === "incoming f" ? "Incoming (F)" : opt.charAt(0).toUpperCase() + opt.slice(1);
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => handleCallTypeChange(opt)}
                        className={`py-2 px-3 rounded-full text-xs font-bold transition-all border ${
                          isSelected
                            ? "bg-[#009669] text-white border-[#009669] shadow-md scale-[1.02]"
                            : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        {labelText}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Multi-Program Context Selector */}
              <ProgramContextSelector
                contact={row || edited}
                programsList={programsList}
                activeProgram={activeProgram}
                onSelectProgram={handleSelectProgram}
                attenderId={attenderId}
                disabled={!getEditable(calledForField)}
              />

              {/* Called For */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Phone size={13} className="text-blue-500" /> CALLED FOR <span className="text-red-500 font-bold ml-0.5">*</span>
                </label>
                <SearchableDropdown
                  options={CALLED_FOR_OPTIONS}
                  selected={String(activeProgram || (edited[calledForField] ? String(edited[calledForField]).split(",")[0].trim() : ""))}
                  onChange={val => handleChange(calledForField, val)}
                  placeholder="Search & select..."
                  isMulti={false}
                  colorClass="blue"
                  disabled={!getEditable(calledForField)}
                />
              </div>

              {/* Source */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Tag size={13} className="text-amber-500" /> SOURCE <span className="text-red-500 font-bold ml-0.5">*</span>
                </label>
                <SearchableDropdown
                  options={SOURCE_OPTIONS}
                  selected={String(edited[sourceField] || "")}
                  onChange={val => handleChange(sourceField, val)}
                  placeholder="Search & select source..."
                  colorClass="amber"
                  disabled={!getEditable(sourceField)}
                />
              </div>

              {/* General Result Status */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 size={13} className="text-blue-500" /> GENERAL RESULT STATUS <span className="text-red-500 font-bold ml-0.5">*</span>
                </label>
                <SearchableDropdown
                  options={STATUS_OPTIONS}
                  selected={edited.status || ""}
                  onChange={val => handleChange("status", val)}
                  placeholder="Search & select status..."
                  colorClass="indigo"
                />

                {/* Registration Status Indicator Banner */}
                {programRegInfo.program && (programRegInfo.exists || edited.status === "Reg.Done") && (
                  <div className={`mt-2 p-2.5 rounded-xl border flex items-start gap-2 animate-fade-in shadow-2xs ${
                    programRegInfo.exists 
                      ? "bg-sky-50/90 border-sky-300/80 text-sky-950" 
                      : "bg-emerald-50/90 border-emerald-300/80 text-emerald-950"
                  }`}>
                    {programRegInfo.exists ? (
                      <Info size={16} className="text-sky-600 shrink-0 mt-0.5" />
                    ) : (
                      <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div className="text-xs font-extrabold flex items-center gap-1.5">
                        <span>{programRegInfo.exists ? "🔵 Existing Registration" : "🟢 New Registration"}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${
                          programRegInfo.exists 
                            ? "bg-sky-200/80 text-sky-900 border-sky-300" 
                            : "bg-emerald-200/80 text-emerald-900 border-emerald-300"
                        }`}>
                          {programRegInfo.program}
                        </span>
                      </div>
                      <div className={`text-[11px] font-medium mt-0.5 leading-tight ${
                        programRegInfo.exists ? "text-sky-800" : "text-emerald-800"
                      }`}>
                        {programRegInfo.exists ? (
                          <>Already registered for <strong>{programRegInfo.program}</strong>. This call will be logged as a call/update against the existing registration. <strong>No new registration record will be created.</strong></>
                        ) : (
                          <>No existing registration for <strong>{programRegInfo.program}</strong>. Saving will create 1 new registration record.</>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>



              {/* Call Notes & History */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <MessageSquare size={13} className="text-indigo-500" /> CALL NOTES
                  </label>
                  {mergedHistory && mergedHistory.length > 0 && (
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-[10px] font-black uppercase">
                      {mergedHistory.length} PAST
                    </span>
                  )}
                </div>

                <HistoryTimeline
                  mergedHistory={mergedHistory}
                  historyList={edited.history}
                  onChangeHistory={updated => handleChange("history", updated)}
                />

                <textarea
                  value={edited.remark || ""}
                  onChange={e => handleChange("remark", e.target.value)}
                  rows={2}
                  className="w-full px-3.5 py-2.5 bg-[#f8fafc] border border-slate-200 rounded-2xl text-xs font-medium resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-[#009669] transition"
                  placeholder="Write notes for this call..."
                />
              </div>

              {/* Follow-up / Callback scheduling */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                    <CalendarDays size={13} className={hasActivePendingFollowup ? "text-amber-600" : isFollowupCompleted ? "text-emerald-600" : "text-slate-400"} />
                    <span>Follow-up</span>
                  </label>

                  {edited.callbackDate && !isRescheduling && !isAddingNext && (
                    <button
                      type="button"
                      onClick={() => {
                        handleChange("callbackDate", null);
                        handleChange("callbackStatus", null);
                        setIsRescheduling(false);
                        setIsAddingNext(false);
                      }}
                      className="px-2 py-0.5 bg-rose-50 text-rose-600 font-bold rounded text-[10px]"
                    >
                      Remove
                    </button>
                  )}
                </div>

                {/* CASE A: Active Pending Follow-up */}
                {hasActivePendingFollowup && (
                  <>
                    {/* Mode 1: Rescheduling Mode */}
                    {isRescheduling ? (
                      <div className="space-y-3 p-3 bg-sky-50/90 border border-sky-200 rounded-xl">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-sky-100 border border-sky-300 text-sky-800 flex items-center justify-center shrink-0">
                            <RotateCw size={14} />
                          </div>
                          <div>
                            <div className="text-xs font-extrabold text-sky-950">
                              Rescheduling Follow-up
                            </div>
                            <div className="text-[10px] text-sky-700 font-medium">
                              Current: {formatFollowupDateStr(edited.callbackDate)} {edited.callbackTime ? `· ${edited.callbackTime}` : ""}
                            </div>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-sky-200/80 space-y-1.5">
                          <label className="text-[10px] font-bold text-sky-900 block">Choose new date & time:</label>
                          <div className="flex gap-2">
                            <input
                              type="date"
                              value={tempDate}
                              onChange={e => setTempDate(e.target.value)}
                              className="flex-1 px-3 py-1.5 bg-white border border-sky-300 text-sky-950 font-bold rounded-lg text-xs"
                            />
                            <input
                              type="time"
                              value={tempTime}
                              onChange={e => setTempTime(e.target.value)}
                              className="w-24 px-2 py-1.5 bg-white border border-sky-300 text-sky-950 font-bold rounded-lg text-xs"
                            />
                          </div>
                        </div>

                        <div className="pt-2 border-t border-sky-200/80 flex justify-end items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              if (!tempDate) {
                                toast.error("Please pick a valid date");
                                return;
                              }
                              saveFollowupSnapshot();
                              handleChange("callbackDate", tempDate);
                              handleChange("callbackTime", tempTime);
                              handleChange("callbackStatus", "rescheduled");
                              setIsRescheduling(false);
                              toast.success(`Rescheduled to ${formatFollowupDateStr(tempDate)}`);
                            }}
                            className="px-3.5 py-1.5 bg-sky-600 active:scale-95 text-white font-extrabold text-xs rounded-lg flex items-center gap-1"
                          >
                            <CheckCircle2 size={13} /> Confirm Reschedule
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsRescheduling(false)}
                            className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 font-bold text-xs rounded-lg"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Mode 2: Normal Pending Mode */
                      <div className="space-y-3 p-3 bg-amber-50/80 border border-amber-200 rounded-xl">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-amber-100 border border-amber-300 text-amber-800 flex items-center justify-center shrink-0">
                            <CalendarDays size={14} />
                          </div>
                          <div>
                            <div className="text-xs font-extrabold text-amber-950 flex items-center gap-1.5">
                              <span>📅 {formatFollowupDateStr(edited.callbackDate)}</span>
                              {edited.callbackTime && <span className="text-amber-800">· 🕒 {edited.callbackTime}</span>}
                            </div>
                            <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-amber-800 bg-amber-100 px-1.5 py-0.2 rounded border border-amber-300/60">
                              ⏳ {edited.callbackStatus === "rescheduled" ? "Rescheduled" : "Pending"}
                            </span>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-amber-200/80 flex justify-end items-center gap-1.5 flex-wrap">
                          {(prevFollowupState || edited.callbackStatus === "rescheduled") && (
                            <button
                              type="button"
                              onClick={handleUndoFollowup}
                              className="py-1.5 px-2 bg-white border border-slate-300 text-slate-700 font-bold text-xs rounded-lg flex items-center gap-1"
                              title="Undo previous follow-up action"
                            >
                              <Undo2 size={12} /> Undo
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              saveFollowupSnapshot();
                              handleChange("callbackStatus", "done");
                              setIsRescheduling(false);
                              toast.success("Follow-up completed ✓");
                            }}
                            className="py-1.5 px-3 bg-emerald-600 active:scale-95 text-white font-extrabold text-xs rounded-lg flex items-center gap-1"
                          >
                            <CheckCircle2 size={13} /> Complete
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setTempDate(getCallbackDateStr());
                              setTempTime(edited.callbackTime || "");
                              setIsRescheduling(true);
                            }}
                            className="py-1.5 px-2.5 bg-sky-50 text-sky-800 border border-sky-200 font-bold text-xs rounded-lg flex items-center gap-1"
                          >
                            <RotateCw size={12} /> Reschedule
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              saveFollowupSnapshot();
                              handleChange("callbackStatus", "cancelled");
                              setIsRescheduling(false);
                              toast("Follow-up cancelled");
                            }}
                            className="py-1.5 px-2 bg-rose-50 text-rose-700 border border-rose-200 font-bold text-xs rounded-lg flex items-center gap-1"
                          >
                            <X size={12} /> Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* CASE B: Completed Follow-up */}
                {isFollowupCompleted && (
                  <div className="space-y-2.5 p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl">
                    <div className="flex items-center gap-2 text-emerald-950 font-extrabold text-xs">
                      <CheckCircle2 size={15} className="text-emerald-600" />
                      <span>✓ Completed — {formatFollowupDateStr(edited.callbackDate) || "Follow-up"}</span>
                    </div>

                    {isAddingNext ? (
                      <div className="pt-2 border-t border-emerald-200/80 space-y-2">
                        <div className="text-[10px] font-bold text-emerald-900">Choose date & time for next follow-up:</div>
                        <div className="flex gap-2">
                          <input
                            type="date"
                            value={tempDate}
                            onChange={e => setTempDate(e.target.value)}
                            className="flex-1 px-3 py-1.5 bg-white border border-emerald-300 text-emerald-950 font-bold rounded-lg text-xs"
                          />
                          <input
                            type="time"
                            value={tempTime}
                            onChange={e => setTempTime(e.target.value)}
                            className="w-24 px-2 py-1.5 bg-white border border-emerald-300 text-emerald-950 font-bold rounded-lg text-xs"
                          />
                        </div>
                        <div className="flex justify-end items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              if (!tempDate) {
                                toast.error("Please pick a valid date");
                                return;
                              }
                              saveFollowupSnapshot();
                              handleChange("callbackDate", tempDate);
                              handleChange("callbackTime", tempTime);
                              handleChange("callbackStatus", "pending");
                              setIsAddingNext(false);
                              toast.success(`Next follow-up scheduled for ${formatFollowupDateStr(tempDate)}`);
                            }}
                            className="px-3.5 py-1.5 bg-indigo-600 text-white font-extrabold text-xs rounded-lg flex items-center gap-1"
                          >
                            <Plus size={13} /> Confirm New Follow-up
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsAddingNext(false)}
                            className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 font-bold text-xs rounded-lg"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="pt-2 border-t border-emerald-200/80 flex justify-end items-center gap-2">
                        <button
                          type="button"
                          onClick={handleUndoFollowup}
                          className="py-1.5 px-2.5 bg-white border border-slate-300 text-slate-700 font-bold text-xs rounded-lg flex items-center gap-1"
                          title="Undo completion and restore follow-up"
                        >
                          <Undo2 size={12} /> Undo
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const today = new Date().toISOString().split('T')[0];
                            setTempDate(today);
                            setTempTime("");
                            setIsAddingNext(true);
                          }}
                          className="py-1.5 px-3 bg-indigo-600 text-white font-extrabold text-xs rounded-lg flex items-center gap-1.5"
                        >
                          <Plus size={14} /> ＋ Add Next Follow-up
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* CASE C: Cancelled Follow-up */}
                {isFollowupCancelled && (
                  <div className="space-y-2.5 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <div className="flex items-center gap-2 text-slate-700 font-extrabold text-xs">
                      <X size={15} className="text-slate-400" />
                      <span>✕ Cancelled — {formatFollowupDateStr(edited.callbackDate) || "Follow-up"}</span>
                    </div>

                    {isAddingNext ? (
                      <div className="pt-2 border-t border-slate-200 space-y-2">
                        <div className="text-[10px] font-bold text-slate-700">Choose date & time for new follow-up:</div>
                        <div className="flex gap-2">
                          <input
                            type="date"
                            value={tempDate}
                            onChange={e => setTempDate(e.target.value)}
                            className="flex-1 px-3 py-1.5 bg-white border border-slate-300 text-slate-900 font-bold rounded-lg text-xs"
                          />
                          <input
                            type="time"
                            value={tempTime}
                            onChange={e => setTempTime(e.target.value)}
                            className="w-24 px-2 py-1.5 bg-white border border-slate-300 text-slate-900 font-bold rounded-lg text-xs"
                          />
                        </div>
                        <div className="flex justify-end items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              if (!tempDate) {
                                toast.error("Please pick a valid date");
                                return;
                              }
                              saveFollowupSnapshot();
                              handleChange("callbackDate", tempDate);
                              handleChange("callbackTime", tempTime);
                              handleChange("callbackStatus", "pending");
                              setIsAddingNext(false);
                              toast.success(`New follow-up set for ${formatFollowupDateStr(tempDate)}`);
                            }}
                            className="px-3.5 py-1.5 bg-indigo-600 text-white font-extrabold text-xs rounded-lg flex items-center gap-1"
                          >
                            <Plus size={13} /> Confirm New Follow-up
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsAddingNext(false)}
                            className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 font-bold text-xs rounded-lg"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="pt-2 border-t border-slate-200 flex justify-end items-center gap-2">
                        <button
                          type="button"
                          onClick={handleUndoFollowup}
                          className="py-1.5 px-2.5 bg-white border border-slate-300 text-slate-700 font-bold text-xs rounded-lg flex items-center gap-1"
                          title="Undo cancellation and restore follow-up"
                        >
                          <Undo2 size={12} /> Undo
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const today = new Date().toISOString().split('T')[0];
                            setTempDate(today);
                            setTempTime("");
                            setIsAddingNext(true);
                          }}
                          className="py-1.5 px-3 bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold text-xs rounded-lg flex items-center gap-1.5"
                        >
                          <Plus size={14} /> ＋ Add Next Follow-up
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* CASE D: No Follow-up set */}
                {!edited.callbackDate && !isFollowupCompleted && !isFollowupCancelled && (
                  <>
                    {isAddingNext ? (
                      <div className="space-y-2.5 p-3 bg-indigo-50/80 border border-indigo-200 rounded-xl">
                        <div className="text-xs font-extrabold text-indigo-950">Schedule Follow-up</div>
                        <div className="flex gap-2">
                          <input
                            type="date"
                            value={tempDate}
                            onChange={e => setTempDate(e.target.value)}
                            className="flex-1 px-3 py-1.5 bg-white border border-indigo-300 text-indigo-950 font-bold rounded-lg text-xs"
                          />
                          <input
                            type="time"
                            value={tempTime}
                            onChange={e => setTempTime(e.target.value)}
                            className="w-24 px-2 py-1.5 bg-white border border-indigo-300 text-indigo-950 font-bold rounded-lg text-xs"
                          />
                        </div>
                        <div className="flex justify-end items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              if (!tempDate) {
                                toast.error("Please pick a valid date");
                                return;
                              }
                              handleChange("callbackDate", tempDate);
                              handleChange("callbackTime", tempTime);
                              handleChange("callbackStatus", "pending");
                              setIsAddingNext(false);
                              toast.success(`Follow-up set for ${formatFollowupDateStr(tempDate)}`);
                            }}
                            className="px-3.5 py-1.5 bg-indigo-600 text-white font-extrabold text-xs rounded-lg flex items-center gap-1"
                          >
                            <Plus size={13} /> Confirm Follow-up
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsAddingNext(false)}
                            className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 font-bold text-xs rounded-lg"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            const today = new Date().toISOString().split('T')[0];
                            setTempDate(today);
                            setTempTime("");
                            setIsAddingNext(true);
                          }}
                          className="py-2 px-3.5 bg-indigo-50 border border-indigo-200 text-indigo-700 font-extrabold rounded-lg text-xs flex items-center gap-1.5"
                        >
                          <CalendarDays size={14} className="text-indigo-600" />
                          <span>＋ Schedule Follow-up</span>
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ) : (
            /* Profile Details Tab */
            <div className="space-y-4">
              <div className="space-y-3">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">PERSONAL INFORMATION</h4>
                
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold text-slate-500 flex items-center gap-1">
                    <User size={11} className="text-emerald-500" /> NAME
                  </label>
                  <input
                    value={edited.Name || ""}
                    onChange={e => handleChange("Name", e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold bg-white text-slate-800"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold text-slate-500 flex items-center gap-1">
                    <Phone size={11} className="text-blue-500" /> PHONE *
                  </label>
                  <input
                    value={edited.Phone || ""}
                    onChange={e => handleChange("Phone", e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold bg-white text-slate-800"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold text-slate-500 flex items-center gap-1">
                    <Phone size={11} className="text-cyan-500" /> MOBILE
                  </label>
                  <input
                    value={edited.Mobile || ""}
                    onChange={e => handleChange("Mobile", e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold bg-white text-slate-800"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold text-slate-500 flex items-center gap-1">
                    <Hash size={11} className="text-purple-500" /> EMAIL
                  </label>
                  <input
                    value={edited.Email || ""}
                    onChange={e => handleChange("Email", e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold bg-white text-slate-800"
                  />
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">LOCATION INFO</h4>
                
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold text-slate-500 flex items-center gap-1">
                    <MapPin size={11} className="text-red-500" /> CITY *
                  </label>
                  <CityAutofillInput
                    value={edited.City || ""}
                    onChange={val => handleChange("City", val)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold text-slate-500 flex items-center gap-1">
                    <MapPin size={11} className="text-amber-500" /> STATE
                  </label>
                  <input
                    value={edited.State || ""}
                    onChange={e => handleChange("State", e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold bg-white text-slate-800"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 4. Modal Footer Bar - Sticky at bottom */}
        <div className="sticky bottom-0 z-30 px-5 py-3.5 border-t border-slate-200 bg-white flex items-center justify-between shrink-0 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] pb-5 sm:pb-3.5">
          {(!row._isNew && row.id) ? (
            <button
              type="button"
              onClick={handleDelete}
              className="flex items-center gap-1.5 text-xs font-bold text-red-500 hover:text-red-700 transition active:scale-95 py-2 px-2"
            >
              <Trash2 size={16} /> Remove
            </button>
          ) : (
            <div />
          )}

          <button
            type="button"
            disabled={saving}
            onClick={() => handleSaveAndClose()}
            className="px-8 py-3 bg-[#6366f1] hover:bg-[#4f46e5] active:bg-[#4338ca] text-white font-extrabold text-xs rounded-full shadow-lg shadow-indigo-500/25 transition active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 ml-auto"
          >
            {saving && <Loader size={14} className="animate-spin text-white" />} Save & Close
          </button>
        </div>
      </div>

      {/* Edit History Modal Overlay */}
      {showEditHistory && (
        <EditHistoryModal
          row={edited}
          attenderId={attenderId}
          attenderName={attenderName}
          onClose={() => setShowEditHistory(false)}
          onHistoryUpdated={(newHistory) => {
            handleChange("history", newHistory);
          }}
        />
      )}
    </div>
  );
}
