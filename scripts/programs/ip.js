import { BaseText } from './engines/base_text.js';

/**
 * IP lookup utility.
 * Fetches and displays network and geographical information based on the user's current IP.
 */
const Ip = {
    engine: null,

    init: async function(screenEl, args = { positional: [], named: {} }) {
        this.engine = new BaseText(screenEl);
        this.engine.render('<span class="console-dim">Fetching IP data...</span>');

        // Check if an IP address was provided as a positional argument
        const targetIp = args.positional[0];
        const url = targetIp ? `https://ipapi.co/${targetIp}/json/` : 'https://ipapi.co/json/';

        try {
            const response = await fetch(url);
            const data = await response.json();

            if (data.error) throw new Error(data.reason || "Rate limit exceeded or invalid IP.");

            let output = '';
            for (const [key, value] of Object.entries(data)) {
                const label = key.replace(/_/g, ' ').toUpperCase();
                output += `<div class="console-row"><span class="console-key">${label}:</span><span class="console-value">${value}</span></div>`;
            }

            this.engine.render(output);
        } catch (error) {
            this.engine.render(`<span class="console-error">Error: ${error.message}</span>`);
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