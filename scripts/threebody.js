import { AppEvents, getScreenSize } from './utils.js';

const NUM_BODIES = 4;
const G = 10;
const SIM_SPEED = 1;
const MAX_FORCE = 10000;

class Threebody {
    running = false;
    container = null;
    bodies = [
        {position: {x: 0, y: 0}, velocity: {x: 0, y: 0}, mass: 50},
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
    isSlingshotting = false;
    SLINGSHOT_THRESHOLD = 171;

// We pass the container element itself, not its absolute position
    constructor(containerElement) {
        this.container = containerElement;
        
        // Configurable spawn offset (set to center-bottom of the container)
        const offsetX = this.container.offsetWidth / 2;
        const offsetY = this.container.offsetHeight / 2 - 5;

        // Apply base offset to all bodies
        for (let i = 0; i < NUM_BODIES; i++) {
            this.bodies[i].position.x = offsetX;
            this.bodies[i].position.y = offsetY;
        }
        
        // Spawn relative to the offset instead of absolute 0,0
        this.bodies[1].position.x -= 15;
        this.bodies[3].position.x += 15;

        let velRangeFactor = 30;
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
        
        // Cache the container's current position on screen for boundaries
        this.currentRect = this.container.getBoundingClientRect();
        
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
        const force = Math.min(G * body1.mass * body2.mass / Math.pow(distance, 1.7), MAX_FORCE);
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
        
        // Transform the window's absolute boundaries into local relative boundaries
        const minX = -this.currentRect.left + 5;
        const maxX = screenSize.width - this.currentRect.left - 10;
        const minY = -this.currentRect.top;
        const maxY = screenSize.height - this.currentRect.top - 30;

        // Collide with dynamic window borders
        if      (body.position.x < minX) body.velocity.x = +Math.abs(body.velocity.x*0.9);
        else if (body.position.x > maxX) body.velocity.x = -Math.abs(body.velocity.x*0.9);
        
        if      (body.position.y < minY) body.velocity.y = +Math.abs(body.velocity.y*0.9);
        else if (body.position.y > maxY) body.velocity.y = -Math.abs(body.velocity.y*0.9);
    }
    
    _display() {
        for (let i=0; i<NUM_BODIES; i++) {
            bodyElements[i].style.left = this.bodies[i].position.x + 'px';
            bodyElements[i].style.top  = this.bodies[i].position.y + 'px';
        }
	}
}


function transformToGoodreads() {
    const body0 = document.getElementById("body0");
    if (!body0) return;

    const goodreadsUrl = "https://www.goodreads.com/karlobabic";

    body0.innerHTML = `
        <a href="${goodreadsUrl}" target="_blank" title="My Goodreads Profile">
            <img src="imgs/goodreads.png" width="8">
        </a>
    `;

    const link = body0.querySelector('a');
    if (link) {
        link.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }
}


let threebodyElement = document.getElementById("threebody");
let bodyElements;

// Simply pass the HTML element down so it acts as our anchor
export let threebody = new Threebody(threebodyElement);

export function threebodyInit() {
    if (threebody.running) return;
    
    threebodyElement.innerHTML  = `<img src="imgs/dots.png" width="35" style="visibility: hidden;">`
    threebodyElement.innerHTML += `<div id="body0" style="position:absolute;"><img src="imgs/dot_blue.png" width="2" class="glow-particle"></div>`;
    threebodyElement.innerHTML += `<div id="body1" style="position:absolute;"><img src="imgs/dot.png" width="3" class="glow-particle"></div>`;
    threebodyElement.innerHTML += `<div id="body2" style="position:absolute;"><img src="imgs/dot.png" width="3" class="glow-particle"></div>`;
    threebodyElement.innerHTML += `<div id="body3" style="position:absolute;"><img src="imgs/dot.png" width="3" class="glow-particle"></div>`;
    bodyElements = [
        document.getElementById("body0"),
        document.getElementById("body1"),
        document.getElementById("body2"),
        document.getElementById("body3")
    ];

    let hasTransformed = false;
    AppEvents.on('rocket:docked', () => {
        if (!hasTransformed) {
            transformToGoodreads();
            hasTransformed = true;
        }
    });

    threebody.running = true;
}

setTimeout(() => {
    threebodyInit()
}, 15000);