
/**
 * TeleCRM Integration Service
 * Pushes leads from Custom CRM -> TeleCRM
 * API Docs: https://telecrm.in/api-docs (Async API)
 */

// ==========================================
// 🔐 CONFIGURATION (YOU MUST FILL THIS)
// ==========================================
// Never commit these. Anything in a browser bundle is public, so the token
// belongs on a server (e.g. a Cloud Function) before sync is switched on.
// For local testing only, set them in an untracked .env.local file.
const ENTERPRISE_ID = import.meta.env.VITE_TELECRM_ENTERPRISE_ID || "";
const API_TOKEN = import.meta.env.VITE_TELECRM_API_TOKEN || "";
// ==========================================

// ⚠️ GLOBAL SWITCH: Set to TRUE once TeleCRM whitelists your domain
// Currently FALSE to prevent CORS errors on Live Site
const ENABLE_SYNC = false;

// USE PROXY PATH (Fixed CORS issue)
// The proxy in vite.config.js maps '/telecrm-api' -> 'https://next-api.telecrm.in'
const BASE_URL = `/telecrm-api/enterprise/${ENTERPRISE_ID}`;

/**
 * Sends a Lead to TeleCRM asynchronously
 * @param {Object} leadData - The lead object from our CRM
 */
export const syncToTeleCRM = async (leadData) => {
    if (!ENABLE_SYNC) {
        console.log("⏸️ TeleCRM Sync Paused (Waiting for Domain Whitelist)");
        return { success: true, skipped: true };
    }

    if (!ENTERPRISE_ID || !API_TOKEN) {
        console.warn("⚠️ TeleCRM Sync Skipped: TeleCRM credentials are not configured");
        return { success: false, error: "Credentials missing" };
    }

    try {
        const url = `${BASE_URL}/autoupdatelead`;

        // Map Our Fields -> TeleCRM Fields
        const payload = {
            fields: {
                name: leadData.studentName,
                phone: leadData.phone,
                // Map other keys as needed (ensure they exist in TeleCRM first)
                // "source": leadData.source, 
                // "course": leadData.courseInterest 
            },
            // "actions": [] // Add specific actions if needed
        };

        // If Email exists
        if (leadData.email) payload.fields.email = leadData.email;

        console.log("🚀 Sending Lead to TeleCRM:", payload);

        // Send Request
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_TOKEN}`
            },
            body: JSON.stringify(payload)
        });

        // Handle Non-JSON responses (like "OK")
        const textResult = await response.text();
        let result;
        try {
            result = JSON.parse(textResult);
        } catch (e) {
            result = textResult; // It might be just "OK" string
        }

        if (response.ok) {
            console.log("✅ TeleCRM Sync Success:", result);
            return { success: true, data: result };
        } else {
            console.error("❌ TeleCRM Sync Failed:", result);
            return { success: false, error: result.message || JSON.stringify(result) || "Unknown Error" };
        }

    } catch (error) {
        console.error("❌ TeleCRM Network Error:", error);
        return { success: false, error: error.message };
    }
};
