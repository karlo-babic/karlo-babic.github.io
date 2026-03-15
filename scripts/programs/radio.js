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
            // Diatonic Modes
            Ionian:     [0, 2, 4, 5, 7, 9, 11],
            Dorian:     [0, 2, 3, 5, 7, 9, 10],
            Phrygian:   [0, 1, 3, 5, 7, 8, 10],
            Lydian:     [0, 2, 4, 6, 7, 9, 11],
            Mixolydian: [0, 2, 4, 5, 7, 9, 10],
            Aeolian:    [0, 2, 3, 5, 7, 8, 10],
            // Exotic Scales
            Pentatonic: [0, 2, 4, 7, 9],
            Hirajoshi:  [0, 2, 3, 7, 8],
            Blues:      [0, 3, 5, 6, 7, 10],
            WholeTone:  [0, 2, 4, 6, 8, 10]
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

    init() {
        super.init();
        this.isRunning = true;

        this._resumeHandler = () => {
            if (this.audioCtx && this.audioCtx.state === 'suspended') {
                this.audioCtx.resume().then(() => {
                    this.tuneToNewStation();
                    this.currentNoteTime = this.audioCtx.currentTime + 0.05;
                    this.scheduleNotes();
                });
            }
        };

        window.addEventListener('click', this._resumeHandler, { once: true });
        window.addEventListener('keydown', this._resumeHandler, { once: true });
        this._resumeHandler();
    }

    unload() {
        this.isRunning = false;
        window.removeEventListener('click', this._resumeHandler);
        window.removeEventListener('keydown', this._resumeHandler);
        if (this.schedulerTimerID) clearTimeout(this.schedulerTimerID);
        if (this.audioCtx) this.audioCtx.close();
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
            chaos: songRng(),
            timbre: {
                leadWave: songRng() > 0.5 ? 'square' : 'sawtooth',
                leadEnv: songRng() > 0.5 ? 'pluck' : 'sustain',
                bassWave: songRng() > 0.5 ? 'triangle' : 'square',
                arpActive: songRng() > 0.1,
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

    /**
     * Creates a chord progression using functional harmony or circle of fifths logic.
     * Incorporates "Chaos" rating to allow borrowed chords or chromaticism.
     */
    generateProgression(rng) {
        const chords = [0]; // Always start on root
        let currentChord = 0;
        
        // Common harmonic movements (IV, V, vi, ii, iii)
        const logicalMoves = [3, 4, 5, 1, 2];
        const chaosFactor = this.station?.chaos || 0.2;

        for (let i = 1; i < 4; i++) {
            if (rng() < chaosFactor) {
                // Chaotic/Borrowed chord
                currentChord = Math.floor(rng() * 7);
            } else {
                // Logical harmonic step
                currentChord = (currentChord + logicalMoves[Math.floor(rng() * logicalMoves.length)]) % 7;
            }
            chords.push(currentChord);
        }
        return chords;
    }

    /**
     * Generates a "Call and Response" pattern.
     * Creates an 8-step "Call", then repeats it with variations for the "Response".
     */
    generateMotif(density, maxJump, isLead, rng) {
        const pattern = new Array(16).fill(null);
        let currentDegree = isLead ? Math.floor(rng() * 4) : 0;

        // Generate the "Call" (Steps 0-7)
        for (let i = 0; i < 8; i++) {
            if (rng() < (i % 4 === 0 ? density * 1.5 : density)) {
                const jump = Math.floor(rng() * (maxJump * 2 + 1)) - maxJump;
                currentDegree += jump;
                // Keep within reasonable scale range
                if (currentDegree > 12) currentDegree -= 5;
                if (currentDegree < -5) currentDegree += 5;
                
                const length = (rng() > 0.8 && i < 7) ? 2 : 1;
                pattern[i] = { degree: currentDegree, length: length };
                if (length > 1) i++;
            }
        }

        // Generate the "Response" (Steps 8-15) as a variation of the Call
        for (let i = 0; i < 8; i++) {
            const callNote = pattern[i];
            const stepIndex = i + 8;

            if (callNote) {
                // 70% chance to keep the note, 30% to vary or remove
                if (rng() < 0.7) {
                    // Small pitch tweak
                    const varJump = rng() < 0.2 ? (Math.floor(rng() * 3) - 1) : 0;
                    pattern[stepIndex] = { 
                        degree: callNote.degree + varJump, 
                        length: callNote.length 
                    };
                }
            } else if (rng() < density * 0.3) {
                // Add a new note where there was silence
                pattern[stepIndex] = { degree: currentDegree, length: 1 };
            }
        }

        return pattern;
    }

    /**
     * Constructs a set of MIDI offsets relative to a root degree.
     * Scale-length agnostic to support Pentatonic/Exotic scales.
     */
    getChordNotes(degree, extension = 'triad') {
        const scale = this.station.scale;
        const len = scale.length;
        const getDegree = (d) => scale[((d % len) + len) % len] + Math.floor(d / len) * 12;

        const notes = [getDegree(degree), getDegree(degree + 2), getDegree(degree + 4)];
        
        if (extension === '7th') {
            notes.push(getDegree(degree + 6));
        } else if (extension === 'sus4') {
            // Mapping sus4 to the fourth index in scale if possible
            notes[1] = getDegree(degree + 3);
        }
        
        return notes;
    }

    midiToFreq(n) {
        return 440 * Math.pow(2, (n - 69) / 12);
    }

    playTone(midiNote, time, duration, type, envShape, volume) {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(this.midiToFreq(midiNote), time);

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
                    const seq = [0, chordMidiNotes.length - 1, 1];
                    noteIndex = seq[i % seq.length];
                    break;
                case 'random':
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
        for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;
        const noise = this.audioCtx.createBufferSource();
        noise.buffer = buffer;
        const gain = this.audioCtx.createGain();
        gain.gain.setValueAtTime(volume, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
        noise.connect(gain);
        gain.connect(this.audioCtx.destination);
        noise.start(time);
    }

    computeNextState(x, y) {
        const rows = this.grid.length;
        const cols = this.grid[0].length;
        const drumRowsCount = Math.max(1, Math.ceil(rows * 0.05));
        const drumStartRow = rows - drumRowsCount;
        const melodyInjectionRow = drumStartRow - 1;

        if (y >= drumStartRow) return Math.random() < 0.35 ? 0 : this.grid[y][x];
        if (y === melodyInjectionRow) return Math.random() < 0.4 ? 0 : this.grid[y][x];

        let state = this.grid[y + 1][x];
        if (state === 1) {
            if (Math.random() < 0.05) return 0;
        } else {
            const leftActive = x > 0 ? this.grid[y + 1][x - 1] : 0;
            const rightActive = x < cols - 1 ? this.grid[y + 1][x + 1] : 0;
            if ((leftActive === 1 || rightActive === 1) && Math.random() < 0.07) return 1;
        }
        return state;
    }

    triggerVisual(type, metadata = 0) {
        if (!this.isRunning || !this.grid || !this.grid.length) return;
        const rows = this.grid.length;
        const cols = this.grid[0].length;
        const drumStartRow = rows - Math.max(1, Math.ceil(rows * 0.05));
        const melodyY = drumStartRow - 1;

        if (type === 'kick') {
            const width = Math.floor(cols * 0.2);
            for (let r = drumStartRow; r < rows; r++) {
                for (let c = 0; c < width; c++) this.grid[r][c] = 1;
            }
        } else if (type === 'snare') {
            for (let r = drumStartRow; r < rows; r++) {
                for (let c = 0; c < cols; c++) if (Math.random() < 0.3) this.grid[r][c] = 1;
            }
        } else if (type === 'hat') {
            const startCol = Math.floor(cols * 0.8);
            for (let r = drumStartRow; r < rows; r++) {
                for (let c = startCol; c < cols; c++) if (Math.random() < 0.5) this.grid[r][c] = 1;
            }
        } else if (type === 'bass') {
            const width = Math.min(4, Math.floor(cols * 0.1));
            for (let i = 0; i < width; i++) this.grid[melodyY][i] = 1;
        } else if (type === 'arp') {
            const step = (metadata % 3) + 2;
            for (let i = Math.floor(cols * 0.2); i < cols * 0.8; i += step * 3) {
                if (i < cols) this.grid[melodyY][i] = 1;
            }
        } else if (type === 'lead') {
            const normalizedPitch = Math.max(-7, Math.min(14, metadata)); 
            const xPos = Math.floor(((normalizedPitch + 7) / 21) * (cols - 1));
            if (xPos >= 0 && xPos < cols) {
                this.grid[melodyY][xPos] = 1;
                if (xPos + 1 < cols) this.grid[melodyY][xPos + 1] = 1;
                if (xPos - 1 >= 0) this.grid[melodyY][xPos - 1] = 1;
            }
        }
    }
    
    scheduleVisual(type, scheduledTime, metadata = 0) {
        const delay = Math.max(0, (scheduledTime - this.audioCtx.currentTime) * 1000);
        setTimeout(() => { if (this.isRunning) this.triggerVisual(type, metadata); }, delay);
    }

    nextNote() {
        const secondsPerBeat = 60.0 / this.station.bpm;
        let stepDuration = 0.25 * secondsPerBeat;
        if (this.step % 2 === 0) stepDuration += this.station.swing;
        else stepDuration -= this.station.swing;
        this.currentNoteTime += stepDuration;
        this.step++;
    }

    playStep(currentStep, time) {
        const stepRng = this.seededRandom(this.station.id + currentStep);
        const secondsPerBeat = 60.0 / this.station.bpm;
        const base16thTime = 0.25 * secondsPerBeat;
        const isSectionA = (currentStep % 128) < 64;
        const currentSection = isSectionA ? this.station.sectionA : this.station.sectionB;
        const chordDegree = currentSection.progression[Math.floor((currentStep % 64) / 16)];
        const stepInBar = currentStep % 16;
        const scale = this.station.scale;
        const sLen = scale.length;

        const bassData = currentSection.bassMotif[stepInBar];
        if (bassData !== null) {
            const deg = chordDegree + bassData.degree;
            const noteInterval = scale[((deg % sLen) + sLen) % sLen];
            const bassMidi = this.station.root + noteInterval + (Math.floor(deg / sLen) * 12) - 12;
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
            const deg = leadData.degree;
            const noteInterval = scale[((deg % sLen) + sLen) % sLen];
            const leadMidi = this.station.root + noteInterval + (Math.floor(deg / sLen) * 12) + 12;
            this.playTone(leadMidi, time, base16thTime * leadData.length, this.station.timbre.leadWave, this.station.timbre.leadEnv, 0.12);
            this.scheduleVisual('lead', time, deg);
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
        if (this.step > 0 && this.step % 16 === 0) {
            const msPerStep = (60000 / this.BASE_BPM) / 4; 
            const currentSongID = Math.floor((Date.now() - this.EPOCH) / (msPerStep * this.SONG_DURATION_STEPS));
            if (this.station && currentSongID !== this.station.id) this.tuneToNewStation();
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
        const config = { cellSize: 6, updateInterval: 50, aliveColor: '#00ffcc' };
        this.instance = new ProceduralRadioProgram(screenEl, config);
        this.instance.init();
    },
    unload: function() {
        if (this.instance) { this.instance.unload(); this.instance = null; }
    },
    onResize: function() {
        if (this.instance) this.instance.onResize();
    }
};

export default Radio;