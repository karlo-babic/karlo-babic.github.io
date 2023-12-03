const framerate = 16;
const width = window.innerWidth;
const height = window.innerHeight;
const cellSize = 6;
const lineWidth = Math.round(width/cellSize);
const numLines = Math.round(height/cellSize);

function startFuzzyEca()
{
    canvasArea.start();
}

var canvasArea =
    {
		canvas : document.createElement("canvas"),
		start : function()
		{
			this.canvas.width = width;
			this.canvas.height = height;
			this.context = this.canvas.getContext("2d");
			document.body.insertBefore(this.canvas, document.body.childNodes[0]);
			this.interval = setInterval(updateCanvasArea, 1000/framerate);
		},
		clear : function()
		{
			this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
		},
		stop : function()
		{
			clearInterval(this.interval);
		}
    }



let patterns = [ [1,1,1], [1,1,0], [1,0,1], [1,0,0], [0,1,1], [0,1,0], [0,0,1], [0,0,0] ];

var fuzzyRule = [];
for (var i=0; i<8; i++)
	fuzzyRule.push(Math.random());
//var fuzzyRule = [0,1,0,1,1,0,1,0];

const ruleDict = {};
for (let i = 0; i < 8; i++) {
	ruleDict[JSON.stringify(patterns[i])] = fuzzyRule[i];
}


var matrix = [];
for (var i=0; i<height/cellSize; i++)
{
    matrix.push([]);
    for (var j=0; j<width/cellSize; j++)
		matrix[i].push(0.1);
}
for (let i=0; i<lineWidth; i++)
	matrix[0][i] = Math.random();
//matrix[0][Math.round(width/cellSize/2)] = 1;



function dotProduct(arr1, arr2) {
	return arr1.reduce((acc, val, index) => acc + val * arr2[index], 0);
}

function euclideanNorm(arr) {
	return Math.sqrt(arr.reduce((acc, val) => acc + val * val, 0));
}

function cosineSimilarity(arr1, arr2) {
	const dotProd = dotProduct(arr1, arr2);
	const norm1 = euclideanNorm(arr1);
	const norm2 = euclideanNorm(arr2);

	return dotProd / (norm1 * norm2);
}

function euclideanSimilarity(arr1, arr2) {
	let distance = Math.sqrt(arr1.reduce((acc, val, index) => acc + Math.pow(val - arr2[index], 2), 0));
	return 1 / (1 + distance);
}

function normalizeArray(arr, targetMean, targetMax) {
	const mean = arr.reduce((sum, value) => sum + value, 0) / arr.length;
	const centeredArray = arr.map(value => value - mean);
  
	const max = Math.max(...centeredArray);
	const scaleFactor = targetMax / max;
  
	const normalizedArray = centeredArray.map(value => (value * scaleFactor) + targetMean);
  
	return normalizedArray;
  }

function applyFuzzy(window)
{
	let cellState = -1;
	let mostSimilar = -1;
	let largestSimilarity = 0;
	for (let p = 0; p < patterns.length; p++)
	{
		let similarity = euclideanSimilarity(window, patterns[p]);
		if (similarity > largestSimilarity)
		{
			mostSimilar = p;
			largestSimilarity = similarity;
		}
	}
	cellState = dotProduct(window, patterns[mostSimilar]) * fuzzyRule[mostSimilar];
	return cellState;
}


let y = 0
function updateCanvasArea()
{
	// render
	for (let x = 0; x < width / cellSize; x++) {
		const red = 50 - matrix[y][x] * 5 - y/8;
		const green = 50 - matrix[y][x] * 9 - y/32;
		const blue = 54 - matrix[y][x] * 11 - y/64;
		canvasArea.context.fillStyle = `rgb(${red}, ${green}, ${blue})`;
		canvasArea.context.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
	}

	// add noise
	for (let x=0; x<lineWidth; x++)
		matrix[y][x] += (Math.random() - 0.5) * 0.2;

	// generate new line
	const prev_line = matrix[y];
	const nextY = (y + 1) % numLines;
	for (let x = 0; x < width / cellSize; x++) {
		// get window (3 neighbors)
		let left = (x - 1) % lineWidth;
		if (left < 0) left = left + lineWidth;
		let right = (x + 1) % lineWidth;
		let window = [prev_line[left], prev_line[x], prev_line[right]];
		matrix[nextY][x] = applyFuzzy(window);
	}
	// normalize so the mean is 0.5
	matrix[nextY] = normalizeArray(matrix[nextY], 0.4, 0.9);

	y++;
	y = y % numLines;
}