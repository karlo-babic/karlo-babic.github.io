import { AppEvents, getScreenSize } from './utils.js';

const NUM_BODIES = 4;
const G = 10;
const SIM_SPEED = 1;
const MAX_FORCE = 10000;

class Threebody {
    running = false;
	origPosition = {x: 0, y: 0};
    bodies = [
        {position: {x: 0, y: 0}, velocity: {x: 0, y: 0}, mass: 10},
        {position: {x: 0, y: 0}, velocity: {x: 0, y: 0}, mass: 1000},
        {position: {x: 0, y: 0}, velocity: {x: 0, y: 0}, mass: 1000},
        {position: {x: 0, y: 0}, velocity: {x: 0, y: 0}, mass: 1000}
    ];
    bodiesBuffer = [
        {position: {x: 0, y: 0}, velocity: {x: 0, y: 0}, mass: 0},
        {position: {x: 0, y: 0}, velocity: {x: 0, y: 0}, mass: 0},
        {position: {x: 0, y: 0}, velocity: {x: 0, y: 0}, mass: 0},
        {position: {x: 0, y: 0}, velocity: {x: 0, y: 0}, mass: 0}
    ];
    iters = 0;
    isSlingshotting = false; // State to prevent event spam
    SLINGSHOT_THRESHOLD = 171;

    constructor(position) {
		this.origPosition = position;
		Object.assign(this.bodies[0].position, position);
		Object.assign(this.bodies[1].position, position);
		Object.assign(this.bodies[2].position, position);
		Object.assign(this.bodies[3].position, position);
        this.bodies[1].position.x -= 15
        this.bodies[3].position.x += 15

        let velRangeFactor = 50;
        this.bodies[0].velocity = {x: Math.random()*velRangeFactor-0.5*velRangeFactor, y: Math.random()*velRangeFactor-0.5*velRangeFactor}
        this.bodies[0].position.x += Math.random()*10 - 5;
        this.bodies[0].position.y += Math.random()*10 - 5;
        this.bodies[1].velocity = {x: Math.random()*velRangeFactor-0.5*velRangeFactor, y: Math.random()*velRangeFactor-0.5*velRangeFactor}
        this.bodies[2].velocity = {x: Math.random()*velRangeFactor-0.5*velRangeFactor, y: Math.random()*velRangeFactor-0.5*velRangeFactor}
        this.bodies[3].velocity = {x: -this.bodies[1].velocity.x - this.bodies[2].velocity.x, y: -this.bodies[1].velocity.y - this.bodies[2].velocity.y}

        for (let i=0; i<NUM_BODIES; i++) {
            Object.assign(this.bodiesBuffer[i].position, this.bodies[i].position);
            Object.assign(this.bodiesBuffer[i].velocity, this.bodies[i].velocity);
            this.bodiesBuffer[i].mass = this.bodies[i].mass;
        }
    }

    update(deltaTime) {
        if (deltaTime > 0.1) deltaTime = 0.02; // Prevent instability on lag
        this._calcPhysics(deltaTime);
        this._checkEvents();
        this._display();
        this.iters += 1;
    }

    _checkEvents() {
        const planetSpeed = Math.sqrt(Math.pow(this.bodies[0].velocity.x, 2) + Math.pow(this.bodies[0].velocity.y, 2));
        if (planetSpeed > this.SLINGSHOT_THRESHOLD && !this.isSlingshotting) {
            this.isSlingshotting = true;
            AppEvents.emit('threebody:slingshot');
        } else if (planetSpeed < this.SLINGSHOT_THRESHOLD) {
            this.isSlingshotting = false;
        }
    }

    _calcPhysics(deltaTime) {
        for (let i=0; i<NUM_BODIES; i++) {
            let fx = 0;
            let fy = 0;
            for (let j=1; j<NUM_BODIES; j++) {
                if (i !== j) {
                    const force = this._calcForce(this.bodies[i], this.bodies[j]);
                    fx += force.fx;
                    fy += force.fy;
                }
            }
            this._updateBody(i, this.bodiesBuffer[i], fx, fy, deltaTime);
        }
        for (let i=0; i<NUM_BODIES; i++) {
            Object.assign(this.bodies[i].position, this.bodiesBuffer[i].position);
            Object.assign(this.bodies[i].velocity, this.bodiesBuffer[i].velocity);
        }
    }
    
    _calcForce(body1, body2) {
        const dx = body2.position.x - body1.position.x;
        const dy = body2.position.y - body1.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy) + 0.001;
        const force = Math.min(G * body1.mass * body2.mass / Math.pow(distance, 1.65), MAX_FORCE);
        const fx = force * dx / distance;
        const fy = force * dy / distance;
        return { fx, fy, distance };
    }
    
    _updateBody(i, body, fx, fy, deltaTime) {
        const screenSize = getScreenSize();
        const ax = fx / body.mass;
        const ay = fy / body.mass;
        body.velocity.x += ax * deltaTime * SIM_SPEED;
        body.velocity.y += ay * deltaTime * SIM_SPEED;
        body.position.x += body.velocity.x * deltaTime * SIM_SPEED;
        body.position.y += body.velocity.y * deltaTime * SIM_SPEED;
        
        if      (body.position.x < 5)                    body.velocity.x = +Math.abs(body.velocity.x*0.9);
        else if (body.position.x > screenSize.width-10)  body.velocity.x = -Math.abs(body.velocity.x*0.9);
        if      (body.position.y < 0)                    body.velocity.y = +Math.abs(body.velocity.y*0.9);
        if      (body.position.y > screenSize.height-30) body.velocity.y = -Math.abs(body.velocity.y*0.9);
    }
    
    _display() {
        for (let i=0; i<NUM_BODIES; i++) {
            bodyElements[i].style.left = this.bodies[i].position.x + 'px';
            bodyElements[i].style.top  = this.bodies[i].position.y + 'px';
        }
	}
}

let threebodyElement = document.getElementById("threebody");
let threebodyPos = {
	x: threebodyElement.getBoundingClientRect().left + 20,
	y: threebodyElement.getBoundingClientRect().top + window.scrollY + 3
};
let bodyElements;
export let threebody = new Threebody(threebodyPos);

export function threebodyInit() {
    if (threebody.running) return;
    
    threebodyElement.innerHTML  = `<div id="body0" style="position:absolute;"><img src="imgs/dot_blue.png" width="2" class="glow-particle"></div>`;
    threebodyElement.innerHTML += `<div id="body1" style="position:absolute;"><img src="imgs/dot.png" width="3" class="glow-particle"></div>`;
    threebodyElement.innerHTML += `<div id="body2" style="position:absolute;"><img src="imgs/dot.png" width="3" class="glow-particle"></div>`;
    threebodyElement.innerHTML += `<div id="body3" style="position:absolute;"><img src="imgs/dot.png" width="3" class="glow-particle"></div>`;
    bodyElements = [
        document.getElementById("body0"),
        document.getElementById("body1"),
        document.getElementById("body2"),
        document.getElementById("body3")
    ];

    threebody.running = true;
}

setTimeout(() => {
    threebodyInit()
}, 15000);