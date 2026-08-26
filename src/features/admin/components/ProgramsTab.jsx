import React, { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import * as XLSX from "xlsx";
import {
  FolderOpen, Plus, Trash2, Loader2, UploadCloud, Download
} from "lucide-react";
import {
  getProgramContactStats, createProgram, deleteProgram,
  importContacts, getProgramChunkContacts, remapProgramContacts,
  getProgramCallLogs, INCOMING_PROGRAM_ID, OUTGOING_PROGRAM_ID
} from "../../../lib/db";
import { getDefaultExcelMapping, cleanExportRow } from "../utils.jsx";
import { FieldMapperModal } from "./FieldMapperModal";
import { SchemaRemapModal } from "./SchemaRemapModal";

export default function ProgramsTab({ programs, attenders, onReloadPrograms }) {
  const [newProgramName, setNewProgramName] = useState("");
  const [creating, setCreating] = useState(false);
  const [selectedProgStats, setSelectedProgStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsProgId, setStatsProgId] = useState("");

  // Excel Upload States
  const [uploadTargetProgId, setUploadTargetProgId] = useState("");
  const [excelFile, setExcelFile] = useState(null);
  const [excelHeaders, setExcelHeaders] = useState([]);
  const [excelDataPreview, setExcelDataPreview] = useState([]);
  const [fieldMapping, setFieldMapping] = useState({});
  const [showMapModal, setShowMapModal] = useState(false);
  const [importing, setImporting] = useState(false);

  // Folder Select States
  const [folderFiles, setFolderFiles] = useState([]);
  const [folderStatus, setFolderStatus] = useState("");

  // Remap States
  const [remapProgram, setRemapProgram] = useState(null);
  const [remapHeaders, setRemapHeaders] = useState([]);
  const [remapMapping, setRemapMapping] = useState({});
  const [remapping, setRemapping] = useState(false);

  useEffect(() => {
    if (statsProgId) {
      loadStats(statsProgId);
    } else {
      setSelectedProgStats(null);
    }
  }, [statsProgId]);

  const loadStats = async (pid) => {
    setStatsLoading(true);
    try {
      const stats = await getProgramContactStats(pid);
      setSelectedProgStats(stats);
    } catch (err) {
      toast.error("Failed to load program stats.");
    } finally {
      setStatsLoading(false);
    }
  };

  const handleCreateProgram = async (e) => {
    e.preventDefault();
    if (!newProgramName.trim()) return;
    setCreating(true);
    try {
      await createProgram(newProgramName.trim());
      setNewProgramName("");
      toast.success("Program created successfully!");
      onReloadPrograms();
    } catch (err) {
      toast.error("Failed to create program: " + err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteProgram = async (id, name) => {
    if (!confirm(`Are you absolutely sure you want to delete "${name}"? This will delete all contacts in it. This cannot be undone!`)) return;
    try {
      await deleteProgram(id);
      toast.success("Program deleted!");
      if (statsProgId === id) setStatsProgId("");
      onReloadPrograms();
    } catch (err) {
      toast.error("Error deleting program: " + err.message);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setExcelFile(file);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

        if (!json.length) {
          toast.error("Excel sheet is empty.");
          return;
        }

        const headers = Object.keys(json[0]);
        setExcelHeaders(headers);
        setExcelDataPreview(json);

        const initMap = {};
        headers.forEach(h => {
          initMap[h] = getDefaultExcelMapping(h);
        });
        setFieldMapping(initMap);
        setShowMapModal(true);
      } catch (err) {
        toast.error("Error reading file: " + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleFolderSelect = async (e) => {
    const files = Array.from(e.target.files);
    const excelFiles = files.filter(f => f.name.endsWith(".xlsx") || f.name.endsWith(".xls"));
    
    if (excelFiles.length === 0) {
      toast.error("No Excel files found in selected folder.");
      return;
    }
    setFolderFiles(excelFiles);
    setFolderStatus(`Found ${excelFiles.length} Excel file(s). Ready to process.`);
  };

  const handleProcessFolder = async () => {
    if (!uploadTargetProgId) {
      toast.error("Select target program first.");
      return;
    }
    if (folderFiles.length === 0) return;
    
    setImporting(true);
    let totalImported = 0;
    try {
      for (let i = 0; i < folderFiles.length; i++) {
        const file = folderFiles[i];
        setFolderStatus(`Processing (${i + 1}/${folderFiles.length}): ${file.name}...`);
        
        const fileData = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (evt) => {
            try {
              const data = new Uint8Array(evt.target.result);
              const wb = XLSX.read(data, { type: "array" });
              const json = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });
              resolve(json);
            } catch (err) { reject(err); }
          };
          reader.readAsArrayBuffer(file);
        });

        if (fileData.length === 0) continue;
        
        const headers = Object.keys(fileData[0]);
        const map = {};
        headers.forEach(h => { map[h] = getDefaultExcelMapping(h); });

        const mappedRows = fileData.map(row => {
          const contact = {};
          Object.entries(map).forEach(([exHeader, targetField]) => {
            if (targetField !== "Ignore") {
              contact[targetField] = row[exHeader];
            }
          });
          Object.keys(row).forEach(k => {
            if (!contact[k] && map[k] === "Ignore") {
              contact[k] = row[k];
            }
          });
          contact.status = "Pending";
          return contact;
        }).filter(c => c.Phone || c.Mobile);

        if (mappedRows.length > 0) {
          await importContacts(uploadTargetProgId, mappedRows);
          totalImported += mappedRows.length;
        }
      }

      toast.success(`Successfully imported ${totalImported} contacts from folder!`);
      setFolderFiles([]);
      setFolderStatus("");
      if (statsProgId === uploadTargetProgId) loadStats(uploadTargetProgId);
    } catch (err) {
      toast.error("Error processing folder: " + err.message);
      setFolderStatus("Error: " + err.message);
    } finally {
      setImporting(false);
    }
  };

  const handleStartRemap = async (prog) => {
    setRemapProgram(prog);
    try {
      const sample = await getProgramChunkContacts(prog.id, 10);
      if (sample.length === 0) {
        toast.error("No contacts found in program to remap.");
        setRemapProgram(null);
        return;
      }
      
      const INTERNAL_KEYS = ["id", "programId", "programName", "attenderId", "createdAt", "updatedAt", "history", "_callbackDue", "_deleted", "isCallbackDue", "isHotLead", "callCount"];
      const allKeys = new Set();
      sample.forEach(c => {
        Object.keys(c).forEach(k => {
          if (!INTERNAL_KEYS.includes(k) && !k.startsWith("_")) {
            allKeys.add(k);
          }
        });
      });

      const headers = Array.from(allKeys);
      setRemapHeaders(headers);
      
      const initMap = {};
      headers.forEach(h => {
        initMap[h] = getDefaultExcelMapping(h);
      });
      setRemapMapping(initMap);
    } catch (err) {
      toast.error("Failed to load schema for remap: " + err.message);
      setRemapProgram(null);
    }
  };

  const handleExecuteRemap = async () => {
    if (!remapProgram) return;
    setRemapping(true);
    try {
      await remapProgramContacts(remapProgram.id, remapMapping);
      toast.success("Program fields remapped successfully!");
      setRemapProgram(null);
      if (statsProgId === remapProgram.id) loadStats(remapProgram.id);
    } catch (err) {
      toast.error("Remapping failed: " + err.message);
    } finally {
      setRemapping(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!uploadTargetProgId) {
      toast.error("Please select a target program first.");
      return;
    }
    
    const mappings = Object.values(fieldMapping);
    if (!mappings.includes("Phone") && !mappings.includes("Mobile")) {
      toast.error("You MUST map at least one column to 'Phone' or 'Mobile'!");
      return;
    }

    setImporting(true);
    try {
      const dataToSave = excelDataPreview.map(row => {
        const contact = {};
        Object.entries(fieldMapping).forEach(([exHeader, targetField]) => {
          if (targetField !== "Ignore") {
            contact[targetField] = row[exHeader];
          }
        });
        
        Object.keys(row).forEach(k => {
          if (!contact[k] && fieldMapping[k] === "Ignore") {
            contact[k] = row[k];
          }
        });

        contact.status = "Pending";
        return contact;
      }).filter(c => c.Phone || c.Mobile);

      if (dataToSave.length === 0) {
        toast.error("No valid contacts found (missing Phone/Mobile).");
        setImporting(false);
        return;
      }

      await importContacts(uploadTargetProgId, dataToSave);
      toast.success(`Successfully imported ${dataToSave.length} contacts!`);
      setShowMapModal(false);
      setExcelFile(null);
      setExcelHeaders([]);
      setExcelDataPreview([]);
      
      if (statsProgId === uploadTargetProgId) {
        loadStats(uploadTargetProgId);
      }
    } catch (err) {
      toast.error("Import failed: " + err.message);
    } finally {
      setImporting(false);
    }
  };

  const handleDownloadAllCallsExcel = async (prog) => {
    toast.loading("Fetching all logs... please wait.", { id: "log-fetch" });
    try {
      const logs = await getProgramCallLogs(prog.id);
      toast.dismiss("log-fetch");
      if (logs.length === 0) {
        toast.error("No call logs found in this program.");
        return;
      }
      const cleaned = logs.map(cleanExportRow);
      const ws = XLSX.utils.json_to_sheet(cleaned);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Logs");
      XLSX.writeFile(wb, `${prog.name}_call_logs_${new Date().toLocaleDateString("en-CA")}.xlsx`);
      toast.success("Excel exported successfully!");
    } catch (err) {
      toast.dismiss("log-fetch");
      toast.error("Failed to export: " + err.message);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Top Bar */}
      <div>
        <h2 className="text-lg font-bold text-slate-900 tracking-tight">Programs & Mappings Manager</h2>
        <p className="text-xs text-slate-500 mt-0.5">Create programs, import Excel contacts, and configure custom field mappings.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-5">
        {/* Left Column: List Programs & Create */}
        <div className="md:col-span-2 space-y-5">
          <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs">
            <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <FolderOpen size={15} className="text-indigo-600" /> Active Programs ({programs.length})
            </h3>
            
            <form onSubmit={handleCreateProgram} className="flex gap-2 mb-4">
              <input type="text" placeholder="Enter new program name..." value={newProgramName} onChange={e => setNewProgramName(e.target.value)} required
                className="flex-1 h-8 px-3 bg-white border border-slate-200 rounded-md text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
              <button type="submit" disabled={creating}
                className="flex items-center gap-1.5 h-8 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-md text-xs shadow-2xs transition-colors disabled:opacity-50 cursor-pointer">
                {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Create
              </button>
            </form>

            <div className="divide-y divide-slate-100 border border-slate-200 rounded-md overflow-hidden">
              {programs.map(p => (
                <div key={p.id} className="p-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div>
                    <h4 className="font-semibold text-xs text-slate-900">{p.name}</h4>
                    <p className="text-[11px] text-slate-400 font-mono mt-0.5">ID: {p.id}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => setStatsProgId(p.id)}
                      className="h-7 px-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium rounded text-xs transition-colors cursor-pointer border border-indigo-100">
                      View Stats
                    </button>
                    <button onClick={() => handleDownloadAllCallsExcel(p)}
                      className="flex items-center gap-1 h-7 px-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-medium rounded text-xs transition-colors cursor-pointer border border-emerald-100">
                      <Download size={11} /> Call Logs
                    </button>
                    <button onClick={() => handleStartRemap(p)}
                      className="h-7 px-2 bg-amber-50 hover:bg-amber-100 text-amber-700 font-medium rounded text-xs transition-colors cursor-pointer border border-amber-100">
                      Remap Schema
                    </button>
                    {p.id !== INCOMING_PROGRAM_ID && p.id !== OUTGOING_PROGRAM_ID && (
                      <button onClick={() => handleDeleteProgram(p.id, p.name)}
                        className="p-1.5 text-rose-500 hover:bg-rose-50 rounded transition-colors cursor-pointer">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {programs.length === 0 && (
                <div className="py-8 text-center text-slate-400 font-medium">No programs created yet.</div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Schema/Stats View & Upload Contacts */}
        <div className="space-y-5">
          {/* Stats View */}
          {selectedProgStats && (
            <div className="bg-slate-900 text-white p-4 rounded-lg shadow-2xs border border-slate-800">
              <h3 className="font-semibold text-xs uppercase tracking-wider mb-3 flex items-center justify-between">
                <span>{selectedProgStats.programName} Stats</span>
                <span className="text-[10px] px-1.5 py-0.5 bg-slate-800 text-indigo-300 rounded border border-slate-700 font-mono">Realtime</span>
              </h3>
              {statsLoading ? (
                <div className="py-4 text-center text-slate-400 text-xs">Loading metrics...</div>
              ) : (
                <div className="grid grid-cols-2 gap-2.5 mt-2">
                  <div className="bg-slate-800/80 p-2.5 rounded border border-slate-700/60">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Total Contacts</p>
                    <p className="text-xl font-bold mt-0.5 text-slate-100">{selectedProgStats.total}</p>
                  </div>
                  <div className="bg-slate-800/80 p-2.5 rounded border border-slate-700/60">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Total Called</p>
                    <p className="text-xl font-bold mt-0.5 text-emerald-400">{selectedProgStats.called}</p>
                  </div>
                  <div className="bg-slate-800/80 p-2.5 rounded border border-slate-700/60">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Conversions</p>
                    <p className="text-xl font-bold mt-0.5 text-amber-400">{selectedProgStats.converted}</p>
                  </div>
                  <div className="bg-slate-800/80 p-2.5 rounded border border-slate-700/60">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Pending Contacts</p>
                    <p className="text-xl font-bold mt-0.5 text-indigo-300">{selectedProgStats.pending}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Upload Box */}
          <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs">
            <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <UploadCloud size={15} className="text-emerald-600" /> Import Contacts from Excel
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Select Target Program</label>
                <select value={uploadTargetProgId} onChange={e => setUploadTargetProgId(e.target.value)}
                  className="w-full h-8 px-3 bg-white border border-slate-200 rounded-md text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500">
                  <option value="">-- Choose Program --</option>
                  {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Import Mode</label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <label className="flex items-center gap-1.5 p-2.5 border border-slate-200 rounded-md cursor-pointer hover:bg-slate-50">
                    <input type="radio" name="import-mode" defaultChecked onChange={() => { setFolderFiles([]); setFolderStatus(""); }} />
                    <span className="text-xs font-medium text-slate-700">Single File</span>
                  </label>
                  <label className="flex items-center gap-1.5 p-2.5 border border-slate-200 rounded-md cursor-pointer hover:bg-slate-50">
                    <input type="radio" name="import-mode" onChange={() => { setExcelFile(null); setExcelHeaders([]); }} />
                    <span className="text-xs font-medium text-slate-700">Folder Upload</span>
                  </label>
                </div>
              </div>

              {folderFiles.length === 0 ? (
                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase">Upload Excel File</label>
                  <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-2xl p-6 cursor-pointer hover:bg-gray-50/50 transition">
                    <UploadCloud size={24} className="text-gray-400 mb-1" />
                    <span className="text-xs font-bold text-gray-500">Click to select files</span>
                    <input type="file" accept=".xlsx,.xls" onChange={handleFileChange} className="hidden" />
                  </label>
                </div>
              ) : (
                <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                  <p className="text-xs font-bold text-emerald-800">{folderStatus}</p>
                  <button onClick={handleProcessFolder} disabled={importing}
                    className="w-full mt-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition disabled:opacity-50 flex items-center justify-center gap-1">
                    {importing ? <Loader2 size={14} className="animate-spin" /> : null} Process Folder Contacts
                  </button>
                </div>
              )}

              {folderFiles.length === 0 && (
                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase">Select Folder containing Excel sheets</label>
                  <input type="file" webkitdirectory="" directory="" onChange={handleFolderSelect}
                    className="w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer" />
                  {folderStatus && <p className="text-xs font-bold text-gray-500 mt-2">{folderStatus}</p>}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Field Mapping Dialog Modal */}
      <FieldMapperModal
        showMapModal={showMapModal}
        setShowMapModal={setShowMapModal}
        excelHeaders={excelHeaders}
        fieldMapping={fieldMapping}
        setFieldMapping={setFieldMapping}
        handleConfirmImport={handleConfirmImport}
        importing={importing}
      />

      {/* Schema Remap Modal */}
      <SchemaRemapModal
        remapProgram={remapProgram}
        setRemapProgram={setRemapProgram}
        remapHeaders={remapHeaders}
        remapMapping={remapMapping}
        setRemapMapping={setRemapMapping}
        handleExecuteRemap={handleExecuteRemap}
        remapping={remapping}
      />
    </div>
  );
}
