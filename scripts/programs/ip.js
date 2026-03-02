import { BaseText } from './engines/base_text.js';

/**
 * IP lookup utility.
 * Fetches and displays network and geographical information based on the user's current IP.
 */
const Ip = {
    engine: null,

    init: async function(screenEl) {
        this.engine = new BaseText(screenEl);
        this.engine.render("Fetching IP data...");

        try {
            const response = await fetch('https://ipapi.co/json/');
            const data = await response.json();

            if (data.error) throw new Error(data.reason || "Rate limit exceeded or API error.");

            // Formatting keys for a cleaner list view
            let output = '<div style="font-family: monospace; padding: 10px; line-height: 1.4; font-size: 0.85rem;">';
            for (const [key, value] of Object.entries(data)) {
                const label = key.replace(/_/g, ' ').toUpperCase();
                output += `<div style="margin-bottom: 2px;"><span style="color: #888;">${label.padEnd(20)}:</span> <span>${value}</span></div>`;
            }
            output += '</div>';

            this.engine.render(output);
        } catch (error) {
            this.engine.render(`<div style="padding: 10px; color: #ff5555;">Error: ${error.message}</div>`);
        }
    },

    unload: function() {
        if (this.engine) {
            this.engine.unload();
            this.engine = null;
        }
    },

    onResize: function() {}
};

export default Ip;