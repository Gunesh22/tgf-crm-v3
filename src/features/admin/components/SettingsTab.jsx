import React, { useState, useEffect, useRef } from "react";
import { toast } from "react-hot-toast";
import { 
  ShieldCheck, Tag, HelpCircle, Loader, Archive, PhoneCall, PhoneOff
} from "lucide-react";
import { OptionsManagerCard } from "./OptionsManagerCard";
import { WhatsAppTemplatesCard } from "./WhatsAppTemplatesCard";
import CompulsoryFieldBypassCard from "./CompulsoryFieldBypassCard";
import { SettingsSubnav } from "./SettingsSubnav";
import { AdminPasswordCard } from "./AdminPasswordCard";
import { StatusClassificationCard } from "./StatusClassificationCard";
import { StatusStageMappingCard } from "./StatusStageMappingCard";
import { AddStatusCategorizationModal } from "./AddStatusCategorizationModal";
import { 
  getSettingsOptions, 
  updateCallCenterOptions,
  getActiveCacheMonths,
  getLockedMonthlyReports,
  DEFAULT_CONNECTED_STATUSES,
  DEFAULT_NOT_CONNECTED_STATUSES,
  DEFAULT_WHATSAPP_TEMPLATES
} from "../../../lib/db";
import { updateDynamicOptions } from "../../attender/utils";

export default function SettingsTab() {
  const [options, setOptions] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeMonths, setActiveMonths] = useState([]);
  const [lockedMonths, setLockedMonths] = useState([]);
  const [isLoadingMonths, setIsLoadingMonths] = useState(false);
  const [draggedItem, setDraggedItem] = useState(null);
  const [dragOverCategory, setDragOverCategory] = useState(null);
  const [addStatusModal, setAddStatusModal] = useState(null);
  const [classificationSearch, setClassificationSearch] = useState("");
  const [activeSection, setActiveSection] = useState("security");
  const isClickingRef = useRef(false);

  useEffect(() => {
    loadOptions();
    loadMonths();
  }, []);

  const sectionIds = ["security", "call-center", "whatsapp-templates", "status-rules", "status-stage-mapping", "call-classification", "data-management"];

  useEffect(() => {
    if (isLoading) return;

    const findScrollContainer = () =>
      document.querySelector("main .overflow-y-auto") ||
      document.querySelector(".overflow-y-auto") ||
      null;

    const container = findScrollContainer();

    const observerOptions = {
      root: container,
      rootMargin: "-20% 0px -60% 0px",
      threshold: 0.01
    };

    const handleIntersect = (entries) => {
      if (isClickingRef.current) return;

      const visible = entries.filter((e) => e.isIntersecting);
      if (visible.length > 0) {
        visible.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        setActiveSection(visible[0].target.id);
      }
    };

    const observer = new IntersectionObserver(handleIntersect, observerOptions);

    sectionIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [isLoading]);

  const loadOptions = async () => {
    setIsLoading(true);
    try {
      const data = await getSettingsOptions();
      setOptions(data);
      updateDynamicOptions(data);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load settings: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const loadMonths = async () => {
    setIsLoadingMonths(true);
    try {
      const active = await getActiveCacheMonths();
      const locked = await getLockedMonthlyReports();
      setActiveMonths(active);
      setLockedMonths(locked);
    } catch (err) {
      console.error("Failed to load months:", err);
    } finally {
      setIsLoadingMonths(false);
    }
  };

  const handleOptionChange = async (type, action, val, newVal) => {
    const key = type === "status" ? "statusOptions" : type === "source" ? "sourceOptions" : "calledForOptions";
    const current = options[key] || [];
    
    let updated;
    if (action === "delete") {
      if (type === "status" && ["Reg.Done", "NA"].includes(val)) {
        toast.error(`Cannot delete required status: ${val}`);
        return;
      }
      updated = current.filter(x => x !== val);
    } else if (action === "rename") {
      if (!newVal || !newVal.trim()) {
        toast.error("Option name cannot be empty!");
        return;
      }
      const trimmedNew = newVal.trim();
      if (val === trimmedNew) return;
      if (current.includes(trimmedNew)) {
        toast.error("Option name already exists!");
        return;
      }
      if (type === "status" && ["Reg.Done", "NA"].includes(val)) {
        toast.error(`Cannot rename required status: ${val}`);
        return;
      }
      updated = current.map(x => (x === val ? trimmedNew : x));
    } else {
      if (!val || !val.trim()) return;
      const trimmedVal = val.trim();
      if (current.includes(trimmedVal)) {
        toast.error("Option already exists!");
        return;
      }
      if (type === "status") {
        setAddStatusModal(trimmedVal);
        return;
      }
      updated = [...current, trimmedVal];
    }

    let updatePayload = { [key]: updated };

    if (type === "status") {
      const currentConn = options?.connectedStatuses || DEFAULT_CONNECTED_STATUSES;
      const currentNotConn = options?.notConnectedStatuses || DEFAULT_NOT_CONNECTED_STATUSES;
      const currentOptComp = options?.optionalCompulsoryStatuses || currentNotConn;

      if (action === "delete") {
        updatePayload.connectedStatuses = currentConn.filter(s => s !== val);
        updatePayload.notConnectedStatuses = currentNotConn.filter(s => s !== val);
        updatePayload.optionalCompulsoryStatuses = currentOptComp.filter(s => s !== val);
      } else if (action === "rename") {
        const trimmedNew = newVal.trim();
        updatePayload.connectedStatuses = currentConn.map(s => (s === val ? trimmedNew : s));
        updatePayload.notConnectedStatuses = currentNotConn.map(s => (s === val ? trimmedNew : s));
        updatePayload.optionalCompulsoryStatuses = currentOptComp.map(s => (s === val ? trimmedNew : s));
      }
    }

    try {
      await updateCallCenterOptions(updatePayload);
      setOptions(prev => ({
        ...prev,
        ...updatePayload
      }));
      updateDynamicOptions(updatePayload);
      toast.success(
        action === "rename"
          ? "Option renamed successfully!"
          : action === "delete"
          ? "Option deleted successfully!"
          : "Option added successfully!"
      );
    } catch (err) {
      console.error(err);
      toast.error("Failed to update option: " + err.message);
    }
  };

  const confirmAddStatus = async (category) => {
    if (!addStatusModal) return;
    const newStatusName = addStatusModal;
    setAddStatusModal(null);

    const currentStatusOptions = options?.statusOptions || [];
    const updatedStatusOptions = [...currentStatusOptions, newStatusName];

    let updatePayload = {
      statusOptions: updatedStatusOptions
    };

    let categoryMsg = "added as Not Assigned.";
    if (category === "connected") {
      const currentConn = options?.connectedStatuses || DEFAULT_CONNECTED_STATUSES;
      updatePayload.connectedStatuses = Array.from(new Set([...currentConn, newStatusName]));
      categoryMsg = "added & categorized as Connected.";
    } else if (category === "notConnected") {
      const currentNotConn = options?.notConnectedStatuses || DEFAULT_NOT_CONNECTED_STATUSES;
      const currentOptComp = options?.optionalCompulsoryStatuses || currentNotConn;
      updatePayload.notConnectedStatuses = Array.from(new Set([...currentNotConn, newStatusName]));
      updatePayload.optionalCompulsoryStatuses = Array.from(new Set([...currentOptComp, newStatusName]));
      categoryMsg = "added & categorized as Not Connected (Compulsory fields optional).";
    }

    try {
      await updateCallCenterOptions(updatePayload);
      setOptions(prev => ({
        ...prev,
        ...updatePayload
      }));
      updateDynamicOptions(updatePayload);
      toast.success(`Status "${newStatusName}" ${categoryMsg}`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to add status option: " + err.message);
    }
  };

  const handleMoveStatus = async (status, fromCategory, toCategory) => {
    if (fromCategory === toCategory) return;

    const currentConn = options?.connectedStatuses || DEFAULT_CONNECTED_STATUSES;
    const currentNotConn = options?.notConnectedStatuses || DEFAULT_NOT_CONNECTED_STATUSES;

    let newConn = currentConn.filter(s => s !== status);
    let newNotConn = currentNotConn.filter(s => s !== status);

    if (toCategory === "connected") {
      newConn.push(status);
    } else if (toCategory === "notConnected") {
      newNotConn.push(status);
    }

    const updatePayload = {
      connectedStatuses: newConn,
      notConnectedStatuses: newNotConn
    };

    try {
      await updateCallCenterOptions(updatePayload);
      setOptions(prev => ({
        ...prev,
        ...updatePayload
      }));
      updateDynamicOptions(updatePayload);
      const label = toCategory === "connected" ? "Connected Calls (Compulsory Fields Required)" : toCategory === "notConnected" ? "Not Connected Calls (Compulsory Fields Optional)" : "Not Assigned";
      toast.success(`Moved "${status}" to ${label}`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to update status categorization: " + err.message);
    }
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader size={32} className="text-indigo-500 animate-spin" />
      </div>
    );
  }

  const statusOptionsSet = new Set(options?.statusOptions || []);
  const rawConn = options?.connectedStatuses || DEFAULT_CONNECTED_STATUSES;
  const rawNotConn = options?.notConnectedStatuses || DEFAULT_NOT_CONNECTED_STATUSES;

  const connectedList = rawConn.filter(s => statusOptionsSet.has(s));
  const notConnectedList = rawNotConn.filter(s => statusOptionsSet.has(s));

  const connectedSet = new Set(connectedList);
  const notConnectedSet = new Set(notConnectedList);

  const unassignedList = (options?.statusOptions || []).filter(
    s => !connectedSet.has(s) && !notConnectedSet.has(s)
  );

  const searchLower = classificationSearch.trim().toLowerCase();
  const displayConnectedList = connectedList.filter(s => s.toLowerCase().includes(searchLower));
  const displayNotConnectedList = notConnectedList.filter(s => s.toLowerCase().includes(searchLower));
  const displayUnassignedList = unassignedList.filter(s => s.toLowerCase().includes(searchLower));

  const handleSaveWhatsappTemplates = async (updatedTemplates) => {
    try {
      await updateCallCenterOptions({ whatsappTemplates: updatedTemplates });
      setOptions((prev) => ({
        ...prev,
        whatsappTemplates: updatedTemplates
      }));
    } catch (err) {
      console.error(err);
      throw err;
    }
  };



  const scrollToSection = (id) => {
    setActiveSection(id);
    isClickingRef.current = true;

    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    setTimeout(() => {
      isClickingRef.current = false;
    }, 800);
  };

  const sectionTitles = {
    security: { title: "Security & Master Password", desc: "Manage administrative access, authentication credentials, and security settings." },
    "call-center": { title: "Call Center Options", desc: "Configure global dropdown options and status lists." },
    "whatsapp-templates": { title: "WhatsApp Message Templates", desc: "Customize quick message templates used by attenders when sending WhatsApp messages." },
    "status-rules": { title: "Status Rules & Compulsory Fields", desc: "Configure which fields are required when an attender logs a specific call status." },
    "status-stage-mapping": { title: "Status to Pipeline Stage Mapping", desc: "Configure which pipeline stage each call status maps to. Stored in MongoDB." },
    "call-classification": { title: "Call Classification (Drag & Drop)", desc: "Classify statuses into Connected, Not Connected, or Unassigned categories for reporting." },
    "data-management": { title: "Data Management & Historical Logs", desc: "Manage monthly log archives, raw database purges, and historical snapshots." }
  };

  const currentSection = sectionTitles[activeSection] || sectionTitles.security;

  return (
    <div className="bg-[#F6F8FB] min-h-screen p-4 md:p-6 pb-24 space-y-6">
      <div className="max-w-[1240px] mx-auto space-y-4">
        {/* Compact Settings Navigation Bar */}
        <SettingsSubnav
          activeSection={activeSection}
          onSelectSection={scrollToSection}
        />

        {/* Page & Active Section Header */}
        <div className="pt-0 pb-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 tracking-wide">
            <span>Settings</span>
            <span className="text-[#98A2B3]">/</span>
            <span className="text-[#172033]">{currentSection.title}</span>
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-[#172033] tracking-tight mt-1">
            {currentSection.title}
          </h1>
          <p className="text-xs md:text-sm text-[#667085] mt-0.5 font-medium max-w-2xl leading-relaxed">
            {currentSection.desc}
          </p>
        </div>

        {/* Section 1: Security */}
        <div 
          id="security" 
          className="relative isolate overflow-hidden bg-white border border-[#E4E7EC] rounded-xl mb-6 shadow-[0_1px_3px_rgba(16,24,40,0.04)] scroll-mt-[90px] p-5 md:p-6 space-y-4"
        >
          <AdminPasswordCard highlighted={false} />
        </div>

        {/* Section 2: Call Center Options */}
        <div 
          id="call-center" 
          className="relative isolate overflow-hidden bg-white border border-[#E4E7EC] rounded-xl mb-6 shadow-[0_1px_3px_rgba(16,24,40,0.04)] scroll-mt-[90px] p-5 md:p-6 space-y-5"
        >
          <div className="flex items-center gap-3 border-b border-[#E4E7EC] pb-4">
            <div className="w-8 h-8 rounded-md bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center shrink-0 shadow-2xs">
              <ShieldCheck size={18} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#172033]">Call Center Options</h3>
              <p className="text-xs text-[#667085] mt-0.5">Configure dropdown values for Status, Source, and Called For globally.</p>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <OptionsManagerCard
              title="Status Options"
              icon={ShieldCheck}
              options={options?.statusOptions || []}
              onAdd={(val) => handleOptionChange("status", "add", val)}
              onDelete={(val) => handleOptionChange("status", "delete", val)}
              onRename={(oldVal, newVal) => handleOptionChange("status", "rename", oldVal, newVal)}
            />
            <OptionsManagerCard
              title="Source Options"
              icon={Tag}
              options={options?.sourceOptions || []}
              onAdd={(val) => handleOptionChange("source", "add", val)}
              onDelete={(val) => handleOptionChange("source", "delete", val)}
              onRename={(oldVal, newVal) => handleOptionChange("source", "rename", oldVal, newVal)}
            />
            <OptionsManagerCard
              title="Called For Options"
              icon={HelpCircle}
              options={options?.calledForOptions || []}
              onAdd={(val) => handleOptionChange("calledFor", "add", val)}
              onDelete={(val) => handleOptionChange("calledFor", "delete", val)}
              onRename={(oldVal, newVal) => handleOptionChange("calledFor", "rename", oldVal, newVal)}
            />
          </div>
        </div>

        {/* Section 3: WhatsApp Message Templates */}
        <div 
          id="whatsapp-templates" 
          className="relative isolate overflow-hidden bg-white border border-[#E4E7EC] rounded-xl mb-6 shadow-[0_1px_3px_rgba(16,24,40,0.04)] scroll-mt-[90px] p-5 md:p-6 space-y-4"
        >
          <WhatsAppTemplatesCard
            templates={options?.whatsappTemplates || DEFAULT_WHATSAPP_TEMPLATES}
            onSaveTemplates={handleSaveWhatsappTemplates}
          />
        </div>

        {/* Section 4: Status Rules */}
        <div 
          id="status-rules" 
          className="relative isolate overflow-hidden bg-white border border-[#E4E7EC] rounded-xl mb-6 shadow-[0_1px_3px_rgba(16,24,40,0.04)] scroll-mt-[90px] p-5 md:p-6 space-y-4"
        >
          <CompulsoryFieldBypassCard
            options={options}
            setOptions={setOptions}
          />
        </div>

        {/* Section 4b: Status to Pipeline Stage Mapping */}
        <div 
          id="status-stage-mapping" 
          className="relative isolate overflow-hidden bg-white border border-[#E4E7EC] rounded-xl mb-6 shadow-[0_1px_3px_rgba(16,24,40,0.04)] scroll-mt-[90px] p-5 md:p-6 space-y-4"
        >
          <StatusStageMappingCard
            options={options}
            onSaveMapping={async (payload) => {
              const updatePayload = payload.statusStageMapping ? payload : { statusStageMapping: payload };
              await updateCallCenterOptions(updatePayload);
              setOptions(prev => ({ ...prev, ...updatePayload }));
              updateDynamicOptions({ ...options, ...updatePayload });
            }}
          />
        </div>

        {/* Section 5: Drag & Drop Status Classification */}
        <div 
          id="call-classification" 
          className="relative isolate overflow-hidden bg-white border border-[#E4E7EC] rounded-xl mb-6 shadow-[0_1px_3px_rgba(16,24,40,0.04)] scroll-mt-[90px] p-5 md:p-6 space-y-4"
        >
          <StatusClassificationCard
            classificationSearch={classificationSearch}
            setClassificationSearch={setClassificationSearch}
            dragOverCategory={dragOverCategory}
            setDragOverCategory={setDragOverCategory}
            draggedItem={draggedItem}
            setDraggedItem={setDraggedItem}
            handleMoveStatus={handleMoveStatus}
            displayConnectedList={displayConnectedList}
            connectedList={connectedList}
            displayNotConnectedList={displayNotConnectedList}
            notConnectedList={notConnectedList}
            displayUnassignedList={displayUnassignedList}
            unassignedList={unassignedList}
          />
        </div>

        {/* Section 6: Data Management */}
        <div 
          id="data-management" 
          className="relative isolate overflow-hidden bg-white border border-[#E4E7EC] rounded-xl mb-6 shadow-[0_1px_3px_rgba(16,24,40,0.04)] scroll-mt-[90px] p-5 md:p-6 space-y-5"
        >
          <div className="flex items-center gap-3 border-b border-[#E4E7EC] pb-4">
            <div className="w-8 h-8 rounded-md bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center shrink-0 shadow-2xs">
              <Archive size={18} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#172033]">Data Management & Historical Logs</h3>
              <p className="text-xs text-[#667085] mt-0.5 max-w-2xl">
                Historical call logs are automatically locked at the end of each month into static snapshots, and raw entries are purged from the database to optimize space.
              </p>
            </div>
          </div>

          {isLoadingMonths ? (
            <div className="flex items-center gap-2 text-xs text-[#667085] py-4 bg-white rounded-[10px] border border-[#E4E7EC] p-5">
              <Loader size={14} className="animate-spin text-blue-600" />
              Loading historical months...
            </div>
          ) : (
            <div className="bg-white border border-[#E4E7EC] rounded-[10px] overflow-hidden shadow-[0_1px_3px_rgba(16,24,40,0.04),0_1px_2px_rgba(16,24,40,0.02)]">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#FAFBFD] border-b border-[#E4E7EC] text-[#667085] font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-2.5 px-4">Month</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E4E7EC]/60">
                  {activeMonths.map(month => (
                    <tr key={month} className="hover:bg-[#F8FAFC] transition-colors duration-150">
                      <td className="py-2.5 px-4 font-semibold text-[#172033] text-[13px]">{month}</td>
                      <td className="py-2.5 px-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200/80">
                          Active Month
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-[#667085] text-[12px]">Live logs. Will be archived automatically at the end of the month.</td>
                    </tr>
                  ))}

                  {lockedMonths.map(item => (
                    <tr key={item.id} className="hover:bg-[#F8FAFC] transition-colors duration-150">
                      <td className="py-2.5 px-4 font-semibold text-[#172033] text-[13px]">{item.month}</td>
                      <td className="py-2.5 px-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                          Archived & Locked
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-[#667085] text-[12px]">
                        Locked automatically by {item.lockedBy || "System"} on {item.lockedAt ? new Date(item.lockedAt).toLocaleDateString() : "month end"}. Contains {item.contactCount} contacts in {item.parts || 1} part(s). Raw logs purged.
                      </td>
                    </tr>
                  ))}

                  {activeMonths.length === 0 && lockedMonths.length === 0 && (
                    <tr>
                      <td colSpan="3" className="py-8 text-center text-[#98A2B3] font-medium">
                        No historical months found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* New Status Categorization Modal */}
        <AddStatusCategorizationModal
          addStatusModal={addStatusModal}
          confirmAddStatus={confirmAddStatus}
        />
      </div>
    </div>
  );
}
