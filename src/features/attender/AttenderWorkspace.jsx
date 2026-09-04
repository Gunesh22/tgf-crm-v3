import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import * as XLSX from "xlsx";
import { toast } from "react-hot-toast";
import {
  Phone, ArrowLeft, Plus, Download, Search, ChevronLeft, ChevronRight, ChevronDown,
  Edit3, X, Save, FileText, Calendar, Tag, User, MapPin, MessageSquare,
  Hash, Clock, PhoneOff, CheckCircle2, AlertCircle, Trash2,
  PhoneIncoming, PhoneOutgoing, CalendarDays, Loader, Flame, SlidersHorizontal, FileSpreadsheet, CheckSquare,
  Bell, Sparkles, UserCheck, RefreshCw, Info, Eye
} from "lucide-react";
import {
  subscribeToCallLogs, getAssignedContacts, safeSetLocalStorage, updateCallLog, addIncomingCallLog,
  assignContactsToAttender, normalizePhone, getActiveTags,
  INCOMING_PROGRAM_ID, INCOMING_PROGRAM_NAME, ensureIncomingProgram,
  OUTGOING_PROGRAM_ID, OUTGOING_PROGRAM_NAME, ensureOutgoingProgram,
  globalSearchContacts, searchAttenderContacts, claimContact, removeAttenderFromContact, claimCRMContact,
  fetchFreshSharedLead
} from "../../lib/db";
import { searchCRM } from "../../lib/ghl";
import {
  STATUS_OPTIONS,
  SOURCE_OPTIONS,
  CALLED_FOR_OPTIONS,
  CONNECTED_STATUSES,
  NOT_CONNECTED_STATUSES,
  getFieldWithFallback,
  getKhojiValue,
  getAttenderStatus,
  getAttenderRemark,
  getContactView,
  getSharedAttenders,
  isKhojiAffirmative,
  isKhojiNegative,
  isIgnoredField,
  getCanonicalStatus,
  isUnansweredCallback
} from "./utils";
import { normalizeProgramStates } from "../../utils/pipelineEngine";
import { EditModal } from "./components/EditModal";
import { MyPerformanceDashboard } from "./components/MyPerformanceDashboard";
import { ColumnsSelector } from "./components/ColumnsSelector";
import StageInfoModal from "./components/edit-modal/StageInfoModal";
import QuickGuideModal from "./components/QuickGuideModal";
import CommandPalette from "../../components/ui/CommandPalette";
import { Pagination } from "./components/Pagination";
import { AttenderFilters } from "./components/AttenderFilters";
import { ContactTable } from "./components/ContactTable";
import MobileAttenderView from "./mobile/MobileAttenderView";
import MobileEditModal from "./mobile/MobileEditModal";

function parseTimestamp(t) {
  if (!t) return null;
  if (t instanceof Date) return isNaN(t.getTime()) ? null : t;
  if (typeof t.toDate === "function") return t.toDate();
  if (typeof t === "object" && t.seconds !== undefined) {
    return new Date(t.seconds * 1000 + Math.round((t.nanoseconds || 0) / 1000000));
  }
  if (typeof t === "number" || typeof t === "string") {
    const d = new Date(t);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function enrichLogsWithCallbackFlags(logs, activeAttenderCtx) {
  if (!Array.isArray(logs)) return [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const seenIds = new Set();
  const uniqueLogs = [];
  for (let i = 0; i < logs.length; i++) {
    const log = logs[i];
    if (!log) continue;
    const logId = log.id || log.localId || `item_${i}`;
    if (seenIds.has(logId)) continue;
    seenIds.add(logId);
    uniqueLogs.push(log);
  }

  return uniqueLogs.map(log => {
    let shouldBeDue = false;
    const view = getContactView(log, activeAttenderCtx);
    const cbStatus = String(view.callbackStatus || log.callbackStatus || "").trim().toLowerCase();
    const isDoneOrCancelled = cbStatus === "done" || cbStatus === "completed" || cbStatus === "cancelled";
    const rawCbDate = view.callbackDate || log.callbackDate;

    if (rawCbDate && !isDoneOrCancelled) {
      const cbDate = parseTimestamp(rawCbDate);
      if (cbDate && !isNaN(cbDate.getTime())) {
        cbDate.setHours(0, 0, 0, 0);
        shouldBeDue = cbDate <= today;
      }
    }
    if (log._callbackDue === shouldBeDue) return log;
    return { ...log, _callbackDue: shouldBeDue };
  });
}

// ─── Main Attender View ───────────────────────
export default function AttenderView({ attenderId, attenderName, optionsVersion, onExit }) {
  const [isMobileScreen, setIsMobileScreen] = useState(() => typeof window !== "undefined" && window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobileScreen(window.innerWidth < 768);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  const [programs, setPrograms] = useState([]);
  const [selectedProgramId, setSelectedProgramId] = useState("");
  const [selectedProgramName, setSelectedProgramName] = useState("");
  const [selectedSubProgram, setSelectedSubProgram] = useState("");
  const [callLogs, setCallLogs] = useState([]);
  const [editingRow, setEditingRow] = useState(null);
  const [isFetchingShared, setIsFetchingShared] = useState(false);
  const [freshSharedLead, setFreshSharedLead] = useState(null);
  const [isLoadingProgram, setIsLoadingProgram] = useState(true); // skeleton state
  const [loadError, setLoadError] = useState(null); // error state
  const [requestCount, setRequestCount] = useState(10);
  const [isRequesting, setIsRequesting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");
  const [page, setPage] = useState(1);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [filterSource, setFilterSource] = useState([]);
  const [filterCity, setFilterCity] = useState([]);
  const [filterCalledFor, setFilterCalledFor] = useState([]);
  const [filterCallType, setFilterCallType] = useState([]);
  const [filterSubProgram, setFilterSubProgram] = useState([]);
  const [filterObjectionReason, setFilterObjectionReason] = useState([]);
  const [filterCallbackStatus, setFilterCallbackStatus] = useState([]);
  const [filterCallCount, setFilterCallCount] = useState([]);
  const [filterGeneralStatus, setFilterGeneralStatus] = useState([]);
  const [filterQueryStatus, setFilterQueryStatus] = useState([]);
  const [filterAbhivyakti, setFilterAbhivyakti] = useState([]);
  const [filterKhoji, setFilterKhoji] = useState([]);
  const [filterDateType, setFilterDateType] = useState("All");
  const [filterDateRange, setFilterDateRange] = useState("All");
  const [customDateFrom, setCustomDateFrom] = useState("");
  const [customDateTo, setCustomDateTo] = useState("");
  const [customTimeFrom, setCustomTimeFrom] = useState("");
  const [customTimeTo, setCustomTimeTo] = useState("");
  const [activeView, setActiveView] = useState("sheet"); // "sheet" | "performance"
  const [sortBy, setSortBy] = useState("activityDesc"); // "activityDesc" | "nameAsc" | "createdDesc"
  const [selectedTags, setSelectedTags] = useState([]);
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false);
  const [tagSearchQuery, setTagSearchQuery] = useState("");
  const ALLOWED_ATTENDER_COLS = useMemo(() => [
    "Name", "Phone", "Mobile", "City", "Khoji", "Tags", "Called For", "Type", "Status", "Remark", "Callback"
  ], []);

  const [hiddenColumns, setHiddenColumns] = useState(() => {
    try {
      const saved = localStorage.getItem(`hidden_cols_${attenderId}`);
      if (!saved) return ["City", "Khoji"];
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) return ["City", "Khoji"];
      // Filter out any legacy or unknown columns not in ALLOWED_ATTENDER_COLS
      return parsed.filter(c => ["Name", "Phone", "Mobile", "City", "Khoji", "Tags", "Called For", "Type", "Status", "Remark", "Callback"].includes(c));
    } catch {
      return ["City", "Khoji"];
    }
  });
  const [isColumnModalOpen, setIsColumnModalOpen] = useState(false);
  const [colSearchQuery, setColSearchQuery] = useState("");
  const [programDropOpen, setProgramDropOpen] = useState(false);
  const [programSearch, setProgramSearch] = useState("");
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [showStageInfoModal, setShowStageInfoModal] = useState(false);
  const [isQuickGuideOpen, setIsQuickGuideOpen] = useState(false);
  const [isSyncingDB, setIsSyncingDB] = useState(false);
  const isSyncingRef = useRef(false);
  const syncAbortControllerRef = useRef(null);
  const isComponentMountedRef = useRef(true);

  useEffect(() => {
    isComponentMountedRef.current = true;
    return () => {
      isComponentMountedRef.current = false;
      if (syncAbortControllerRef.current) {
        syncAbortControllerRef.current.abort();
        syncAbortControllerRef.current = null;
      }
      isSyncingRef.current = false;
    };
  }, []);

  // Abort active manual sync whenever attenderId changes to prevent cross-contamination
  useEffect(() => {
    if (syncAbortControllerRef.current) {
      syncAbortControllerRef.current.abort();
      syncAbortControllerRef.current = null;
    }
    isSyncingRef.current = false;
    setIsSyncingDB(false);
  }, [attenderId]);

  const handleSyncDB = async () => {
    if (isSyncingRef.current || !attenderId) return;

    console.log(`%c[MANUAL SYNC DB] Manual sync triggered by ${attenderName} (${attenderId})`, "background: #2563eb; color: #ffffff; font-weight: bold; padding: 4px 8px; border-radius: 4px;");
    const requestAttenderId = attenderId;
    isSyncingRef.current = true;
    setIsSyncingDB(true);

    if (syncAbortControllerRef.current) {
      syncAbortControllerRef.current.abort();
    }
    const controller = new AbortController();
    syncAbortControllerRef.current = controller;

    const toastId = toast.loading("Syncing with database...");
    try {
      const res = await getAssignedContacts(requestAttenderId, { signal: controller.signal, attenderName, purpose: 'manual_sync', device: 'desktop' });
      if (controller.signal.aborted || attenderId !== requestAttenderId) return;

      const rawData = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
      const normList = rawData.map(c => normalizeProgramStates(c));

      if (isComponentMountedRef.current && !controller.signal.aborted && attenderId === requestAttenderId) {
        setCallLogs(normList);
        safeSetLocalStorage(`attender_call_logs_${requestAttenderId}`, normList);
        toast.success(`Database synced! Downloaded ${normList.length} contacts.`, { id: toastId });
      }
    } catch (err) {
      if (err?.name === "AbortError" || err?.message?.includes("aborted") || controller.signal.aborted) {
        console.log("[Sync DB] Request intentionally aborted.");
        toast.dismiss(toastId);
        return;
      }
      console.error("[Sync DB Error]", err);
      toast.error(`Failed to sync database: ${err.message || err}`, { id: toastId });
    } finally {
      isSyncingRef.current = false;
      if (isComponentMountedRef.current) {
        setIsSyncingDB(false);
      }
    }
  };



  useEffect(() => {
    try {
      localStorage.setItem(`hidden_cols_${attenderId}`, JSON.stringify(hiddenColumns));
    } catch (e) {
      console.error(e);
    }
  }, [hiddenColumns, attenderId]);

  // ── Assisted Notifications Logic (Leads owned by attender but registered by a team member) ──
  const [readNotifIds, setReadNotifIds] = useState(() => {
    try {
      const saved = localStorage.getItem(`read_notifs_${attenderId}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [showNotifPopover, setShowNotifPopover] = useState(false);
  const notifRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotifPopover(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const assistedNotifications = useMemo(() => {
    if (!attenderName || !callLogs || callLogs.length === 0) return [];
    
    const currentAttenderLower = String(attenderName).trim().toLowerCase();
    const notifications = [];

    callLogs.forEach(log => {
      if (log._deleted) return;

      const status = getCanonicalStatus(log.status || "");
      if (status !== "Reg.Done") return;

      let convertedBy = log.convertedBy || "";

      if (!convertedBy && Array.isArray(log.history)) {
        const regHist = log.history.find(h => getCanonicalStatus(h.status || "") === "Reg.Done");
        if (regHist && regHist.attenderName) {
          convertedBy = regHist.attenderName;
        }
      }
      if (!convertedBy && log.attenderStates) {
        Object.values(log.attenderStates).forEach(st => {
          if (st && getCanonicalStatus(st.status || "") === "Reg.Done" && st.attenderName) {
            convertedBy = st.attenderName;
          }
        });
      }

      if (convertedBy && String(convertedBy).trim().toLowerCase() !== currentAttenderLower) {
        const nameKey = Object.keys(log).find(k => ["name", "lead name", "caller name", "lead"].includes(k.toLowerCase())) || "Name";
        const leadName = log[nameKey] || "Lead";

        notifications.push({
          id: log.id,
          leadName: leadName,
          phone: log.Phone || log.phone || log.Mobile || log.mobile || "",
          convertedBy: convertedBy,
          program: log["Called For"] || log["Sub Program"] || log.programName || "Program",
          registeredAt: log.registeredAt || log.lastCalledAt || log.updatedAt || log.createdAt,
          log: log
        });
      }
    });

    return notifications.sort((a, b) => {
      const da = parseTimestamp(a.registeredAt) || new Date(0);
      const db = parseTimestamp(b.registeredAt) || new Date(0);
      return db - da;
    });
  }, [callLogs, attenderName]);

  const unreadNotifCount = useMemo(() => {
    return assistedNotifications.filter(n => !readNotifIds.includes(n.id)).length;
  }, [assistedNotifications, readNotifIds]);

  const markAllNotificationsRead = () => {
    const allIds = assistedNotifications.map(n => n.id);
    setReadNotifIds(allIds);
    try {
      localStorage.setItem(`read_notifs_${attenderId}`, JSON.stringify(allIds));
    } catch (e) {
      console.error(e);
    }
  };

  const resetOtherFilters = () => {
    setFilterStatus("All");
    setFilterSource([]); setFilterCity([]); setFilterCalledFor([]);
    setFilterCallType([]); setFilterSubProgram([]); setFilterObjectionReason([]);
    setFilterCallbackStatus([]); setFilterCallCount([]); setFilterGeneralStatus([]);
    setFilterQueryStatus([]);
    setFilterAbhivyakti([]); setFilterKhoji([]); setFilterDateType("All"); setFilterDateRange("All");
    setCustomDateFrom(""); setCustomDateTo(""); setSearchQuery("");
  };

  // ── Global Search State ──
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState("");
  const [globalSearchResults, setGlobalSearchResults] = useState([]);
  const [isSearchingGlobal, setIsSearchingGlobal] = useState(false);

  // ── Add Call Entry dialog state ──
  const [pickedProgramId, setPickedProgramId] = useState("");

  const rowsPerPage = 50;
  const unsubRef = useRef(null);
  const didDrag = useRef(false);
  const scrollRef = useRef(null);
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragScrollLeft = useRef(0);

  useEffect(() => {
    loadPrograms();
  }, []);

  const handleRetryLoad = useCallback(() => {
    if (!attenderId) return;
    setIsLoadingProgram(true);
    setLoadError(null);
    if (unsubRef.current) unsubRef.current();

    console.log(`[ATTENDER VIEW SUB] Subscribing for attenderId: "${attenderId}"`);
    unsubRef.current = subscribeToCallLogs(
      attenderId,
      attenderName,
      (logs) => {
        setCallLogs(enrichLogsWithCallbackFlags(logs, attenderId || attenderName));
        setIsLoadingProgram(false);
        setLoadError(null);
      },
      (err) => {
        console.error("[Call Sheet Load Error]", err);
        setLoadError(err);
        setIsLoadingProgram(false);
      }
    );
  }, [attenderId, attenderName]);

  useEffect(() => {
    handleRetryLoad();
    return () => { if (unsubRef.current) unsubRef.current(); };
  }, [handleRetryLoad]);

  // Modal Close Handler with Logging
  const handleCloseModal = useCallback(() => {
    if (editingRow) {
      const leadName = editingRow.Name || editingRow.name || "Lead";
      console.log(
        `%c✖️ [MODAL CLOSED] Closed edit modal for "${leadName}" (${editingRow.id || 'new'})`,
        "background: #475569; color: #cbd5e1; font-weight: bold; padding: 3px 8px; border-radius: 4px;"
      );
    }
    setEditingRow(null);
    setFreshSharedLead(null);
    setIsFetchingShared(false);
  }, [editingRow]);

  // Trigger 1: Handle Row Selection to open EditModal (On-demand fetch for shared leads)
  const handleSelectRow = useCallback(async (row) => {
    if (!row) return;
    const isShared = Array.isArray(row.assignedTo) && row.assignedTo.length > 1;
    const leadName = row.Name || row.name || "Lead";

    console.log(
      `%c📖 [MODAL OPENED] Opening edit modal for "${leadName}" (${row.id || 'new'}) | Loading 0ms local cache & background sync...`,
      "background: #7c3aed; color: #ffffff; font-weight: bold; padding: 3px 8px; border-radius: 4px;"
    );

    console.log(
      `[ROW SELECTED DIAGNOSTIC] Lead "${leadName}" (${row.id || 'new'}) | _isNew: ${!!row._isNew} | currentAttender: "${attenderName}" (${attenderId}) | assignedTo:`,
      row.assignedTo,
      "| attenderStates keys:",
      Object.keys(row.attenderStates || {}),
      "| history length:",
      Array.isArray(row.history) ? row.history.length : 0
    );

    setEditingRow(row); // 0ms Instant Modal Render from local cache
    setFreshSharedLead(null);

    // Fetch fresh copy from MongoDB for SharedBanner reference ONLY
    const contactId = row.id || row.contactId || row._id;
    if (contactId && !row._isNew) {
      setIsFetchingShared(true);
      console.log(`[MODAL OPEN] Triggering fetchFreshSharedLead for leadId: ${contactId}`);
      try {
        const fresh = await fetchFreshSharedLead(row, attenderId, attenderName, false);
        if (fresh) {
          console.log(`[MODAL OPEN SUCCESS] Loaded fresh lead data for SharedBanner reference: ${fresh.id || contactId}`);
          setFreshSharedLead(fresh);
          setEditingRow(fresh);
        }
      } catch (err) {
        console.error(`[MODAL OPEN ERROR] Failed to fetch contact ${contactId}:`, err);
      } finally {
        setIsFetchingShared(false);
      }
    }
  }, [attenderId, attenderName]);

  // Trigger 3: Handle Manual Single-Lead Refresh
  const handleRefreshSingleLead = useCallback(async (row) => {
    if (!row) return;
    const contactId = row.id || row.contactId || row._id;
    if (!contactId) return;
    const leadName = row.Name || row.name || "Lead";
    console.log(
      `%c🔄 [MANUAL SYNC TRIGGERED] Manual refresh requested for lead "${leadName}" (${contactId})`,
      "background: #0284c7; color: #e0f2fe; font-weight: bold; padding: 3px 8px; border-radius: 4px;"
    );
    setIsFetchingShared(true);
    const startTime = Date.now();
    try {
      const fresh = await fetchFreshSharedLead(row, attenderId, attenderName, true);
      const elapsed = Date.now() - startTime;
      if (elapsed < 800) {
        await new Promise(res => setTimeout(res, 800 - elapsed));
      }
      if (fresh) {
        setFreshSharedLead(fresh);
        setEditingRow(fresh);
        toast.success(`Updated shared activity for ${leadName}!`, { id: `sync-${contactId}` });
      } else {
        toast.dismiss(`sync-${contactId}`);
      }
    } finally {
      setIsFetchingShared(false);
    }
  }, [attenderId, attenderName]);

  // Trigger 2: Triggered when user clicks "Search" button or presses Enter in Search bar
  const handleTriggerSearch = useCallback(async (overrideQuery) => {
    const q = (typeof overrideQuery === "string" ? overrideQuery : searchQuery).trim();
    if (!q || q.length < 2) return;

    // Check if matching leads exist in currently loaded memory
    const qLower = q.toLowerCase();
    const norm = normalizePhone(q);
    const localMatch = callLogs.find(log => {
      const name = String(log.Name || log.name || "").toLowerCase();
      const phone = String(log.Phone || log.phone || log.Mobile || log.mobile || "");
      const normPhone = normalizePhone(phone);
      const email = String(log.Email || log.email || "").toLowerCase();
      return name.includes(qLower) || (norm.length >= 4 && normPhone.includes(norm)) || email.includes(qLower);
    });

    if (localMatch) {
      console.log("[TRIGGER 2 SEARCH] Local match found in memory/IndexedDB");
      return;
    }

    // Fallback to targeted master contacts query
    try {
      const extraResults = await searchAttenderContacts(q, attenderId, attenderName);
      if (Array.isArray(extraResults) && extraResults.length > 0) {
        setCallLogs(prev => {
          const existingMap = new Map(prev.map(item => [item.id, item]));
          let hasNew = false;
          extraResults.forEach(item => {
            if (!existingMap.has(item.id)) {
              existingMap.set(item.id, item);
              hasNew = true;
            }
          });
          return hasNew ? Array.from(existingMap.values()) : prev;
        });
        toast.success(`Found ${extraResults.length} matching contact(s)`);
      } else {
        toast.error("No matching contact found in your assigned leads");
      }
    } catch (err) {
      console.warn("Error fetching search results:", err);
    }
  }, [searchQuery, callLogs, attenderId, attenderName]);

  // On-demand Historical Partition Fetcher: Triggered when filter requires older months outside the 3-Month Active Window
  useEffect(() => {
    if (filterDateType === "All" && filterDateRange === "All" && !customDateFrom) return;

    // Determine target historical months if custom dates or date range is set
    const targetMonths = new Set();
    let dFrom = customDateFrom ? new Date(customDateFrom) : null;
    let dTo = customDateTo ? new Date(customDateTo) : null;

    if (dFrom && !isNaN(dFrom.getTime())) {
      const start = new Date(dFrom.getFullYear(), dFrom.getMonth(), 1);
      const end = (dTo && !isNaN(dTo.getTime())) 
        ? new Date(dTo.getFullYear(), dTo.getMonth(), 1) 
        : new Date(dFrom.getFullYear(), dFrom.getMonth(), 1);

      let curr = new Date(start);
      while (curr <= end) {
        targetMonths.add(`${curr.getFullYear()}-${String(curr.getMonth() + 1).padStart(2, "0")}`);
        curr.setMonth(curr.getMonth() + 1);
      }
    } else if (dTo && !isNaN(dTo.getTime())) {
      targetMonths.add(`${dTo.getFullYear()}-${String(dTo.getMonth() + 1).padStart(2, "0")}`);
    }

    if (targetMonths.size === 0) return;

    // Calculate active 3 months (Current Month + Previous 2 Months) to SKIP re-fetching
    const now = new Date();
    const curMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    
    const p1 = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prev1MonthStr = `${p1.getFullYear()}-${String(p1.getMonth() + 1).padStart(2, "0")}`;
    
    const p2 = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    const prev2MonthStr = `${p2.getFullYear()}-${String(p2.getMonth() + 1).padStart(2, "0")}`;

    const active3Months = new Set([curMonthStr, prev1MonthStr, prev2MonthStr]);

    targetMonths.forEach(async (monthStr) => {
      if (active3Months.has(monthStr)) {
        console.log(`[HISTORICAL FETCH SKIP] Month ${monthStr} is inside 3-Month Active Window — skipping Firebase read`);
        return; // Already present in active 3-month realtime snapshot / local cache
      }
      console.log(`[HISTORICAL FETCH START] Month ${monthStr} is older than 3 months — checking IndexedDB / fetching partition on-demand`);
      // With MongoDB, all assigned contacts are fetched natively without partitions.
      console.log(`[HISTORICAL FETCH] Fetching older logs from MongoDB natively`);
      toast.success("Historical logs are fetched automatically with MongoDB");
    });
  }, [filterDateType, filterDateRange, customDateFrom, customDateTo, attenderId, attenderName]);



  const loadPrograms = async () => {
    // Ensure the default programs always exist in Firestore
    await ensureIncomingProgram();
    await ensureOutgoingProgram();
    const tags = await getActiveTags();
    // Convert active tags to object structure for compatibility
    const list = tags.map(tag => ({
      id: tag,
      name: tag,
      subPrograms: []
    }));
    setPrograms(list);
  };

  const handleGetNumbers = async () => {
    if (!selectedProgramId) { toast.error("Select a tag first."); return; }

    const currentTagCount = callLogs.filter(l => !l._deleted && (l.programId === selectedProgramId || l.tags?.includes?.(selectedProgramId) || l.Tags?.includes?.(selectedProgramId))).length;
    if (currentTagCount > 0) {
      if (!window.confirm(`You already have ${currentTagCount} entries with tag #${selectedProgramId}.\nGet ${requestCount} more contacts?`)) return;
    }
    setIsRequesting(true);
    try {
      const assigned = await assignContactsToAttender(
        selectedProgramId, // tag
        selectedProgramId, // programName (which is tag)
        attenderId,
        attenderName,
        requestCount,
        null // subProgramName
      );
      if (assigned === 0) toast.error("No more available contacts in this tag!");
      else {
        toast.success(`${assigned} contacts added to your sheet!`);
        setSelectedTags([selectedProgramId]);
        setPage(1);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to get contacts.");
    } finally {
      setIsRequesting(false);
    }
  };

  const [isRebuildingCache, setIsRebuildingCache] = useState(false);

  const handleRebuildCache = async () => {
    if (isRebuildingCache) return;
    setIsRebuildingCache(true);
    const toastId = toast.loading("Syncing with MongoDB...");
    try {
      toast.success(`MongoDB syncs continuously!`, { id: toastId });
    } catch (err) {
      toast.error("Failed to sync", { id: toastId });
    } finally {
      setIsRebuildingCache(false);
    }
  };


  const openCallEntryDialog = useCallback(() => {
    setCommandPaletteOpen(false);
    setShowAdvancedFilters(false);
    setIsColumnModalOpen(false);
    setEditingRow({
      _isNew: true,
      _timestamp: Date.now(),
      programId: INCOMING_PROGRAM_ID,
      programName: INCOMING_PROGRAM_NAME,
      attenderId, attenderName,
      Name: "", Phone: "", Mobile: "", Email: "",
      City: "", State: "", Khoji: "No", Source: "", Tags: "",
      "Called For": "",
      callType: "incoming",
      "Sub Program": "Incoming Calls",
      subProgram: "Incoming Calls",
      status: "", remark: "",
    });
  }, [attenderId, attenderName]);

  // Global Keyboard Shortcut: Alt + A directly opens the Add Call Entry modal
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      const isAltA = e.altKey && (e.code === "KeyA" || e.key?.toLowerCase() === "a" || e.keyCode === 65);
      if (isAltA) {
        e.preventDefault();
        openCallEntryDialog();
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [openCallEntryDialog]);

  const handleDeleteRow = async (id) => {
    try {
      // Remove only this attender from the contact — does NOT affect other attenders.
      // The Firestore subscription queries by assignedTo array-contains, so the
      // contact vanishes from this attender's sheet automatically.
      await removeAttenderFromContact(id, attenderId);
      setCallLogs(prev => prev.filter(l => l.id !== id));
      toast.success("Entry removed from your sheet.");
    } catch (err) {
      toast.error("Failed to remove.");
    }
  };

  const handleGlobalSearch = async (e) => {
    if (e) e.preventDefault();
    if (!globalSearchQuery.trim()) return;
    setIsSearchingGlobal(true);
    try {
      const results = await globalSearchContacts(globalSearchQuery);
      if (results.length === 0) {
        const crmLoaderId = toast.loading("No matches in Firebase. Searching CRM...");
        console.log(`[CRM Fetch Global] No Firebase matches. Initiating search CRM for query: "${globalSearchQuery}"`);
        try {
          const crmResults = await searchCRM(globalSearchQuery);
          toast.dismiss(crmLoaderId);
          if (crmResults && crmResults.length > 0) {
            console.log(`[CRM Fetch Global] Found ${crmResults.length} contact(s) in CRM:`, crmResults);
            setGlobalSearchResults(crmResults);
            toast.success(`Found ${crmResults.length} contact(s) in CRM!`);
          } else {
            console.log(`[CRM Fetch Global] No contacts found in CRM for query: "${globalSearchQuery}"`);
            setGlobalSearchResults([]);
            toast.error("No contacts found in Firebase or CRM.");
          }
        } catch (crmErr) {
          toast.dismiss(crmLoaderId);
          console.error(`[CRM Fetch Global] Error querying CRM contacts:`, crmErr);
          toast.error("Failed to query CRM contacts.");
          setGlobalSearchResults([]);
        }
      } else {
        console.log(`[Firebase Search Global] Found ${results.length} contact(s) in Firebase:`, results);
        setGlobalSearchResults(results);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to perform global search.");
    } finally {
      setIsSearchingGlobal(false);
    }
  };

  const handleClaimContact = async (contact) => {
    const confirmMsg = contact.isFromCRM
      ? `Are you sure you want to claim and import this lead from CRM?`
      : contact.isAssigned
        ? `This contact is currently assigned to ${contact.assignedName || "someone else"}.\nAre you sure you want to claim this lead?`
        : `Are you sure you want to claim this lead?`;
    if (!window.confirm(confirmMsg)) return;

    try {
      if (contact.isFromCRM) {
        const newId = await claimCRMContact(contact, attenderId, attenderName);
        toast.success("Lead claimed from CRM successfully! It will now appear on your call sheet.");
        // Update local search results so it displays as claimed/assigned
        setGlobalSearchResults(prev => prev.map(c => c.GHL_ID === contact.GHL_ID ? {
          ...c,
          id: newId,
          isFromCRM: false,
          isAssigned: true,
          assignedTo: attenderId,
          assignedName: attenderName,
          attenderId,
          attenderName
        } : c));
      } else {
        await claimContact(contact.id, attenderId, attenderName);
        toast.success("Lead claimed successfully! It will now appear on your call sheet.");
        setGlobalSearchResults(prev => prev.map(c => c.id === contact.id ? {
          ...c,
          isAssigned: true,
          assignedTo: attenderId,
          assignedName: attenderName,
          attenderId,
          attenderName
        } : c));
      }
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Failed to claim contact.");
    }
  };

  const cleanExportRow = (log) => {
    const INTERNAL_KEYS = [
      "id", "programId", "programName", "contactId", "attenderId", "createdAt", "updatedAt",
      "history", "_callbackDue", "_deleted", "isCallbackDue", "isHotLead", "callCount",
      "callbackStatus", "lastCalledAt", "firstCalledAt", "registeredAt", "conversionSource",
      "convertedBy", "subProgram", "objectionReason"
    ];

    const row = {};
    
    // Find standard field mappings
    const findValue = (obj, keysList) => {
      const matchingKeys = Object.keys(obj).filter(k => keysList.includes(k.toLowerCase()));
      for (const k of matchingKeys) {
        const val = String(obj[k] || "").trim();
        if (val) return val;
      }
      return "";
    };

    const nameVal = findValue(log, ["name", "caller", "caller name", "lead name", "lead", "name of caller"]);
    const phoneVal = findValue(log, ["phone", "mobile", "whatsapp", "phone number", "whatsapp number", "whatsappno", "contact", "contact number", "mobile number"]);
    const emailVal = findValue(log, ["email", "mail", "e-mail", "email id", "emailaddress"]);
    const cityVal = findValue(log, ["city", "location", "khoji city", "place", "city name"]);
    const stateVal = findValue(log, ["state", "state name", "province", "region"]);
    const khojiVal = findValue(log, ["khoji", "khoji yes or no", "khoji yes or no (have you done maha asmani)", "have you done maha asmani", "maha asmani", "mahaasmani", "have you done mahaasmani"]);

    const tagsVal = findValue(log, ["tags", "tag"]);
    const statusVal = log.status || "Pending";
    const remarkVal = log.remark || "";
    const subProgramVal = log["Sub Program"] || log.subProgram || "";
    const sourceVal = findValue(log, ["source", "sourse"]);
    const calledForVal = findValue(log, ["called for", "called_for", "calledfor"]);
    const callTypeVal = log.callType || "";
    const callbackStatusVal = log.callbackStatus || "";
    const objectionReasonVal = log.objectionReason || "";

    let callbackDateStr = "";
    if (log.callbackDate) {
      const d = parseTimestamp(log.callbackDate);
      if (d && !isNaN(d.getTime())) {
        callbackDateStr = d.toLocaleDateString("en-IN");
      }
    }

    row["Name"] = nameVal;
    row["Phone"] = phoneVal;
    row["Email"] = emailVal;
    row["City"] = cityVal;
    row["State"] = stateVal;
    row["Khoji"] = khojiVal;
    row["Tags"] = tagsVal;
    row["Sub Program"] = subProgramVal;
    row["Source"] = sourceVal;
    row["Called For"] = calledForVal;
    row["Call Type"] = callTypeVal;
    row["Status"] = statusVal;
    row["Remark"] = remarkVal;
    row["Callback Date"] = callbackDateStr;
    row["Callback Status"] = callbackStatusVal;
    row["Objection Reason"] = objectionReasonVal;

    // Add all other dynamic/custom keys ONLY if they are explicitly present in the _mappedFields array metadata of the contact.
    if (log._mappedFields && Array.isArray(log._mappedFields)) {
      log._mappedFields.forEach(key => {
        if (INTERNAL_KEYS.includes(key) || key.startsWith("_")) return;
        
        const isStandard = [
          "name", "caller", "caller name", "lead name", "lead", "name of caller",
          "phone", "mobile", "whatsapp", "phone number", "whatsapp number", "whatsappno", "contact", "contact number", "mobile number",
          "email", "mail", "e-mail", "email id", "emailaddress",
          "city", "location", "khoji city", "place", "city name",
          "state", "state name", "province", "region",
          "khoji", "khoji yes or no", "khoji yes or no (have you done maha asmani)", "have you done maha asmani", "maha asmani", "mahaasmani", "have you done mahaasmani",
          "tags", "tag", "status", "remark", "callbackdate", "sub program",
          "source", "sourse", "called for", "called_for", "calledfor", "call type", "calltype", "callback status", "callbackstatus", "objection reason", "objectionreason"
        ].includes(key.toLowerCase());
        
        if (!isStandard) {
          row[key] = log[key];
        }
      });
    }

    if (log.attenderName) {
      row["Attended By"] = log.attenderName;
    }

    let historyStr = "";
    if (log.history && Array.isArray(log.history)) {
      historyStr = log.history.map(h => {
        const d = parseTimestamp(h.timestamp);
        const dateStr = d && !isNaN(d.getTime()) ? d.toLocaleDateString("en-IN") : "Invalid Date";
        return `[${dateStr}] ${h.attenderName}: ${h.status} - ${h.remark}`;
      }).join(" | ");
    }
    row["Call History Timeline"] = historyStr;

    return row;
  };

  const handleExport = () => {
    if (sortedLogs.length === 0) { toast.error("Nothing to export."); return; }
    const rows = sortedLogs.map(cleanExportRow);
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "My Sheet");
    XLSX.writeFile(wb, `${attenderName}_all_${new Date().toLocaleDateString("en-CA")}.xlsx`);
    toast.success("Exported!");
  };

  // ── Drag scroll ──
  const onMouseDown = useCallback((e) => {
    isDragging.current = true; didDrag.current = false;
    dragStartX.current = e.pageX - scrollRef.current.offsetLeft;
    dragScrollLeft.current = scrollRef.current.scrollLeft;
    scrollRef.current.style.cursor = "grabbing";
  }, []);
  const onMouseMove = useCallback((e) => {
    if (!isDragging.current) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - dragStartX.current) * 1.2;
    if (Math.abs(walk) > 3) didDrag.current = true;
    scrollRef.current.scrollLeft = dragScrollLeft.current - walk;
  }, []);
  const onMouseUp = useCallback(() => {
    isDragging.current = false;
    if (scrollRef.current) scrollRef.current.style.cursor = "grab";
  }, []);

  // ── Available tags ──
  const availableTags = useMemo(() => {
    const tagsSet = new Set();
    const programNames = new Set(programs.map(p => p.name));
    programNames.add("Incoming Calls"); // ensure Incoming Calls is always considered a main tag

    let hasUntagged = false;

    callLogs.forEach(l => {
      if (l._deleted) return;
      let isTagged = false;

      const checkTag = (x) => {
        if (x) {
          tagsSet.add(x);
          isTagged = true;
        }
      };

      if (Array.isArray(l.tags)) {
        l.tags.forEach(t => {
          if (typeof t === "string") {
            t.split(",").map(x => x.trim()).filter(Boolean).forEach(checkTag);
          } else if (t) {
            checkTag(String(t).trim());
          }
        });
      }
      if (l.Tags) {
        String(l.Tags).split(",").map(x => x.trim()).filter(Boolean).forEach(checkTag);
      }
      // Backwards compatibility for old records:
      const sh = l["Sub Program"] || l.subProgram;
      if (sh) {
        String(sh).split(",").map(x => x.trim()).filter(Boolean).forEach(checkTag);
      }

      if (!isTagged && !l.programId) {
        hasUntagged = true;
      }
    });

    const list = Array.from(tagsSet).sort();
    if (hasUntagged) {
      list.push("Untagged");
    }
    return list;
  }, [callLogs, programs]);

  useEffect(() => {
    if (availableTags.length > 0) {
      setSelectedTags(prev => prev.filter(t => availableTags.includes(t)));
    } else {
      setSelectedTags([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableTags]);

  // ── Tag filtered logs ──
  const tagFilteredLogs = useMemo(() => {
    if (selectedTags.length === 0) return callLogs.filter(l => !l._deleted);
    return callLogs.filter(l => {
      if (l._deleted) return false;
      const tags = Array.isArray(l.tags) ? l.tags.map(x => String(x).trim()) : [];
      const tagsStr = l.Tags ? String(l.Tags).trim() : "";
      const splitTags = tagsStr.split(",").map(x => x.trim()).filter(Boolean);
      const subProg = l["Sub Program"] || l.subProgram || "";
      const calledFor = l["Called For"] || l.calledFor || "";
      const progId = l.programId || "";
      const progName = l.programName || "";

      const allContactTags = new Set([...tags, ...splitTags]);
      if (subProg) {
        subProg.split(",").map(x => x.trim()).filter(Boolean).forEach(x => allContactTags.add(x));
      }
      if (calledFor) {
        calledFor.split(",").map(x => x.trim()).filter(Boolean).forEach(x => allContactTags.add(x));
      }
      if (progId) allContactTags.add(String(progId).trim());
      if (progName) allContactTags.add(String(progName).trim());

      // Map program IDs to program names so ID-based tags match UI tag selections
      programs.forEach(p => {
        if (p.id && (allContactTags.has(p.id) || p.id === progId)) {
          if (p.name) allContactTags.add(p.name);
        }
      });

      const programNames = new Set(programs.map(p => p.name));
      programNames.add("Incoming Calls");

      let isTagged = false;
      allContactTags.forEach(t => {
        if (programNames.has(t)) {
          isTagged = true;
        }
      });

      const isLogUntagged = !isTagged && !l.programId;

      return selectedTags.some(t => {
        if (t === "Untagged") {
          return isLogUntagged;
        }
        return allContactTags.has(t);
      });
    });
  }, [callLogs, selectedTags, programs]);

  // ── Unique values for dropdowns dynamically computed from month data ──
  const uniqueSources = useMemo(() => {
    const set = new Set(SOURCE_OPTIONS);
    tagFilteredLogs.forEach(log => {
      const srcVal = getFieldWithFallback(log, "Source", attenderId || attenderName);
      if (srcVal) set.add(srcVal);
    });
    return Array.from(set).sort();
  }, [tagFilteredLogs, optionsVersion, attenderId, attenderName]);

  const uniqueCities = useMemo(() => {
    const set = new Set();
    tagFilteredLogs.forEach(log => {
      const cityVal = getFieldWithFallback(log, "City", attenderId || attenderName);
      if (cityVal) set.add(cityVal);
    });
    return Array.from(set).sort();
  }, [tagFilteredLogs, optionsVersion, attenderId, attenderName]);

  const uniqueCalledFor = useMemo(() => {
    const set = new Set(CALLED_FOR_OPTIONS);
    tagFilteredLogs.forEach(log => {
      const cfVal = getFieldWithFallback(log, "Called For", attenderId || attenderName);
      if (cfVal) {
        cfVal.split(",").map(x => x.trim()).filter(Boolean).forEach(cf => set.add(cf));
      }
    });
    return Array.from(set).sort();
  }, [tagFilteredLogs, optionsVersion, attenderId, attenderName]);

  const uniqueSubPrograms = useMemo(() => {
    const set = new Set();
    tagFilteredLogs.forEach(log => {
      if (log["Sub Program"]) set.add(String(log["Sub Program"]).trim());
    });
    return Array.from(set).sort();
  }, [tagFilteredLogs]);

  const uniqueObjectionReasons = useMemo(() => {
    const set = new Set();
    tagFilteredLogs.forEach(log => {
      if (log.objectionReason) set.add(String(log.objectionReason).trim());
    });
    return Array.from(set).sort();
  }, [tagFilteredLogs]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (searchQuery) count++;
    if (filterStatus !== "All") count++;
    if (filterSource.length > 0) count++;
    if (filterCity.length > 0) count++;
    if (filterCalledFor.length > 0) count++;
    if (filterCallType.length > 0) count++;
    if (filterSubProgram.length > 0) count++;
    if (filterObjectionReason.length > 0) count++;
    if (filterCallbackStatus.length > 0) count++;
    if (filterCallCount.length > 0) count++;
    if (filterGeneralStatus.length > 0) count++;
    if (filterAbhivyakti.length > 0) count++;
    if (filterKhoji.length > 0) count++;
    if (filterDateType !== "All" && filterDateRange !== "All") count++;
    if (customTimeFrom) count++;
    if (customTimeTo) count++;
    return count;
  }, [
    searchQuery, filterStatus, filterSource, filterCity, filterCalledFor,
    filterCallType, filterSubProgram, filterObjectionReason,
    filterCallbackStatus, filterCallCount, filterGeneralStatus, filterQueryStatus, filterAbhivyakti,
    filterKhoji,
    filterDateType, filterDateRange, customTimeFrom, customTimeTo
  ]);

  const handleClearAllFilters = () => {
    setSearchQuery("");
    setFilterStatus("All");
    setFilterSource([]);
    setFilterCity([]);
    setFilterCalledFor([]);
    setFilterCallType([]);
    setFilterSubProgram([]);
    setFilterObjectionReason([]);
    setFilterCallbackStatus([]);
    setFilterCallCount([]);
    setFilterGeneralStatus([]);
    setFilterAbhivyakti([]);
    setFilterKhoji([]);
    setFilterDateType("All");
    setFilterDateRange("All");
    setCustomDateFrom("");
    setCustomDateTo("");
    setCustomTimeFrom("");
    setCustomTimeTo("");
    setPage(1);
    toast.success("All filters cleared!");
  };

  // ── Filter ──
  const filteredLogs = useMemo(() => {
    return tagFilteredLogs.filter(log => {
      // 1. Text Search Query
      const q = searchQuery.trim().toLowerCase();
      if (q) {
        const qDigits = q.replace(/[\s\-\.\(\)\+]/g, "");
        const isPhoneQuery = qDigits.length >= 3 && /^\d+$/.test(qDigits);

        let isMatch = false;

        // A. Standard substring search across all values of the log
        for (const val of Object.values(log)) {
          if (val && typeof val !== "object" && String(val).toLowerCase().includes(q)) {
            isMatch = true;
            break;
          }
        }

        // B. Phone number normalized matching
        if (!isMatch && isPhoneQuery) {
          const logPhones = [
            log.Phone, log.phone, log.Mobile, log.mobile, log.Whatsapp, log.whatsapp, log.normalizedPhone, log.normalizedMobile
          ].map(p => String(p || "").replace(/[\s\-\.\(\)\+]/g, "")).filter(Boolean);

          if (logPhones.some(p => p.includes(qDigits))) {
            isMatch = true;
          }
        }

        if (!isMatch) return false;
      }

      // 2. Quick Status Filter
      const activeAttenderStatus = getAttenderStatus(log, attenderId || attenderName);
      if (filterStatus === "Hot Leads" && !log.isHotLead) return false;
      if (filterStatus === "Callback" && !log.callbackDate) return false;
      if (filterStatus === "Follow up" && !(log.callbackDate || activeAttenderStatus === "reminder" || activeAttenderStatus === "Next time")) return false;
      if (filterStatus === "Unanswered Callback" && !isUnansweredCallback(log)) return false;
      if (filterStatus === "Shared" && getSharedAttenders(log).length <= 1) return false;
      if (filterStatus === "Today Activity") {
        const dateCandidates = [
          log.lastCalledAt,
          log.updatedAt,
          log.lastActivityAt,
          log.attenderStates?.[attenderId]?.lastCalledAt,
          log.attenderStates?.[attenderId]?.updatedAt,
          ...(log.attenderStates ? Object.values(log.attenderStates).flatMap(st => [st?.lastCalledAt, st?.updatedAt]) : []),
          ...(Array.isArray(log.history) ? log.history.map(h => h.date || h.timestamp) : [])
        ];

        const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
        const endOfToday = new Date(); endOfToday.setHours(23, 59, 59, 999);

        const hasTodayActivity = dateCandidates.some(cand => {
          const d = parseTimestamp(cand);
          return d && !isNaN(d.getTime()) && d >= startOfToday && d <= endOfToday;
        });

        if (!hasTodayActivity) return false;
      }
      if (
        filterStatus !== "All" && 
        filterStatus !== "Hot Leads" && 
        filterStatus !== "Callback" && 
        filterStatus !== "Follow up" && 
        filterStatus !== "Unanswered Callback" && 
        filterStatus !== "Today Activity" && 
        filterStatus !== "Shared"
      ) {
        const canonicalFilter = getCanonicalStatus(filterStatus) || filterStatus;
        const canonicalActive = getCanonicalStatus(activeAttenderStatus) || activeAttenderStatus;

        let statusMatches = canonicalActive === canonicalFilter || activeAttenderStatus === filterStatus;

        if (!statusMatches && (canonicalFilter === "Reg.Done" || filterStatus === "Reg.Done")) {
          const isRegStage = log.pipelineStage === "6. Registered / Won" || log.pipelineStage === "Registered / Won";
          const hasRegs = Array.isArray(log.registrations) && log.registrations.length > 0;
          const hasRegHist = Array.isArray(log.history) && log.history.some(h => getCanonicalStatus(h?.status) === "Reg.Done");
          if (isRegStage || hasRegs || hasRegHist) {
            statusMatches = true;
          }
        }

        if (!statusMatches) return false;
      }

      // 3. Source Filter
      if (filterSource.length > 0) {
        const srcVal = getFieldWithFallback(log, "Source", attenderId || attenderName);
        if (!srcVal || !filterSource.includes(srcVal)) return false;
      }

      // 4. Called For Filter
      if (filterCalledFor.length > 0) {
        const cfVal = getFieldWithFallback(log, "Called For", attenderId || attenderName);
        if (!cfVal) return false;
        const logCalledFors = cfVal.split(",").map(x => x.trim()).filter(Boolean);
        if (!logCalledFors.some(cf => filterCalledFor.includes(cf))) return false;
      }

      // 5. City/Location Filter
      if (filterCity.length > 0) {
        const cityVal = getFieldWithFallback(log, "City", attenderId || attenderName);
        if (!cityVal || !filterCity.includes(cityVal)) return false;
      }

      // 6. Call Type Filter
      if (filterCallType.length > 0) {
        const activeView = getContactView(log, attenderId || attenderName);
        const cType = activeView.callType || "outgoing";
        if (!filterCallType.includes(cType)) return false;
      }

      // 7. Sub Program / Sheet Filter
      if (filterSubProgram.length > 0) {
        if (!filterSubProgram.includes(String(log["Sub Program"] || "").trim())) return false;
      }

      // 8. Objection Reason Filter
      if (filterObjectionReason.length > 0) {
        if (!filterObjectionReason.includes(String(log.objectionReason || "").trim())) return false;
      }

      // 9. Callback Status Filter
      if (filterCallbackStatus.length > 0) {
        const activeView = getContactView(log, attenderId || attenderName);
        if (!activeView.callbackDate && !log.callbackDate) return false;
        const cbStatus = activeView.callbackStatus || log.callbackStatus || "pending";
        if (!filterCallbackStatus.includes(cbStatus)) return false;
      }

      // 10. Single-Attender Call Count Filter
      if (filterCallCount.length > 0) {
        let attenderCallCount = 0;

        if (log.attenderStates && typeof log.attenderStates === "object") {
          const stateObj = findMatchingAttenderState(log.attenderStates, attenderId, attenderName);
          if (stateObj) {
            if (Array.isArray(stateObj.history) && stateObj.history.length > 0) {
              attenderCallCount = stateObj.history.length;
            } else if (stateObj.remark || stateObj.status || stateObj.lastCalledAt) {
              attenderCallCount = 1;
            }
          }
        }

        if (attenderCallCount === 0) {
          const hasAttempt = activeAttenderStatus || log.callbackDate || log.remark || log.remarks;
          const isMyLead = (log.attenderId && String(log.attenderId).toLowerCase().trim() === String(attenderId || "").toLowerCase().trim()) ||
                           (log.assignedName && String(log.assignedName).toLowerCase().trim() === String(attenderName || "").toLowerCase().trim());
          if (isMyLead) {
            if (Array.isArray(log.history) && log.history.length > 0) {
              attenderCallCount = log.history.length;
            } else if (hasAttempt) {
              attenderCallCount = 1;
            }
          }
        }

        const count = attenderCallCount;
        let match = false;
        if (filterCallCount.includes("0") && count === 0) match = true;
        if (filterCallCount.includes("1") && count === 1) match = true;
        if (filterCallCount.includes("2+") && count >= 2) match = true;
        if (!match) return false;
      }

      // 10b. General Result Status Filter
      if (filterGeneralStatus.length > 0) {
        const logStatus = activeAttenderStatus;
        const logQueryStatus = log.queryStatus || "Pending";

        const matched = filterGeneralStatus.some(f => {
          if (f === "Query Pending") return logStatus === "Query" && logQueryStatus === "Pending";
          if (f === "Query Solved")  return logStatus === "Query" && logQueryStatus === "Solved";
          return f === logStatus;
        });
        if (!matched) return false;
      }

      // 10c. Abhivyakti Filter
      if (filterAbhivyakti.length > 0) {
        const hasYes = filterAbhivyakti.includes("Yes");
        const hasNo = filterAbhivyakti.includes("No");
        if (hasYes && !hasNo && activeAttenderStatus !== "Reg.Done") return false;
        if (hasNo && !hasYes && activeAttenderStatus === "Reg.Done") return false;
      }

      // 10d. Khoji Filter
      if (filterKhoji.length > 0) {
        const val = getKhojiValue(log, attenderId || attenderName);
        const affirmative = isKhojiAffirmative(val);
        const isDew = String(val || "").toLowerCase().includes("dew d") || String(val || "").toLowerCase().includes("dewdrop");
        const isNo = isKhojiNegative(val) || !val;
        
        let match = false;
        if (filterKhoji.includes("Yes") && affirmative && !isDew) match = true;
        if (filterKhoji.includes("No") && isNo) match = true;
        if (filterKhoji.includes("Dew drop khoji") && isDew) match = true;
        
        if (!match) return false;
      }

      // 11. Date & Time Range Filter
      if (filterDateType !== "All") {
        let logDate = null;
        if (filterDateType === "lastCalledAt") {
          logDate = log.lastCalledAt ? new Date(log.lastCalledAt) : null;
        } else if (filterDateType === "createdAt") {
          logDate = log.createdAt?.toDate ? log.createdAt.toDate() : log.createdAt ? new Date(log.createdAt) : null;
        }

        if (!logDate || isNaN(logDate)) return false;

        if (filterDateRange !== "All") {
          const startOfDay = (d) => { const nd = new Date(d); nd.setHours(0, 0, 0, 0); return nd; };
          const endOfDay = (d) => { const nd = new Date(d); nd.setHours(23, 59, 59, 999); return nd; };

          const today = new Date();
          const yesterday = new Date();
          yesterday.setDate(today.getDate() - 1);

          if (filterDateRange === "Today") {
            if (logDate < startOfDay(today) || logDate > endOfDay(today)) return false;
          } else if (filterDateRange === "Yesterday") {
            if (logDate < startOfDay(yesterday) || logDate > endOfDay(yesterday)) return false;
          } else if (filterDateRange === "This Week") {
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(today.getDate() - 7);
            if (logDate < startOfDay(sevenDaysAgo)) return false;
          } else if (filterDateRange === "Custom") {
            if (customDateFrom && logDate < startOfDay(new Date(customDateFrom))) return false;
            if (customDateTo && logDate > endOfDay(new Date(customDateTo))) return false;
          }
        }

        if (customTimeFrom || customTimeTo) {
          const logHours = logDate.getHours();
          const logMinutes = logDate.getMinutes();
          const logMinutesSinceMidnight = logHours * 60 + logMinutes;

          if (customTimeFrom) {
            const [h, m] = customTimeFrom.split(":").map(Number);
            const fromMinutes = h * 60 + m;
            if (logMinutesSinceMidnight < fromMinutes) return false;
          }
          if (customTimeTo) {
            const [h, m] = customTimeTo.split(":").map(Number);
            const toMinutes = h * 60 + m;
            if (logMinutesSinceMidnight > toMinutes) return false;
          }
        }
      }

      return true;
    });
  }, [
    tagFilteredLogs, searchQuery, filterStatus, filterSource, filterCalledFor,
    filterCity, filterCallType, filterSubProgram, filterObjectionReason,
    filterCallbackStatus, filterCallCount, filterGeneralStatus, filterQueryStatus, filterAbhivyakti,
    filterKhoji,
    filterDateType, filterDateRange, customDateFrom, customDateTo, customTimeFrom, customTimeTo
  ]);

  // ── Dynamic columns from data ──
  const INTERNAL_KEYS_LOWER = useMemo(() => new Set([
    "id", "contactid", "attenderid", "attendername", "programid", "programname",
    "status", "remark", "callbackdate", "calltype", "createdat", "updatedat",
    "_callbackdue", "_deleted", "iscallbackdue", "ishotlead", "registeredat",
    "type", "callback", "call type", "call_type", "followup", "followup date",
    "history", "lastcalledat", "firstcalledat", "sub program", "subprogram",
    "ghl_id", "_contactrefid", "objectionreason",
    "normalizedphone", "normalizedmobile", "contactrefid", "conversionSource", "conversionsource",
    "convertedat", "convertedby", "isassigned",
    "assignedname", "assignedto", "assignedat", "registeredyearmonth",
    "calledfor", "called_for"
  ]), []);

  const allPossibleCols = ALLOWED_ATTENDER_COLS;

  const visibleCount = useMemo(() => {
    return 1 + allPossibleCols.filter(col => !hiddenColumns.includes(col)).length;
  }, [allPossibleCols, hiddenColumns]);

  const duplicatePhoneMap = useMemo(() => {
    const map = {};
    callLogs.forEach(log => {
      if (log._deleted) return;
      const progId = log.programId || "incoming";
      const keys = Object.keys(log);
      const phoneKey = keys.find(k => ["phone", "mobile", "whatsapp", "phone number", "whatsapp number", "whatsappno"].includes(k.toLowerCase()))
        || keys.find(k => k.toLowerCase().includes("phone") || k.toLowerCase().includes("mobile") || k.toLowerCase().includes("whatsapp"));
      const rawPhone = phoneKey ? String(log[phoneKey] || "").replace(/[\s\-\.\(\)\+]/g, "").trim() : "";
      const phone = rawPhone.length >= 10 ? rawPhone.slice(-10) : rawPhone;
      if (!phone || phone.length < 5) return;
      if (!map[progId]) map[progId] = {};
      map[progId][phone] = (map[progId][phone] || 0) + 1;
    });
    return map;
  }, [callLogs]);

  const sortedLogs = useMemo(() => {
    const list = [...filteredLogs];
    list.sort((a, b) => {
      const aDue = a._callbackDue ? 1 : 0;
      const bDue = b._callbackDue ? 1 : 0;
      if (aDue !== bDue) return bDue - aDue;

      if (sortBy === "nameAsc") {
        const aName = getFieldWithFallback(a, "Name", attenderId || attenderName).toLowerCase();
        const bName = getFieldWithFallback(b, "Name", attenderId || attenderName).toLowerCase();
        return aName.localeCompare(bName);
      } else if (sortBy === "createdDesc") {
        const aDate = parseTimestamp(a.createdAt) || new Date(0);
        const bDate = parseTimestamp(b.createdAt) || new Date(0);
        return bDate - aDate;
      } else {
        const aDate = parseTimestamp(a.lastCalledAt) || parseTimestamp(a.updatedAt) || parseTimestamp(a.createdAt) || new Date(0);
        const bDate = parseTimestamp(b.lastCalledAt) || parseTimestamp(b.updatedAt) || parseTimestamp(b.createdAt) || new Date(0);
        return bDate - aDate;
      }
    });
    return list;
  }, [filteredLogs, sortBy]);

  // ── Stats ──
  const stats = useMemo(() => {
    const active = sortedLogs;
    const total = active.length;
    const called = active.filter(l => {
      const st = getAttenderStatus(l, attenderId || attenderName);
      const rm = getAttenderRemark(l, attenderId || attenderName);
      return st || rm || l.callbackDate;
    }).length;
    const interested = active.filter(l => getAttenderStatus(l, attenderId || attenderName) === "Interested").length;
    const regDoneSet = new Set();
    active.forEach(l => {
      const cId = String(l.id || l._id || l.Phone || l.Name || "").trim();
      if (!cId) return;
      if (Array.isArray(l.registrations) && l.registrations.length > 0) {
        l.registrations.forEach(r => {
          const prog = String(r.calledForKey || r.calledFor || r.programName || l.calledFor || "general").trim().toLowerCase();
          regDoneSet.add(`${cId}_${prog}`);
        });
      } else if (getAttenderStatus(l, attenderId || attenderName) === "Reg.Done") {
        const prog = String(l.calledFor || l.programName || "general").trim().toLowerCase();
        regDoneSet.add(`${cId}_${prog}`);
      }
    });
    const regDone = regDoneSet.size;
    const callbacks = active.filter(l => l._callbackDue).length;
    const incoming = active.filter(l => getContactView(l, attenderId || attenderName).callType === "incoming").length;
    const outgoing = active.filter(l => getContactView(l, attenderId || attenderName).callType !== "incoming").length;
    const hotLeads = active.filter(l => l.isHotLead).length;
    const shared = active.filter(l => getSharedAttenders(l).length > 1).length;
    return { total, called, interested, regDone, callbacks, incoming, outgoing, hotLeads, shared };
  }, [sortedLogs, attenderId, attenderName]);

  const totalPages = Math.ceil(sortedLogs.length / rowsPerPage);
  const paginated = sortedLogs.slice((page - 1) * rowsPerPage, page * rowsPerPage);

  const performanceStats = useMemo(() => {
    let totalAttempts = 0;
    let connectedContacts = 0;
    let notConnectedContacts = 0;
    let infoGiven = 0;
    let interested = 0;
    
    const statusCounts = {};
    const objectionCounts = {};
    const dailyActivity = {}; // date string -> attempts count
    const uniqueRegSet = new Set();

    tagFilteredLogs.forEach(log => {
      const activeStatus = getAttenderStatus(log, attenderId || attenderName);
      const activeRemark = getAttenderRemark(log, attenderId || attenderName);
      const hist = Array.isArray(log.history)
        ? log.history.filter(h => {
            const hId = String(h?.attenderId || h?.by || h?.editedBy || "").toLowerCase().trim();
            const hName = String(h?.attenderName || h?.assignedName || h?.name || "").toLowerCase().trim();
            const target = String(attenderId || attenderName || "").toLowerCase().trim();
            return !target || hId === target || hName === target;
          })
        : [];
      const isCalled = activeStatus || log.callbackDate || activeRemark || hist.length > 0;
      const status = isCalled ? getCanonicalStatus(activeStatus || "Pending") : "";

      const attemptsCount = hist.length || (status ? 1 : 0);
      totalAttempts += attemptsCount;

      hist.forEach(h => {
        const d = parseTimestamp(h.timestamp);
        const dStr = d && !isNaN(d.getTime()) ? d.toLocaleDateString("en-IN") : "Invalid Date";
        dailyActivity[dStr] = (dailyActivity[dStr] || 0) + 1;
      });
      if (hist.length === 0 && status && log.updatedAt) {
        const d = parseTimestamp(log.updatedAt);
        const dStr = d && !isNaN(d.getTime()) ? d.toLocaleDateString("en-IN") : "Invalid Date";
        dailyActivity[dStr] = (dailyActivity[dStr] || 0) + 1;
      }

      if (status) {
        statusCounts[status] = (statusCounts[status] || 0) + 1;
        if (CONNECTED_STATUSES.includes(status)) {
          connectedContacts++;
          if (status === "Reg.Done") {
            const cId = String(log.id || log._id || log.Phone || log.Name || "").trim();
            const prog = String(log.calledFor || log.programName || "general").trim().toLowerCase();
            if (cId) uniqueRegSet.add(`${cId}_${prog}`);
          }
          else if (status === "Info given") infoGiven++;
          else if (status === "Interested") interested++;
        } else if (NOT_CONNECTED_STATUSES.includes(status)) {
          notConnectedContacts++;
        }
      }

      if (log.objectionReason) {
        objectionCounts[log.objectionReason] = (objectionCounts[log.objectionReason] || 0) + 1;
      }
    });

    const registrations = uniqueRegSet.size;
    const statusChartData = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));
    const objectionChartData = Object.entries(objectionCounts).map(([name, value]) => ({ name, value }));
    const dailyChartData = Object.entries(dailyActivity)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => {
        const [da, ma, ya] = a.date.split("/").map(Number);
        const [db, mb, yb] = b.date.split("/").map(Number);
        return new Date(ya, ma - 1, da) - new Date(yb, mb - 1, db);
      })
      .slice(-15);

    const assignedCount = tagFilteredLogs.length;
    const isLogCalled = l => !!(l.status || l.callbackDate || l.remark || l.remarks);
    const calledCount = tagFilteredLogs.filter(isLogCalled).length;
    const pendingCount = tagFilteredLogs.filter(l => !isLogCalled(l)).length;

    // Today's calls — count history entries with today's date
    const todayStr = new Date().toLocaleDateString("en-IN");
    let todayCallCount = 0;
    tagFilteredLogs.forEach(log => {
      const hist = log.history || [];
      hist.forEach(h => {
        if (new Date(h.timestamp).toLocaleDateString("en-IN") === todayStr) todayCallCount++;
      });
      // Fallback for logs with no history but updated today
      if (hist.length === 0 && log.status && log.updatedAt) {
        const d = parseTimestamp(log.updatedAt);
        if (d && d.toLocaleDateString("en-IN") === todayStr) todayCallCount++;
      }
    });

    // Overdue callbacks
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const callbacksDue = tagFilteredLogs.filter(l => {
      if (!l.callbackDate) return false;
      const d = parseTimestamp(l.callbackDate);
      if (!d || isNaN(d.getTime())) return false;
      d.setHours(0, 0, 0, 0);
      return d <= today && l.callbackStatus !== "done";
    }).length;

    return {
      totalAttempts,
      assignedCount,
      calledCount,
      pendingCount,
      connectedContacts,
      notConnectedContacts,
      registrations,
      infoGiven,
      interested,
      statusChartData,
      objectionChartData,
      dailyChartData,
      todayCallCount,
      callbacksDue,
      connectionRate: assignedCount > 0 ? Math.round((connectedContacts / assignedCount) * 100) : 0,
      registrationRate: assignedCount > 0 ? Math.round((registrations / assignedCount) * 100) : 0,
      callsPerAssign: assignedCount > 0 ? (totalAttempts / assignedCount).toFixed(1) : "0.0"
    };
  }, [tagFilteredLogs]);

  const getStatusBadge = (status) => {
    if (!status) return { bg: "bg-gray-100", text: "text-gray-400", label: "Pending" };
    if (status === "Reg.Done") return { bg: "bg-emerald-100", text: "text-emerald-700", label: status };
    if (status === "Interested") return { bg: "bg-blue-100", text: "text-blue-700", label: status };
    if (status === "Info given") return { bg: "bg-purple-100", text: "text-purple-700", label: status };
    if (["NA", "Busy", "Call Cut", "switched off", "Not interested", "Invalid No"].includes(status)) return { bg: "bg-red-100", text: "text-red-600", label: status };
    return { bg: "bg-indigo-100", text: "text-indigo-700", label: status };
  };

  const getCallbackStr = (log) => {
    if (!log.callbackDate) return "";
    if (log.callbackDate?.toDate) return log.callbackDate.toDate().toLocaleDateString("en-IN");
    return String(log.callbackDate).split("T")[0];
  };

  return (
    <>
      {/* Mobile-Only Dedicated Layout (< 768px) */}
      <div className="block md:hidden h-screen overflow-hidden">
        <MobileAttenderView
          optionsVersion={optionsVersion}
          attenderId={attenderId}
          attenderName={attenderName}
          isLoadingProgram={isLoadingProgram}
          filteredLogs={sortedLogs}
          allLogsCount={callLogs.length}
          filterStatus={filterStatus}
          setFilterStatus={setFilterStatus}
          onExit={onExit}
          openCallEntryDialog={openCallEntryDialog}
          handleSyncDB={handleSyncDB}
          isSyncingDB={isSyncingDB}
          handleRebuildCache={handleRebuildCache}
          isRebuildingCache={isRebuildingCache}
          setEditingRow={handleSelectRow}
          setGlobalSearchOpen={setGlobalSearchOpen}
          showAdvancedFilters={showAdvancedFilters}
          setShowAdvancedFilters={setShowAdvancedFilters}
          resetOtherFilters={resetOtherFilters}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          sortBy={sortBy}
          setSortBy={setSortBy}
          setPage={setPage}
          hiddenColumns={hiddenColumns}
          allPossibleCols={allPossibleCols}
          setIsColumnModalOpen={setIsColumnModalOpen}
          availableTags={availableTags}
          selectedTags={selectedTags}
          setSelectedTags={setSelectedTags}
          tagDropdownOpen={tagDropdownOpen}
          setTagDropdownOpen={setTagDropdownOpen}
          tagSearchQuery={tagSearchQuery}
          setTagSearchQuery={setTagSearchQuery}
          tagFilteredLogsLength={tagFilteredLogs.length}
          activeFiltersCount={activeFiltersCount}
          handleClearAllFilters={handleClearAllFilters}
          filterSource={filterSource} setFilterSource={setFilterSource}
          filterCity={filterCity} setFilterCity={setFilterCity}
          filterCalledFor={filterCalledFor} setFilterCalledFor={setFilterCalledFor}
          filterCallType={filterCallType} setFilterCallType={setFilterCallType}
          filterSubProgram={filterSubProgram} setFilterSubProgram={setFilterSubProgram}
          filterObjectionReason={filterObjectionReason} setFilterObjectionReason={setFilterObjectionReason}
          filterCallbackStatus={filterCallbackStatus} setFilterCallbackStatus={setFilterCallbackStatus}
          filterCallCount={filterCallCount} setFilterCallCount={setFilterCallCount}
          filterGeneralStatus={filterGeneralStatus} setFilterGeneralStatus={setFilterGeneralStatus}
          filterQueryStatus={filterQueryStatus} setFilterQueryStatus={setFilterQueryStatus}
          filterAbhivyakti={filterAbhivyakti} setFilterAbhivyakti={setFilterAbhivyakti}
          filterKhoji={filterKhoji} setFilterKhoji={setFilterKhoji}
          filterDateType={filterDateType} setFilterDateType={setFilterDateType}
          filterDateRange={filterDateRange} setFilterDateRange={setFilterDateRange}
          customDateFrom={customDateFrom} setCustomDateFrom={setCustomDateFrom}
          customDateTo={customDateTo} setCustomDateTo={setCustomDateTo}
          customTimeFrom={customTimeFrom} setCustomTimeFrom={setCustomTimeFrom}
          customTimeTo={customTimeTo} setCustomTimeTo={setCustomTimeTo}
          uniqueSources={uniqueSources}
          uniqueCities={uniqueCities}
          uniqueCalledFor={uniqueCalledFor}
          uniqueSubPrograms={uniqueSubPrograms}
          uniqueObjectionReasons={uniqueObjectionReasons}
          stats={stats}
          programs={programs}
          selectedProgramId={selectedProgramId}
          setSelectedProgramId={setSelectedProgramId}
          handleGetNumbers={handleGetNumbers}
          isRequesting={isRequesting}
          onTriggerSearch={handleTriggerSearch}
          assistedNotifications={assistedNotifications}
          unreadNotifCount={unreadNotifCount}
          showNotifPopover={showNotifPopover}
          setShowNotifPopover={setShowNotifPopover}
          markAllNotificationsRead={markAllNotificationsRead}
          readNotifIds={readNotifIds}
        />
      </div>

      {/* Desktop-Only Layout (>= 768px) */}
      <div className="hidden md:flex flex-col h-screen bg-slate-50 font-sans text-slate-900">
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>

      {/* Top Bar — Identity + Primary Action */}
      <header className="bg-white border-b border-slate-200 px-5 py-3 flex items-center justify-between gap-4 shrink-0 shadow-2xs">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <button onClick={onExit} className="p-1.5 hover:bg-slate-100 rounded-lg transition border border-slate-200 text-slate-600 hover:text-slate-900 cursor-pointer" title="Exit to Portal">
              <ArrowLeft size={16} />
            </button>
            <div>
              <h1 className="font-bold text-slate-900 text-base leading-none">My Call Sheet</h1>
              <p className="text-[11px] text-slate-500 font-medium mt-0.5">{attenderName}</p>
            </div>
          </div>

          {/* View Toggle tabs */}
          <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 shrink-0">
            <button
              onClick={() => setActiveView("sheet")}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                activeView === "sheet"
                  ? "bg-indigo-600 text-white shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Call Sheet
            </button>
            <button
              onClick={() => setActiveView("performance")}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                activeView === "performance"
                  ? "bg-indigo-600 text-white shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              My Performance
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Notifications & Quick Info Row */}
          <div className="flex items-center gap-2">
            {/* Sync DB Manual Download Button */}
            <button
              type="button"
              onClick={handleSyncDB}
              disabled={isSyncingDB}
              className={`px-3 py-1.5 rounded-xl border font-semibold text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                isSyncingDB
                  ? "bg-slate-100 border-slate-300 text-slate-400 cursor-not-allowed"
                  : "bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100 hover:border-indigo-300"
              }`}
              title="Manually sync & download fresh data from MongoDB Database"
            >
              <RefreshCw size={14} className={isSyncingDB ? "animate-spin text-indigo-600" : "text-indigo-600"} />
              <span>{isSyncingDB ? "Syncing..." : "Sync DB"}</span>
            </button>

            {/* Assisted Registration Notification Bell */}
            <div className="relative" ref={notifRef}>
              <button
                type="button"
                onClick={() => {
                  setShowNotifPopover(prev => !prev);
                  if (unreadNotifCount > 0) markAllNotificationsRead();
                }}
                className={`p-2 rounded-xl border transition-all flex items-center justify-center relative cursor-pointer ${
                  unreadNotifCount > 0
                    ? "bg-amber-50 border-amber-300 text-amber-600 hover:bg-amber-100 shadow-xs"
                    : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                }`}
                title="Team Assisted Registrations"
              >
                <Bell size={18} className={unreadNotifCount > 0 ? "animate-bounce" : ""} />
                {unreadNotifCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white font-extrabold text-[10px] w-5 h-5 rounded-full flex items-center justify-center border-2 border-white shadow-xs">
                    {unreadNotifCount}
                  </span>
                )}
              </button>

              {/* Notification Popover Dropdown */}
              {showNotifPopover && (
                <div className="absolute left-0 sm:left-auto sm:right-0 mt-2 w-80 sm:w-96 bg-white border border-gray-200 rounded-2xl shadow-2xl z-50 overflow-hidden animate-fadeIn">
                  <div className="p-3.5 bg-slate-900 text-white flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles size={16} className="text-amber-400" />
                      <div>
                        <h3 className="font-extrabold text-xs">Team Assisted Registrations</h3>
                        <p className="text-[10px] text-slate-300 font-medium">Registrations completed on your leads</p>
                      </div>
                    </div>
                  </div>

                  <div className="max-h-80 overflow-y-auto divide-y divide-gray-100">
                    {assistedNotifications.length === 0 ? (
                      <div className="p-6 text-center text-gray-400">
                        <UserCheck size={28} className="mx-auto mb-2 text-gray-300" />
                        <p className="text-xs font-semibold">No team-assisted registrations yet</p>
                        <p className="text-[10px] mt-1 text-gray-400">When a team member closes a registration for your assigned lead, it will show up here.</p>
                      </div>
                    ) : (
                      assistedNotifications.map(notif => {
                        const isRead = readNotifIds.includes(notif.id);
                        return (
                          <div
                            key={notif.id}
                            onClick={() => {
                              setEditingRow(notif.log);
                              setShowNotifPopover(false);
                            }}
                            className={`p-3.5 hover:bg-blue-50/60 cursor-pointer transition flex items-start gap-3 ${
                              !isRead ? "bg-amber-50/40" : ""
                            }`}
                          >
                            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-extrabold text-xs shrink-0 mt-0.5 shadow-xs">
                              {notif.convertedBy.charAt(0).toUpperCase()}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-xs font-black text-slate-900 truncate">{notif.leadName}</span>
                                <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 shrink-0">
                                  +1 Primary Credit
                                </span>
                              </div>

                              <p className="text-xs text-slate-600 mt-0.5 leading-snug">
                                Registered by <span className="font-extrabold text-blue-600">{notif.convertedBy}</span> on your behalf.
                              </p>

                              <div className="flex items-center justify-between text-[10px] text-gray-400 font-semibold mt-1.5">
                                <span className="truncate">{notif.program}</span>
                                <span>{notif.phone}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Quick Guide Eye Button */}
            <button
              type="button"
              onClick={() => setIsQuickGuideOpen(true)}
              className="p-2 rounded-xl border border-gray-200 bg-white hover:bg-slate-50 text-gray-500 hover:text-indigo-600 transition-all flex items-center justify-center cursor-pointer shadow-2xs"
              title="CRM Quick Guide & Stage Definitions (English / Hindi / Marathi)"
            >
              <Eye size={18} />
            </button>
          </div>

          {/* Primary Action: Add Call Entry */}
          <button 
            onClick={openCallEntryDialog} 
            className="flex items-center gap-2 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white rounded-lg font-bold text-xs transition shadow-2xs cursor-pointer shrink-0"
          >
            <PhoneIncoming size={14} /> Add Call Entry
          </button>
        </div>
      </header>







      {/* Global Search Modal */}
      {globalSearchOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-[550px] max-h-[85vh] flex flex-col animate-slide-up">
            <div className="flex items-center justify-between mb-4 shrink-0">
              <div>
                <h2 className="text-lg font-black text-gray-900">Global Contact Search</h2>
                <p className="text-xs text-gray-400 font-medium mt-0.5">Search and claim contacts across all lists by Name, Phone, or Email Prefix.</p>
              </div>
              <button onClick={() => { setGlobalSearchOpen(false); setGlobalSearchResults([]); setGlobalSearchQuery(""); }} className="p-1.5 hover:bg-gray-100 rounded-lg transition">
                <X size={18} className="text-gray-400" />
              </button>
            </div>

            <form onSubmit={handleGlobalSearch} className="flex gap-2 mb-4 shrink-0">
              <div className="flex-1 flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
                <Search size={16} className="text-gray-400" />
                <input
                  type="text"
                  placeholder="Enter phone, name prefix, or email..."
                  value={globalSearchQuery}
                  onChange={e => setGlobalSearchQuery(e.target.value)}
                  className="bg-transparent text-sm outline-none w-full font-medium text-gray-700"
                  autoFocus
                />
              </div>
              <button
                type="submit"
                disabled={isSearchingGlobal || !globalSearchQuery.trim()}
                className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition disabled:opacity-50 flex items-center gap-2"
              >
                {isSearchingGlobal ? <Loader size={16} className="animate-spin" /> : "Search"}
              </button>
            </form>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {isSearchingGlobal && (
                <div className="py-12 text-center text-gray-400 font-bold flex flex-col items-center gap-2">
                  <Loader size={24} className="animate-spin text-indigo-500" />
                  Searching global database...
                </div>
              )}

              {!isSearchingGlobal && globalSearchResults.length > 0 && (
                globalSearchResults.map(contact => {
                  const alreadyMine = Array.isArray(contact.assignedTo) ? contact.assignedTo.includes(attenderId) : contact.assignedTo === attenderId;
                  const isAssigned = contact.isAssigned;
                  const tags = contact.tags || [];
                  const uniqueKey = contact.id || contact.GHL_ID || Math.random().toString();

                  return (
                    <div key={uniqueKey} className="p-4 border border-gray-100 rounded-xl bg-gray-50/50 hover:bg-white hover:shadow transition flex items-center justify-between gap-4">
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-gray-900 truncate">{contact.Name || "No Name"}</p>
                          <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                            contact.isFromCRM
                              ? "bg-purple-100 text-purple-700"
                              : isAssigned
                                ? alreadyMine
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-amber-100 text-amber-700"
                                : "bg-blue-100 text-blue-700"
                          }`}>
                            {contact.isFromCRM
                              ? "CRM Lead"
                              : isAssigned
                                ? alreadyMine
                                  ? "My Lead"
                                  : `Assigned to: ${contact.assignedName || "Other"}`
                                : "Unassigned"
                            }
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 space-y-0.5">
                          <p className="flex items-center gap-1"><Phone size={12} className="text-gray-400" /> {contact.Phone || contact.Mobile || "No Phone"}</p>
                          {contact.Email && <p className="truncate flex items-center gap-1"><User size={12} className="text-gray-400" /> {contact.Email}</p>}
                        </div>
                        {tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {tags.map(t => (
                              <span key={t} className="text-[9px] font-bold bg-gray-200/60 text-gray-600 px-1.5 py-0.5 rounded">
                                #{t}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => handleClaimContact(contact)}
                        disabled={alreadyMine}
                        className={`px-3 py-1.5 rounded-lg font-bold text-xs shadow-sm transition ${
                          alreadyMine
                            ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                            : contact.isFromCRM
                              ? "bg-purple-600 hover:bg-purple-700 text-white"
                              : isAssigned
                                ? "bg-amber-500 hover:bg-amber-600 text-white"
                                : "bg-indigo-600 hover:bg-indigo-700 text-white"
                        }`}
                      >
                        {alreadyMine
                          ? "Claimed"
                          : contact.isFromCRM
                            ? "Claim & Import"
                            : isAssigned
                              ? "Claim & Reassign"
                              : "Claim Lead"
                        }
                      </button>
                    </div>
                  );
                })
              )}

              {!isSearchingGlobal && globalSearchQuery && globalSearchResults.length === 0 && (
                <div className="py-12 text-center text-gray-400 font-bold">
                  No matching contacts found globally.
                </div>
              )}

              {!globalSearchQuery && (
                <div className="py-12 text-center text-gray-400 font-semibold text-xs">
                  Enter a phone number, name prefix, or email prefix to query the entire database.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Column Config Modal */}
      <ColumnsSelector
        isOpen={isColumnModalOpen}
        onClose={() => setIsColumnModalOpen(false)}
        hiddenColumns={hiddenColumns}
        setHiddenColumns={setHiddenColumns}
        allPossibleCols={allPossibleCols}
        colSearchQuery={colSearchQuery}
        setColSearchQuery={setColSearchQuery}
      />

      {/* Filters */}
      {activeView === "sheet" && (
        <AttenderFilters
          programs={programs}
          selectedProgramId={selectedProgramId}
          setSelectedProgramId={setSelectedProgramId}
          selectedProgramName={selectedProgramName}
          setSelectedProgramName={setSelectedProgramName}
          setSelectedSubProgram={setSelectedSubProgram}
          programDropOpen={programDropOpen}
          setProgramDropOpen={setProgramDropOpen}
          programSearch={programSearch}
          setProgramSearch={setProgramSearch}
          requestCount={requestCount}
          setRequestCount={setRequestCount}
          handleGetNumbers={handleGetNumbers}
          isRequesting={isRequesting}
          handleRebuildCache={handleRebuildCache}
          isRebuildingCache={isRebuildingCache}
          isLoadingProgram={isLoadingProgram}
          optionsVersion={optionsVersion}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          sortBy={sortBy}
          setSortBy={setSortBy}
          setPage={setPage}
          showAdvancedFilters={showAdvancedFilters}
          setShowAdvancedFilters={setShowAdvancedFilters}
          activeFiltersCount={activeFiltersCount}
          hiddenColumns={hiddenColumns}
          allPossibleCols={allPossibleCols}
          setIsColumnModalOpen={setIsColumnModalOpen}
          filterStatus={filterStatus}
          setFilterStatus={setFilterStatus}
          availableTags={availableTags}
          selectedTags={selectedTags}
          setSelectedTags={setSelectedTags}
          tagDropdownOpen={tagDropdownOpen}
          setTagDropdownOpen={setTagDropdownOpen}
          tagSearchQuery={tagSearchQuery}
          setTagSearchQuery={setTagSearchQuery}
          tagFilteredLogsLength={tagFilteredLogs.length}
          resetOtherFilters={resetOtherFilters}
          stats={stats}
          filterSource={filterSource}
          setFilterSource={setFilterSource}
          filterCity={filterCity}
          setFilterCity={setFilterCity}
          filterCalledFor={filterCalledFor}
          setFilterCalledFor={setFilterCalledFor}
          filterCallType={filterCallType}
          setFilterCallType={setFilterCallType}
          filterSubProgram={filterSubProgram}
          setFilterSubProgram={setFilterSubProgram}
          filterObjectionReason={filterObjectionReason}
          setFilterObjectionReason={setFilterObjectionReason}
          filterCallbackStatus={filterCallbackStatus}
          setFilterCallbackStatus={setFilterCallbackStatus}
          filterCallCount={filterCallCount}
          setFilterCallCount={setFilterCallCount}
          filterGeneralStatus={filterGeneralStatus}
          setFilterGeneralStatus={setFilterGeneralStatus}
          filterQueryStatus={filterQueryStatus}
          setFilterQueryStatus={setFilterQueryStatus}
          filterAbhivyakti={filterAbhivyakti}
          setFilterAbhivyakti={setFilterAbhivyakti}
          filterKhoji={filterKhoji}
          setFilterKhoji={setFilterKhoji}
          filterDateType={filterDateType}
          setFilterDateType={setFilterDateType}
          filterDateRange={filterDateRange}
          setFilterDateRange={setFilterDateRange}
          customDateFrom={customDateFrom}
          setCustomDateFrom={setCustomDateFrom}
          customDateTo={customDateTo}
          setCustomDateTo={setCustomDateTo}
          customTimeFrom={customTimeFrom}
          setCustomTimeFrom={setCustomTimeFrom}
          customTimeTo={customTimeTo}
          setCustomTimeTo={setCustomTimeTo}
          uniqueSources={uniqueSources}
          uniqueCities={uniqueCities}
          uniqueCalledFor={uniqueCalledFor}
          uniqueSubPrograms={uniqueSubPrograms}
          uniqueObjectionReasons={uniqueObjectionReasons}
          handleClearAllFilters={handleClearAllFilters}
        />
      )}

      {/* Sheet Table Area */}
      {activeView === "performance" ? (
        <MyPerformanceDashboard logs={callLogs} attenderName={attenderName} attenderId={attenderId} />
      ) : loadError && callLogs.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-12 bg-white text-center">
          <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mb-3 border border-rose-100 shadow-xs">
            <AlertCircle size={24} />
          </div>
          <h3 className="text-sm font-bold text-slate-900">Unable to load contacts</h3>
          <p className="text-xs text-slate-500 max-w-sm mt-1 mb-4 leading-relaxed">
            {loadError?.message || "Something went wrong while loading your call sheet."}
          </p>
          <button
            type="button"
            onClick={handleRetryLoad}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs shadow-sm transition flex items-center gap-2 cursor-pointer active:scale-95"
          >
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      ) : isLoadingProgram && callLogs.length === 0 ? (
        <div className="flex-1 flex flex-col overflow-hidden bg-white border-t border-slate-200">
          <style>{`
            @keyframes skeletonShimmer {
              0% { background-position: -200% 0; }
              100% { background-position: 200% 0; }
            }
            .skeleton-box {
              background: linear-gradient(90deg, #F1F3F5 25%, #F8F9FA 50%, #F1F3F5 75%);
              background-size: 200% 100%;
              animation: skeletonShimmer 1.4s ease-in-out infinite;
            }
          `}</style>
          <div className="flex-1 overflow-auto">
            <table className="table-auto w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                <tr>
                  <th className="py-2.5 px-3 text-[11px] font-semibold text-slate-400 uppercase w-10 text-center">#</th>
                  <th className="py-2.5 px-3 text-[11px] font-semibold text-slate-400 uppercase min-w-[140px]">Name</th>
                  <th className="py-2.5 px-3 text-[11px] font-semibold text-slate-400 uppercase min-w-[130px]">Phone</th>
                  <th className="py-2.5 px-3 text-[11px] font-semibold text-slate-400 uppercase min-w-[120px]">City</th>
                  <th className="py-2.5 px-3 text-[11px] font-semibold text-slate-400 uppercase min-w-[120px]">Tags</th>
                  <th className="py-2.5 px-3 text-[11px] font-semibold text-slate-400 uppercase min-w-[90px]">Type</th>
                  <th className="py-2.5 px-3 text-[11px] font-semibold text-slate-400 uppercase min-w-[110px]">Status</th>
                  <th className="py-2.5 px-3 text-[11px] font-semibold text-slate-400 uppercase min-w-[200px]">Remark</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {[...Array(7)].map((_, i) => (
                  <tr key={i} className="h-[48px]">
                    <td className="py-2.5 px-3 text-center"><div className="h-4 w-4 bg-[#F1F3F5] rounded mx-auto skeleton-box" /></td>
                    <td className="py-2.5 px-3"><div className="h-4 w-28 bg-[#F1F3F5] rounded skeleton-box" /></td>
                    <td className="py-2.5 px-3"><div className="h-4 w-24 bg-[#F1F3F5] rounded skeleton-box" /></td>
                    <td className="py-2.5 px-3"><div className="h-4 w-20 bg-[#F1F3F5] rounded skeleton-box" /></td>
                    <td className="py-2.5 px-3"><div className="h-4 w-16 bg-[#F1F3F5] rounded skeleton-box" /></td>
                    <td className="py-2.5 px-3"><div className="h-4 w-14 bg-[#F1F3F5] rounded skeleton-box" /></td>
                    <td className="py-2.5 px-3"><div className="h-4 w-20 bg-[#F1F3F5] rounded skeleton-box" /></td>
                    <td className="py-2.5 px-3"><div className="h-4 w-36 bg-[#F1F3F5] rounded skeleton-box" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden">


          <ContactTable
            isLoadingProgram={isLoadingProgram}
            scrollRef={scrollRef}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            dynamicCols={["Name", "Phone", "Mobile", "City", "Khoji", "Tags", "Called For"]}
            hiddenColumns={hiddenColumns}
            paginated={paginated}
            page={page}
            rowsPerPage={rowsPerPage}
            duplicatePhoneMap={duplicatePhoneMap}
            didDrag={didDrag}
            setEditingRow={handleSelectRow}
            onRefreshLead={handleRefreshSingleLead}
            onClearFilters={handleClearAllFilters}
            callLogs={callLogs}
            attenderId={attenderId}
            attenderName={attenderName}
          />

          <Pagination
            page={page}
            totalPages={totalPages}
            setPage={setPage}
            filteredLogsLength={filteredLogs.length}
            stats={stats}
          />
        </div>
      )}
    </div>

    {/* Shared Edit Modal (PC & Mobile Isolated) */}
    {editingRow && (
      isMobileScreen ? (
        <MobileEditModal
          key={editingRow.id || (editingRow._isNew ? `new-${editingRow._timestamp || Date.now()}` : "entry")}
          optionsVersion={optionsVersion}
          row={editingRow}
          attenderId={attenderId}
          attenderName={attenderName}
          programs={programs.filter(p => p.id !== INCOMING_PROGRAM_ID && p.id !== OUTGOING_PROGRAM_ID)}
          onSave={(updated, isOptimistic) => {
            const cleanUpdated = { ...updated };
            if (cleanUpdated.id) delete cleanUpdated._isNew;
            setCallLogs(prev => {
              const index = prev.findIndex(l => (cleanUpdated.id && l.id === cleanUpdated.id) || (cleanUpdated._timestamp && l._timestamp === cleanUpdated._timestamp));
              if (index >= 0) {
                const next = [...prev];
                const merged = { ...next[index], ...cleanUpdated };
                if (merged.id) delete merged._isNew;
                next[index] = merged;
                return next;
              }
              return [cleanUpdated, ...prev];
            });
            if (!isOptimistic) setEditingRow(null);
          }}
          onDelete={handleDeleteRow}
          onClose={handleCloseModal}
          onRefreshLead={handleRefreshSingleLead}
          isFetchingShared={isFetchingShared}
          freshSharedLead={freshSharedLead}
        />
      ) : (
        <EditModal
          key={editingRow.id || (editingRow._isNew ? `new-${editingRow._timestamp || Date.now()}` : "entry")}
          optionsVersion={optionsVersion}
          row={editingRow}
          attenderId={attenderId}
          attenderName={attenderName}
          programs={programs.filter(p => p.id !== INCOMING_PROGRAM_ID && p.id !== OUTGOING_PROGRAM_ID)}
          onSave={(updated, isOptimistic) => {
            const cleanUpdated = { ...updated };
            if (cleanUpdated.id) delete cleanUpdated._isNew;
            setCallLogs(prev => {
              const index = prev.findIndex(l => (cleanUpdated.id && l.id === cleanUpdated.id) || (cleanUpdated._timestamp && l._timestamp === cleanUpdated._timestamp));
              if (index >= 0) {
                const next = [...prev];
                const merged = { ...next[index], ...cleanUpdated };
                if (merged.id) delete merged._isNew;
                next[index] = merged;
                return next;
              }
              return [cleanUpdated, ...prev];
            });
            if (!isOptimistic) handleCloseModal();
          }}
          onDelete={handleDeleteRow}
          onClose={handleCloseModal}
          onRefreshLead={handleRefreshSingleLead}
          isFetchingShared={isFetchingShared}
          freshSharedLead={freshSharedLead}
        />
      )
    )}

      {/* Global Command Palette (Ctrl+K / Cmd+K) */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        contacts={callLogs}
        onSelectContact={(c) => setEditingRow(c)}
        onOpenCallEntry={openCallEntryDialog}
        onOpenStageInfo={() => setIsQuickGuideOpen(true)}
      />

      {/* Stage Definitions Info Modal */}
      <StageInfoModal
        isOpen={showStageInfoModal}
        onClose={() => setShowStageInfoModal(false)}
      />

      {/* Attender Quick Reference Guide Modal (English / Hindi / Marathi) */}
      <QuickGuideModal
        isOpen={isQuickGuideOpen}
        onClose={() => setIsQuickGuideOpen(false)}
      />
    </>
  );
}
