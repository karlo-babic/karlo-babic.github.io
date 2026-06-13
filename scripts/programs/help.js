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
    const generalText = (data._general || '').replace(/\n/g, '<br>').replace(/(<br>\s*)+$/, '');
    let content = `<div style="margin-bottom:1.2em;">${generalText}</div>`;
    const categories = data._categories;

    if (categories) {
        for (const [catName, programs] of Object.entries(categories)) {
            content += `<div class="console-section">${catName.toUpperCase()}</div>`;
            for (const cmd of programs) {
                if (!data[cmd]) continue;
                content += `<div style="margin-top:0.3em;"><b><a href="/console?start=help&topic=${cmd}">${cmd}</a></b></div>`;
                content += `<div class="console-dim">&nbsp;&nbsp;${data[cmd].usage}</div>`;
                content += `<div class="console-dim">&nbsp;&nbsp;${data[cmd].description}</div>`;
            }
        }
    } else {
        for (const cmd in data) {
            if (cmd.startsWith('_')) continue;
            content += `<div style="margin-top:0.3em;"><b><a href="/console?start=help&topic=${cmd}">${cmd}</a></b></div>`;
            content += `<div class="console-dim">&nbsp;&nbsp;${data[cmd].usage}</div>`;
            content += `<div class="console-dim">&nbsp;&nbsp;${data[cmd].description}</div>`;
        }
    }
    return content;
}

function getTopicHelp(data, topic) {
    if (!data[topic] || topic.startsWith('_')) {
        const suggestion = findSuggestion(data, topic);
        const hint = suggestion ? `<br>Did you mean '<b>${suggestion}</b>'? Try: help ${suggestion}` : '';
        return `<span class="console-error">Error: No help topic for '${topic}'.</span>${hint}`;
    }
    const d = data[topic];
    let content = `<div class="console-section">COMMAND</div><div>${topic}</div>`;
    content += `<div class="console-section">DESCRIPTION</div><div>${d.description}</div>`;
    content += `<div class="console-section">USAGE</div><div>${d.usage}</div>`;
    content += `<div class="console-section">DETAILS</div><div>${d.details.replace(/\n/g, '<br>')}</div>`;
    if (d.see_also && d.see_also.length > 0) {
        const links = d.see_also.map(cmd => `<a href="/console?start=help&topic=${cmd}">${cmd}</a>`).join(', ');
        content += `<div class="console-section">SEE ALSO</div><div>${links}</div>`;
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
