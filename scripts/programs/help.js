import { BaseText } from './engines/base_text.js';

let helpData = null; // Use null to check if data has been loaded

/**
 * Fetches and caches the help data from the external JSON file.
 */
async function loadHelpData() {
    // If data is already loaded, don't fetch it again.
    if (helpData) {
        return helpData;
    }
    try {
        const response = await fetch('./data/help.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        helpData = await response.json();
        return helpData;
    } catch (error) {
        console.error("Could not load help data:", error);
        return { _general: "Error: Could not load help data." }; // Fallback data
    }
}

/**
 * Generates the main help screen listing all commands.
 * @param {object} data The loaded help data.
 */
function getMainHelp(data) {
    let content = data._general || '';
    for (const cmd in data) {
        if (cmd.startsWith('_')) continue;
        const usage = data[cmd].usage;
        const description = data[cmd].description;
        content += `\n<b><a href="/console?run=${cmd}">${cmd}</a></b>\n  ${usage}\n  ${description}\n`;
    }
    return content;
}

/**
 * Generates the detailed help for a specific topic.
 * @param {object} data The loaded help data.
 * @param {string} topic The command to get help for.
 */
function getTopicHelp(data, topic) {
    if (!data[topic] || topic.startsWith('_')) {
        return `Error: No help topic for '${topic}'.`;
    }
    const topicData = data[topic];
    let content = `<b>COMMAND</b>\n  ${topic}\n\n`;
    content += `<b>DESCRIPTION</b>\n  ${topicData.description}\n\n`;
    content += `<b>USAGE</b>\n  ${topicData.usage}\n\n`;
    content += `<b>DETAILS</b>\n  ${topicData.details}`;
    return content;
}


// The public interface for the Console.
const Help = {
    engine: null,

    // The init function must be async to wait for the data
    init: async function(screenEl, args = { positional: [], named: {} }) {
        this.engine = new BaseText(screenEl);
        
        // Wait for the help data to be loaded
        const data = await loadHelpData();
        let content = '';

        if (args.positional.length === 0) {
            content = getMainHelp(data);
        } else {
            content = getTopicHelp(data, args.positional[0]);
        }
        
        this.engine.render(content);
    },

    unload: function() {
        if (this.engine) {
            this.engine.unload();
            this.engine = null;
        }
    },

    onResize: function() {
        // Not needed for this program.
    }
};

export default Help;