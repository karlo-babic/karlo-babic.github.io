const NUM_SNAKE_PARTS = 16;

class Snake {
    running = false;
    snakeParts = [];
    STEP_SIZE = 1;
    speed = 1;
    velocity = {x: 0, y: -1};
    rotation = 1;
    iter = 0;

    constructor(position) {
        let sinI = -1;
        for (let i=0; i<NUM_SNAKE_PARTS; i++) {
            sinI += 0.5
            this.snakeParts.push({position: {x: position.x + Math.sin(sinI)*4 - 15, y: position.y - i}});
        }
    }

    update() {
		if (Keyboard.keys && (Keyboard.keys["ArrowLeft"] || Keyboard.keys["ArrowRight"] || Keyboard.keys["ArrowUp"])) {
			if (Keyboard.keys["ArrowLeft"]) this.rotation -= 0.15;
			if (Keyboard.keys["ArrowRight"]) this.rotation += 0.15;
			if (Keyboard.keys["ArrowUp"]) this.speed = 2;
            else this.speed = 1;
        }

        this.velocity.x += Math.cos(this.rotation - Math.PI / 2);
        this.velocity.y += Math.sin(this.rotation - Math.PI / 2);
        const magnitude = Math.sqrt(Math.pow(this.velocity.x, 2) + Math.pow(this.velocity.y, 2));
        this.velocity.x /= magnitude;
        this.velocity.y /= magnitude;
        this.velocity.x *= this.speed;
        this.velocity.y *= this.speed;

        for (let i=0; i<NUM_SNAKE_PARTS; i++) {
            if (i == NUM_SNAKE_PARTS-1) {
                this.snakeParts[i].position.x += this.velocity.x * this.STEP_SIZE;
                this.snakeParts[i].position.y += this.velocity.y * this.STEP_SIZE;
            }
            else {
                this.snakeParts[i].position.x = this.snakeParts[i+1].position.x;
                this.snakeParts[i].position.y = this.snakeParts[i+1].position.y;
            }
        }
        this.display();
        this.iter += 1;
    }
    
    display() {
        for (let i=0; i<NUM_SNAKE_PARTS; i++) {
            snakePartsElements[i].style.left = this.snakeParts[i].position.x + 'px';
            snakePartsElements[i].style.top  = this.snakeParts[i].position.y + 'px';
        }
	}
}

let snakeElement = document.getElementById("snake");
let snakePos = {
	x: snakeElement.getBoundingClientRect().left + 20,
	y: snakeElement.getBoundingClientRect().top + window.scrollY + 3
};
let snakePartsElements = [];
let snake = null;

function snakeInit() {
    if (snake && snake.running) return;
    
    snakeElement.innerHTML = '';
    for (let i=0; i<NUM_SNAKE_PARTS; i++) {
        snakeElement.innerHTML += '<div id="snakePart' + i + '" style="position:absolute;"><img src="imgs/dot.png" width="2"></div>';
    }
    snakePartsElements = []; // Clear previous elements
    for (let i=0; i<NUM_SNAKE_PARTS; i++) {
        snakePartsElements.push(document.getElementById("snakePart" + i));
    }
    
    // Create a new snake instance if it's the first time
    if (!snake) {
        snake = new Snake(snakePos);
    }
    snake.running = true;
}