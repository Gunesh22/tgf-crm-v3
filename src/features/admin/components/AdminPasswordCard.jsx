import React, { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import { ShieldCheck, Key, Eye, EyeOff, Copy, Check, RotateCcw, Lock } from "lucide-react";
import { getAdminPassword, setAdminPassword, generateRandomPassword } from "../../../lib/db";

export function AdminPasswordCard({ highlighted = true }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [showNewPass, setShowNewPass] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchCurrentAdminPassword();
  }, []);

  const fetchCurrentAdminPassword = async () => {
    try {
      const pass = await getAdminPassword();
      setCurrentPassword(pass);
    } catch (err) {
      console.error("Failed to load admin password", err);
    }
  };

  const handleUpdatePassword = async (e) => {
    if (e) e.preventDefault();
    const trimmed = newPassword.trim();
    if (!trimmed) {
      toast.error("Please enter a new password.");
      return;
    }

    if (trimmed.length < 4) {
      toast.error("Password should be at least 4 characters long.");
      return;
    }

    setIsUpdating(true);
    try {
      await setAdminPassword(trimmed);
      setCurrentPassword(trimmed);
      setNewPassword("");
      toast.success("Admin password updated successfully!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to update admin password: " + err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCopy = () => {
    if (!currentPassword) return;
    navigator.clipboard.writeText(currentPassword);
    setCopied(true);
    toast.success("Admin password copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white rounded-[10px] border border-[#E4E7EC] p-5 shadow-[0_1px_3px_rgba(16,24,40,0.04),0_1px_2px_rgba(16,24,40,0.02)] space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center shrink-0">
            <ShieldCheck size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm text-[#172033]">
                Admin Security & Master Password
              </h3>
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                Admin Only
              </span>
            </div>
            <p className="text-xs text-[#667085] mt-0.5">
              Change the 6-digit master passcode required to unlock Admin Panel.
            </p>
          </div>
        </div>
      </div>

      {/* Current Password Bar */}
      <div className="p-3 rounded-md bg-[#FAFBFD] border border-[#E4E7EC] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Key size={14} className="text-blue-600 shrink-0" />
          <span className="text-xs font-medium text-[#667085]">Current Passcode:</span>
          <span className="font-mono text-xs font-bold text-[#172033] tracking-wider">
            {showCurrentPass ? currentPassword || "123456" : "••••••"}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowCurrentPass(!showCurrentPass)}
            className="p-1 text-[#98A2B3] hover:text-[#172033] rounded transition-colors cursor-pointer"
            title={showCurrentPass ? "Hide password" : "Show password"}
          >
            {showCurrentPass ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="h-7 px-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>

      {/* Change Password Form */}
      <form onSubmit={handleUpdatePassword} className="space-y-3">
        <label className="block text-[11px] font-semibold text-[#667085] uppercase tracking-wider">
          Set New Admin Password
        </label>
        
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type={showNewPass ? "text" : "password"}
              maxLength={6}
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="Enter new 6-digit PIN"
              className="w-full h-9 px-3 pr-8 rounded-[7px] bg-white border border-[#DDE2EA] text-xs font-mono font-medium text-[#172033] placeholder:text-[#98A2B3] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all duration-150"
            />
            <button
              type="button"
              onClick={() => setShowNewPass(!showNewPass)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#98A2B3] hover:text-[#172033] p-0.5 cursor-pointer"
            >
              {showNewPass ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              const r = generateRandomPassword();
              setNewPassword(r);
              setShowNewPass(true);
            }}
            className="h-9 px-3 rounded-[7px] text-xs font-medium bg-slate-100 text-[#172033] hover:bg-slate-200 border border-[#E4E7EC] flex items-center gap-1 shrink-0 transition-colors cursor-pointer"
            title="Generate random 6-digit PIN"
          >
            <RotateCcw size={13} /> Auto-PIN
          </button>
        </div>

        <button
          type="submit"
          disabled={isUpdating || !newPassword.trim()}
          className="w-full h-9 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold text-xs rounded-[7px] shadow-[0_1px_2px_rgba(16,24,40,0.05)] flex items-center justify-center gap-1.5 transition-all duration-150 ease-out cursor-pointer active:scale-[0.99]"
        >
          <Lock size={13} />
          {isUpdating ? "Updating..." : "Save Admin Password"}
        </button>
      </form>
    </div>
  );
}
