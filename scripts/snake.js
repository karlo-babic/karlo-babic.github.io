const NUM_SNAKE_PARTS = 16;


class Snake {
    snakeParts = [];
    STEP_SIZE = 1;
    velocity = {x: 0, y: -1};
    rotation = 0;
    iter = 0;

    constructor(position) {
        let sinI = -1;
        for (let i=0; i<NUM_SNAKE_PARTS; i++) {
            sinI += 0.5
            this.snakeParts.push({position: {x: position.x + Math.sin(sinI)*4 - 15, y: position.y - i}});
        }
    }

    movement() {
		/*const mouseRelativePosition = {
			x: Mouse.x - this.snakeParts[NUM_SNAKE_PARTS-1].position.x,
			y: Mouse.y - this.snakeParts[NUM_SNAKE_PARTS-1].position.y
		};
        const magnitude = Math.sqrt(Math.pow(mouseRelativePosition.x, 2) + Math.pow(mouseRelativePosition.y, 2));
        const mouseRelativeDirection = {
			x: mouseRelativePosition.x / magnitude,
			y: mouseRelativePosition.y / magnitude
		};*/

		if (Keyboard.keys && (Keyboard.keys["ArrowLeft"] || Keyboard.keys["ArrowRight"])) {
			if (Keyboard.keys["ArrowLeft"]) this.rotation -= 0.15;
			if (Keyboard.keys["ArrowRight"]) this.rotation += 0.15;
        }

        this.velocity.x += Math.cos(this.rotation - Math.PI / 2);
        this.velocity.y += Math.sin(this.rotation - Math.PI / 2);
        const magnitude = Math.sqrt(Math.pow(this.velocity.x, 2) + Math.pow(this.velocity.y, 2));
        this.velocity.x /= magnitude;
        this.velocity.y /= magnitude;

        for (let i=0; i<NUM_SNAKE_PARTS; i++) {
            if (i == NUM_SNAKE_PARTS-1) {
                this.snakeParts[i].position.x += this.velocity.x * this.STEP_SIZE;
                this.snakeParts[i].position.y += this.velocity.y * this.STEP_SIZE;
            }
            else {
                this.snakeParts[i].position.x = this.snakeParts[i+1].position.x;
                this.snakeParts[i].position.y = this.snakeParts[i+1].position.y;
            }
            /*if      (this.snakeParts[i].position.x < 5)                    this.velocity.x = +Math.abs(this.velocity.x*0.9);
            else if (this.snakeParts[i].position.x > screenSize.width-10)  this.velocity.x = -Math.abs(this.velocity.x*0.9);
            if      (this.snakeParts[i].position.y < 0)                    this.velocity.y = +Math.abs(this.velocity.y*0.9);
            if      (this.snakeParts[i].position.y > screenSize.height-30) this.velocity.y = -Math.abs(this.velocity.y*0.9);*/
        }

        this.iter += 1;
    }
    
    display(bodyElements) {
        for (let i=0; i<NUM_SNAKE_PARTS; i++) {
            bodyElements[i].style.left = this.snakeParts[i].position.x + 'px';
            bodyElements[i].style.top  = this.snakeParts[i].position.y + 'px';
        }
	}
}





let snakeElement = document.getElementById("snake");
let snakePos = {
	x: snakeElement.getBoundingClientRect().left + 20,
	y: snakeElement.getBoundingClientRect().top + window.scrollY + 3
};
let snakePartsElements = [];

let snake = new Snake(snakePos);

let snakeLoop = null;
let snakeRunning = false;
function snakeInit() {
    if (snakeRunning) return
    snakeRunning = true;
    snakeElement.innerHTML = ''
    for (let i=0; i<NUM_SNAKE_PARTS; i++) {
        snakeElement.innerHTML += '<div id="snakePart' + i + '" style="position:absolute;"><img src="imgs/dot.png" width="2"></div>';
    }
    for (let i=0; i<NUM_SNAKE_PARTS; i++) {
        snakePartsElements.push(document.getElementById("snakePart" + i));
    }

    snakeLoop = setInterval(iterSnake, 30);
}

function iterSnake() {
    snake.movement();
    snake.display(snakePartsElements)
}
