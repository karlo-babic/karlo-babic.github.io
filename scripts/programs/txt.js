import { BaseText } from './engines/base_text.js';

/**
 * Text processing and NLP utility program.
 * Supports: lower, clean, sort, and stats.
 */
const Txt = {
    engine: null,

    init: async function(screenEl, args = { positional: [], named: {} }) {
        this.engine = new BaseText(screenEl);
        
        const subcommand = args.positional[0]?.toLowerCase();
        const rawText = args.positional.slice(1).join(' ');

        if (!subcommand || !rawText) {
            this.engine.render("Usage: txt &lt;stats|lower|clean|sort|title|urls&gt; &lt;text&gt;<br>Output is copied to clipboard.");
            return;
        }

        let result = "";
        let htmlOutput = "";
        let shouldCopy = true;

        switch (subcommand) {
            case 'lower':
                result = rawText.toLowerCase();
                htmlOutput = result;
                break;

            case 'clean':
                result = this._clean(rawText);
                htmlOutput = result;
                break;

            case 'sort':
                result = this._clean(rawText).split(' ').sort((a, b) => a.localeCompare(b)).join(' ');
                htmlOutput = result;
                break;

            case 'stats':
                htmlOutput = this._generateStats(rawText);
                shouldCopy = false;
                break;

            case 'title':
                result = this._toTitleCase(rawText);
                htmlOutput = result;
                break;

            case 'urls':
                const urlList = this._extractURLs(rawText);
                result = urlList.join('\n');
                htmlOutput = urlList.length > 0 ? urlList.join('<br>') : "No URLs found.";
                break;

            default:
                htmlOutput = `Unknown subcommand: ${subcommand}`;
                shouldCopy = false;
        }

        if (shouldCopy && result) {
            this._copyToClipboard(result);
        }

        this.engine.render(htmlOutput);
    },

    _clean: function(text) {
        // Removes all non-alphanumeric characters except spaces
        return text.replace(/[^a-zA-Z0-9\s]/g, ' ')
                   .replace(/\s+/g, ' ')
                   .trim();
    },

    _generateStats: function(text) {
        const tokens = this._clean(text).toLowerCase().split(' ').filter(t => t.length > 0);
        const wordCount = tokens.length;
        
        if (wordCount === 0) return "No text to analyze.";

        const getFreqs = (arr) => {
            const freqs = {};
            arr.forEach(item => freqs[item] = (freqs[item] || 0) + 1);
            return Object.entries(freqs).sort((a, b) => b[1] - a[1]);
        };

        const getNGrams = (arr, n) => {
            const grams = [];
            for (let i = 0; i <= arr.length - n; i++) {
                grams.push(arr.slice(i, i + n).join(' '));
            }
            return grams;
        };

        const topWords = getFreqs(tokens).slice(0, 5);
        const topBigrams = getFreqs(getNGrams(tokens, 2)).slice(0, 5);
        const topTrigrams = getFreqs(getNGrams(tokens, 3)).slice(0, 5);

        let html = `<b>TEXT ANALYSIS</b><br>`;
        html += `Word Count: ${wordCount}<br><br>`;
        
        html += `<b>TOP WORDS</b><br>`;
        topWords.forEach(([word, count]) => html += `- ${word}: ${count}<br>`);
        
        if (topBigrams.length > 0) {
            html += `<br><b>TOP BIGRAMS</b><br>`;
            topBigrams.forEach(([gram, count]) => html += `- ${gram}: ${count}<br>`);
        }

        if (topTrigrams.length > 0) {
            html += `<br><b>TOP TRIGRAMS</b><br>`;
            topTrigrams.forEach(([gram, count]) => html += `- ${gram}: ${count}<br>`);
        }

        return html;
    },

    _toTitleCase: function(text) {
        return text.toLowerCase().split(' ').map(word => 
            word.charAt(0).toUpperCase() + word.substring(1)
        ).join(' ');
    },

    _extractURLs: function(text) {
        const urlRegex = /(((https?:\/\/)|(www\.))[^\s]+)/g;
        return text.match(urlRegex) || [];
    },
    
    _copyToClipboard: function(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).catch(err => {
                console.error('Unable to copy text to clipboard', err);
            });
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

export default Txt;