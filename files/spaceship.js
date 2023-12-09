class Spaceship {
	origPosition = {x: 0, y: 0};
    position = {x: 0, y: 0};
    SIZE = 12;
    
    velocity = {x: 0, y: 0};
    rotation = 0;
    angularSpeed = (Math.random()-0.5)*0.1;
    propulse = false;
    PROPULSION_STRENGTH = 3;
    MASS = 0.5;
    MAX_ANGULAR_SPEED = 0.5;
    gravityActive = true;
	GRAVITY_ACC = 6.81;
    
	prevTime = -1;
	iters = 0;
    itersWithoutControl = 0;
    MAX_ITERS_WITHOUT_CONTROL = 100;
    
    constructor(position, size) {
		this.origPosition = position;
		Object.assign(this.position, position);
		this.SIZE = size;
    }

    playerControl() {
		this.propulse = false;
		if ( keyboard.keys && (keyboard.keys[37] || keyboard.keys[39] || keyboard.keys[38]) ) {
			this.itersWithoutControl = 0;
			
			if (keyboard.keys[37]) this.angularSpeed -= 0.01;
			if (keyboard.keys[39]) this.angularSpeed += 0.01;
			if (keyboard.keys[38]) this.propulse = true;
		} else {
			this.itersWithoutControl += 1;
		}

        if (keyboard.keys && keyboard.keys[71]) this.gravityActive = !this.gravityActive;
	}

    automaticControl() {
		if (this.itersWithoutControl <= this.MAX_ITERS_WITHOUT_CONTROL) return;  // user is controlling it
		let MAX_VELOCITY_DIRECTION = 2.6;

		let mouseRelativePos = { 
			x : mouse.x - this.position.x,
			y : mouse.y - this.position.y
		};
		let MOUSE_HOMING_STRENGTH = 2.0;

		let homingVelocity = {
			x : this.velocity.x - mouseRelativePos.x * MOUSE_HOMING_STRENGTH,
			y : this.velocity.y - (mouseRelativePos.y * MOUSE_HOMING_STRENGTH - this.GRAVITY_ACC*20)
		};

		let homingVelocityAngle = Math.atan2(homingVelocity.y, homingVelocity.x);
		let homingVelocityAngleRelative = normalizeRadians(homingVelocityAngle - this.rotation - Math.PI/2 - Math.PI);
		let homingSpeed = Math.sqrt(homingVelocity.x**2 + homingVelocity.y**2);
		if (homingSpeed > 0.2) {
			if ( Math.abs(homingVelocityAngleRelative) > MAX_VELOCITY_DIRECTION ) {
				this.propulse = true;
			}
			if ( Math.abs(this.angularSpeed - homingVelocityAngleRelative) > 0.2 ) {  // ship needs to turn
				let angularChange = 0.02 * Math.sign(homingVelocityAngleRelative);
				this.angularSpeed -= angularChange;
			}
		}
		// slow down rotation
		if (this.angularSpeed - homingVelocityAngleRelative >= 0) {
			this.angularSpeed = this.angularSpeed * 0.9;
		}

		/*let velocityAngle = Math.atan2(this.velocity.y, this.velocity.x);
		let velocityAngleRelative = normalizeRadians(velocityAngle - this.rotation - Math.PI/2 - Math.PI);
		let speed = Math.sqrt(this.velocity.x**2 + this.velocity.y**2);
		if (speed > 4) {
			if ( Math.abs(velocityAngleRelative) > MAX_VELOCITY_DIRECTION ) {
				this.propulse = true;
			} else if (Math.sign(this.angularSpeed) == Math.sign(velocityAngleRelative)) {  // ship needs to turn opposite to its current velocity direction
				this.angularSpeed -= 0.2 * Math.sign(velocityAngleRelative);
			}
		}*/
	}

    calcPhysics() {
		if (this.angularSpeed > this.MAX_ANGULAR_SPEED) {
			this.angularSpeed = this.MAX_ANGULAR_SPEED;
		}
		if (this.angularSpeed < -this.MAX_ANGULAR_SPEED) {
			this.angularSpeed = -this.MAX_ANGULAR_SPEED;
		}
	
		if (this.propulse) {
			this.velocity.x += this.PROPULSION_STRENGTH * Math.cos( this.rotation-Math.PI/2 ) / this.MASS;
			this.velocity.y += this.PROPULSION_STRENGTH * Math.sin( this.rotation-Math.PI/2 ) / this.MASS;
		}

		// gravity
        if (this.gravityActive) {
    		this.velocity.y += this.GRAVITY_ACC * this.MASS;
        }
    }

    updateState(deltaTime) {
		if      (this.position.x < 10 && this.velocity.x < 0)                   { this.velocity.x = +Math.abs(this.velocity.x)*0.2; if (Math.abs(this.velocity.x) < 0.01) this.velocity.x = 0; }
		else if (this.position.x > screenDims.width-20 && this.velocity.x > 0)  this.velocity.x = -Math.abs(this.velocity.x)*0.2;
		if      (this.position.y < 0 && this.velocity.y < 0)                    this.velocity.y = +Math.abs(this.velocity.y)*0.2;
		else if (this.position.y > screenDims.height-30 && this.velocity.y > 0) this.velocity.y = -Math.abs(this.velocity.y)*0.2;

		this.position.x += this.velocity.x * deltaTime;
		this.position.y += this.velocity.y * deltaTime;
	
		this.rotation += 2 * this.angularSpeed / (this.MASS*0.3) * deltaTime;
		this.rotation = normalizeRadians(this.rotation);
		
		// if back at the origin
		if (Math.abs(this.position.x - this.origPosition.x) < 4 &&
		Math.abs(this.position.y - this.origPosition.y) < 4 &&
		Math.abs(this.rotation) < 0.4 &&
		this.iters >= 50) {
			Object.assign(this.position, this.origPosition);
			this.rotation = 0;
			showhide('books');
			stopShip();
		}

		if (this.iters%100==0) updateScreenDims();
		this.iters += 1;
    }

    display(shipEl) {
		let onoff = "off";
		if (this.propulse) { onoff = "on"; }
		shipEl.innerHTML = '<img src="files/ship_'+onoff+'.png" width="'+this.SIZE+'" style="transform:rotate('+ this.rotation +'rad);">';
		shipEl.style.left = this.position.x-this.SIZE/2 + 'px';
		shipEl.style.top  = this.position.y-this.SIZE/2 + 'px';
	}
}






let shipElement = document.getElementById("spaceship");
let shipSize = 12;
let shipPos = {
	x: shipElement.getBoundingClientRect().left + window.scrollX + shipSize/2,
	y: shipElement.getBoundingClientRect().top  + window.scrollY + shipSize/2
};
let spaceship = new Spaceship(shipPos, shipSize);

screenDims = {};
function updateScreenDims() {
	screenDims = {
		width: Math.max(window.innerWidth, document.body.getBoundingClientRect().width),
		height: Math.max(window.innerHeight, document.body.getBoundingClientRect().height+25)
	};
}


let shipRunning = false;
let mainLoop = null;
function spaceshipInit() {
	if (shipRunning) return;
	shipRunning = true;
    keyboard.init();
    mouse.init();
	spaceship.prevTime = performance.now();
    mainLoop = setInterval(iterSpaceship, 20);
}

function iterSpaceship() {
	const time = performance.now();
	const deltaTime = (time - spaceship.prevTime) / 1000;
	spaceship.prevTime = time;
    spaceship.playerControl();
    spaceship.automaticControl();
    spaceship.calcPhysics();
    spaceship.updateState(deltaTime);
    spaceship.display(shipElement)
}

function stopShip() {
	if (shipRunning == false) return;
	shipRunning = false;
	clearInterval(mainLoop);
	spaceship.propulse = false;
	spaceship.iters = 0;
	spaceship.itersWithoutControl = 0;
	spaceship.display(shipElement);
}







var keyboard = {
	init : function() {
		// keyboard controls
		window.addEventListener('keydown', function (e) {
			keyboard.keys = (keyboard.keys || []);
			keyboard.keys[e.keyCode] = true;
			keyboard.pressedKey = e.keyCode;
		})
		window.addEventListener('keyup', function (e) {
			keyboard.keys[e.keyCode] = false;
			keyboard.pressedKey = false;
		})
	}
}

var mouse = {
	init : function() {
		// mouse controls
		window.addEventListener('mousemove', function (e) {
			mouse.x = e.pageX;
			mouse.y = e.pageY;
		})
		window.addEventListener('mousedown', function (e) {
			mouse.clickX = e.pageX;
			mouse.clickY = e.pageY;
		})
		window.addEventListener('mouseup', function (e) {
			mouse.clickX = false;
			mouse.clickY = false;
		})
	}
}



function normalizeRadians(rad) {
    rad = rad % (2*Math.PI)
    if (rad > Math.PI)        { rad -= 2 * Math.PI; }
    else if (rad <= -Math.PI) { rad += 2 * Math.PI; }
    return rad;
}
