import React, { useState, useEffect, useRef } from "react";
import {
  Plus,
  Edit2,
  Trash2,
  Copy,
  Image as ImageIcon,
  X,
  MessageSquare,
  Upload,
  Download,
  AlertTriangle,
  Sparkles
} from "lucide-react";
import { toast } from "react-hot-toast";
import { getLocalTemplates, saveLocalTemplates } from "../../../../lib/localTemplates";
import { DEFAULT_TGF_TEMPLATES } from "../../../../data/defaultTemplates";

export default function TemplatesSettings({ attenderId, attenderName }) {
  const [templates, setTemplates] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null); // null when adding
  const [deletingTemplate, setDeletingTemplate] = useState(null); // template pending deletion
  const [formData, setFormData] = useState({
    title: "",
    text: "",
    image: null, // data URL (base64) uncompressed
    imageName: ""
  });
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);
  const jsonInputRef = useRef(null);

  useEffect(() => {
    loadTemplates();
  }, [attenderId]);

  const loadTemplates = async () => {
    setIsLoading(true);
    try {
      const data = await getLocalTemplates(attenderId);
      setTemplates(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load local templates");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setEditingTemplate(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setFormData({
      title: "",
      text: "",
      image: null,
      imageName: ""
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (tpl) => {
    setEditingTemplate(tpl);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setFormData({
      title: tpl.title || "",
      text: tpl.text || "",
      image: tpl.image || null,
      imageName: tpl.imageName || ""
    });
    setIsModalOpen(true);
  };

  const handleDuplicate = async (tpl) => {
    try {
      let newTitle = `${tpl.title || "Template"} (Copy)`;
      const existingTitles = new Set(templates.map((t) => (t.title || "").toLowerCase().trim()));

      let counter = 2;
      while (existingTitles.has(newTitle.toLowerCase().trim())) {
        newTitle = `${tpl.title || "Template"} (Copy ${counter})`;
        counter++;
      }

      const duplicate = {
        id: `local_tpl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        title: newTitle,
        text: tpl.text || "",
        image: tpl.image || null,
        imageName: tpl.imageName ? `${tpl.imageName} (copy)` : "",
        createdAt: Date.now()
      };

      const originalIdx = templates.findIndex((t) => t.id === tpl.id);
      let updated;
      if (originalIdx !== -1) {
        updated = [
          ...templates.slice(0, originalIdx + 1),
          duplicate,
          ...templates.slice(originalIdx + 1)
        ];
      } else {
        updated = [...templates, duplicate];
      }

      await saveLocalTemplates(attenderId, updated);
      setTemplates(updated);
      toast.success(`Duplicated "${tpl.title}"`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to duplicate template: " + err.message);
    }
  };

  const processFile = (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload a valid image file (PNG, JPG, WEBP, etc.)");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      setFormData((prev) => ({
        ...prev,
        image: e.target.result,
        imageName: file.name
      }));
      toast.success("Image attached in original full quality");
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const handleRemoveImage = () => {
    setFormData((prev) => ({ ...prev, image: null, imageName: "" }));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const insertPlaceholder = (tag = "{Name}") => {
    setFormData((prev) => {
      const cur = prev.text || "";
      const needsSpace = cur.length > 0 && !cur.endsWith(" ");
      return {
        ...prev,
        text: needsSpace ? `${cur} ${tag}` : `${cur}${tag}`
      };
    });
  };

  const handleSave = async (e) => {
    e?.preventDefault();
    if (!formData.title.trim()) {
      toast.error("Please enter a template name");
      return;
    }
    if (!formData.text.trim()) {
      toast.error("Please enter message text");
      return;
    }

    try {
      let updated;
      if (editingTemplate) {
        updated = templates.map((t) =>
          t.id === editingTemplate.id
            ? {
                ...t,
                title: formData.title.trim(),
                text: formData.text.trim(),
                image: formData.image || null,
                imageName: formData.imageName || "",
                updatedAt: Date.now()
              }
            : t
        );
      } else {
        const newTemplate = {
          id: `local_tpl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          title: formData.title.trim(),
          text: formData.text.trim(),
          image: formData.image || null,
          imageName: formData.imageName || "",
          createdAt: Date.now()
        };
        updated = [...templates, newTemplate];
      }

      await saveLocalTemplates(attenderId, updated);
      setTemplates(updated);
      setIsModalOpen(false);
      toast.success(editingTemplate ? "Template saved!" : "Template created!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to save template: " + err.message);
    }
  };

  const confirmDelete = async () => {
    if (!deletingTemplate) return;
    try {
      const updated = templates.filter((t) => t.id !== deletingTemplate.id);
      await saveLocalTemplates(attenderId, updated);
      setTemplates(updated);
      toast.success(`Deleted "${deletingTemplate.title}"`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete template: " + err.message);
    } finally {
      setDeletingTemplate(null);
    }
  };

  const handleExportJSON = () => {
    if (templates.length === 0) {
      toast("No templates to export", { icon: "ℹ️" });
      return;
    }
    try {
      const exportPayload = {
        exportedAt: new Date().toISOString(),
        version: 1,
        attenderId,
        templatesCount: templates.length,
        templates
      };
      const blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
        type: "application/json"
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const safeName = (attenderName || "attender").toLowerCase().replace(/[^a-z0-9_-]/g, "_");
      link.href = url;
      link.download = `message_templates_${safeName}_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("Templates exported with full-quality images!");
    } catch (err) {
      console.error(err);
      toast.error("Export failed: " + err.message);
    }
  };

  const handleImportJSONClick = () => {
    if (jsonInputRef.current) {
      jsonInputRef.current.value = "";
      jsonInputRef.current.click();
    }
  };

  const handleImportJSONFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const incomingList = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed.templates)
        ? parsed.templates
        : null;

      if (!incomingList || incomingList.length === 0) {
        toast.error("No valid templates found in this JSON file");
        return;
      }

      const validated = incomingList
        .filter((item) => item && typeof item === "object" && (item.title || item.text))
        .map((item) => ({
          id: item.id || `local_tpl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          title: String(item.title || "Imported Template").trim(),
          text: String(item.text || "").trim(),
          image: item.image || null,
          imageName: item.imageName || "",
          createdAt: item.createdAt || Date.now(),
          updatedAt: Date.now()
        }));

      if (validated.length === 0) {
        toast.error("JSON file did not contain compatible templates");
        return;
      }

      // Merge avoiding duplicates with identical titles
      const existingByTitle = new Map(templates.map((t) => [t.title.trim().toLowerCase(), t]));
      let newCount = 0;
      let updatedCount = 0;

      const merged = [...templates];
      for (const item of validated) {
        const key = item.title.toLowerCase();
        if (existingByTitle.has(key)) {
          const idx = merged.findIndex((t) => t.title.trim().toLowerCase() === key);
          if (idx !== -1) {
            merged[idx] = { ...merged[idx], ...item, id: merged[idx].id };
            updatedCount++;
          }
        } else {
          merged.push(item);
          newCount++;
        }
      }

      await saveLocalTemplates(attenderId, merged);
      setTemplates(merged);
      toast.success(
        `Imported ${validated.length} templates (${newCount} added, ${updatedCount} updated)`
      );
    } catch (err) {
      console.error(err);
      toast.error("Failed to parse JSON file: " + err.message);
    }
  };

  const handleLoadDefaultTemplates = async () => {
    try {
      const existingByTitle = new Map(templates.map((t) => [t.title.trim().toLowerCase(), t]));
      let newCount = 0;
      let updatedCount = 0;
      const merged = [...templates];

      for (const item of DEFAULT_TGF_TEMPLATES) {
        const key = item.title.trim().toLowerCase();
        if (existingByTitle.has(key)) {
          const idx = merged.findIndex((t) => t.title.trim().toLowerCase() === key);
          if (idx !== -1) {
            merged[idx] = { ...merged[idx], text: item.text, updatedAt: Date.now() };
            updatedCount++;
          }
        } else {
          merged.push({
            ...item,
            id: `tpl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
          });
          newCount++;
        }
      }

      await saveLocalTemplates(attenderId, merged);
      setTemplates(merged);
      toast.success(
        `Loaded ${DEFAULT_TGF_TEMPLATES.length} standard templates (${newCount} added, ${updatedCount} updated)!`
      );
    } catch (err) {
      console.error(err);
      toast.error("Failed to load standard templates: " + err.message);
    }
  };

  return (
    <div className="flex flex-col space-y-6">
      {/* Hidden file input for JSON import */}
      <input
        type="file"
        ref={jsonInputRef}
        onChange={handleImportJSONFile}
        accept=".json,application/json"
        className="hidden"
      />

      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Templates</h2>
            {templates.length > 0 && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                {templates.length}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Manage your personal message templates
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleLoadDefaultTemplates}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-indigo-200 bg-indigo-50/70 hover:bg-indigo-100/70 active:scale-[0.98] text-indigo-700 text-xs font-semibold transition cursor-pointer shadow-2xs"
            title={`Load the ${DEFAULT_TGF_TEMPLATES.length} standard TGF templates with placeholders`}
          >
            <Sparkles size={14} className="text-indigo-600" />
            <span>Load Standard Templates</span>
          </button>

          <button
            type="button"
            onClick={handleImportJSONClick}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 active:scale-[0.98] text-slate-700 text-xs font-semibold transition cursor-pointer shadow-2xs"
            title="Import templates from JSON"
          >
            <Upload size={14} className="text-slate-500" />
            <span>Import</span>
          </button>

          <button
            type="button"
            onClick={handleExportJSON}
            disabled={templates.length === 0}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold transition shadow-2xs ${
              templates.length === 0
                ? "bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200"
                : "bg-white hover:bg-slate-50 text-slate-700 active:scale-[0.98] cursor-pointer"
            }`}
            title="Export templates to JSON"
          >
            <Download size={14} className="text-slate-500" />
            <span>Export</span>
          </button>

          <button
            type="button"
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
          >
            <Plus size={15} />
            <span>Create New Template</span>
          </button>
        </div>
      </div>

      {/* Main Content: Grid / Empty State */}
      {isLoading ? (
        <div className="py-24 text-center text-slate-400 font-medium text-xs">
          Loading templates...
        </div>
      ) : templates.length === 0 ? (
        <div className="py-16 px-6 text-center max-w-lg mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4 border border-emerald-100/80 shadow-2xs">
            <MessageSquare size={26} />
          </div>
          <h3 className="text-base font-bold text-slate-900">No message templates yet</h3>
          <p className="text-xs text-slate-500 mt-1.5 mb-6 leading-relaxed">
            Create your own templates or load the 8 standard Tej Gyan Foundation templates with placeholders ({'{Name}'}, {'{Program}'}, {'{Attender}'}).
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={handleLoadDefaultTemplates}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
            >
              <Sparkles size={15} />
              <span>Load 8 Standard Templates</span>
            </button>
            <button
              type="button"
              onClick={handleOpenAdd}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 active:scale-[0.98] text-slate-700 text-xs font-semibold transition cursor-pointer shadow-2xs"
            >
              <Plus size={15} className="text-slate-500" />
              <span>Create New</span>
            </button>
            <button
              type="button"
              onClick={handleImportJSONClick}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 active:scale-[0.98] text-slate-700 text-xs font-semibold transition cursor-pointer shadow-2xs"
            >
              <Upload size={14} className="text-slate-500" />
              <span>Import JSON</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {templates.map((tpl) => (
            <div
              key={tpl.id}
              className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs hover:shadow-sm hover:border-slate-300 transition-all flex flex-col justify-between group"
            >
              <div>
                {/* Header: Title + Actions */}
                <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-100">
                  <h4
                    className="text-xs font-bold text-slate-900 leading-snug break-words line-clamp-1"
                    title={tpl.title}
                  >
                    {tpl.title}
                  </h4>
                  <div className="flex items-center gap-1 shrink-0 -mr-1">
                    <button
                      type="button"
                      onClick={() => handleDuplicate(tpl)}
                      className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-indigo-600 rounded-lg transition cursor-pointer"
                      title="Duplicate template"
                      aria-label="Duplicate template"
                    >
                      <Copy size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(tpl)}
                      className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-lg transition cursor-pointer"
                      title="Edit template"
                      aria-label="Edit template"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingTemplate(tpl)}
                      className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition cursor-pointer"
                      title="Delete template"
                      aria-label="Delete template"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Content: Thumbnail + Message text */}
                <div className="pt-3 flex gap-3 items-start">
                  {tpl.image ? (
                    <div className="w-16 h-16 rounded-xl border border-slate-200 overflow-hidden bg-slate-50 shrink-0 shadow-2xs">
                      <img
                        src={tpl.image}
                        alt={tpl.imageName || "Template image"}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.parentElement.innerHTML =
                            '<div class="w-full h-full flex items-center justify-center bg-slate-100 text-slate-400"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg></div>';
                        }}
                      />
                    </div>
                  ) : null}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed font-normal whitespace-pre-wrap break-words">
                      {tpl.text}
                    </p>
                  </div>
                </div>
              </div>

              {/* Card Footer: Metadata & Status */}
              <div className="mt-3.5 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                <span className="truncate pr-2">
                  {tpl.image ? "Includes original image" : "Text only"}
                </span>
                <span className="shrink-0 font-medium text-slate-400/80 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">
                  {tpl.updatedAt ? "Updated" : "Saved"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingTemplate && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl border border-slate-200 p-6 animate-scale-in">
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center mb-3 border border-rose-100">
              <AlertTriangle size={20} />
            </div>
            <h3 className="text-sm font-bold text-slate-900">Delete template?</h3>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
              Are you sure you want to delete{" "}
              <strong className="text-slate-800 font-semibold">
                "{deletingTemplate.title}"
              </strong>
              ? This cannot be undone.
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeletingTemplate(null)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 active:scale-[0.98] text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Template Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-emerald-600 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-white/20 text-white flex items-center justify-center font-bold">
                  <MessageSquare size={16} />
                </div>
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider">
                    {editingTemplate ? "Edit Template" : "Create New Template"}
                  </h3>
                  <p className="text-[10px] text-emerald-100 font-medium">
                    Personal template stored locally on this device
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 hover:bg-white/20 rounded-lg transition text-emerald-100 hover:text-white cursor-pointer"
                aria-label="Close modal"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSave} className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* Template Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Template Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Maha Shivir Registration, Follow-up Info"
                  value={formData.title}
                  onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
                  autoFocus
                />
              </div>

              {/* Message text with {Name} chip */}
              <div>
                <div className="flex flex-wrap items-center justify-between gap-1.5 mb-1.5">
                  <label className="block text-xs font-semibold text-slate-700">
                    Message <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="text-[10px] text-slate-400 font-medium">Insert:</span>
                    <button
                      type="button"
                      onClick={() => insertPlaceholder("{Name}")}
                      className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-200 transition cursor-pointer"
                      title="Insert contact name tag"
                    >
                      &#123;Name&#125;
                    </button>
                    <button
                      type="button"
                      onClick={() => insertPlaceholder("{Program}")}
                      className="text-[10px] font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-2 py-0.5 rounded-md border border-indigo-200 transition cursor-pointer"
                      title="Insert program name tag"
                    >
                      &#123;Program&#125;
                    </button>
                    <button
                      type="button"
                      onClick={() => insertPlaceholder("{Attender}")}
                      className="text-[10px] font-semibold bg-amber-50 text-amber-700 hover:bg-amber-100 px-2 py-0.5 rounded-md border border-amber-200 transition cursor-pointer"
                      title="Insert attender name tag"
                    >
                      &#123;Attender&#125;
                    </button>
                  </div>
                </div>
                <textarea
                  required
                  rows={5}
                  placeholder="Namaste {Name} ji! Here are the program details..."
                  value={formData.text}
                  onChange={(e) => setFormData((p) => ({ ...p, text: e.target.value }))}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-normal focus:outline-none focus:ring-2 focus:ring-emerald-500 leading-relaxed transition"
                />
              </div>

              {/* Drag and Drop Image Upload Box */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Image (optional)
                </label>

                {formData.image ? (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-14 h-14 rounded-xl border border-slate-200 overflow-hidden bg-white shrink-0">
                        <img
                          src={formData.image}
                          alt="Preview"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-800 truncate">
                          {formData.imageName || "Attached Image"}
                        </p>
                        <p className="text-[10px] text-emerald-600 font-semibold mt-0.5">
                          ✓ Full Original Quality
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-rose-200 transition cursor-pointer shrink-0"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-6 text-center transition cursor-pointer ${
                      isDragging
                        ? "border-emerald-500 bg-emerald-50/50"
                        : "border-slate-300 hover:border-emerald-400 hover:bg-slate-50/60"
                    }`}
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept="image/*"
                      className="hidden"
                    />
                    <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center mx-auto mb-2">
                      <Upload size={18} />
                    </div>
                    <p className="text-xs font-semibold text-slate-700">
                      Drag & Drop image here, or{" "}
                      <span className="text-emerald-600 underline">browse</span>
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1">
                      PNG, JPG, WEBP. Saved in 100% original quality.
                    </p>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
                >
                  {editingTemplate ? "Save Template" : "Create New Template"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
