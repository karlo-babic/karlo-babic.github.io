import { BaseText } from './engines/base_text.js';

/**
 * Ultimate System, Hardware, and Environment Diagnostics.
 * Collects every non-restricted telemetry point accessible to the browser.
 */
const Stats = {
    engine: null,

    init: async function(screenEl) {
        this.engine = new BaseText(screenEl);
        this.engine.render('<div style="padding: 10px; font-family: monospace; color: #888;">Scanning environment...</div>');
        
        // --- Refresh Rate Detection ---
        const getHz = () => new Promise(resolve => {
            let frames = 0;
            const start = performance.now();
            const check = (now) => {
                frames++;
                if (now - start >= 500) resolve(Math.round((frames * 1000) / (now - start)));
                else requestAnimationFrame(check);
            };
            requestAnimationFrame(check);
        });

        // --- Permission State Check ---
        const getPermission = async (name) => {
            try {
                const status = await navigator.permissions.query({ name });
                return status.state;
            } catch (e) { return "Unsupported"; }
        };

        // --- Graphics/GPU Detection ---
        let gpu = "Unknown";
        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
            if (debugInfo) gpu = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
        } catch (e) {}

        // --- Async Data Gathering ---
        const [hz, storage, battery, geo, notify, cam] = await Promise.all([
            getHz(),
            navigator.storage?.estimate() || Promise.resolve(null),
            navigator.getBattery ? navigator.getBattery() : Promise.resolve(null),
            getPermission('geolocation'),
            getPermission('notifications'),
            getPermission('camera')
        ]);

        // --- Persistence ---
        let visits = parseInt(localStorage.getItem('console_stats_visits') || 0) + 1;
        localStorage.setItem('console_stats_visits', visits);

        const data = {
            "SESSION": {
                "Visits": visits,
                "Referrer": document.referrer || "Direct",
                "Nav Type": performance.getEntriesByType("navigation")[0]?.type || "Unknown",
                "Start Time": new Date(performance.timeOrigin).toLocaleTimeString()
            },
            "HARDWARE": {
                "Platform": navigator.platform,
                "Logical Cores": navigator.hardwareConcurrency || "Unknown",
                "RAM (Est)": navigator.deviceMemory ? `~${navigator.deviceMemory} GB` : "Unknown",
                "GPU": gpu,
                "Battery": battery ? `${Math.round(battery.level * 100)}% (${battery.charging ? 'Charging' : 'Discharging'})` : "Unsupported",
                "Refresh Rate": `${hz} Hz`
            },
            "DISPLAY": {
                "Resolution": `${screen.width}x${screen.height}`,
                "Available": `${screen.availWidth}x${screen.availHeight}`,
                "Viewport": `${window.innerWidth}x${window.innerHeight}`,
                "Pixel Ratio": window.devicePixelRatio,
                "Color Depth": `${screen.colorDepth}-bit`,
                "HDR Support": window.matchMedia("(dynamic-range: high)").matches ? "Yes" : "No",
                "P3 Gamut": window.matchMedia("(color-gamut: p3)").matches ? "Yes" : "No"
            },
            "INPUT": {
                "Touch Points": navigator.maxTouchPoints,
                "Pointer": window.matchMedia("(pointer: fine)").matches ? "Fine (Mouse)" : "Coarse (Touch)",
                "Hover Capable": window.matchMedia("(hover: hover)").matches ? "Yes" : "No",
                "Keyboard": ('keyboard' in navigator) ? "Available" : "Unknown"
            },
            "NETWORK": {
                "Status": navigator.onLine ? "Online" : "Offline",
                "Type": navigator.connection?.effectiveType || "Unknown",
                "Downlink": navigator.connection ? `${navigator.connection.downlink} Mbps` : "Unknown",
                "RTT": navigator.connection ? `${navigator.connection.rtt} ms` : "Unknown",
                "Save Data": navigator.connection?.saveData ? "Enabled" : "Disabled"
            },
            "BROWSER": {
                "Engine": navigator.vendor || "Unknown",
                "Cookies": navigator.cookieEnabled ? "Yes" : "No",
                "Automation": navigator.webdriver ? "Detected (Bot/Script)" : "None",
                "PDF Support": navigator.pdfViewerEnabled ? "Yes" : "No",
                "Storage": storage ? `${(storage.usage / 1024 / 1024).toFixed(2)} MB of ${(storage.quota / 1024 / 1024 / 1024).toFixed(2)} GB` : "Unknown",
                "Memory": performance.memory ? `${(performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB` : "Unsupported",
                "User Agent": navigator.userAgent
            },
            "PERMISSIONS": {
                "Geolocation": geo,
                "Notifications": notify,
                "Camera": cam
            },
            "LOCALE": {
                "Language": navigator.language,
                "All Languages": navigator.languages.join(', '),
                "Timezone": Intl.DateTimeFormat().resolvedOptions().timeZone,
                "UTC Offset": (new Date().getTimezoneOffset() / -60) + "h"
            },
            "ACCESSIBILITY": {
                "Reduced Motion": window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "Enabled" : "Disabled",
                "High Contrast": window.matchMedia("(forced-colors: active)").matches ? "Enabled" : "Disabled"
            }
        };

        this._render(data);
    },

    _render: function(sections) {
        let html = '<div style="font-family: monospace; padding: 10px; line-height: 1.5; font-size: 0.8rem;">';
        for (const [section, items] of Object.entries(sections)) {
            html += `<div style="color: #50c0f0; margin-top: 15px; margin-bottom: 5px; border-bottom: 1px solid #333;">[ ${section} ]</div>`;
            for (const [key, value] of Object.entries(items)) {
                html += `<div style="display: flex; margin-bottom: 2px;">`;
                html += `<span style="color: #888; min-width: 140px; flex-shrink: 0;">${key}:</span>`;
                html += `<span style="word-break: break-all;">${value}</span>`;
                html += `</div>`;
            }
        }
        html += '</div>';
        this.engine.render(html);
    },

    unload: function() {
        if (this.engine) {
            this.engine.unload();
            this.engine = null;
        }
    },

    onResize: function() {}
};

export default Stats;