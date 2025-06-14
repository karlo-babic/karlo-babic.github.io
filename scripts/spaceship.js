import { Keyboard, Mouse, AppEvents, getScreenSize, normalizeRadians, toggleDisplay } from './utils.js';

// --- Module Constants ---
const PROPULSION_STRENGTH = 3;
const MASS = 0.5;
const MAX_ANGULAR_SPEED = 0.5;
const GRAVITY_ACC = 6.81;
const MAX_ITERS_WITHOUT_CONTROL = 100;
const ANGULAR_SENSITIVITY = 0.015;
const SHIP_SIZE = 12;

class Spaceship {
	active = false;
	origPosition = { x: 0, y: 0 };
	position = { x: 0, y: 0 };
	docElement = null; // This will be the <img> tag

	velocity = { x: 0, y: 0 };
	rotation = 0;
	angularSpeed = (Math.random() - 0.5) * 0.1;
	propulse = false;
	gravityActive = true;

	iters = 0;
	itersWithoutControl = 0;

	constructor(docElement) {
		this.docElement = docElement;
	}

    setOrigPosition(position) {
        this.origPosition = position;
        Object.assign(this.position, this.origPosition);
    }

    activate() {
        this.active = true;
        this.docElement.classList.add('active');
    }

	update(deltaTime) {
        if (deltaTime > 0.1) deltaTime = 0.02;
		this._playerControl();
		this._automaticControl();
		this._calcPhysics();
		this._updatePosition(deltaTime);
        this._checkReturnToOrigin();
		this.display();
	}

	_playerControl() {
		this.propulse = false;
		if (Keyboard.keys && (Keyboard.keys["ArrowUp"] || Keyboard.keys["ArrowLeft"] || Keyboard.keys["ArrowRight"])) {
			this.itersWithoutControl = 0;
			if (Keyboard.keys["ArrowUp"]) this.propulse = true;
			if (Keyboard.keys["ArrowLeft"]) this.angularSpeed -= ANGULAR_SENSITIVITY;
			if (Keyboard.keys["ArrowRight"]) this.angularSpeed += ANGULAR_SENSITIVITY;
		} else {
			this.itersWithoutControl += 1;
		}
		if (Keyboard.keys && Keyboard.keys["KeyG"]) {
            this.gravityActive = !this.gravityActive;
        }
	}

	_automaticControl() {
		if (this.itersWithoutControl <= MAX_ITERS_WITHOUT_CONTROL) return;
		let MAX_VELOCITY_DIRECTION = 2.6;
		let MOUSE_HOMING_STRENGTH = 0.8;
		let mouseRelativePos = { x: Mouse.x - this.position.x, y: Mouse.y - this.position.y };
		let homingVelocity = {
			x: this.velocity.x - mouseRelativePos.x * MOUSE_HOMING_STRENGTH,
			y: this.velocity.y - (mouseRelativePos.y * MOUSE_HOMING_STRENGTH - GRAVITY_ACC * 10)
		};
		let homingVelocityAngle = Math.atan2(homingVelocity.y, homingVelocity.x);
		let homingVelocityAngleRelative = normalizeRadians(homingVelocityAngle - this.rotation - Math.PI / 2 - Math.PI);
		let homingSpeed = Math.sqrt(homingVelocity.x ** 2 + homingVelocity.y ** 2);
		if (homingSpeed > 0.2) {
			if (Math.abs(homingVelocityAngleRelative) > MAX_VELOCITY_DIRECTION) this.propulse = true;
			if (Math.abs(this.angularSpeed - homingVelocityAngleRelative) > 0.2) {
				this.angularSpeed -= 0.03 * Math.sign(homingVelocityAngleRelative);
			}
		}
		if (this.angularSpeed - homingVelocityAngleRelative >= 0) {
			this.angularSpeed = this.angularSpeed * 0.9;
		}
	}

	_calcPhysics() {
		this.angularSpeed = Math.max(-MAX_ANGULAR_SPEED, Math.min(MAX_ANGULAR_SPEED, this.angularSpeed));
		if (this.propulse) {
			let propulsionAcc = {
				x: PROPULSION_STRENGTH * Math.cos(this.rotation - Math.PI / 2) / MASS,
				y: PROPULSION_STRENGTH * Math.sin(this.rotation - Math.PI / 2) / MASS
			};
			this.velocity.x += propulsionAcc.x;
			this.velocity.y += propulsionAcc.y;
			Smoke.propulsionReaction = { x: -propulsionAcc.x, y: -propulsionAcc.y };
		} else {
            Smoke.propulsionReaction = false;
        }
		if (this.gravityActive) {
			this.velocity.y += GRAVITY_ACC * MASS;
		}
	}

	_updatePosition(deltaTime) {
        const screenSize = getScreenSize();
        if (this.position.x < 10 && this.velocity.x < 0) this.velocity.x = Math.abs(this.velocity.x) * 0.2;
		else if (this.position.x > screenSize.width - 20 && this.velocity.x > 0) this.velocity.x = -Math.abs(this.velocity.x) * 0.2;
		if (this.position.y < 0 && this.velocity.y < 0) this.velocity.y = Math.abs(this.velocity.y) * 0.2;
		else if (this.position.y > screenSize.height - 30 && this.velocity.y > 0) this.velocity.y = -Math.abs(this.velocity.y) * 0.2;
        this.position.x += this.velocity.x * deltaTime;
		this.position.y += this.velocity.y * deltaTime;
		this.rotation = normalizeRadians(this.rotation + 2 * this.angularSpeed / (MASS * 0.3) * deltaTime);
		Smoke.updateState(deltaTime);
		this.iters += 1;
	}

    _checkReturnToOrigin() {
        const atOrigin = Math.abs(this.position.x - this.origPosition.x) < 5 &&
                         Math.abs(this.position.y - this.origPosition.y) < 5;
        if (atOrigin && Math.abs(this.rotation) < 0.4 && this.iters >= 50) {
			toggleDisplay('books');
			this.stop();
		}
    }

	display() {
        let onoff = this.propulse ? "on" : "off";
        this.docElement.src = `imgs/ship_${onoff}.png`;
        
        if (this.active) {
            this.docElement.style.transform = `rotate(${this.rotation}rad)`;
            this.docElement.style.left = this.position.x - SHIP_SIZE / 2 + 'px';
            this.docElement.style.top = this.position.y - SHIP_SIZE / 2 + 'px';
        } else {
            this.docElement.style.transform = '';
            this.docElement.style.left = '';
            this.docElement.style.top = '';
        }
		Smoke.display();
	}

	stop() {
		if (this.active == false) return;
		this.active = false;
        this.docElement.classList.remove('active');
		this.propulse = false;
		this.iters = 0;
		this.itersWithoutControl = 0;
        this.velocity = { x: 0, y: 0 };
        this.rotation = 0;
        Object.assign(this.position, this.origPosition);
		this.display();
	}
}

export const Smoke = {
	lifetime: 3,
	particles: [ { position: { x: 0, y: 0 }, velocity: { x: 0, y: 0 }, lifetime: 0, size: 6 } ],
	docElement: null,
	particleDocElements: [],
	propulsionReaction: false,

	init: function (docElement) {
		this.docElement = docElement;
		this.docElement.innerHTML = ""
		for (let i = 0; i < this.particles.length; i++) {
			this.docElement.innerHTML += `<div id="smoke${i}" style="position:absolute;"><img src="imgs/smoke.png" width="${this.particles[i].size}" class="glow-particle" style="visibility:hidden;"></div>`;
			this.particleDocElements.push(document.getElementById("smoke" + i));
		}
	},

	updateState: function (deltaTime) {
		for (let i = 0; i < this.particles.length; i++) {
			if (this.particles[i].lifetime <= 0) {
				if (this.propulsionReaction) {
					this.particles[i].lifetime = this.lifetime;
					this.particles[i].position = { x: spaceship.position.x, y: spaceship.position.y };
					this.particles[i].velocity = { x: this.propulsionReaction.x, y: this.propulsionReaction.y };
				}
			}
			else {
				const screenSize = getScreenSize();
				this.particles[i].position.x += this.particles[i].velocity.x * deltaTime * 100;
				this.particles[i].position.y += this.particles[i].velocity.y * deltaTime * 100;
				this.particles[i].lifetime -= 0.5;
				if (this.particles[i].position.x < 5) this.particles[i].velocity.x = +Math.abs(this.particles[i].velocity.x*0.9);
				else if (this.particles[i].position.x > screenSize.width-20) this.particles[i].velocity.x = -Math.abs(this.particles[i].velocity.x*0.9);
				if (this.particles[i].position.y < 0) this.particles[i].velocity.y = +Math.abs(this.particles[i].velocity.y*0.9);
				else if (this.particles[i].position.y > screenSize.height-50) this.particles[i].velocity.y = -Math.abs(this.particles[i].velocity.y*0.9);
			}
		}
	},

	display: function () {
		for (let i = 0; i < this.particles.length; i++) {
            const particleEl = this.particleDocElements[i];
            const particleImg = particleEl.querySelector('img');
			if (particleImg) {
                let visible = (this.particles[i].lifetime > 0) ? "visible" : "hidden";
                particleImg.style.visibility = visible;
                particleImg.style.width = `${this.particles[i].lifetime * 2}px`;
                particleEl.style.left = this.particles[i].position.x - this.particles[i].lifetime * 2 / 2 + 'px';
			    particleEl.style.top = this.particles[i].position.y - this.particles[i].lifetime * 2 / 2 + 'px';
            }
		}
	}
};

export let spaceship = null;
export function spaceshipInit() {
	let docElement = document.getElementById("spaceship");
	
	if (spaceship === null) {
        spaceship = new Spaceship(docElement);
    }
    
	if (spaceship.active) return;

    let shipRect = docElement.getBoundingClientRect();
    let shipPos = {
		x: shipRect.left + window.scrollX + shipRect.width / 2,
		y: shipRect.top + window.scrollY + shipRect.height / 2
	};
    spaceship.setOrigPosition(shipPos);

	spaceship.activate();
    AppEvents.emit('spaceship:liftoff');
	
	let smokeDocElement = document.getElementById("smoke");
	Smoke.init(smokeDocElement);
}

/*setTimeout(() => {
    spaceshipInit()
}, 40000);*/