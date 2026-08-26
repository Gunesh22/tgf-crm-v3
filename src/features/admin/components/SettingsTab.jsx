import React, { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import { 
  ShieldCheck, Tag, HelpCircle, Loader, Archive, PhoneCall, PhoneOff
} from "lucide-react";
import { OptionsManagerCard } from "./OptionsManagerCard";
import { WhatsAppTemplatesCard } from "./WhatsAppTemplatesCard";
import CompulsoryFieldBypassCard from "./CompulsoryFieldBypassCard";
import { AdminPasswordCard } from "./AdminPasswordCard";
import { StatusClassificationCard } from "./StatusClassificationCard";
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

  useEffect(() => {
    loadOptions();
    loadMonths();
  }, []);

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

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-5">
      {/* Admin Master Password Management */}
      <AdminPasswordCard highlighted={false} />

      <div>
        <h2 className="text-lg font-bold text-slate-900 tracking-tight">Call Center Options</h2>
        <p className="text-xs text-slate-500 mt-0.5">Configure dropdown values for Attenders globally.</p>
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

      {/* WhatsApp Message Templates Manager */}
      <WhatsAppTemplatesCard
        templates={options?.whatsappTemplates || DEFAULT_WHATSAPP_TEMPLATES}
        onSaveTemplates={handleSaveWhatsappTemplates}
      />

      {/* Standalone Table: Statuses with Optional Compulsory Fields */}
      <CompulsoryFieldBypassCard
        options={options}
        setOptions={setOptions}
      />

      {/* Drag & Drop Status Classification Tables */}
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

      {/* Archive & Purge Section */}
      <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-2xs space-y-4">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <Archive size={16} className="text-indigo-600" />
            <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">Archive & Purge Historical Call Logs</h3>
          </div>
          <p className="text-xs text-slate-500">
            Historical call logs are automatically locked at the end of each month into static snapshots, and raw entries are purged from the database to optimize space.
          </p>
        </div>

        {isLoadingMonths ? (
          <div className="flex items-center gap-2 text-xs text-slate-500 py-3">
            <Loader size={15} className="animate-spin text-indigo-600" />
            Loading historical months...
          </div>
        ) : (
          <div className="overflow-hidden border border-slate-200 rounded-md">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="p-2.5">Month</th>
                  <th className="p-2.5">Status</th>
                  <th className="p-2.5">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activeMonths.map(month => (
                  <tr key={month} className="hover:bg-slate-50 transition-colors">
                    <td className="p-2.5 font-semibold text-slate-900">{month}</td>
                    <td className="p-2.5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                        Active Month
                      </span>
                    </td>
                    <td className="p-2.5 text-slate-500">Live logs. Will be archived automatically at the end of the month.</td>
                  </tr>
                ))}

                {lockedMonths.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-2.5 font-semibold text-slate-900">{item.month}</td>
                    <td className="p-2.5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Archived & Locked
                      </span>
                    </td>
                    <td className="p-2.5 text-slate-500">
                      Locked automatically by {item.lockedBy || "System"} on {item.lockedAt ? new Date(item.lockedAt).toLocaleDateString() : "month end"}. Contains {item.contactCount} contacts in {item.parts || 1} part(s). Raw logs purged.
                    </td>
                  </tr>
                ))}

                {activeMonths.length === 0 && lockedMonths.length === 0 && (
                  <tr>
                    <td colSpan="3" className="p-4 text-center text-slate-400 font-medium">
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
  );
}
