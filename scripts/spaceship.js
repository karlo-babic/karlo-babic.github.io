class Spaceship {
	active = false;

	origPosition = { x: 0, y: 0 };
	position = { x: 0, y: 0 };
	SIZE = 0;
	docElement = null;
	mainLoop = null;

	velocity = { x: 0, y: 0 };
	rotation = 0;
	angularSpeed = (Math.random() - 0.5) * 0.1;
	propulse = false;
	PROPULSION_STRENGTH = 3;
	MASS = 0.5;
	MAX_ANGULAR_SPEED = 0.5;
	gravityActive = true;
	GRAVITY_ACC = 4.81;

	prevTime = -1;
	iters = 0;
	itersWithoutControl = 0;
	MAX_ITERS_WITHOUT_CONTROL = 100;

	constructor(position, size, docElement) {
		this.origPosition = position;
		Object.assign(this.position, position);
		this.SIZE = size;
		this.docElement = docElement;
	}

	loopIter() {
		const time = performance.now();
		let deltaTime = (time - spaceship.prevTime) / 1000;
		if (deltaTime > 0.1) deltaTime = 0.02;
		spaceship.prevTime = time;
		spaceship.playerControl();
		spaceship.automaticControl();
		spaceship.calcPhysics();
		spaceship.updateState(deltaTime);
		spaceship.display()
	}

	playerControl() {
		this.propulse = false;
		if (Keyboard.keys && (Keyboard.keys["ArrowUp"] || Keyboard.keys["ArrowLeft"] || Keyboard.keys["ArrowRight"])) {
			this.itersWithoutControl = 0;

			if (Keyboard.keys["ArrowUp"]) this.propulse = true;
			if (Keyboard.keys["ArrowLeft"]) this.angularSpeed -= 0.01;
			if (Keyboard.keys["ArrowRight"]) this.angularSpeed += 0.01;
		} else {
			this.itersWithoutControl += 1;
		}

		if (Keyboard.keys && Keyboard.keys[71]) this.gravityActive = !this.gravityActive;
	}

	automaticControl() {
		if (this.itersWithoutControl <= this.MAX_ITERS_WITHOUT_CONTROL) return;  // user is controlling it
		let MAX_VELOCITY_DIRECTION = 2.6;

		let mouseRelativePos = {
			x: Mouse.x - this.position.x,
			y: Mouse.y - this.position.y
		};
		let MOUSE_HOMING_STRENGTH = 0.8;

		let homingVelocity = {
			x: this.velocity.x - mouseRelativePos.x * MOUSE_HOMING_STRENGTH,
			y: this.velocity.y - (mouseRelativePos.y * MOUSE_HOMING_STRENGTH - this.GRAVITY_ACC * 10)
		};

		let homingVelocityAngle = Math.atan2(homingVelocity.y, homingVelocity.x);
		let homingVelocityAngleRelative = normalizeRadians(homingVelocityAngle - this.rotation - Math.PI / 2 - Math.PI);
		let homingSpeed = Math.sqrt(homingVelocity.x ** 2 + homingVelocity.y ** 2);
		if (homingSpeed > 0.2) {
			if (Math.abs(homingVelocityAngleRelative) > MAX_VELOCITY_DIRECTION) {
				this.propulse = true;
			}
			if (Math.abs(this.angularSpeed - homingVelocityAngleRelative) > 0.2) {  // ship needs to turn
				let angularChange = 0.01 * Math.sign(homingVelocityAngleRelative);
				this.angularSpeed -= angularChange;
			}
		}
		// slow down rotation
		if (this.angularSpeed - homingVelocityAngleRelative >= 0) {
			this.angularSpeed = this.angularSpeed * 0.9;
		}
	}

	calcPhysics() {
		if (this.angularSpeed > this.MAX_ANGULAR_SPEED) {
			this.angularSpeed = this.MAX_ANGULAR_SPEED;
		}
		if (this.angularSpeed < -this.MAX_ANGULAR_SPEED) {
			this.angularSpeed = -this.MAX_ANGULAR_SPEED;
		}

		if (this.propulse) {
			let propulsionAcc = {
				x: this.PROPULSION_STRENGTH * Math.cos(this.rotation - Math.PI / 2) / this.MASS,
				y: this.PROPULSION_STRENGTH * Math.sin(this.rotation - Math.PI / 2) / this.MASS
			};
			this.velocity.x += propulsionAcc.x;
			this.velocity.y += propulsionAcc.y;
			Smoke.propulsionReaction = { x: -propulsionAcc.x, y: -propulsionAcc.y };
		}
		else Smoke.propulsionReaction = false;

		// gravity
		if (this.gravityActive) {
			this.velocity.y += this.GRAVITY_ACC * this.MASS;
		}
	}

	updateState(deltaTime) {
		if (this.position.x < 10 && this.velocity.x < 0) { this.velocity.x = +Math.abs(this.velocity.x) * 0.2; if (Math.abs(this.velocity.x) < 0.01) this.velocity.x = 0; }
		else if (this.position.x > screenSize.width - 20 && this.velocity.x > 0) this.velocity.x = -Math.abs(this.velocity.x) * 0.2;
		if (this.position.y < 0 && this.velocity.y < 0) this.velocity.y = +Math.abs(this.velocity.y) * 0.2;
		else if (this.position.y > screenSize.height - 30 && this.velocity.y > 0) this.velocity.y = -Math.abs(this.velocity.y) * 0.2;

		this.position.x += this.velocity.x * deltaTime;
		this.position.y += this.velocity.y * deltaTime;

		this.rotation += 2 * this.angularSpeed / (this.MASS * 0.3) * deltaTime;
		this.rotation = normalizeRadians(this.rotation);

		Smoke.updateState(deltaTime);

		// if back at the origin
		if (Math.abs(this.position.x - this.origPosition.x) < 4 &&
			Math.abs(this.position.y - this.origPosition.y) < 4 &&
			Math.abs(this.rotation) < 0.4 &&
			this.iters >= 50) {
			Object.assign(this.position, this.origPosition);
			this.rotation = 0;
			showhide('books');
			this.stop();
		}

		this.iters += 1;
	}

	display() {
		let onoff = "off";
		if (this.propulse) { onoff = "on"; }
		this.docElement.innerHTML = '<img src="imgs/ship_' + onoff + '.png" width="' + this.SIZE + '" style="transform:rotate(' + this.rotation + 'rad);">';
		this.docElement.style.left = this.position.x - this.SIZE / 2 + 'px';
		this.docElement.style.top = this.position.y - this.SIZE / 2 + 'px';

		Smoke.display();
	}

	stop() {
		if (this.active == false) return;
		this.active = false;
		clearInterval(spaceship.mainLoop);
		this.propulse = false;
		this.iters = 0;
		this.itersWithoutControl = 0;
		this.display(this.docElement);
	}
}


const Smoke = {
	lifetime: 3,
	particles: [
		{ position: { x: 0, y: 0 }, velocity: { x: 0, y: 0 }, lifetime: 0, size: 6 },
		//{ position: { x: 0, y: 0 }, velocity: { x: 0, y: 0 }, lifetime: 0, size: 6 },
		//{ position: { x: 0, y: 0 }, velocity: { x: 0, y: 0 }, lifetime: 0, size: 6 }
	],
	docElement: null,
	particleDocElements: [],
	propulsionReaction: false, //{x: 0, y: 0},

	init: function (docElement) {
		Smoke.docElement = docElement;
		Smoke.docElement.innerHTML = ""
		for (let i = 0; i < Smoke.particles.length; i++) {
			Smoke.docElement.innerHTML += '<div id="smoke' + i + '" style="position:absolute;"><img src="imgs/smoke.png" width="' + Smoke.particles[i].size + '" style="visibility:hidden;"></div>';
			Smoke.particleDocElements.push(document.getElementById("smoke" + i));
		}
	},

	updateState: function (deltaTime) {
		for (let i = 0; i < Smoke.particles.length; i++) {
			if (Smoke.particles[i].lifetime == 0) {
				if (Smoke.propulsionReaction) {
					Smoke.particles[i].lifetime = Smoke.lifetime;
					Smoke.particles[i].position = { x: spaceship.position.x, y: spaceship.position.y - spaceship.SIZE / 1.5 };
					Smoke.particles[i].velocity = { x: Smoke.propulsionReaction.x, y: Smoke.propulsionReaction.y };
				}
			}
			else {
				Smoke.particles[i].position.x += Smoke.particles[i].velocity.x * deltaTime * 100;
				Smoke.particles[i].position.y += Smoke.particles[i].velocity.y * deltaTime * 100;
				Smoke.particles[i].lifetime -= 0.5;
			}
		}
	},

	display: function () {
		for (let i = 0; i < Smoke.particles.length; i++) {
			let visible = (Smoke.particles[i].lifetime > 0) ? "visible" : "hidden";
			Smoke.particleDocElements[i].innerHTML = '<div id="smoke' + i + '" style="position:absolute;"><img src="imgs/smoke.png" width="' + Smoke.particles[i].lifetime*2 + '" style="visibility:' + visible + ';"></div>';
			Smoke.particleDocElements[i].style.left = Smoke.particles[i].position.x - Smoke.particles[i].lifetime*2 / 2 + 'px';
			Smoke.particleDocElements[i].style.top = Smoke.particles[i].position.y - Smoke.particles[i].lifetime*2 / 2 + 'px';
		}
	}
};




let spaceship = null;
function spaceshipInit() {
	let docElement = document.getElementById("spaceship");
	let shipSize = 12;
	let shipPos = {
		x: docElement.getBoundingClientRect().left + window.scrollX + shipSize / 2,
		y: docElement.getBoundingClientRect().top + window.scrollY + shipSize / 2
	};
	if (spaceship === null) spaceship = new Spaceship(shipPos, shipSize, docElement);
	spaceship.prevTime = performance.now();

	if (spaceship.active) return;
	spaceship.active = true;
	spaceship.mainLoop = setInterval(spaceship.loopIter, 20);

	let smokeDocElement = document.getElementById("smoke");
	Smoke.init(smokeDocElement);
}
