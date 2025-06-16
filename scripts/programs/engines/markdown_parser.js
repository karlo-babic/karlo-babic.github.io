/**
 * A simple helper to escape characters for safe insertion into HTML.
 * This is crucial for rendering code blocks correctly without executing any HTML.
 * @param {string} text The raw text to escape.
 * @returns {string} The escaped text.
 */
function escapeHtml(text) {
    return text.replace(/&/g, '&amp;')
               .replace(/</g, '&lt;')
               .replace(/>/g, '&gt;')
               .replace(/"/g, '&quot;')
               .replace(/'/g, '&#39;');
}

/**
 * Parses a string of basic Markdown into an HTML string using a robust,
 * multi-pass replacement strategy.
 * @param {string} markdownText The raw Markdown text.
 * @returns {string} The resulting HTML.
 */
export function parseMarkdown(markdownText) {
    let text = markdownText.trim();

    // --- Pass 1: Hoist Code Blocks ---
    const codeBlocks = [];
    text = text.replace(/^```([\s\S]+?)^```/gm, (match, code) => {
        const placeholder = `%%CODEBLOCK_${codeBlocks.length}%%`;
        codeBlocks.push(`<pre><code>${escapeHtml(code.trim())}</code></pre>`);
        return placeholder;
    });

    // --- Pass 2: Block-Level Elements ---
    let html = text.split(/\n/).map(line => {
        // Headers
        if (/^# /.test(line)) return `<h1>${line.substring(2)}</h1>`;
        if (/^## /.test(line)) return `<h2>${line.substring(3)}</h2>`;
        if (/^### /.test(line)) return `<h3>${line.substring(4)}</h3>`;

        // Horizontal Rules
        if (/^\s*([-*_]){3,}\s*$/.test(line)) return '<hr>';

        // Blockquotes
        if (/^> /.test(line)) return `<blockquote>${line.substring(2)}</blockquote>`;

        // List items
        if (/^(\s*)(\*|-)\s/.test(line)) {
            const indent = line.match(/^\s*/)[0].length;
            let itemText = line.trim().substring(2);

            // Checklists
            if (/^\[x\]/i.test(itemText)) {
                itemText = `<input type="checkbox" disabled checked> ${itemText.substring(4)}`;
            } else if (/^\[ \]/i.test(itemText)) {
                itemText = `<input type="checkbox" disabled> ${itemText.substring(4)}`;
            }
            return `<li data-indent="${indent}">${itemText}</li>`;
        }

        // Return paragraphs for non-empty lines
        return line ? `<p>${line}</p>` : '';

    }).join('\n');

    // --- Pass 3: Process Lists ---
    // This regex wraps consecutive <li> items into <ul> blocks.
    html = html.replace(/(<li data-indent="\d+">.*?<\/li>(\n)?)+/g, (match) => {
        let listHtml = '';
        let depth = -1;
        const items = match.match(/<li data-indent="\d+">.*?<\/li>/g);

        for(const item of items) {
            const indent = parseInt(item.match(/data-indent="(\d+)"/)[1], 10);
            const newDepth = Math.floor(indent / 2);

            while(newDepth > depth) {
                listHtml += '<ul>';
                depth++;
            }
            while(newDepth < depth) {
                listHtml += '</ul></li>';
                depth--;
            }
            if (!listHtml.endsWith('<ul>')) listHtml += '</li>';

            listHtml += item.replace(/ data-indent="\d+"/, '');
        }
        while(depth > -1) {
            listHtml += '</li></ul>';
            depth--;
        }
        return listHtml.replace(/^<\/li>/, '');
    });

    // --- Pass 4: Inline Elements ---
    html = html.replace(/!\[(.*?)\]\((.*?)\)/g, '<img src="$2" alt="$1">')
               .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank">$1</a>')
               // NEW: Autolink http/https URLs. The (?<!) is a negative lookbehind
               // to ensure we don't re-link something already in an href, src, or markdown link.
               .replace(/(?<!href="|src="|]\()(https?:\/\/[^\s<>]+)/g, '<a href="$1" target="_blank">$1</a>')
               .replace(/`([^`]+)`/g, (match, code) => `<code>${escapeHtml(code)}</code>`)
               .replace(/~~(.*?)~~/g, '<del>$1</del>')
               .replace(/\*\*(.*?)\*\*|__(.*?)__/g, '<b>$1$2</b>')
               .replace(/\*(.*?)\*|_(.*?)_/g, '<i>$1$2</i>');

    // --- Pass 5: Restore Code Blocks ---
    html = html.replace(/<p>%%CODEBLOCK_(\d+)%%<\/p>/g, (match, index) => {
        return codeBlocks[parseInt(index, 10)];
    }).replace(/%%CODEBLOCK_(\d+)%%/g, (match, index) => {
        return codeBlocks[parseInt(index, 10)];
    });

    return html;
}