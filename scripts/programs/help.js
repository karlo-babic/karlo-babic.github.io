import { BaseText } from './engines/base_text.js';

let helpData = null;

async function loadHelpData() {
    if (helpData) return helpData;
    try {
        const response = await fetch('./data/help.json');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        helpData = await response.json();
        return helpData;
    } catch (error) {
        console.error("Could not load help data:", error);
        return { _general: "Error: Could not load help data." };
    }
}

function levenshtein(a, b) {
    const n = b.length;
    const row = Array.from({ length: n + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
        let prev = row[0];
        row[0] = i;
        for (let j = 1; j <= n; j++) {
            const temp = row[j];
            row[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, row[j], row[j - 1]);
            prev = temp;
        }
    }
    return row[n];
}

function findSuggestion(data, topic) {
    const topics = Object.keys(data).filter(k => !k.startsWith('_'));
    let best = null, bestDist = Infinity;
    for (const t of topics) {
        const d = levenshtein(topic, t);
        if (d < bestDist) { bestDist = d; best = t; }
    }
    return bestDist <= 3 ? best : null;
}

function getMainHelp(data) {
    let content = data._general || '';
    const categories = data._categories;

    if (categories) {
        for (const [catName, programs] of Object.entries(categories)) {
            content += `\n<b>${catName.toUpperCase()}</b>\n`;
            for (const cmd of programs) {
                if (!data[cmd]) continue;
                content += `\n  <b><a href="/console?start=help&topic=${cmd}">${cmd}</a></b>\n    ${data[cmd].usage}\n    ${data[cmd].description}\n`;
            }
        }
    } else {
        for (const cmd in data) {
            if (cmd.startsWith('_')) continue;
            content += `\n<b><a href="/console?start=help&topic=${cmd}">${cmd}</a></b>\n  ${data[cmd].usage}\n  ${data[cmd].description}\n`;
        }
    }
    return content;
}

function getTopicHelp(data, topic) {
    if (!data[topic] || topic.startsWith('_')) {
        const suggestion = findSuggestion(data, topic);
        const hint = suggestion ? `\nDid you mean '<b>${suggestion}</b>'? Try: help ${suggestion}` : '';
        return `Error: No help topic for '${topic}'.${hint}`;
    }
    const d = data[topic];
    let content = `<b>COMMAND</b>\n  ${topic}\n\n`;
    content += `<b>DESCRIPTION</b>\n  ${d.description}\n\n`;
    content += `<b>USAGE</b>\n  ${d.usage}\n\n`;
    content += `<b>DETAILS</b>\n  ${d.details}`;
    if (d.see_also && d.see_also.length > 0) {
        const links = d.see_also.map(cmd => `<a href="/console?start=help&topic=${cmd}">${cmd}</a>`).join(', ');
        content += `\n\n<b>SEE ALSO</b>\n  ${links}`;
    }
    return content;
}

const Help = {
    engine: null,

    init: async function(screenEl, args = { positional: [], named: {} }) {
        this.engine = new BaseText(screenEl);
        const data = await loadHelpData();

        const topic = args.positional[0] || args.named.topic || null;
        const content = topic
            ? getTopicHelp(data, topic)
            : getMainHelp(data);

        this.engine.render(content);
    },

    unload: function() {
        if (this.engine) {
            this.engine.unload();
            this.engine = null;
        }
    },

    onResize: function() {}
};

export default Help;
