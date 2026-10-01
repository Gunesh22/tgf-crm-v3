import { get, set } from "idb-keyval";

const getStorageKey = (attenderId) => `tgf_wa_templates_${attenderId || "default"}`;

/**
 * Converts any image blob or dataUrl to PNG blob so the Browser ClipboardItem
 * accepts it without throwing 'Type image/jpeg not supported on write'.
 * Preserves original width, height and quality.
 */
export async function convertToPngBlob(imageData) {
  // If already PNG data URL or PNG Blob, convert directly to Blob for speed & fidelity
  if (typeof imageData === "string" && imageData.startsWith("data:image/png")) {
    try {
      const res = await fetch(imageData);
      const blob = await res.blob();
      if (blob && blob.size > 0) return blob;
    } catch {
      // Fallback to canvas conversion
    }
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth || img.width || 300;
        canvas.height = img.naturalHeight || img.height || 300;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error("Failed to convert image to PNG blob"));
          }
        }, "image/png");
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error("Failed to load image for PNG conversion"));

    if (typeof imageData === "string") {
      img.src = imageData;
    } else if (imageData instanceof Blob) {
      img.src = URL.createObjectURL(imageData);
    } else {
      reject(new Error("Unsupported image format"));
    }
  });
}

/**
 * Copies an image binary to clipboard so user can press Ctrl+V directly in WhatsApp
 */
export async function copyImageToClipboard(imageData) {
  if (!navigator?.clipboard?.write) {
    throw new Error("Clipboard API with image support is not available in this browser");
  }

  const pngBlob = await convertToPngBlob(imageData);
  const clipboardItem = new ClipboardItem({
    "image/png": pngBlob
  });

  await navigator.clipboard.write([clipboardItem]);
}

/**
 * Fetches all templates for this attender from local IndexedDB
 */
export async function getLocalTemplates(attenderId) {
  try {
    const key = getStorageKey(attenderId);
    const data = await get(key);
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error("Failed to load local templates from IndexedDB", err);
    return [];
  }
}

/**
 * Saves templates for this attender to local IndexedDB and dispatches update event
 */
export async function saveLocalTemplates(attenderId, templates) {
  const key = getStorageKey(attenderId);
  await set(key, templates);
  window.dispatchEvent(
    new CustomEvent("local-wa-templates-updated", {
      detail: { attenderId }
    })
  );
}
