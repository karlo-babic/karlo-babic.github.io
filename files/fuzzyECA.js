const framerate = 5;
const width = window.innerWidth;
const height = window.innerHeight;
const cellSize = 8;
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
//for (var i=0; i<8; i++)
//	fuzzyRule.push(Math.random());
var fuzzyRule = [0,1,0,1,1,0,1,0];
//var fuzzyRule = [ 0.47398141095020885, 0.23030618538707937, 0.009286802871400712, 0.4728388328867922, 0.1826573775245438, 0.26016084029232256, 0.9399837710207025, 0.5030221980461372 ];
//var fuzzyRule = [ 0.16918267212197635, 0.5879058323486155, 0.9644257139923239, 0.6950276349724105, 0.9851676741380405, 0.9184982124543024, 0.37632280292114384, 0.007321717212266932 ];
//var fuzzyRule = [ 0.49086710480759765, 0.0017398902440128872, 0.7903580944178309, 0.04929205379877233, 0.11645377521018752, 0.27737944420579697, 0.10099048727879822, 0.19001239365478628 ];
//var fuzzyRule = [ 0.6238646061560877, 0.1110215404256164, 0.11573790740208045, 0.8185498443520172, 0.6396952778430475, 0.5285087828770861, 0.8501060379864118, 0.31528285304458714 ];
//var fuzzyRule = [ 0.9268537451978056, 0.14087292594974166, 0.449457402970732, 0.5587802510419991, 0.02490707907405343, 0.9620976401942491, 0.16376406616087913, 0.12791980271781078 ];
//var fuzzyRule = [ 0.09651885535100546, 0.8522847248380958, 0.6006917017077714, 0.21657162130155982, 0.8424535699575201, 0.9426730510043012, 0.33514098761826616, 0.5923123380124324 ];

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
//for (let i=0; i<lineWidth; i++)
//	matrix[0][i] = Math.random();
matrix[0][Math.round(Math.random()*lineWidth)-1] = 1;



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

// initial direction in which to mutate fuzzyRule
randomDirection = [0,0,0,0,0,0,0,0]


let y = 0
function updateCanvasArea()
{
	// render
	for (let x = 0; x < width / cellSize; x++) {
		const red = 45 - matrix[y][x] * 3 - y/8;
		const green = 45 - matrix[y][x] * 5 - y/32;
		const blue = 49 - matrix[y][x] * 6 - y/64;
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

	// randomly mutate fuzzyRule
	for (let i = 0; i < 8; i++) {
		let pertubation = (Math.random() - 0.5) * 0.001;
		randomDirection[i] += pertubation;
		if (randomDirection[i] > 0.2) randomDirection[i] = -0.2 + (randomDirection[i] - 0.2);
		if (randomDirection[i] < -0.2) randomDirection[i] = 0.2 + (randomDirection[i] + 0.2);
		//if (randomDirection[i] < -0.2 || randomDirection[i] > 0.2) randomDirection[i] -= 2 * pertubation;
		//randomDirection[i] = Math.min(Math.max(randomDirection[i], -0.2), 0.2);
		fuzzyRule[i] += randomDirection[i];
		if (fuzzyRule[i] > 0.9) fuzzyRule[i] = 0.01 + (fuzzyRule[i] - 0.9);
		if (fuzzyRule[i] < 0) fuzzyRule[i] = 0.9 - (fuzzyRule[i]);
		//fuzzyRule[i] = Math.min(Math.max(fuzzyRule[i], 0.01), 0.9);
	}

	y++;
	y = y % numLines;
}
