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
                    const targetBatchSize = 3 + (Math.floor(Math.abs(Math.sin(seed) * 100.0)) % 6);

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

    speak: function(text) {
        if (!window.speechSynthesis) return;

        const utterance = new SpeechSynthesisUtterance(text);
        const { seed } = this.getGlobalSyncState();
        
        // Slightly lower pitch and rate to fit the surreal broadcast aesthetic
        utterance.rate = 1.3;
        utterance.pitch = Math.max(0.1, Math.abs(Math.sin(seed)) * 2);
        utterance.volume = 0.9;

        window.speechSynthesis.speak(utterance);
    },
    
    unload: function() {
        if (this.subtitleObserver) {
            this.subtitleObserver.disconnect();
            this.subtitleObserver = null;
        }

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