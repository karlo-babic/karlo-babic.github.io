import { BaseGridSimulation } from './engines/base_grid_simulation.js';

/**
 * Procedural Chiptune Engine and Visualizer
 * A generative music engine that writes infinite, varied 8-bit soundtracks.
 * Features Euclidean rhythms, station archetypes, and visual-audio synesthesia.
 * Supports command-line interaction for station ID retrieval and forced tuning.
 */
class ProceduralRadioProgram extends BaseGridSimulation {
    constructor(screenEl, config) {
        super(screenEl, config);
        
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.audioCtx = new AudioContext();
        this.isRunning = false;

        this.EPOCH = 1704067200000;
        this.SONG_DURATION_STEPS = 256;
        this.BASE_BPM = 120;

        this.modes = {
            Ionian:     [0, 2, 4, 5, 7, 9, 11],
            Dorian:     [0, 2, 3, 5, 7, 9, 10],
            Phrygian:   [0, 1, 3, 5, 7, 8, 10],
            Lydian:     [0, 2, 4, 6, 7, 9, 11],
            Mixolydian: [0, 2, 4, 5, 7, 9, 10],
            Aeolian:    [0, 2, 3, 5, 7, 8, 10],
            Pentatonic: [0, 2, 4, 7, 9],
            Hirajoshi:  [0, 2, 3, 7, 8],
            Blues:      [0, 3, 5, 6, 7, 10],
            WholeTone:  [0, 2, 4, 6, 8, 10]
        };

        this.palettes = ['#00ffcc', '#ff007f', '#ffff00', '#ff5500', '#aa00ff', '#00ff00', '#00aaff'];

        this.station = null;
        this.lookahead = 25.0;
        this.scheduleAheadTime = 0.15;
        this.currentNoteTime = 0;
        this.step = 0;
        this.schedulerTimerID = null;
        this.forceId = null;

        // Visual-Audio Synesthesia State
        this.currentSpread = 0.07;
        this.baseHue = 180;

        this.masterBus = null;
        this.masterFilter = null;
        this.crusherNode = null;

        this.scheduleNotes = this.scheduleNotes.bind(this);
    }

    seededRandom(seed) {
        return function() {
            seed |= 0; seed = seed + 0x6D2B79F5 | 0;
            let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
            t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        };
    }

    generateEuclidean(steps, pulses) {
        const pattern = new Array(steps).fill(0);
        if (pulses <= 0) return pattern;
        let bucket = 0;
        for (let i = 0; i < steps; i++) {
            bucket += pulses;
            if (bucket >= steps) {
                bucket -= steps;
                pattern[i] = 1;
            }
        }
        return pattern;
    }

    getCrushCurve(depth) {
        const samples = 4096;
        const curve = new Float32Array(samples);
        const step = Math.pow(2, depth);
        for (let i = 0; i < samples; i++) {
            const x = (i * 2) / samples - 1;
            curve[i] = Math.round(x * step) / step;
        }
        return curve;
    }

    init() {
        super.init();
        this.isRunning = true;

        this.masterBus = this.audioCtx.createGain();
        this.masterBus.gain.value = 0.8;

        this.masterFilter = this.audioCtx.createBiquadFilter();
        this.masterFilter.type = 'lowpass';
        this.masterFilter.Q.value = 3.0;

        this.crusherNode = this.audioCtx.createWaveShaper();
        this.crusherNode.oversample = 'none';

        this.masterBus.connect(this.masterFilter);
        this.masterFilter.connect(this.crusherNode);
        this.crusherNode.connect(this.audioCtx.destination);

        this._resumeHandler = () => {
            if (this.audioCtx && this.audioCtx.state === 'suspended') {
                this.audioCtx.resume().then(() => {
                    this.tuneToNewStation(this.forceId);
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

    tuneToNewStation(targetId = null) {
        let currentSongID;
        if (targetId !== null) {
            currentSongID = targetId;
        } else {
            const msPerStep = (60000 / this.BASE_BPM) / 4; 
            currentSongID = Math.floor((Date.now() - this.EPOCH) / (msPerStep * this.SONG_DURATION_STEPS));
        }
        
        const songRng = this.seededRandom(currentSongID);
        const nextInt = (max) => Math.floor(songRng() * max);

        const modeKeys = Object.keys(this.modes);
        const selectedMode = modeKeys[nextInt(modeKeys.length)];
        const color = this.palettes[nextInt(this.palettes.length)];

        this.config.aliveColor = color;
        // Extract base hue for synesthetic color shifting
        const tempCtx = document.createElement('canvas').getContext('2d');
        tempCtx.fillStyle = color;
        const hex = tempCtx.fillStyle;
        const r = parseInt(hex.slice(1, 3), 16) / 255;
        const g = parseInt(hex.slice(3, 5), 16) / 255;
        const b = parseInt(hex.slice(5, 7), 16) / 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h = (max + min) / 2;
        if (max !== min) {
            const d = max - min;
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }
        this.baseHue = h * 360;

        const archetypes = ['Standard', 'Ambient', 'Heavy', 'Melodic'];
        const archetype = archetypes[nextInt(archetypes.length)];

        let baseBpm = nextInt(40) + 100;
        let arpActive = songRng() > 0.2;
        let leadWave = songRng() > 0.3 ? 'pulse' : (songRng() > 0.5 ? 'square' : 'sawtooth');
        let bassWave = songRng() > 0.5 ? 'triangle' : 'square';

        if (archetype === 'Ambient') {
            baseBpm = nextInt(20) + 70;
            leadWave = 'sine';
            arpActive = false;
        }

        const drumSteps = [12, 14, 16][nextInt(3)];
        const arrangement = [];
        for (let i = 0; i < 8; i++) {
            arrangement.push({
                lead: archetype === 'Heavy' ? false : (i !== 0 && i !== 4), 
                bass: i !== 0,
                arp: arpActive && (i !== 3 || archetype === 'Melodic'),
                drums: archetype === 'Ambient' ? false : (i !== 0 && i !== 3) 
            });
        }

        this.station = {
            id: currentSongID,
            archetype: archetype,
            mode: selectedMode,
            scale: this.modes[selectedMode],
            root: nextInt(12) + 36,
            bpm: baseBpm,
            swing: songRng() < 0.3 ? (songRng() * 0.05) : 0,
            chaos: songRng(),
            arrangement: arrangement,
            groove: {
                steps: drumSteps,
                kick: this.generateEuclidean(drumSteps, nextInt(4) + 2),
                snare: this.generateEuclidean(drumSteps, nextInt(3) + 1),
                hatDense: nextInt(8) / 10 + 0.2
            },
            timbre: {
                leadWave: leadWave,
                leadEnv: songRng() > 0.5 ? 'pluck' : 'sustain',
                bassWave: bassWave,
                vibratoDepth: songRng() > 0.7 ? nextInt(15) + 5 : 0,
                vibratoSpeed: nextInt(4) + 4,
                drift: songRng() > 0.8 ? (songRng() * 0.5) : 0,
                bitDepth: nextInt(5) + 3,
                pwmSpeed: songRng() * 2 + 0.5,
                arpStyle: ['up', 'down', 'converge', 'random'][nextInt(4)],
                arpInterval: [0.03, 0.04, 0.06, 0.08][nextInt(4)],
                arpOctave: songRng() > 0.5 ? 12 : 24,
                arpExtension: songRng() > 0.6 ? '7th' : (songRng() > 0.8 ? 'sus4' : 'triad'),
                mix: { lead: 0.12, bass: archetype === 'Ambient' ? 0.1 : 0.2, arp: 0.03, drums: 0.5 }
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

        // Arp-Spread Synesthesia: Faster arps create more chaotic sideways pixel bleeding
        this.currentSpread = 0.01 + (0.08 - this.station.timbre.arpInterval) * 4;

        if (this.crusherNode) this.crusherNode.curve = this.getCrushCurve(this.station.timbre.bitDepth);
        if (targetId === null) {
            const msPerStep = (60000 / this.BASE_BPM) / 4; 
            this.step = Math.floor((Date.now() - this.EPOCH) / msPerStep) % this.SONG_DURATION_STEPS;
        } else {
            this.step = 0;
        }
    }

    generateProgression(rng) {
        const chords = [0];
        let currentChord = 0;
        const logicalMoves = [3, 4, 5, 1, 2];
        const chaosFactor = this.station?.chaos || 0.2;
        for (let i = 1; i < 4; i++) {
            if (rng() < chaosFactor) currentChord = Math.floor(rng() * 7);
            else currentChord = (currentChord + logicalMoves[Math.floor(rng() * logicalMoves.length)]) % 7;
            chords.push(currentChord);
        }
        return chords;
    }

    generateMotif(density, maxJump, isLead, rng) {
        const pattern = new Array(16).fill(null);
        let currentDegree = isLead ? Math.floor(rng() * 4) : 0;
        for (let i = 0; i < 8; i++) {
            if (rng() < (i % 4 === 0 ? density * 1.5 : density)) {
                const jump = Math.floor(rng() * (maxJump * 2 + 1)) - maxJump;
                currentDegree += jump;
                if (currentDegree > 12) currentDegree -= 5;
                if (currentDegree < -5) currentDegree += 5;
                const length = (rng() > 0.8 && i < 7) ? 2 : 1;
                pattern[i] = { degree: currentDegree, length: length };
                if (length > 1) i++;
            }
        }
        for (let i = 0; i < 8; i++) {
            const callNote = pattern[i];
            const stepIndex = i + 8;
            if (callNote) {
                if (rng() < 0.7) {
                    const varJump = rng() < 0.2 ? (Math.floor(rng() * 3) - 1) : 0;
                    pattern[stepIndex] = { degree: callNote.degree + varJump, length: callNote.length };
                }
            } else if (rng() < density * 0.3) {
                pattern[stepIndex] = { degree: currentDegree, length: 1 };
            }
        }
        return pattern;
    }

    getChordNotes(degree, extension = 'triad') {
        const scale = this.station.scale;
        const len = scale.length;
        const getDegree = (d) => scale[((d % len) + len) % len] + Math.floor(d / len) * 12;
        const notes = [getDegree(degree), getDegree(degree + 2), getDegree(degree + 4)];
        if (extension === '7th') notes.push(getDegree(degree + 6));
        else if (extension === 'sus4') notes[1] = getDegree(degree + 3);
        return notes;
    }

    midiToFreq(n) {
        return 440 * Math.pow(2, (n - 69) / 12);
    }

    playTone(midiNote, time, duration, type, envShape, volume) {
        const gain = this.audioCtx.createGain();
        const freq = this.midiToFreq(midiNote);
        const nodes = [];
        const t = this.station.timbre;

        if (type === 'pulse') {
            const osc1 = this.audioCtx.createOscillator();
            const osc2 = this.audioCtx.createOscillator();
            const inverter = this.audioCtx.createGain();
            const pwmOsc = this.audioCtx.createOscillator();
            const pwmGain = this.audioCtx.createGain();
            osc1.type = 'sawtooth'; osc2.type = 'sawtooth'; inverter.gain.value = -1;
            osc1.frequency.setValueAtTime(freq, time); osc2.frequency.setValueAtTime(freq, time);
            pwmOsc.type = 'sine'; pwmOsc.frequency.value = t.pwmSpeed; pwmGain.gain.value = 0.002; 
            pwmOsc.connect(pwmGain); pwmGain.connect(osc2.phase ? osc2.phase : gain.gain); 
            osc1.connect(gain); osc2.connect(inverter); inverter.connect(gain);
            nodes.push(osc1, osc2, pwmOsc);
        } else {
            const osc = this.audioCtx.createOscillator();
            osc.type = type;
            if (t.drift > 0) {
                osc.frequency.setValueAtTime(freq * (1 + t.drift), time);
                osc.frequency.exponentialRampToValueAtTime(freq, time + 0.05);
            } else {
                osc.frequency.setValueAtTime(freq, time);
            }
            if (t.vibratoDepth > 0) {
                const vLfo = this.audioCtx.createOscillator();
                const vGain = this.audioCtx.createGain();
                vLfo.frequency.value = t.vibratoSpeed; vGain.gain.value = t.vibratoDepth;
                vLfo.connect(vGain); vGain.connect(osc.frequency); nodes.push(vLfo);
            }
            osc.connect(gain);
            nodes.push(osc);
        }

        if (envShape === 'pluck') {
            gain.gain.setValueAtTime(volume, time);
            gain.gain.exponentialRampToValueAtTime(0.001, time + duration * 0.8);
        } else {
            gain.gain.setValueAtTime(0.001, time);
            gain.gain.linearRampToValueAtTime(volume, time + 0.02);
            gain.gain.setValueAtTime(volume, time + duration - 0.05);
            gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
        }

        gain.connect(this.masterBus);
        nodes.forEach(n => { n.start(time); n.stop(time + duration + 0.1); });
    }

    playTrackerArp(chordMidiNotes, time, duration, volume, settings) {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = settings.leadWave === 'pulse' ? 'square' : settings.leadWave;
        const arpSpeed = settings.arpInterval || 0.04;
        const steps = Math.floor(duration / arpSpeed);
        const style = settings.arpStyle || 'up';
        for (let i = 0; i < steps; i++) {
            let noteIndex;
            switch(style) {
                case 'down': noteIndex = (chordMidiNotes.length - 1) - (i % chordMidiNotes.length); break;
                case 'converge': noteIndex = [0, chordMidiNotes.length - 1, 1][i % 3]; break;
                case 'random': noteIndex = Math.floor(Math.abs(Math.sin(time + i)) * chordMidiNotes.length); break;
                default: noteIndex = i % chordMidiNotes.length;
            }
            osc.frequency.setValueAtTime(this.midiToFreq(chordMidiNotes[noteIndex] + settings.arpOctave), time + (i * arpSpeed));
        }
        gain.gain.setValueAtTime(volume, time);
        gain.gain.setTargetAtTime(0.001, time + duration - 0.02, 0.02);
        osc.connect(gain); gain.connect(this.masterBus);
        osc.start(time); osc.stop(time + duration);
    }

    playDrum(type, time, volumeMultiplier = 1.0) {
        if (type === 'kick') {
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();
            osc.frequency.setValueAtTime(150, time);
            osc.frequency.exponentialRampToValueAtTime(40, time + 0.1);
            gain.gain.setValueAtTime(0.5 * volumeMultiplier, time);
            gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);
            osc.connect(gain); gain.connect(this.masterBus);
            osc.start(time); osc.stop(time + 0.15);
        } else if (type === 'snare') {
            this.playTone(72, time, 0.1, 'triangle', 'pluck', 0.3 * volumeMultiplier);
            this.playNoise(time, 0.15, 0.25 * volumeMultiplier);
        } else if (type === 'hat') {
            this.playNoise(time, 0.05, 0.05 * volumeMultiplier);
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
        noise.connect(gain); gain.connect(this.masterBus);
        noise.start(time);
    }

    computeNextState(x, y) {
        const rows = this.grid.length;
        const cols = this.grid[0].length;
        const drumStartRow = rows - Math.max(1, Math.ceil(rows * 0.05));
        const melodyInjectionRow = drumStartRow - 1;

        if (y >= drumStartRow) return Math.random() < 0.35 ? 0 : this.grid[y][x];
        if (y === melodyInjectionRow) return Math.random() < 0.4 ? 0 : this.grid[y][x];

        let state = this.grid[y + 1][x];
        if (state === 1) {
            if (Math.random()*(y/rows)*3 < 0.05) return 0;
        } else {
            const leftActive = x > 0 ? this.grid[y + 1][x - 1] : 0;
            const rightActive = x < cols - 1 ? this.grid[y + 1][x + 1] : 0;
            // Spread-Synesthesia: Side-bleed probability linked to current Arp interval
            if ((leftActive === 1 || rightActive === 1) && Math.random()*(y/rows)*3 < this.currentSpread) return 1;
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
            for (let r = drumStartRow; r < rows; r++) for (let c = 0; c < width; c++) this.grid[r][c] = 1;
        } else if (type === 'snare') {
            for (let r = drumStartRow; r < rows; r++) for (let c = 0; c < cols; c++) if (Math.random() < 0.3) this.grid[r][c] = 1;
        } else if (type === 'hat') {
            const startCol = Math.floor(cols * 0.8);
            for (let r = drumStartRow; r < rows; r++) for (let c = startCol; c < cols; c++) if (Math.random() < 0.5) this.grid[r][c] = 1;
        } else if (type === 'bass') {
            const width = Math.min(4, Math.floor(cols * 0.1));
            for (let i = 0; i < width; i++) this.grid[melodyY][i] = 1;
        } else if (type === 'arp') {
            const step = (metadata % 3) + 2;
            for (let i = Math.floor(cols * 0.2); i < cols * 0.8; i += step * 3) if (i < cols) this.grid[melodyY][i] = 1;
        } else if (type === 'lead') {
            const xPos = Math.floor(((Math.max(-7, Math.min(14, metadata)) + 7) / 21) * (cols - 1));
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
        const base16thTime = (60.0 / this.station.bpm) * 0.25;
        const arrangementBlock = Math.floor(currentStep / 32) % 8;
        const activeInstruments = this.station.arrangement[arrangementBlock];
        const isSectionA = (currentStep % 128) < 64;
        const currentSection = isSectionA ? this.station.sectionA : this.station.sectionB;
        const chordDegree = currentSection.progression[Math.floor((currentStep % 64) / 16)];
        const drumStep = currentStep % this.station.groove.steps;
        const scale = this.station.scale;
        const sLen = scale.length;
        const mix = this.station.timbre.mix;

        // Brightness-Hue Synesthesia: Shift color based on chord function
        const hueShift = [0, 40, 80, 120, 160, 200, 240][chordDegree];
        this.config.aliveColor = `hsl(${(this.baseHue + hueShift) % 360}, 100%, 60%)`;

        let targetFilterFreq = isSectionA ? 2500 : 5000;
        if (arrangementBlock === 7) targetFilterFreq = 10000; 
        targetFilterFreq += Math.sin(((currentStep % 32) / 32) * Math.PI) * 1500;
        this.masterFilter.frequency.setTargetAtTime(Math.max(200, targetFilterFreq), time, 0.1);

        if (activeInstruments.bass) {
            const bassData = currentSection.bassMotif[currentStep % 16];
            if (bassData !== null) {
                const deg = chordDegree + bassData.degree;
                const noteInterval = scale[((deg % sLen) + sLen) % sLen];
                const bassMidi = this.station.root + noteInterval + (Math.floor(deg / sLen) * 12) - 12;
                this.playTone(bassMidi, time, base16thTime * bassData.length, this.station.timbre.bassWave, 'pluck', mix.bass);
                this.scheduleVisual('bass', time);
            }
        }

        if (activeInstruments.arp && (currentStep % 16) % 4 === 0) {
            const chordIntervals = this.getChordNotes(chordDegree, this.station.timbre.arpExtension);
            this.playTrackerArp(chordIntervals.map(i => this.station.root + i), time, base16thTime * 4, mix.arp, this.station.timbre);
            this.scheduleVisual('arp', time, currentStep);
        }

        if (activeInstruments.lead) {
            const leadData = currentSection.leadMotif[currentStep % 16];
            if (leadData !== null) {
                const deg = leadData.degree;
                const noteInterval = scale[((deg % sLen) + sLen) % sLen];
                const leadMidi = this.station.root + noteInterval + (Math.floor(deg / sLen) * 12) + 12;
                this.playTone(leadMidi, time, base16thTime * leadData.length, this.station.timbre.leadWave, this.station.timbre.leadEnv, mix.lead);
                this.scheduleVisual('lead', time, deg);
            }
        }

        if (activeInstruments.drums) {
            if (this.station.groove.kick[drumStep]) { this.playDrum('kick', time, mix.drums); this.scheduleVisual('kick', time); }
            if (this.station.groove.snare[drumStep]) { this.playDrum('snare', time, mix.drums); this.scheduleVisual('snare', time); }
            if (stepRng() < this.station.groove.hatDense) { this.playDrum('hat', time, mix.drums); this.scheduleVisual('hat', time); }
        }
    }

    scheduleNotes() {
        if (!this.isRunning) return;
        if (this.forceId === null && this.step > 0 && this.step % 16 === 0) {
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

    init: function(screenEl, args = { positional: [], named: {} }) {
        const config = { cellSize: 6, updateInterval: 50, aliveColor: '#00ffcc' };
        this.instance = new ProceduralRadioProgram(screenEl, config);
        
        const subcommand = args.positional[0]?.toLowerCase();
        
        if (subcommand === 'id') {
            // Calculate current ID if engine not running yet, otherwise get instance ID
            let currentId = this.instance.station?.id;
            if (currentId === undefined) {
                const msPerStep = (60000 / 120) / 4; 
                currentId = Math.floor((Date.now() - 1704067200000) / (msPerStep * 256));
            }
            const output = `Station ID: ${currentId}`;
            this._copyToClipboard(currentId.toString());
            // Since this is usually a visual engine, we use console/render as a fallback
            if (this.instance.ctx) {
                console.log(output);
            }
            return;
        }

        if (!isNaN(parseInt(subcommand))) {
            this.instance.forceId = parseInt(subcommand);
        }

        this.instance.init();
    },

    _copyToClipboard: function(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).catch(err => console.error(err));
        }
    },

    unload: function() { if (this.instance) { this.instance.unload(); this.instance = null; } },
    onResize: function() { if (this.instance) this.instance.onResize(); }
};

export default Radio;