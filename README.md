# 🚀 TGF Call Center CRM (v3)

A high-performance, real-time Call Center CRM and Analytics platform optimized for zero-polling network architecture, real-time serverless observability, and zero-lag production deployments.

---

## 🛠️ Key Architectural Highlights

### 1. ⚡ Zero-Polling Network Architecture
* **Eliminated Background Loops**: Removed legacy `setInterval` periodic polling loops to prevent redundant API calls.
* **On-Demand Data Fetching**: Data fetches occur exclusively on initial mount (`purpose=initial_mount`) or explicit user action (`purpose=manual_sync`).
* **Bandwidth Optimization**: Reduced Vercel `Fast Origin Transfer` bandwidth usage by **over 95%**, remaining comfortably within Vercel's free Hobby tier limits.

### 2. 🚀 Automatic Production Deployment Updater (`useAutoUpdater`)
* **Zero-Lag Client Refreshes**: Active browser tabs monitor `/api/version` (which serves `process.env.VERCEL_GIT_COMMIT_SHA`).
* **Instant Auto-Reload**: When a new deployment is pushed to production, the app notifies attenders with a toast (`🚀 New CRM update deployed! Updating app in 2 seconds...`) and automatically reloads the tab so everyone operates on the latest build.
* **Dev Mode Guard**: Ignores local `dev_build` responses silently to ensure uninterrupted local development (`localhost:5173`).

### 3. 🏷️ Real-Time Attender Observability & Log Tagging
* All primary serverless API handlers (`/api/contacts/get-assigned`, `/api/contacts/create-incoming`, `/api/contacts/log-call`) automatically extract and log:
  * `attenderName`: Human-readable attender name (e.g. `Priyanka`, `Manisha`, `Geeta`, `Rakhi`) with automatic ID-to-Name fallback mapping.
  * `purpose`: Purpose of request (`initial_mount`, `manual_sync`).
  * `device`: Client device hardware (`desktop`, `mobile`).
* **Vercel Log Search**: Filter logs instantly on the Vercel Dashboard by typing any attender name (e.g. `Priyanka`) or purpose tag.

### 📊 Canonical Pipeline & Funnel Engine
* Centralized lead classification logic (`src/utils/pipelineEngine.js` & `src/features/admin/utils.jsx`).
* Preserves workstream integrity across `Query`, `Reminder`, and `Sales` interactions without cross-contaminating historical funnel progress.

---

## 💻 Tech Stack

* **Frontend**: React 18, Vite, Lucide Icons, React Hot Toast, Recharts, XLSX Exports.
* **Backend / API**: Vercel Serverless Functions (Node.js runtime), MongoDB (`clientPromise`), GoHighLevel API Proxy.
* **Styling**: Modern Vanilla CSS, responsive glassmorphism themes, tailored dark/light modes.

---

## 🏃 Local Development & Build Commands

```bash
# Install dependencies
npm install

# Run local development server
npm run dev

# Run production build validation
npx vite build
```

---

## ☁️ Deployment Strategy

Pushing to `main` branch automatically triggers Vercel CI/CD deployment:

```bash
git add .
git commit -m "feat: your feature summary"
git push origin main
```
