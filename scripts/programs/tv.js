import Radio from './radio.js';
import Stream from './stream.js';
import Fractal from './fractal.js';

/**
 * TV Orchestrator
 * Composites the procedural audio-visual broadcast:
 * - Visuals: Time-driven autonomous fractals (fractal.js)
 * - Audio/Music: Generative Chiptune engine (radio.js)
 * - Subtitles: Deterministic text streaming (stream.js)
 * - Speech: Browser TTS reading generated text.
 */
const TV = {
    screenEl: null,
    
    fractalContainer: null,
    radioContainer: null,
    streamContainer: null,
    
    subtitleObserver: null,
    sentenceBuffer: [],
    EPOCH: 1709251200000,

    _speechQueue: [],
    _speaking: false,
    _unmuted: false,
    _muteBtn: null,

    init: async function(screenEl, args = { positional: [], named: {} }) {
        this.screenEl = screenEl;
        this.screenEl.style.position = 'relative';
        this.screenEl.style.overflow = 'hidden';
        this.screenEl.style.backgroundColor = '#000';
        this.screenEl.innerHTML = '';

        this.setupDOM();

        // Initialize sub-systems simultaneously
        Fractal.init(this.fractalContainer);
        Radio.init(this.radioContainer, args);
        await Stream.init(this.streamContainer, args);

        this._setupMuteButton();
        this.attachSubtitleObserver();
    },

    setupDOM: function() {
        // Layer 1: Fractal Background
        this.fractalContainer = document.createElement('div');
        this.fractalContainer.style.position = 'absolute';
        this.fractalContainer.style.inset = '0';
        this.fractalContainer.style.zIndex = '1';

        // Layer 2: Hidden Radio Context
        this.radioContainer = document.createElement('div');
        this.radioContainer.style.position = 'absolute';
        this.radioContainer.style.width = '10px';
        this.radioContainer.style.height = '10px';
        this.radioContainer.style.opacity = '0';
        this.radioContainer.style.pointerEvents = 'none';

        // Layer 3: TV Subtitles (Stream)
        this.streamContainer = document.createElement('div');
        this.streamContainer.classList.add('tv-subtitles-container');
        this.streamContainer.style.position = 'absolute';
        this.streamContainer.style.bottom = '8%';
        this.streamContainer.style.left = '10%';
        this.streamContainer.style.right = '10%';
        this.streamContainer.style.zIndex = '10';
        this.streamContainer.style.maxHeight = '4.5em';
        this.streamContainer.style.overflowY = 'auto';
        this.streamContainer.style.textAlign = 'center';
        this.streamContainer.style.fontFamily = 'monospace';
        this.streamContainer.style.fontSize = 'clamp(1rem, 2.5vw, 1.5rem)';
        this.streamContainer.style.color = '#ffff00';
        this.streamContainer.style.textShadow = '2px 2px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 0 4px 5px rgba(0,0,0,0.8)';
        this.streamContainer.style.pointerEvents = 'none';
        
        // Hide scrollbars and visually hide the Stream.js roulette word
        const styleBlock = document.createElement('style');
        styleBlock.id = 'tv-custom-styles';
        styleBlock.textContent = `
            .tv-subtitles-container::-webkit-scrollbar { display: none; }
            .tv-subtitles-container { -ms-overflow-style: none; scrollbar-width: none; }
            .tv-subtitles-container span[style*="opacity: 0.4"] { display: none !important; }
        `;
        document.head.appendChild(styleBlock);

        this.screenEl.appendChild(this.fractalContainer);
        this.screenEl.appendChild(this.radioContainer);
        this.screenEl.appendChild(this.streamContainer);
    },

    /**
     * Computes the current global synchronized time and seed.
     * Synchronized every 10 seconds across all instances.
     */
    getGlobalSyncState: function() {
        const globalSeconds = (Date.now() - this.EPOCH) / 1000.0;
        const seed = Math.floor(globalSeconds / 10.0);
        return { globalSeconds, seed };
    },
    
    /**
     * Watches the stream container and triggers TTS based on 
     * synchronized word counts and sentence punctuation.
     */
    attachSubtitleObserver: function() {
        this.sentenceBuffer = [];

        this.subtitleObserver = new MutationObserver(mutations => {
            let totalAdded = 0;
            mutations.forEach(m => totalAdded += m.addedNodes.length);

            if (totalAdded > 5) {
                this.sentenceBuffer = [];
                return;
            }

            mutations.forEach(m => {
                m.addedNodes.forEach(node => {
                    if (node.style && node.style.opacity === '0.4') return;
                    
                    const text = node.textContent.trim();
                    if (!text || text === '[EOF]') return;

                    const { seed } = this.getGlobalSyncState();
                    const targetBatchSize = 8 + (Math.floor(Math.abs(Math.sin(seed) * 100.0)) % 6);

                    if (text === '.') {
                        if (this.sentenceBuffer.length > 0) {
                            this.speak(this.sentenceBuffer.join(' '));
                            this.sentenceBuffer = [];
                        }
                    } else {
                        this.sentenceBuffer.push(text);

                        if (this.sentenceBuffer.length >= targetBatchSize) {
                            this.speak(this.sentenceBuffer.join(' '));
                            this.sentenceBuffer = [];
                        }
                    }
                });
            });
        });

        this.subtitleObserver.observe(this.streamContainer, { childList: true });
    },

    pruneSubtitles: function() {
        const nodes = Array.from(this.streamContainer.childNodes);
        const stableNodes = nodes.filter(n => !(n.nodeType === 1 && n.style && n.style.opacity === '0.4'));
        
        let periodCount = 0;
        let cutoffIndex = -1;

        // Traverse backwards to find the 3rd period (keeping only the last 2 sentences)
        for (let i = stableNodes.length - 1; i >= 0; i--) {
            if (stableNodes[i].textContent.trim() === '.') {
                periodCount++;
                if (periodCount === 3) {
                    cutoffIndex = i;
                    break;
                }
            }
        }

        // Remove all old nodes up to and including the cutoff period
        if (cutoffIndex !== -1) {
            for (let i = 0; i <= cutoffIndex; i++) {
                if (stableNodes[i].parentNode) {
                    stableNodes[i].parentNode.removeChild(stableNodes[i]);
                }
            }
        }
    },

    _setupMuteButton: function() {
        const mutedSVG   = `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M16.5 12A4.5 4.5 0 0 0 14 7.97v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.796 8.796 0 0 0 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.99 8.99 0 0 0 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>`;
        const unmutedSVG = `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>`;

        this._muteBtn = document.createElement('button');
        Object.assign(this._muteBtn.style, {
            position: 'absolute', bottom: '16px', right: '16px', zIndex: '20',
            background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,0,0.2)',
            borderRadius: '4px', padding: '5px 7px', cursor: 'pointer', lineHeight: '0',
        });

        const sync = () => {
            this._muteBtn.innerHTML = this._unmuted ? unmutedSVG : mutedSVG;
            this._muteBtn.style.color = this._unmuted ? '#ffff00' : 'rgba(255,255,255,0.4)';
        };
        sync();

        this._muteBtn.addEventListener('click', () => {
            this._unmuted = !this._unmuted;
            sync();
            if (this._unmuted) {
                if (!this._speaking) this._speakNext();
            } else {
                window.speechSynthesis.cancel();
                this._speaking = false;
                this._speechQueue = [];
            }
        });

        this.screenEl.appendChild(this._muteBtn);
    },

    speak: function(text) {
        if (!this._unmuted || !window.speechSynthesis) return;
        this._speechQueue.push(text);
        if (!this._speaking) this._speakNext();
    },

    _speakNext: function() {
        if (!this._unmuted || !this._speechQueue.length) { this._speaking = false; return; }
        this._speaking = true;
        const text = this._speechQueue.shift();
        const { seed } = this.getGlobalSyncState();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.3;
        utterance.pitch = Math.max(0.1, Math.abs(Math.sin(seed)) * 2);
        utterance.volume = 1.4;
        utterance.onend = () => this._speakNext();
        utterance.onerror = () => this._speakNext();
        window.speechSynthesis.speak(utterance);
    },
    
    unload: function() {
        if (this.subtitleObserver) {
            this.subtitleObserver.disconnect();
            this.subtitleObserver = null;
        }

        this._speechQueue = [];
        this._speaking = false;
        this._unmuted = false;
        this._muteBtn = null;

        if (window.speechSynthesis) {
            window.speechSynthesis.cancel();
        }

        const customStyles = document.getElementById('tv-custom-styles');
        if (customStyles) customStyles.remove();

        Fractal.unload();
        Radio.unload();
        Stream.unload();

        if (this.screenEl) {
            this.screenEl.innerHTML = '';
        }
    },

    onResize: function() {
        Fractal.onResize();
        Radio.onResize();
        Stream.onResize();
    }
};

export default TV;