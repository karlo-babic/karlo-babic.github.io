import { BaseGridSimulation } from './engines/base_grid_simulation.js';

/**
 * Procedural Chiptune Engine and Visualizer
 * A generative music engine that writes infinite, varied 8-bit soundtracks.
 * Features structural song generation, varied musical archetypes, and
 * visual-audio synesthesia via cellular automata.
 */
class ProceduralRadioProgram extends BaseGridSimulation {
    constructor(screenEl, config) {
        super(screenEl, config);
        
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.audioCtx = new AudioContext();
        this.isRunning = false;

        this.EPOCH = 1704067200000;
        this.SONG_DURATION_STEPS = 512; // 4 blocks of 128 steps (~1 minute at 120bpm)
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
            Harmonic:   [0, 2, 3, 5, 7, 8, 11]
        };

        this.palettes = ['#00ffcc', '#ff007f', '#ffff00', '#ff5500', '#aa00ff', '#00ff00', '#00aaff', '#ffcccc'];

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
        this.reverbNode = null;
        this.reverbGain = null;
        this.noiseBuffer = null;

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

    createReverb() {
        const length = this.audioCtx.sampleRate * 2.5; 
        const buffer = this.audioCtx.createBuffer(2, length, this.audioCtx.sampleRate);
        for (let c = 0; c < 2; c++) {
            const data = buffer.getChannelData(c);
            for (let i = 0; i < length; i++) {
                data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 4);
            }
        }
        const convolver = this.audioCtx.createConvolver();
        convolver.buffer = buffer;
        return convolver;
    }

    createNoiseBuffer() {
        const size = this.audioCtx.sampleRate * 2;
        this.noiseBuffer = this.audioCtx.createBuffer(1, size, this.audioCtx.sampleRate);
        const data = this.noiseBuffer.getChannelData(0);
        for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;
    }

    init() {
        super.init();
        this.isRunning = true;

        this.createNoiseBuffer();

        this.masterBus = this.audioCtx.createGain();
        this.masterBus.gain.value = 0.8;

        this.reverbNode = this.createReverb();
        this.reverbGain = this.audioCtx.createGain();
        this.reverbGain.gain.value = 0.15;

        this.masterFilter = this.audioCtx.createBiquadFilter();
        this.masterFilter.type = 'lowpass';
        this.masterFilter.Q.value = 1.5;

        this.crusherNode = this.audioCtx.createWaveShaper();
        this.crusherNode.oversample = 'none';

        this.masterBus.connect(this.masterFilter);
        
        this.masterBus.connect(this.reverbNode);
        this.reverbNode.connect(this.reverbGain);
        this.reverbGain.connect(this.masterFilter);

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

        const archetypes = ['Standard', 'Ambient', 'Heavy', 'Groove', 'Melodic'];
        const archetype = archetypes[nextInt(archetypes.length)];

        // Core BPM scaling based on archetype to ensure wide variety
        let baseBpm = nextInt(60) + 90; // 90 to 150
        if (archetype === 'Ambient') baseBpm = nextInt(30) + 65;
        if (archetype === 'Heavy') baseBpm = nextInt(40) + 110;
        if (archetype === 'Groove') baseBpm = nextInt(30) + 95;

        let leadWave = ['square', 'sawtooth', 'pulse'][nextInt(3)];
        let bassWave = ['triangle', 'square', 'sawtooth'][nextInt(3)];
        if (archetype === 'Ambient') leadWave = 'sine';

        // Structured Arrangement: 8 blocks of 128 steps
        // Structure: Intro, Verse1, Chorus1, Verse2, Break, Build, Chorus2, Outro
        const arrangement = [
            { pad: true,  bass: false, drums: false, arp: true,  lead: false }, // 0: Intro
            { pad: false, bass: true,  drums: true,  arp: true,  lead: false }, // 1: Verse 1
            { pad: true,  bass: true,  drums: true,  arp: false, lead: true  }, // 2: Chorus 1
            { pad: false, bass: true,  drums: true,  arp: true,  lead: false }, // 3: Verse 2
            { pad: true,  bass: true,  drums: false, arp: false, lead: false }, // 4: Break
            { pad: true,  bass: true,  drums: true,  arp: true,  lead: false }, // 5: Build
            { pad: true,  bass: true,  drums: true,  arp: false, lead: true  }, // 6: Chorus 2
            { pad: true,  bass: false, drums: false, arp: false, lead: false }  // 7: Outro
        ];

        // Specific modifications based on archetype
        if (archetype === 'Ambient') {
            arrangement.forEach(block => {
                block.pad = true;
                block.drums = songRng() > 0.6;
                block.lead = songRng() > 0.5;
            });
        }

        const drumSteps = 16; 
        
        this.station = {
            id: currentSongID,
            archetype: archetype,
            mode: selectedMode,
            scale: this.modes[selectedMode],
            root: nextInt(12) + 36, // C2 to B2
            bpm: baseBpm,
            swing: (archetype === 'Groove' || songRng() < 0.3) ? (songRng() * 0.08) : 0,
            arrangement: arrangement,
            groove: this.generateGroove(archetype, drumSteps, nextInt, songRng),
            timbre: {
                leadWave: leadWave,
                leadEnv: songRng() > 0.5 ? 'pluck' : 'sustain',
                bassWave: bassWave,
                vibratoDepth: songRng() > 0.6 ? nextInt(12) + 4 : 0,
                vibratoSpeed: nextInt(4) + 4,
                drift: songRng() > 0.8 ? (songRng() * 0.4) : 0,
                bitDepth: nextInt(6) + 3,
                pwmSpeed: songRng() * 3 + 0.5,
                arpStyle: ['up', 'down', 'converge', 'random'][nextInt(4)],
                arpInterval: [0.03, 0.04, 0.06, 0.08][nextInt(4)],
                arpOctave: songRng() > 0.5 ? 12 : 24,
                arpExtension: songRng() > 0.5 ? '7th' : (songRng() > 0.7 ? 'sus4' : 'triad'),
                mix: { 
                    lead: 0.15, 
                    bass: archetype === 'Heavy' ? 0.22 : 0.18, 
                    arp: 0.07, 
                    drums: 0.45,
                    pad: archetype === 'Ambient' ? 0.25 : 0.12
                }
            },
            sectionA: { // Verse
                progression: this.generateProgression(songRng),
                leadMotif: this.generateMotif(0.3, 2, songRng), // Sparse lead
                bassMotif: this.generateBassMotif(archetype, songRng)
            },
            sectionB: { // Chorus
                progression: this.generateProgression(songRng),
                leadMotif: this.generateMotif(0.6, 3, songRng), // Active lead
                bassMotif: this.generateBassMotif(archetype, songRng)
            }
        };

        this.currentSpread = 0.01 + (0.08 - this.station.timbre.arpInterval) * 4;
        
        if (this.reverbGain) {
            let revAmt = 0.15;
            if (archetype === 'Ambient') revAmt = 0.5;
            else if (archetype === 'Heavy') revAmt = 0.05;
            this.reverbGain.gain.value = revAmt;
        }

        if (this.crusherNode) this.crusherNode.curve = this.getCrushCurve(this.station.timbre.bitDepth);
        
        if (targetId === null) {
            const msPerStep = (60000 / this.BASE_BPM) / 4; 
            this.step = Math.floor((Date.now() - this.EPOCH) / msPerStep) % this.SONG_DURATION_STEPS;
        } else {
            this.step = 0;
        }
    }

    generateGroove(archetype, steps, nextInt, rng) {
        const kick = new Array(steps).fill(0);
        const snare = new Array(steps).fill(0);
        
        if (archetype === 'Standard' || archetype === 'Heavy' || archetype === 'Melodic') {
            // Four on the floor or basic rock beat
            kick[0] = 1; kick[4] = rng() > 0.8 ? 1 : 0; 
            kick[8] = 1; kick[12] = rng() > 0.8 ? 1 : 0;
            snare[4] = 1; snare[12] = 1;
        } else if (archetype === 'Groove') {
            // Breakbeat/Syncopated
            kick[0] = 1; 
            if (rng() > 0.5) kick[3] = 1; 
            kick[8] = rng() > 0.3 ? 1 : 0; 
            kick[10] = 1;
            snare[4] = 1; snare[12] = 1;
            if (rng() > 0.7) snare[15] = 1; // ghost note
        } else if (archetype === 'Ambient') {
            // Sparse, floating rhythm
            kick[0] = 1;
            kick[nextInt(steps - 1) + 1] = 1;
            snare[8] = rng() > 0.5 ? 1 : 0;
        }

        return {
            steps: steps,
            kick: kick,
            snare: snare,
            hatDense: nextInt(5) / 10 + 0.3
        };
    }

    generateProgression(rng) {
        // Generates a 4-chord loop that makes musical sense
        const progressions = [
            [0, 4, 5, 3], // I - V - vi - IV
            [0, 5, 3, 4], // I - vi - IV - V
            [5, 3, 0, 4], // vi - IV - I - V
            [1, 4, 0, 5], // ii - V - I - vi
            [0, 3, 0, 4], // I - IV - I - V
            [0, 0, 3, 4]  // I - I - IV - V
        ];
        return progressions[Math.floor(rng() * progressions.length)];
    }

    generateMotif(density, maxJump, rng) {
        const pattern = new Array(16).fill(null);
        let currentDegree = 0;
        let hasNotes = false;
        
        // Generate a 16-step phrase. To keep it musical, we restrict the rhythmic mask.
        for (let i = 0; i < 16; i++) {
            // Emphasize downbeats
            const prob = (i % 4 === 0) ? density * 1.5 : density;
            
            if (rng() < prob) {
                const jump = Math.floor(rng() * (maxJump * 2 + 1)) - maxJump;
                currentDegree += jump;
                // Keep melody contained within a sensible octave-ish range
                if (currentDegree > 7) currentDegree -= 4;
                if (currentDegree < -4) currentDegree += 4;
                
                const length = (rng() > 0.7 && i < 15) ? 2 : 1;
                pattern[i] = { degree: currentDegree, length: length };
                hasNotes = true;
                if (length > 1) i++; // Skip next step if sustained
            }
        }
        
        if (!hasNotes) pattern[0] = { degree: 0, length: 2 };

        return pattern;
    }

    generateBassMotif(archetype, rng) {
        const pattern = new Array(16).fill(null);
        
        if (archetype === 'Heavy' || archetype === 'Groove') {
            // Busy, rhythmic bass
            for (let i = 0; i < 16; i++) {
                if (i % 2 === 0 || rng() > 0.6) {
                    pattern[i] = { degree: 0, length: 1 };
                }
            }
        } else if (archetype === 'Ambient') {
            // Long sustained root notes
            pattern[0] = { degree: 0, length: 16 };
        } else {
            // Standard: Root on downbeats, maybe an octave or 5th jump
            pattern[0] = { degree: 0, length: 2 };
            pattern[4] = { degree: 0, length: 2 };
            pattern[8] = { degree: 0, length: 2 };
            if (rng() > 0.5) pattern[12] = { degree: 4, length: 2 }; // Jump to 5th
            else pattern[12] = { degree: 0, length: 2 };
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
            const delay = this.audioCtx.createDelay(0.1);
            const pwmOsc = this.audioCtx.createOscillator();
            const pwmGain = this.audioCtx.createGain();
            
            osc1.type = 'sawtooth'; 
            osc2.type = 'sawtooth'; 
            inverter.gain.value = -1;
            
            osc1.frequency.setValueAtTime(freq, time); 
            osc2.frequency.setValueAtTime(freq, time);
            
            pwmOsc.type = 'sine'; 
            pwmOsc.frequency.value = t.pwmSpeed; 
            
            delay.delayTime.value = 0.002;
            pwmGain.gain.value = 0.001;
            
            pwmOsc.connect(pwmGain); 
            pwmGain.connect(delay.delayTime); 
            
            osc2.connect(delay); 
            delay.connect(inverter);
            
            osc1.connect(gain); 
            inverter.connect(gain);
            
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
            gain.gain.exponentialRampToValueAtTime(0.001, time + Math.max(0.1, duration * 0.8));
        } else {
            gain.gain.setValueAtTime(0.001, time);
            gain.gain.linearRampToValueAtTime(volume, time + 0.02);
            gain.gain.setValueAtTime(volume, time + Math.max(0.02, duration - 0.05));
            gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
        }

        gain.connect(this.masterBus);
        nodes.forEach(n => { n.start(time); n.stop(time + duration + 0.1); });
    }

    playPadChord(midiNotes, time, duration, volume) {
        const gain = this.audioCtx.createGain();
        gain.gain.setValueAtTime(0.001, time);
        gain.gain.linearRampToValueAtTime(volume, time + Math.min(0.5, duration * 0.3));
        gain.gain.setTargetAtTime(0.001, time + duration * 0.8, duration * 0.2);
        
        gain.connect(this.masterBus);
        
        midiNotes.forEach((note, index) => {
            const osc = this.audioCtx.createOscillator();
            const osc2 = this.audioCtx.createOscillator();
            const freq = this.midiToFreq(note + (index === 0 ? -12 : 0)); 
            
            osc.type = 'sine';
            osc.frequency.value = freq;
            
            osc2.type = 'sine';
            osc2.frequency.value = freq;
            osc2.detune.value = 8; 
            
            osc.connect(gain);
            osc2.connect(gain);
            osc.start(time);
            osc2.start(time);
            osc.stop(time + duration + 0.5);
            osc2.stop(time + duration + 0.5);
        });
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
        gain.gain.setTargetAtTime(0.001, time + Math.max(0, duration - 0.05), 0.02);
        
        osc.connect(gain); 
        gain.connect(this.masterBus);
        osc.start(time); 
        osc.stop(time + duration + 0.1);
    }

    playDrum(type, time, volumeMultiplier = 1.0) {
        if (type === 'kick') {
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();
            osc.frequency.setValueAtTime(200, time);
            osc.frequency.exponentialRampToValueAtTime(40, time + 0.04);
            
            gain.gain.setValueAtTime(0.7 * volumeMultiplier, time);
            gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);
            
            osc.connect(gain); 
            gain.connect(this.masterBus);
            osc.start(time); 
            osc.stop(time + 0.15);
            
        } else if (type === 'snare') {
            this.playTone(60, time, 0.1, 'triangle', 'pluck', 0.4 * volumeMultiplier);
            this.playNoise(time, 0.15, 0.3 * volumeMultiplier);
            
        } else if (type === 'hat') {
            this.playNoise(time, 0.04, 0.06 * volumeMultiplier);
        }
    }

    playNoise(time, duration, volume) {
        if (!this.noiseBuffer) return;
        const noise = this.audioCtx.createBufferSource();
        noise.buffer = this.noiseBuffer;
        
        const gain = this.audioCtx.createGain();
        gain.gain.setValueAtTime(volume, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
        
        noise.connect(gain); 
        gain.connect(this.masterBus);
        
        noise.start(time, Math.random() * Math.max(0, 2 - duration));
        noise.stop(time + duration);
    }

    computeNextState(x, y) {
        const rows = this.grid.length;
        const cols = this.grid[0].length;
        const drumStartRow = rows - Math.max(1, Math.ceil(rows * 0.05));
        const melodyInjectionRow = drumStartRow - 1;

        if (y >= drumStartRow) return Math.random() < 0.35 ? 0 : this.grid[y][x];
        if (y === melodyInjectionRow) return Math.random() < 0.4 ? 0 : this.grid[y][x];

        let state = (y < rows - 1) ? this.grid[y + 1][x] : 0;
        
        if (state === 1) {
            if (Math.random()*(y/rows)*3 < 0.05) return 0;
        } else {
            const leftActive = (x > 0 && y < rows - 1) ? this.grid[y + 1][x - 1] : 0;
            const rightActive = (x < cols - 1 && y < rows - 1) ? this.grid[y + 1][x + 1] : 0;
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
            const startCol = Math.floor((cols - width) / 2);
            for (let r = drumStartRow; r < rows; r++) for (let c = startCol; c < startCol + width; c++) this.grid[r][c] = 1;
        } else if (type === 'snare') {
            for (let r = drumStartRow; r < rows; r++) for (let c = 0; c < cols; c++) if (Math.random() < 0.8) this.grid[r][c] = 1;
        } else if (type === 'hat') {
            const startCol = Math.floor(cols * 0.8);
            for (let r = drumStartRow; r < rows; r++) for (let c = startCol; c < cols; c++) if (Math.random() < 0.9) this.grid[r][c] = 1;
        } else if (type === 'bass') {
            const width = Math.min(6, Math.floor(cols * 0.15));
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
        } else if (type === 'pad') {
            const width = Math.floor(cols * 0.6);
            const startCol = Math.floor((cols - width) / 2);
            for (let c = startCol; c < startCol + width; c++) if (Math.random() < 0.6) this.grid[melodyY][c] = 1;
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
        
        // 128 steps per block, 8 blocks total
        const blockIndex = Math.floor(currentStep / 128) % 8;
        const activeInstruments = this.station.arrangement[blockIndex];
        
        // Determine section logically based on arrangement template
        // Intro/Verse/Break/Outro generally use Section A. Chorus/Build uses Section B.
        const isSectionA = (blockIndex === 0 || blockIndex === 1 || blockIndex === 3 || blockIndex === 4 || blockIndex === 7);
        const currentSection = isSectionA ? this.station.sectionA : this.station.sectionB;
        
        // Chords change every 32 steps (2 bars)
        const chordIndex = Math.floor((currentStep % 128) / 32) % 4;
        const chordDegree = currentSection.progression[chordIndex];
        
        const drumStep = currentStep % this.station.groove.steps;
        const scale = this.station.scale;
        const sLen = scale.length;
        const mix = this.station.timbre.mix;

        // Visual Synesthesia
        const hueShift = [0, 40, 80, 120, 160, 200, 240][chordDegree % 7] || 0;
        this.config.aliveColor = `hsl(${(this.baseHue + hueShift) % 360}, 100%, 60%)`;

        // Filter automation for builds and drops
        let targetFilterFreq = isSectionA ? 2500 : 6000;
        if (blockIndex === 5) targetFilterFreq = 1000 + ((currentStep % 128) / 128) * 8000; // Build block
        if (blockIndex === 7) targetFilterFreq = 4000 - ((currentStep % 128) / 128) * 3000; // Outro block
        this.masterFilter.frequency.setTargetAtTime(Math.max(200, targetFilterFreq), time, 0.1);

        // PAD
        if (activeInstruments.pad && (currentStep % 32) === 0) {
            const chordIntervals = this.getChordNotes(chordDegree, this.station.timbre.arpExtension);
            this.playPadChord(chordIntervals.map(i => this.station.root + i), time, base16thTime * 32, mix.pad);
            this.scheduleVisual('pad', time);
        }

        // BASS
        if (activeInstruments.bass) {
            const bassData = currentSection.bassMotif[currentStep % 16];
            if (bassData !== null) {
                // Bass note is relative to the current chord root
                const deg = chordDegree + bassData.degree;
                const noteInterval = scale[((deg % sLen) + sLen) % sLen];
                const bassMidi = this.station.root + noteInterval + (Math.floor(deg / sLen) * 12) - 12;
                this.playTone(bassMidi, time, base16thTime * bassData.length, this.station.timbre.bassWave, 'pluck', mix.bass);
                this.scheduleVisual('bass', time);
            }
        }

        // ARP
        if (activeInstruments.arp && (currentStep % 16) % 4 === 0) {
            const chordIntervals = this.getChordNotes(chordDegree, this.station.timbre.arpExtension);
            this.playTrackerArp(chordIntervals.map(i => this.station.root + i), time, base16thTime * 4, mix.arp, this.station.timbre);
            this.scheduleVisual('arp', time, currentStep);
        }

        // LEAD
        if (activeInstruments.lead) {
            const leadData = currentSection.leadMotif[currentStep % 16];
            if (leadData !== null) {
                // Transpose motif to current chord safely
                const deg = chordDegree + leadData.degree;
                const noteInterval = scale[((deg % sLen) + sLen) % sLen];
                const leadMidi = this.station.root + noteInterval + (Math.floor(deg / sLen) * 12) + 12;
                this.playTone(leadMidi, time, base16thTime * leadData.length, this.station.timbre.leadWave, this.station.timbre.leadEnv, mix.lead);
                this.scheduleVisual('lead', time, deg);
            }
        }

        // DRUMS
        if (activeInstruments.drums) {
            if (this.station.groove.kick[drumStep]) { this.playDrum('kick', time, mix.drums); this.scheduleVisual('kick', time); }
            if (this.station.groove.snare[drumStep]) { this.playDrum('snare', time, mix.drums); this.scheduleVisual('snare', time); }
            
            // Randomly dense hats based on groove setting
            if (stepRng() < this.station.groove.hatDense) { 
                this.playDrum('hat', time, mix.drums * 0.8); 
                this.scheduleVisual('hat', time); 
            }
            
            // Occasional crash on the downbeat of a new 32-step phrase
            if (currentStep % 32 === 0 && stepRng() > 0.4 && blockIndex !== 0) {
                this.playNoise(time, 0.8, 0.4 * mix.drums);
            }
        }
    }

    scheduleNotes() {
        if (!this.isRunning) return;
        
        // Loop back and switch stations when track completes
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
        const config = { cellSize: 4, updateInterval: 40, aliveColor: '#00ffcc' };
        this.instance = new ProceduralRadioProgram(screenEl, config);
        
        const subcommand = args.positional[0]?.toLowerCase();
        
        if (subcommand === 'id') {
            let currentId = this.instance.station?.id;
            if (currentId === undefined) {
                const msPerStep = (60000 / 120) / 4; 
                currentId = Math.floor((Date.now() - 1704067200000) / (msPerStep * 1024));
            }
            const output = `Station ID: ${currentId}`;
            this._copyToClipboard(currentId.toString());
            if (this.instance.ctx) {
                console.log(output);
            }
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