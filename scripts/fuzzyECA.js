/**
 * RGB Fuzzy Elementary Cellular Automata (ECA)
 * 
 * A continuous-state cellular automaton designed for a "dark outer space" 
 * programmer aesthetic. Features vector-based color inheritance, 
 * high-speed rule mutation, and row-wise normalization to ensure 
 * signal persistence while maintaining low luminosity.
 */

const CELL_SIZE = 8;
const MUTATION_RATE = 0.001; 
const MAX_DRIFT = 2.0;

const TARGET_ROW_MEAN = Math.random() * 0.1 + 0.2;
const TARGET_ROW_MAX = Math.random() + 0.4;

const width = window.innerWidth;
const height = window.innerHeight;
const lineWidth = Math.round(width / CELL_SIZE);
const numLines = Math.round(height / CELL_SIZE);

const BASE_BG_COLOR = 'rgb(20, 20, 25)'; // Deep space base

let y = 0; 
const patterns = [
    [1, 1, 1], [1, 1, 0], [1, 0, 1], [1, 0, 0], 
    [0, 1, 1], [0, 1, 0], [0, 0, 1], [0, 0, 0]
];

/**
 * Weights and thresholds for pattern activation.
 * Drift variables provide the momentum for continuous mutation.
 */
let fuzzyRule = Array.from({ length: 8 }, () => Math.random());
let limit = Math.random() * 0.4 + 0.1;
let randomDirection = Array.from({ length: 8 }, () => (Math.random() - 0.5) * 0.1);
let limitDirection = (Math.random() - 0.5) * 0.01;

let matrix = [];

const canvasArea = {
    canvas: document.createElement("canvas"),
    start: function () {
        this.canvas.width = width;
        this.canvas.height = height;

        Object.assign(this.canvas.style, {
            position: 'fixed',
            top: '0',
            left: '0',
            zIndex: '-1',
            display: 'block',
            backgroundColor: BASE_BG_COLOR
        });

        this.context = this.canvas.getContext("2d");
        document.body.insertBefore(this.canvas, document.body.childNodes[0]);
        _initializeMatrix();
    },
};

/**
 * Ensures the simulation maintains a consistent intensity.
 * Prevents color channels from diverging into monochromatic noise.
 */
function _normalizeLine(line) {
    const brightnesses = line.map(c => (c.r + c.g + c.b) / 3);
    const mean = brightnesses.reduce((sum, v) => sum + v, 0) / line.length;

    if (mean < 0.005) {
        return line.map(() => {
            const gray = Math.random() * 0.5;
            return { r: gray, g: gray, b: gray };
        });
    }

    const max = Math.max(...brightnesses);
    const scaleFactor = TARGET_ROW_MAX / (max || 1);
    const shift = TARGET_ROW_MEAN - (mean * scaleFactor);

    return line.map(c => ({
        r: Math.max(0, Math.min(1, (c.r * scaleFactor) + shift)),
        g: Math.max(0, Math.min(1, (c.g * scaleFactor) + shift)),
        b: Math.max(0, Math.min(1, (c.b * scaleFactor) + shift))
    }));
}

/**
 * Seeds the simulation with low-saturation, randomized intensities.
 */
function _initializeMatrix() {
    matrix = [];
    for (let i = 0; i < numLines; i++) {
        matrix.push(new Array(lineWidth).fill(null).map(() => ({ r: 0, g: 0, b: 0 })));
    }
    
    for (let j = 0; j < lineWidth; j++) {
        if (Math.random() > 0.6) {
            const lum = Math.random() * 0.5;
            // First row is mostly grayscale with very subtle color tinting
            matrix[0][j] = { 
                r: lum + (Math.random() - 0.5) * 0.7, 
                g: lum + (Math.random() - 0.5) * 0.1, 
                b: lum + (Math.random() - 0.5) * 0.7
            };
        }
    }
    matrix[0] = _normalizeLine(matrix[0]);
}

/**
 * Calculates the next RGB state.
 * Neighborhood luminance determines the pattern match, 
 * while the RGB components are inherited from 'active' neighbors.
 */
function _calculateCellState(window) {
    const luma = window.map(c => (c.r + c.g + c.b) / 3);
    let bestR = 0, bestG = 0, bestB = 0;
    let maxResult = 0;

    for (let p = 0; p < 8; p++) {
        if (fuzzyRule[p] <= 0) continue;

        let diff = 0;
        for (let j = 0; j < 3; j++) {
            diff += Math.abs(patterns[p][j] - luma[j]);
        }
        let similarity = 3 - diff;

        let sR = 0, sG = 0, sB = 0, count = 0;
        for (let j = 0; j < 3; j++) {
            if (patterns[p][j] === 1) {
                sR += window[j].r;
                sG += window[j].g;
                sB += window[j].b;
                count++;
            }
        }

        let strength = count > 0 ? (sR + sG + sB) / (3 * count) : 0.05;
        let result = similarity * fuzzyRule[p] * strength;

        if (result > limit && result > maxResult) {
            maxResult = result;
            if (count > 0) {
                bestR = (sR / count) * fuzzyRule[p];
                bestG = (sG / count) * fuzzyRule[p];
                bestB = (sB / count) * fuzzyRule[p];
            } else {
                bestR = (1 - luma[1]) * fuzzyRule[p] * 0.5;
                bestG = (1 - luma[1]) * fuzzyRule[p] * 0.5;
                bestB = (1 - luma[1]) * fuzzyRule[p] * 0.5;
            }
        }
    }

    return { r: bestR, g: bestG, b: bestB };
}

/**
 * Renders the state with tightly capped luminosity for a dark neon feel.
 */
function _renderLine(y) {
    const row = matrix[y];
    for (let x = 0; x < lineWidth; x++) {
        const cell = row[x];
        const brightness = (cell.r + cell.g + cell.b) / 3;

        if (brightness > 0.02) {
            // Colors are kept dark to maintain background integrity
            const r = Math.min(255, cell.r * 40);
            const g = Math.min(255, cell.g * 50);
            const b = Math.min(255, cell.b * 70);
            const alpha = brightness * 0.45;

            canvasArea.context.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
            canvasArea.context.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
        }
    }
}

function _clearLine(y) {
    canvasArea.context.fillStyle = BASE_BG_COLOR;
    canvasArea.context.fillRect(0, y * CELL_SIZE, width, CELL_SIZE);
}

function _generateNextLine(y) {
    const nextY = (y + 1) % numLines;
    const currentLine = matrix[y];
    let nextRow = new Array(lineWidth);

    for (let x = 0; x < lineWidth; x++) {
        const left = (x - 1 + lineWidth) % lineWidth;
        const right = (x + 1) % lineWidth;
        const window = [currentLine[left], currentLine[x], currentLine[right]];
        
        nextRow[x] = _calculateCellState(window);
    }

    matrix[nextY] = _normalizeLine(nextRow);
}

function _mutateRule() {
    for (let i = 0; i < 8; i++) {
        randomDirection[i] += (Math.random() - 0.5) * MUTATION_RATE;
        randomDirection[i] = Math.max(-MAX_DRIFT, Math.min(MAX_DRIFT, randomDirection[i]));
        
        fuzzyRule[i] += randomDirection[i];
        if (fuzzyRule[i] > 1.6) fuzzyRule[i] = 0.4;
        if (fuzzyRule[i] < -0.4) fuzzyRule[i] = 0.9;
    }

    limitDirection += (Math.random() - 0.5) * (MUTATION_RATE * 0.4);
    limitDirection = Math.max(-MAX_DRIFT, Math.min(MAX_DRIFT, limitDirection));
    limit += limitDirection;

    if (limit > 0.85) limit = 0.2;
    if (limit < 0.05) limit = 0.1;
}

export function updateCanvasArea() {
    _renderLine(y);
    _generateNextLine(y);
    _mutateRule();

    y = (y + 1) % numLines;
    _clearLine((y + 1) % numLines);
}

export function startFuzzyEca() {
    canvasArea.start();
}