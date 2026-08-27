import React from 'react';
import { X, Save, Phone, User, MapPin, MessageSquare, Tag, Hash } from 'lucide-react';
import { STATUS_OPTIONS } from '../../../utils/constants';

export default function EditDrawer({ contact, onClose, onSave }) {
  const [edited, setEdited] = React.useState(contact || {});
  
  React.useEffect(() => {
    if (contact) setEdited(contact);
  }, [contact]);

  if (!contact) return null;

  const handleChange = (field, value) => {
    setEdited(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = (e) => {
    e.preventDefault();
    onSave(edited);
  };

  return (
    <>
      {/* Backdrop overlay */}
      <div 
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-[60] animate-fade-in" 
        onClick={onClose}
      />
      
      {/* Sliding Drawer matching V2 EditModal styling */}
      <div className="fixed inset-y-0 right-0 w-full max-w-[450px] bg-white shadow-2xl z-[70] animate-drawer-right flex flex-col border-l border-slate-200">
        
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 shadow-sm border border-blue-200">
              <User size={18} />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-lg leading-tight">{edited.name || 'Unknown Lead'}</h2>
              <p className="text-xs font-semibold text-slate-500">{edited.phone}</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 hover:bg-slate-200 text-slate-500 hover:text-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto bg-slate-50/30 p-5">
          <form id="edit-form" onSubmit={handleSave} className="flex flex-col gap-5">
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-0.5">Name</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-500 transition-colors">
                    <User size={14} />
                  </div>
                  <input 
                    type="text" 
                    value={edited.name || ''} 
                    onChange={e => handleChange('name', e.target.value)} 
                    className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-0.5">Phone</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-500 transition-colors">
                    <Phone size={14} />
                  </div>
                  <input 
                    type="text" 
                    value={edited.phone || ''} 
                    onChange={e => handleChange('phone', e.target.value)} 
                    className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-0.5">Status</label>
              <select 
                value={edited.status || 'Pending'} 
                onChange={e => handleChange('status', e.target.value)}
                className="w-full pl-3 pr-8 py-2.5 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm appearance-none cursor-pointer"
              >
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-0.5">Remarks</label>
              <div className="relative group">
                <div className="absolute top-2.5 left-2.5 pointer-events-none text-slate-400 group-focus-within:text-blue-500 transition-colors">
                  <MessageSquare size={14} />
                </div>
                <textarea 
                  value={edited.remark || ''} 
                  onChange={e => handleChange('remark', e.target.value)}
                  placeholder="Enter call notes here..."
                  className="w-full pl-8 pr-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm min-h-[120px] resize-y"
                />
              </div>
            </div>
            
          </form>
        </div>

        <div className="p-4 border-t border-slate-200 bg-white flex justify-end gap-3 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.02)]">
          <button 
            type="button" 
            onClick={onClose} 
            className="px-5 py-2 rounded-lg text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button 
            type="submit" 
            form="edit-form" 
            className="px-5 py-2 rounded-lg text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/20 transition-all flex items-center gap-2 cursor-pointer active:scale-[0.98]"
          >
            <Save size={16} /> Save (Alt+S)
          </button>
        </div>
      </div>
    </>
  );
}
