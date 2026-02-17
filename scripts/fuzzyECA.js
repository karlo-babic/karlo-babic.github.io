// --- Simulation Constants ---
const CELL_SIZE = 8;
const NOISE_STRENGTH = 0.2;

// --- Rendering Constants ---
const BASE_COLOR = { r: 45, g: 45, b: 49 };
const MATRIX_COLOR_WEIGHT = { r: 3, g: 5, b: 6 };
const Y_POS_COLOR_WEIGHT = { r: 1/8, g: 1/32, b: 1/64 };

// --- Mutation Constants ---
const MUTATION_PERTURBATION = 0.001;
const MUTATION_DIRECTION_LIMIT = 0.2;
const FUZZY_RULE_MAX = 0.9;
const FUZZY_RULE_MIN = 0.01;


// --- Canvas and Matrix Setup ---
const width = window.innerWidth;
const height = window.innerHeight;
const lineWidth = Math.round(width / CELL_SIZE);
const numLines = Math.round(height / CELL_SIZE);

let y = 0; // Current line being processed
let patterns = [[1, 1, 1], [1, 1, 0], [1, 0, 1], [1, 0, 0], [0, 1, 1], [0, 1, 0], [0, 0, 1], [0, 0, 0]];
var fuzzyRule = [0, 1, 0, 1, 1, 0, 1, 0]; // Rule 30
var randomDirection = [0, 0, 0, 0, 0, 0, 0, 0];
var matrix = [];


const canvasArea = {
	canvas: document.createElement("canvas"),
	start: function () {
		this.canvas.width = width;
		this.canvas.height = height;

        Object.assign(this.canvas.style, {
            position: 'fixed',
            top: '0',
            left: '0',
            zIndex: '-2',
            display: 'block'
        });

		this.context = this.canvas.getContext("2d");
		document.body.insertBefore(this.canvas, document.body.childNodes[0]);
        _initializeMatrix();
	},
};

function _initializeMatrix() {
    for (var i = 0; i < numLines; i++) {
        matrix.push([]);
        for (var j = 0; j < lineWidth; j++)
            matrix[i].push(0.1);
    }
    matrix[0][Math.round(Math.random() * lineWidth) - 1] = 1;
}

// --- Core ECA Logic ---

function applyFuzzy(window) {
	let mostSimilar = -1;
	let largestSimilarity = 0;
	for (let p = 0; p < patterns.length; p++) {
		let similarity = euclideanSimilarity(window, patterns[p]);
		if (similarity > largestSimilarity) {
			mostSimilar = p;
			largestSimilarity = similarity;
		}
	}
	return dotProduct(window, patterns[mostSimilar]) * fuzzyRule[mostSimilar];
}

// --- Helper Functions ---

function dotProduct(arr1, arr2) {
	return arr1.reduce((acc, val, index) => acc + val * arr2[index], 0);
}

function euclideanSimilarity(arr1, arr2) {
	let distance = Math.sqrt(arr1.reduce((acc, val, index) => acc + Math.pow(val - arr2[index], 2), 0));
	return 1 / (1 + distance);
}

function normalizeArray(arr, targetMean, targetMax) {
	const mean = arr.reduce((sum, value) => sum + value, 0) / arr.length;
	const centeredArray = arr.map(value => value - mean);
	const max = Math.max(...centeredArray.map(Math.abs));
    if (max === 0) return centeredArray.map(() => targetMean);
	const scaleFactor = targetMax / max;
	return centeredArray.map(value => (value * scaleFactor) + targetMean);
}

// --- Update Sub-routines ---

function _renderLine(y) {
    for (let x = 0; x < lineWidth; x++) {
		const red = BASE_COLOR.r - matrix[y][x] * MATRIX_COLOR_WEIGHT.r - y * Y_POS_COLOR_WEIGHT.r;
		const green = BASE_COLOR.g - matrix[y][x] * MATRIX_COLOR_WEIGHT.g - y * Y_POS_COLOR_WEIGHT.g;
		const blue = BASE_COLOR.b - matrix[y][x] * MATRIX_COLOR_WEIGHT.b - y * Y_POS_COLOR_WEIGHT.b;
		canvasArea.context.fillStyle = `rgb(${red}, ${green}, ${blue})`;
		canvasArea.context.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
	}
}

function _addNoise(y) {
    for (let x = 0; x < lineWidth; x++) {
		matrix[y][x] += (Math.random() - 0.5) * NOISE_STRENGTH;
    }
}

function _generateNextLine(y) {
    const prev_line = matrix[y];
	const nextY = (y + 1) % numLines;
	for (let x = 0; x < lineWidth; x++) {
		let left = (x - 1 + lineWidth) % lineWidth;
		let right = (x + 1) % lineWidth;
		let window = [prev_line[left], prev_line[x], prev_line[right]];
		matrix[nextY][x] = applyFuzzy(window);
	}
    matrix[nextY] = normalizeArray(matrix[nextY], 0.4, 0.9);
}

function _mutateRule() {
    for (let i = 0; i < 8; i++) {
		let pertubation = (Math.random() - 0.5) * MUTATION_PERTURBATION;
		randomDirection[i] += pertubation;

        // Wrap the direction value if it exceeds limits
		if (randomDirection[i] > MUTATION_DIRECTION_LIMIT) randomDirection[i] = -MUTATION_DIRECTION_LIMIT + (randomDirection[i] - MUTATION_DIRECTION_LIMIT);
		if (randomDirection[i] < -MUTATION_DIRECTION_LIMIT) randomDirection[i] = MUTATION_DIRECTION_LIMIT + (randomDirection[i] + MUTATION_DIRECTION_LIMIT);
		
        fuzzyRule[i] += randomDirection[i];
        
        // Wrap the rule value if it exceeds limits
		if (fuzzyRule[i] > FUZZY_RULE_MAX) fuzzyRule[i] = FUZZY_RULE_MIN + (fuzzyRule[i] - FUZZY_RULE_MAX);
		if (fuzzyRule[i] < FUZZY_RULE_MIN) fuzzyRule[i] = FUZZY_RULE_MAX - (FUZZY_RULE_MIN - fuzzyRule[i]);
	}
}

// --- Main Update Function (called by main.js) ---

export function updateCanvasArea() {
	_renderLine(y);
    _addNoise(y);
	_generateNextLine(y);
	_mutateRule();
    
	y = (y + 1) % numLines;
}

// --- Public Access ---
export function startFuzzyEca() {
    canvasArea.start();
}