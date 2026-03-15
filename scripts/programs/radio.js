import { BaseGridSimulation } from './engines/base_grid_simulation.js';

/**
 * Procedural Chiptune Engine and Visualizer
 * A generative music engine that writes infinite, varied 8-bit soundtracks.
 * It uses algorithmic composition (modes, motifs, song structures) and 
 * synthesizes tracker-style audio (fast arps, PWM approximations) using the Web Audio API.
 */
class ProceduralRadioProgram extends BaseGridSimulation {
    constructor(screenEl, config) {
        super(screenEl, config);
        
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.audioCtx = new AudioContext();
        this.isRunning = false;

        // Synchronization Constants
        this.EPOCH = 1704067200000; // Fixed reference point (Jan 1, 2024)
        this.SONG_DURATION_STEPS = 256; // Length of one procedural song
        this.BASE_BPM = 120; // Reference tempo to calculate global step alignment

        // Music Theory & Algorithmic Composition Constraints
        this.modes = {
            Ionian:     [0, 2, 4, 5, 7, 9, 11],
            Dorian:     [0, 2, 3, 5, 7, 9, 10],
            Phrygian:   [0, 1, 3, 5, 7, 8, 10],
            Lydian:     [0, 2, 4, 6, 7, 9, 11],
            Mixolydian: [0, 2, 4, 5, 7, 9, 10],
            Aeolian:    [0, 2, 3, 5, 7, 8, 10]
        };

        this.grooveStyles = [
            { kick: [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0], snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0], hatDense: 0.8 },
            { kick: [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0], snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0], hatDense: 1.0 },
            { kick: [1,0,0,0, 0,0,0,1, 0,0,1,0, 0,0,0,0], snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0], hatDense: 0.5 },
            { kick: [1,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0], snare: [0,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0], hatDense: 0.3 }
        ];

        this.palettes = ['#00ffcc', '#ff007f', '#ffff00', '#ff5500', '#aa00ff', '#00ff00', '#00aaff'];

        this.station = null;
        this.lookahead = 25.0;
        this.scheduleAheadTime = 0.15;
        this.currentNoteTime = 0;
        this.step = 0;
        this.schedulerTimerID = null;

        this.scheduleNotes = this.scheduleNotes.bind(this);
    }

    /**
     * Mulberry32 Seeded PRNG
     * Provides deterministic randomness so all clients generate the same song.
     */
    seededRandom(seed) {
        return function() {
            seed |= 0; seed = seed + 0x6D2B79F5 | 0;
            let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
            t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        };
    }

    /**
     * Initializes the program and sets up a mandatory user-interaction listener
     * to resume the AudioContext, as modern browsers block auto-playing audio 
     * when loaded via URL parameters without a preceding gesture.
     */
    init() {
        super.init();
        this.isRunning = true;

        this._resumeHandler = () => {
            if (this.audioCtx && this.audioCtx.state === 'suspended') {
                this.audioCtx.resume().then(() => {
                    this.tuneToNewStation();
                    // Catch current time to begin deterministic scheduling
                    this.currentNoteTime = this.audioCtx.currentTime + 0.05;
                    this.scheduleNotes();
                });
            }
        };

        window.addEventListener('click', this._resumeHandler, { once: true });
        window.addEventListener('keydown', this._resumeHandler, { once: true });
        this._resumeHandler();
    }

    /**
     * Cleans up the audio context, timers, and the global interaction listeners.
     */
    unload() {
        this.isRunning = false;
        
        // Remove listeners to prevent memory leaks or unintended resumptions
        window.removeEventListener('click', this._resumeHandler);
        window.removeEventListener('keydown', this._resumeHandler);

        if (this.schedulerTimerID) {
            clearTimeout(this.schedulerTimerID);
        }
        
        if (this.audioCtx) {
            this.audioCtx.close();
        }
        
        super.unload();
    }

    /**
     * Algorithmic Composer Methods
     * Generates the structural blueprint for a new song.
     */
    tuneToNewStation() {
        const now = Date.now();
        const elapsed = now - this.EPOCH;
        
        const msPerStep = (60000 / this.BASE_BPM) / 4; 
        const totalStepsPassed = Math.floor(elapsed / msPerStep);
        const currentSongID = Math.floor(totalStepsPassed / this.SONG_DURATION_STEPS);
        
        const songRng = this.seededRandom(currentSongID);
        const nextInt = (max) => Math.floor(songRng() * max);

        const modeKeys = Object.keys(this.modes);
        const selectedMode = modeKeys[nextInt(modeKeys.length)];
        const color = this.palettes[nextInt(this.palettes.length)];

        this.config.aliveColor = color;
        if (this.ctx && this.canvas) this.ctx.fillStyle = color;

        this.station = {
            id: currentSongID,
            mode: selectedMode,
            scale: this.modes[selectedMode],
            root: nextInt(12) + 36,
            bpm: nextInt(60) + 100,
            groove: this.grooveStyles[nextInt(this.grooveStyles.length)],
            swing: songRng() < 0.3 ? (songRng() * 0.05) : 0,
            timbre: {
                leadWave: songRng() > 0.5 ? 'square' : 'sawtooth',
                leadEnv: songRng() > 0.5 ? 'pluck' : 'sustain',
                bassWave: songRng() > 0.5 ? 'triangle' : 'square',
                arpActive: songRng() > 0.1,
                // Arpeggiator Variation Parameters
                arpStyle: ['up', 'down', 'converge', 'random'][nextInt(4)],
                arpInterval: [0.03, 0.04, 0.06, 0.08][nextInt(4)],
                arpOctave: songRng() > 0.5 ? 12 : 24,
                arpExtension: songRng() > 0.6 ? '7th' : (songRng() > 0.8 ? 'sus4' : 'triad')
            },
            sectionA: {
                progression: this.generateProgression(songRng),
                leadMotif: this.generateMotif(0.4, 3, true, songRng),
                bassMotif: this.generateMotif(0.6, 1, false, songRng)
            },
            sectionB: {
                progression: this.generateProgression(songRng),
                leadMotif: this.generateMotif(0.7, 4, true, songRng),
                bassMotif: this.generateMotif(0.8, 2, false, songRng)
            }
        };

        this.step = totalStepsPassed % this.SONG_DURATION_STEPS;
    }

    generateProgression(rng) {
        const chords = [];
        let currentChord = 0;
        const moves = [3, 4, 1, -1, 2];
        for (let i = 0; i < 4; i++) {
            chords.push(currentChord);
            currentChord = (currentChord + moves[Math.floor(rng() * moves.length)] + 7) % 7;
        }
        return chords;
    }

    generateMotif(density, maxJump, isLead, rng) {
        const pattern = new Array(16).fill(null);
        let currentDegree = isLead ? Math.floor(rng() * 4) : 0;
        for (let i = 0; i < 16; i++) {
            const isStrongBeat = i % 4 === 0;
            const currentDensity = isStrongBeat ? density * 1.5 : density;
            if (rng() < currentDensity) {
                const jump = Math.floor(rng() * (maxJump * 2 + 1)) - maxJump;
                currentDegree += jump;
                if (currentDegree > 14) currentDegree -= 7;
                if (currentDegree < -7) currentDegree += 7;
                const length = (rng() > 0.7 && i < 15) ? 2 : 1;
                pattern[i] = { degree: currentDegree, length: length };
                if (length > 1) i++;
            }
        }
        return pattern;
    }

    /**
     * Constructs a set of MIDI offsets relative to a root degree based on 
     * specified chord types (Triads, 7ths, or Suspended 4ths).
     */
    getChordNotes(degree, extension = 'triad') {
        const scale = this.station.scale;
        const getDegree = (d) => scale[d % 7] + Math.floor(d / 7) * 12;

        const notes = [getDegree(degree), getDegree(degree + 2), getDegree(degree + 4)];
        
        if (extension === '7th') {
            notes.push(getDegree(degree + 6));
        } else if (extension === 'sus4') {
            notes[1] = getDegree(degree + 3);
        }
        
        return notes;
    }

    midiToFreq(n) {
        return 440 * Math.pow(2, (n - 69) / 12);
    }

    // --- Audio Synthesizer Engines ---

    playTone(midiNote, time, duration, type, envShape, volume) {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(this.midiToFreq(midiNote), time);

        // Envelope shaping
        if (envShape === 'pluck') {
            gain.gain.setValueAtTime(volume, time);
            gain.gain.exponentialRampToValueAtTime(0.001, time + duration * 0.8);
        } else {
            gain.gain.setValueAtTime(0.001, time);
            gain.gain.linearRampToValueAtTime(volume, time + 0.02);
            gain.gain.setValueAtTime(volume, time + duration - 0.05);
            gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
        }

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);

        osc.start(time);
        osc.stop(time + duration + 0.1);
    }

    /**
     * Synthesizes a rapid cycling arpeggio. 
     * Supports various movement patterns and deterministic randomization.
     */
    playTrackerArp(chordMidiNotes, time, duration, volume, settings) {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        osc.type = 'square';
        
        const arpSpeed = settings.arpInterval || 0.04;
        const steps = Math.floor(duration / arpSpeed);
        const style = settings.arpStyle || 'up';
        
        for (let i = 0; i < steps; i++) {
            let noteIndex;
            switch(style) {
                case 'down':
                    noteIndex = (chordMidiNotes.length - 1) - (i % chordMidiNotes.length);
                    break;
                case 'converge':
                    // Pattern: Root, High, Mid
                    const seq = [0, chordMidiNotes.length - 1, 1];
                    noteIndex = seq[i % seq.length];
                    break;
                case 'random':
                    // Deterministic pseudo-random based on start time to keep clients in sync
                    noteIndex = Math.floor(Math.abs(Math.sin(time + i)) * chordMidiNotes.length);
                    break;
                case 'up':
                default:
                    noteIndex = i % chordMidiNotes.length;
            }

            const note = chordMidiNotes[noteIndex];
            osc.frequency.setValueAtTime(this.midiToFreq(note + settings.arpOctave), time + (i * arpSpeed));
        }

        gain.gain.setValueAtTime(volume, time);
        gain.gain.setTargetAtTime(0.001, time + duration - 0.02, 0.02);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);

        osc.start(time);
        osc.stop(time + duration);
    }

    playDrum(type, time) {
        if (type === 'kick') {
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();

            osc.frequency.setValueAtTime(150, time);
            osc.frequency.exponentialRampToValueAtTime(40, time + 0.1);

            gain.gain.setValueAtTime(0.5, time);
            gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);

            osc.connect(gain);
            gain.connect(this.audioCtx.destination);

            osc.start(time);
            osc.stop(time + 0.15);
        } else if (type === 'snare') {
            // Noise burst + triangle impact
            this.playTone(72, time, 0.1, 'triangle', 'pluck', 0.3);
            this.playNoise(time, 0.15, 0.25);
        } else if (type === 'hat') {
            this.playNoise(time, 0.05, 0.05);
        }
    }

    playNoise(time, duration, volume) {
        const size = this.audioCtx.sampleRate * duration;
        const buffer = this.audioCtx.createBuffer(1, size, this.audioCtx.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < size; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.audioCtx.createBufferSource();
        noise.buffer = buffer;

        const gain = this.audioCtx.createGain();
        gain.gain.setValueAtTime(volume, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

        noise.connect(gain);
        gain.connect(this.audioCtx.destination);

        noise.start(time);
    }

    // --- Visualizer Engines ---

    computeNextState(x, y) {
        const rows = this.grid.length;
        const cols = this.grid[0].length;
        
        // Define the drum zone (bottom 5%) and the melody injection line
        const drumRowsCount = Math.max(1, Math.ceil(rows * 0.05));
        const drumStartRow = rows - drumRowsCount;
        const melodyInjectionRow = drumStartRow - 1;

        // The drum zone does not scroll. It flickers and clears itself to show pulses.
        if (y >= drumStartRow) {
            return Math.random() < 0.35 ? 0 : this.grid[y][x];
        }

        // The melody injection row clears itself to prepare for the next step's input.
        // It does not pull from the drum zone, preventing drums from traveling up.
        if (y === melodyInjectionRow) {
            return Math.random() < 0.4 ? 0 : this.grid[y][x];
        }

        // Main traveling area: Pull pixels from the row below to create upward motion.
        let state = this.grid[y + 1][x];

        // Apply a "digital flame" / signal decay effect.
        if (state === 1) {
            // High probability of traveling up, with a slight chance of vanishing.
            if (Math.random() < 0.05) return 0;
        } else {
            // Organic propagation: pixels can "bleed" sideways as they rise.
            const leftActive = x > 0 ? this.grid[y + 1][x - 1] : 0;
            const rightActive = x < cols - 1 ? this.grid[y + 1][x + 1] : 0;
            
            if ((leftActive === 1 || rightActive === 1) && Math.random() < 0.07) {
                return 1;
            }
        }

        return state;
    }

    triggerVisual(type, metadata = 0) {
        if (!this.isRunning || !this.grid || !this.grid.length || !this.grid[0].length) return;
        
        const rows = this.grid.length;
        const cols = this.grid[0].length;
        
        const drumRowsCount = Math.max(1, Math.ceil(rows * 0.05));
        const drumStartRow = rows - drumRowsCount;
        const melodyY = drumStartRow - 1;

        if (type === 'kick') {
            // Fill a substantial block in the drum zone
            const width = Math.floor(cols * 0.2);
            for (let r = drumStartRow; r < rows; r++) {
                for (let c = 0; c < width; c++) {
                    this.grid[r][c] = 1;
                }
            }
        } else if (type === 'snare') {
            // Scatter noise across the entire drum zone
            for (let r = drumStartRow; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    if (Math.random() < 0.3) this.grid[r][c] = 1;
                }
            }
        } else if (type === 'hat') {
            // Sharp spark on the right side of the drum zone
            const startCol = Math.floor(cols * 0.8);
            for (let r = drumStartRow; r < rows; r++) {
                for (let c = startCol; c < cols; c++) {
                    if (Math.random() < 0.5) this.grid[r][c] = 1;
                }
            }
        } else if (type === 'bass') {
            // A persistent, thick vertical pillar on the left of the melody row
            const width = Math.min(4, Math.floor(cols * 0.1));
            for (let i = 0; i < width; i++) {
                this.grid[melodyY][i] = 1;
            }
        } else if (type === 'arp') {
            // Geometric dot sequence based on chord interval index
            const step = (metadata % 3) + 2;
            for (let i = Math.floor(cols * 0.2); i < cols * 0.8; i += step * 3) {
                if (i < cols) this.grid[melodyY][i] = 1;
            }
        } else if (type === 'lead') {
            // Direct pitch mapping across the width of the melody row (asymmetric)
            const normalizedPitch = Math.max(-7, Math.min(14, metadata)); 
            const percent = (normalizedPitch + 7) / 21;
            const xPos = Math.floor(percent * (cols - 1));
            
            if (xPos >= 0 && xPos < cols) {
                this.grid[melodyY][xPos] = 1;
                // Add a small cluster for visibility
                if (xPos + 1 < cols) this.grid[melodyY][xPos + 1] = 1;
                if (xPos - 1 >= 0) this.grid[melodyY][xPos - 1] = 1;
            }
        }
    }
    
    scheduleVisual(type, scheduledTime, metadata = 0) {
        const delay = Math.max(0, (scheduledTime - this.audioCtx.currentTime) * 1000);
        setTimeout(() => {
            if (this.isRunning) {
                this.triggerVisual(type, metadata);
            }
        }, delay);
    }

    // --- Sequencer ---

    nextNote() {
        const secondsPerBeat = 60.0 / this.station.bpm;
        // 16th note duration calculation
        let stepDuration = 0.25 * secondsPerBeat;
        
        // Apply swing to even 16th notes
        if (this.step % 2 === 0) {
            stepDuration += this.station.swing;
        } else {
            stepDuration -= this.station.swing;
        }

        this.currentNoteTime += stepDuration;
        this.step++;
    }

    /**
     * Executes the logic for a single sequencer step.
     */
    playStep(currentStep, time) {
        const stepRng = this.seededRandom(this.station.id + currentStep);
        
        const secondsPerBeat = 60.0 / this.station.bpm;
        const base16thTime = 0.25 * secondsPerBeat;
        const isSectionA = (currentStep % 128) < 64;
        const currentSection = isSectionA ? this.station.sectionA : this.station.sectionB;
        const measureInSubSection = Math.floor((currentStep % 64) / 16);
        const chordDegree = currentSection.progression[measureInSubSection];
        const stepInBar = currentStep % 16;

        const bassData = currentSection.bassMotif[stepInBar];
        if (bassData !== null) {
            const scaleDegree = chordDegree + bassData.degree;
            const noteInterval = this.station.scale[((scaleDegree % 7) + 7) % 7];
            const octaveOffset = Math.floor(scaleDegree / 7) * 12;
            const bassMidi = this.station.root + noteInterval + octaveOffset - 12;
            this.playTone(bassMidi, time, base16thTime * bassData.length, this.station.timbre.bassWave, 'pluck', 0.2);
            this.scheduleVisual('bass', time);
        }

        if (this.station.timbre.arpActive && stepInBar % 4 === 0) {
            const chordIntervals = this.getChordNotes(chordDegree, this.station.timbre.arpExtension);
            const chordMidiNotes = chordIntervals.map(interval => this.station.root + interval);
            this.playTrackerArp(chordMidiNotes, time, base16thTime * 4, 0.03, this.station.timbre);
            this.scheduleVisual('arp', time, currentStep);
        }

        const leadData = currentSection.leadMotif[stepInBar];
        if (leadData !== null) {
            const scaleDegree = leadData.degree;
            const noteInterval = this.station.scale[((scaleDegree % 7) + 7) % 7];
            const octaveOffset = Math.floor(scaleDegree / 7) * 12;
            const leadMidi = this.station.root + noteInterval + octaveOffset + 12;
            this.playTone(leadMidi, time, base16thTime * leadData.length, this.station.timbre.leadWave, this.station.timbre.leadEnv, 0.12);
            this.scheduleVisual('lead', time, scaleDegree);
        }

        if (this.station.groove.kick[stepInBar]) {
            this.playDrum('kick', time);
            this.scheduleVisual('kick', time);
        }
        if (this.station.groove.snare[stepInBar]) {
            this.playDrum('snare', time);
            this.scheduleVisual('snare', time);
        }
        if (stepRng() < this.station.groove.hatDense) {
            this.playDrum('hat', time);
            this.scheduleVisual('hat', time);
        }
    }

    scheduleNotes() {
        if (!this.isRunning) return;

        // Check for song transition every bar
        if (this.step > 0 && this.step % 16 === 0) {
            const now = Date.now();
            const msPerStep = (60000 / this.BASE_BPM) / 4; 
            const totalStepsPassed = Math.floor((now - this.EPOCH) / msPerStep);
            const currentSongID = Math.floor(totalStepsPassed / this.SONG_DURATION_STEPS);
            
            if (this.station && currentSongID !== this.station.id) {
                this.tuneToNewStation();
            }
        }

        while (this.currentNoteTime < this.audioCtx.currentTime + this.scheduleAheadTime) {
            this.playStep(this.step, this.currentNoteTime);
            this.nextNote();
        }
        
        this.schedulerTimerID = setTimeout(this.scheduleNotes, this.lookahead);
    }
}

const Radio = {
    instance: null,

    init: function(screenEl) {
        const config = {
            cellSize: 6,
            updateInterval: 50, 
            aliveColor: '#00ffcc' // Overridden dynamically by station changes
        };
        this.instance = new ProceduralRadioProgram(screenEl, config);
        this.instance.init();
    },

    unload: function() {
        if (this.instance) {
            this.instance.unload();
            this.instance = null;
        }
    },

    onResize: function() {
        if (this.instance) {
            this.instance.onResize();
        }
    }
};

export default Radio;