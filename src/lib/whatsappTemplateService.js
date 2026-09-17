// src/lib/whatsappTemplateService.js
// Client-side Version-Checked Cache for WhatsApp Templates (MongoDB optimized)
import { fetchAPI } from "./db";

const CACHE_KEY = "tgf_whatsapp_templates_cache_v1";

let memoryTemplates = null;
let memoryVersion = null;
let activeSyncPromise = null;
const listeners = new Set();

/**
 * Reads local cache from localStorage (synchronous, 0ms)
 */
const getStoredCache = () => {
  if (memoryTemplates !== null) {
    return { version: memoryVersion, templates: memoryTemplates };
  }
  try {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(CACHE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && Array.isArray(parsed.templates)) {
          memoryTemplates = parsed.templates;
          memoryVersion = parsed.version || 0;
          return { version: memoryVersion, templates: memoryTemplates };
        }
      }
    }
  } catch (e) {
    console.warn("Failed reading WhatsApp templates cache:", e);
  }
  memoryTemplates = [];
  memoryVersion = 0;
  return { version: 0, templates: [] };
};

/**
 * Returns current locally cached templates (0ms, non-blocking)
 */
export const getCachedWhatsAppTemplates = () => {
  return getStoredCache().templates;
};

/**
 * Returns current cached version
 */
export const getCachedWhatsAppVersion = () => {
  return getStoredCache().version;
};

/**
 * Subscribes a callback to template changes across the entire app
 */
export const subscribeWhatsAppTemplates = (callback) => {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
};

/**
 * Saves templates & version locally and notifies all subscribers
 */
export const updateLocalWhatsAppTemplates = (templates, version = null) => {
  const current = getStoredCache();
  const newVersion = version !== null ? version : (current.version || 0) + 1;
  memoryTemplates = Array.isArray(templates) ? templates : [];
  memoryVersion = newVersion;

  try {
    if (typeof window !== "undefined") {
      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({ version: newVersion, templates: memoryTemplates })
      );
    }
  } catch (e) {}

  listeners.forEach((fn) => {
    try {
      fn(memoryTemplates, newVersion);
    } catch (err) {
      console.error("WhatsApp template listener error:", err);
    }
  });
};

/**
 * Lightweight version check & fetch only if changed
 * Dedupes concurrent calls across all WhatsAppButtons in the workspace
 */
export const syncWhatsAppTemplatesIfChanged = async () => {
  if (activeSyncPromise) {
    return activeSyncPromise;
  }

  activeSyncPromise = (async () => {
    try {
      const { version: cachedVer } = getStoredCache();

      // 1. Lightweight version check
      const versionRes = await fetchAPI("/api/admin/settings?field=whatsapp-version");
      if (!versionRes || !versionRes.success) {
        return { updated: false, templates: memoryTemplates, version: cachedVer };
      }

      const serverVersion = versionRes.version;

      // 2. If version matches and we already have templates in memory: ZERO TEMPLATE PAYLOAD FETCHED!
      if (serverVersion === cachedVer && memoryTemplates !== null) {
        return { updated: false, templates: memoryTemplates, version: cachedVer };
      }

      // 3. Version differs: fetch full templates
      const templatesRes = await fetchAPI("/api/admin/settings?field=whatsapp-templates");
      if (templatesRes && templatesRes.success) {
        const fullTemplates = Array.isArray(templatesRes.whatsappTemplates)
          ? templatesRes.whatsappTemplates
          : [];
        updateLocalWhatsAppTemplates(fullTemplates, templatesRes.version || serverVersion);
        return { updated: true, templates: fullTemplates, version: serverVersion };
      }
    } catch (e) {
      // Silently fall back to cached data
      console.debug("WhatsApp templates version check skipped or failed:", e?.message);
    } finally {
      activeSyncPromise = null;
    }
    return { updated: false, templates: getCachedWhatsAppTemplates(), version: getCachedWhatsAppVersion() };
  })();

  return activeSyncPromise;
};
