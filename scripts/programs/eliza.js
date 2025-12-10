import { InteractiveText } from './engines/interactive_text.js';

/**
 * Represents a keyword in the Eliza script.
 */
class Key {
    constructor(word, weight, decomps) {
        this.word = word;
        this.weight = weight;
        this.decomps = decomps;
    }
}

/**
 * Represents a decomposition rule for a keyword.
 */
class Decomp {
    constructor(parts, save, reasmbs) {
        this.parts = parts;
        this.save = save;
        this.reasmbs = reasmbs;
        this.next_reasmb_index = 0;
    }
}

/**
 * The Core Eliza Logic.
 * Ported from Python.
 */
class ElizaBot {
    constructor() {
        this.initials = [];
        this.finals = [];
        this.quits = [];
        this.pres = {};
        this.posts = {};
        this.synons = {};
        this.keys = {};
        this.memory = [];
    }

    /**
     * Parses the script content (doctor.txt).
     * @param {string} content 
     */
    load(content) {
        let key = null;
        let decomp = null;
        const lines = content.split(/\r?\n/);

        for (const line of lines) {
            if (!line.trim()) continue;

            // Split on the first colon only
            const splitIdx = line.indexOf(':');
            if (splitIdx === -1) continue;

            const tag = line.substring(0, splitIdx).trim();
            let contentStr = line.substring(splitIdx + 1).trim();

            if (tag === 'initial') {
                this.initials.push(contentStr);
            } else if (tag === 'final') {
                this.finals.push(contentStr);
            } else if (tag === 'quit') {
                this.quits.push(contentStr);
            } else if (tag === 'pre') {
                const parts = contentStr.split(' ');
                this.pres[parts[0]] = parts.slice(1);
            } else if (tag === 'post') {
                const parts = contentStr.split(' ');
                this.posts[parts[0]] = parts.slice(1);
            } else if (tag === 'synon') {
                const parts = contentStr.split(' ');
                this.synons[parts[0]] = parts;
            } else if (tag === 'key') {
                const parts = contentStr.split(' ');
                const word = parts[0];
                const weight = parts.length > 1 ? parseInt(parts[1], 10) : 1;
                key = new Key(word, weight, []);
                this.keys[word] = key;
            } else if (tag === 'decomp') {
                let parts = contentStr.split(' ');
                let save = false;
                if (parts[0] === '$') {
                    save = true;
                    parts = parts.slice(1);
                }
                decomp = new Decomp(parts, save, []);
                key.decomps.push(decomp);
            } else if (tag === 'reasmb') {
                const parts = contentStr.split(' ');
                decomp.reasmbs.push(parts);
            }
        }
    }

    _match_decomp_r(parts, words, results) {
        if (parts.length === 0 && words.length === 0) {
            return true;
        }
        if (parts.length === 0 || (words.length === 0 && parts[0] !== '*')) {
            return false;
        }

        if (parts[0] === '*') {
            for (let index = words.length; index >= 0; index--) {
                results.push(words.slice(0, index));
                if (this._match_decomp_r(parts.slice(1), words.slice(index), results)) {
                    return true;
                }
                results.pop();
            }
            return false;
        } else if (parts[0].startsWith('@')) {
            const root = parts[0].substring(1);
            if (!this.synons[root]) {
                throw new Error(`Unknown synonym root ${root}`);
            }
            if (!this.synons[root].includes(words[0].toLowerCase())) {
                return false;
            }
            results.push([words[0]]);
            return this._match_decomp_r(parts.slice(1), words.slice(1), results);
        } else if (parts[0].toLowerCase() !== words[0].toLowerCase()) {
            return false;
        } else {
            return this._match_decomp_r(parts.slice(1), words.slice(1), results);
        }
    }

    _match_decomp(parts, words) {
        const results = [];
        if (this._match_decomp_r(parts, words, results)) {
            return results;
        }
        return null;
    }

    _next_reasmb(decomp) {
        const index = decomp.next_reasmb_index;
        const result = decomp.reasmbs[index % decomp.reasmbs.length];
        decomp.next_reasmb_index = index + 1;
        return result;
    }

    _reassemble(reasmb, results) {
        const output = [];
        for (const reword of reasmb) {
            if (!reword) continue;
            if (reword.startsWith('(') && reword.endsWith(')')) {
                const index = parseInt(reword.substring(1, reword.length - 1), 10);
                if (index < 1 || index > results.length) {
                    throw new Error(`Invalid result index ${index}`);
                }
                let insert = results[index - 1];
                // Punctuation cleanup for inserted text
                ['.', ',', ';'].forEach(punct => {
                    const idx = insert.indexOf(punct);
                    if (idx !== -1) {
                        insert = insert.slice(0, idx);
                    }
                });
                output.push(...insert);
            } else {
                output.push(reword);
            }
        }
        return output;
    }

    _sub(words, sub) {
        const output = [];
        for (const word of words) {
            const wordLower = word.toLowerCase();
            if (sub[wordLower]) {
                output.push(...sub[wordLower]);
            } else {
                output.push(word);
            }
        }
        return output;
    }

    _match_key(words, key) {
        for (const decomp of key.decomps) {
            let results = this._match_decomp(decomp.parts, words);
            if (results === null) continue;

            results = results.map(w => this._sub(w, this.posts));
            const reasmb = this._next_reasmb(decomp);

            if (reasmb[0] === 'goto') {
                const gotoKey = reasmb[1];
                if (!this.keys[gotoKey]) {
                    throw new Error(`Invalid goto key ${gotoKey}`);
                }
                return this._match_key(words, this.keys[gotoKey]);
            }

            const output = this._reassemble(reasmb, results);
            if (decomp.save) {
                this.memory.push(output);
                continue;
            }
            return output;
        }
        return null;
    }

    respond(text) {
        if (this.quits.includes(text.toLowerCase())) {
            return null; // Signal to quit
        }

        // Pre-processing
        text = text.replace(/\s*\.+\s*/g, ' . ');
        text = text.replace(/\s*,+\s*/g, ' , ');
        text = text.replace(/\s*;+\s*/g, ' ; ');

        let words = text.split(' ').filter(w => w);
        words = this._sub(words, this.pres);

        // Find keys
        let keys = words
            .filter(w => this.keys[w.toLowerCase()])
            .map(w => this.keys[w.toLowerCase()]);
        
        keys = keys.sort((a, b) => b.weight - a.weight);

        let output = null;

        for (const key of keys) {
            output = this._match_key(words, key);
            if (output) break;
        }

        if (!output) {
            if (this.memory.length > 0) {
                const index = Math.floor(Math.random() * this.memory.length);
                output = this.memory.splice(index, 1)[0];
            } else {
                output = this._next_reasmb(this.keys['xnone'].decomps[0]);
            }
        }

        return output.join(" ");
    }

    initial() {
        return this.initials[Math.floor(Math.random() * this.initials.length)];
    }

    final() {
        return this.finals[Math.floor(Math.random() * this.finals.length)];
    }
}

/**
 * Public Interface for the Console
 */
const Eliza = {
    engine: null,
    bot: null,

    init: async function(screenEl) {
        // Initialize the UI Engine
        this.engine = new InteractiveText(screenEl, (text) => this.handleInput(text));
        
        this.engine.println("Loading Eliza...");

        try {
            // Load the script file
            // Assuming doctor.txt is served from the same location or mapped in your server config
            const response = await fetch('./data/doctor.txt');
            if (!response.ok) throw new Error("Could not load doctor.txt");
            
            const scriptContent = await response.text();

            this.bot = new ElizaBot();
            this.bot.load(scriptContent);

            // Display initial greeting
            this.engine.println(this.bot.initial());

        } catch (e) {
            this.engine.println(`Error: ${e.message}`, 'error');
        }
    },

    handleInput: function(text) {
        if (!this.bot) return;

        try {
            const response = this.bot.respond(text);
            
            if (response === null) {
                // Quit condition met
                this.engine.println(this.bot.final());
                // Remove input capability effectively ending the session
                if(this.engine.inputField) this.engine.inputField.disabled = true;
            } else {
                this.engine.println(response);
            }
        } catch (e) {
            console.error(e);
            this.engine.println("I am confused. Please check the console logs.", 'error');
        }
    },

    unload: function() {
        if (this.engine) {
            this.engine.unload();
            this.engine = null;
        }
        this.bot = null;
    },

    onResize: function() {
        if (this.engine) this.engine.onResize();
    }
};

export default Eliza;