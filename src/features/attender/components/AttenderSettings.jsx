import React, { useState, useEffect, useRef } from "react";
import { ArrowLeft, Plus, Edit2, Trash2, Image as ImageIcon, X, Check, MessageSquare, Upload } from "lucide-react";
import { toast } from "react-hot-toast";
import { getLocalTemplates, saveLocalTemplates } from "../../../lib/localTemplates";

export default function AttenderSettings({ attenderId, attenderName, onBack }) {
  const [templates, setTemplates] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null); // null when adding
  const [formData, setFormData] = useState({
    title: "",
    text: "",
    image: null, // data URL (base64) uncompressed
    imageName: ""
  });
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadTemplates();
  }, [attenderId]);

  const loadTemplates = async () => {
    setIsLoading(true);
    try {
      const data = await getLocalTemplates(attenderId);
      setTemplates(data);
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
      toast.success("Image added in original quality!");
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
      toast.error("Please enter a template title");
      return;
    }
    if (!formData.text.trim()) {
      toast.error("Please enter template message text");
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
      toast.success(editingTemplate ? "Template updated!" : "Template created!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to save template locally: " + err.message);
    }
  };

  const handleDelete = async (idToDelete) => {
    if (!window.confirm("Are you sure you want to delete this template?")) return;
    try {
      const updated = templates.filter((t) => t.id !== idToDelete);
      await saveLocalTemplates(attenderId, updated);
      setTemplates(updated);
      toast.success("Template deleted!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete template: " + err.message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col animate-fade-in text-slate-800">
      {/* Top Navigation Bar */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-30 shadow-2xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 active:scale-[0.98] text-slate-700 text-xs font-bold transition cursor-pointer"
            title="Return to Call Sheet"
          >
            <ArrowLeft size={15} />
            <span>Back to Call Sheet</span>
          </button>
          <div className="h-4 w-px bg-slate-200" />
          <div>
            <h1 className="text-base font-extrabold text-slate-900 leading-none">Settings & Message Templates</h1>
            <p className="text-[11px] text-slate-500 font-medium mt-1">
              Personal templates stored 100% locally on your computer with full-quality images
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleOpenAdd}
          className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
        >
          <Plus size={15} />
          <span>Create New Template</span>
        </button>
      </header>

      {/* Main Content Area */}
      <main className="max-w-6xl w-full mx-auto p-6 md:p-8 flex-1">
        {/* Templates Grid / List */}
        {isLoading ? (
          <div className="py-20 text-center text-slate-400 font-semibold text-xs">
            Loading your templates...
          </div>
        ) : templates.length === 0 ? (
          <div className="bg-white border border-dashed border-slate-300 rounded-3xl p-12 text-center max-w-lg mx-auto my-12 shadow-2xs">
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4 border border-emerald-100 shadow-2xs">
              <MessageSquare size={30} />
            </div>
            <h3 className="text-base font-bold text-slate-800">No Templates Created Yet</h3>
            <p className="text-xs text-slate-500 mt-1 mb-6 leading-relaxed">
              Create your own WhatsApp messages with text and full-quality drag-and-drop images. When talking to leads, you can copy text or images in 1 click!
            </p>
            <button
              type="button"
              onClick={handleOpenAdd}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
            >
              <Plus size={16} />
              <span>Create First Template</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {templates.map((tpl) => (
              <div
                key={tpl.id}
                className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs hover:shadow-md transition flex flex-col justify-between group"
              >
                <div>
                  {/* Header of card */}
                  <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
                    <h4 className="text-xs font-bold text-slate-900 truncate" title={tpl.title}>
                      {tpl.title}
                    </h4>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(tpl)}
                        className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded-lg transition cursor-pointer"
                        title="Edit template"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(tpl.id)}
                        className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition cursor-pointer"
                        title="Delete template"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Body with image box & text preview */}
                  <div className="pt-3 flex gap-3">
                    {tpl.image && (
                      <div className="w-16 h-16 rounded-xl border border-slate-200 overflow-hidden bg-slate-50 shrink-0 relative group/img">
                        <img
                          src={tpl.image}
                          alt="Template poster"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-600 line-clamp-4 leading-relaxed font-normal whitespace-pre-wrap">
                        {tpl.text}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Footer status */}
                <div className="mt-4 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                  <span>{tpl.image ? "Includes original image" : "Text only"}</span>
                  <span className="font-mono">
                    {tpl.updatedAt ? "Updated" : "Saved"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Create / Edit Template Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl border border-slate-200 overflow-hidden animate-slide-up flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-emerald-600 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-white/20 text-white flex items-center justify-center font-bold">
                  <MessageSquare size={16} />
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider">
                    {editingTemplate ? "Edit Template" : "New WhatsApp Template"}
                  </h3>
                  <p className="text-[10px] text-emerald-100 font-medium">
                    Will be stored in your local browser only
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 hover:bg-white/20 rounded-lg transition text-emerald-100 hover:text-white cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSave} className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* Template Name */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Template Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Maha Shivir Registration, Follow-up Info"
                  value={formData.title}
                  onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  autoFocus
                />
              </div>

              {/* Message text with {Name} chip */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-bold text-slate-600 uppercase">
                    Message Text <span className="text-rose-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => insertPlaceholder("{Name}")}
                    className="text-[10px] font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-200 transition cursor-pointer"
                    title="Insert contact name tag"
                  >
                    + Insert &#123;Name&#125;
                  </button>
                </div>
                <textarea
                  required
                  rows={5}
                  placeholder="Namaste {Name} ji! Here are the program details..."
                  value={formData.text}
                  onChange={(e) => setFormData((p) => ({ ...p, text: e.target.value }))}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-normal focus:outline-none focus:ring-2 focus:ring-emerald-500 leading-relaxed"
                />
              </div>

              {/* Drag and Drop Image Upload Box */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Attached Image / Poster <span className="text-slate-400 font-normal">(Optional - Uncompressed)</span>
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
                        <p className="text-xs font-bold text-slate-800 truncate">
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
                      className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-rose-600 hover:bg-rose-50 border border-rose-200 transition cursor-pointer shrink-0"
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
                    <p className="text-xs font-bold text-slate-700">
                      Drag & Drop image here, or <span className="text-emerald-600 underline">browse</span>
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1">
                      PNG, JPG, WEBP. Saved in 100% original quality with zero compression.
                    </p>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
                >
                  {editingTemplate ? "Save Changes" : "Create Template"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
