
/**
 * TeleCRM Integration Service
 * Pushes leads from Custom CRM -> TeleCRM
 * API Docs: https://telecrm.in/api-docs (Async API)
 */

// ==========================================
// 🔐 CONFIGURATION (YOU MUST FILL THIS)
// ==========================================
const ENTERPRISE_ID = "6969f30a4957c81387ae8da9"; // Updated from User URL
const API_TOKEN = "8efcfe2f-4139-4a6c-b5e2-1e1cb30676591770387106758:74ba5b19-ebd8-4a1d-a99d-0ea7b3dbbc25";
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

    if (ENTERPRISE_ID === "YOUR_ENTERPRISE_ID_HERE" || API_TOKEN === "YOUR_API_TOKEN_HERE") {
        console.warn("⚠️ TeleCRM Sync Skipped: Credentials not configured in src/services/teleCrmService.js");
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
