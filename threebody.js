const G = 0.001;
const DT = 5;


class Threebody {
	origPosition = {x: 0, y: 0};
    bodies = [
        {position: {x: 0, y: 0}, velocity: {x: Math.random()-0.5, y: Math.random()-0.5}, mass: 100},
        {position: {x: 0, y: 0}, velocity: {x: Math.random()-0.5, y: Math.random()-0.5}, mass: 100},
        {position: {x: 0, y: 0}, velocity: {x: Math.random()-0.5, y: Math.random()-0.5}, mass: 100}
    ];
    bodiesBuffer = [
        {position: {x: 0, y: 0}, velocity: {x: 0, y: 0}, mass: 0},
        {position: {x: 0, y: 0}, velocity: {x: 0, y: 0}, mass: 0},
        {position: {x: 0, y: 0}, velocity: {x: 0, y: 0}, mass: 0}
    ];
    iters = 0;

    constructor(position) {
		this.origPosition = position;
		Object.assign(this.bodies[0].position, position);
		Object.assign(this.bodies[1].position, position);
		Object.assign(this.bodies[2].position, position);
        this.bodies[0].position.x -= 15
        this.bodies[2].position.x += 15

        this.bodies[0].velocity = {x: Math.random()*0.1-0.05, y: Math.random()*0.1-0.05}
        this.bodies[1].velocity = {x: Math.random()*0.1-0.05, y: Math.random()*0.1-0.05}
        this.bodies[2].velocity = {x: -this.bodies[0].velocity.x - this.bodies[1].velocity.x, y: -this.bodies[0].velocity.y - this.bodies[1].velocity.y}

        for (let i=0; i<3; i++) {
            Object.assign(this.bodiesBuffer[i].position, this.bodies[i].position);
            Object.assign(this.bodiesBuffer[i].velocity, this.bodies[i].velocity);
            this.bodiesBuffer[i].mass = this.bodies[i].mass;
        }
    }

    calcPhysics() {
        for (let i=0; i<3; i++) {
            let fx = 0;
            let fy = 0;
            for (let j=0; j<3; j++) {
                if (i !== j) {
                    const force = this._calcForce(this.bodies[i], this.bodies[j]);
                    fx += force.fx;
                    fy += force.fy;
                }
            }
            this._updateBody(this.bodiesBuffer[i], fx, fy);
        }
        for (let i=0; i<3; i++) {
            Object.assign(this.bodies[i].position, this.bodiesBuffer[i].position);
            Object.assign(this.bodies[i].velocity, this.bodiesBuffer[i].velocity);
        }
    }
    
    _calcForce(body1, body2) {
        const dx = body2.position.x - body1.position.x;
        const dy = body2.position.y - body1.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy );
        const force = G * body1.mass * body2.mass / Math.max(Math.pow(distance, 2), 10);
        const fx = force * dx / distance;
        const fy = force * dy / distance;
        return { fx, fy };
    }
    
    _updateBody(body, fx, fy) {
        const ax = fx / body.mass;
        const ay = fy / body.mass;
        body.velocity.x += ax * DT;
        body.velocity.y += ay * DT;
        body.position.x += body.velocity.x * DT;
        body.position.y += body.velocity.y * DT;
		
		if      (body.position.x < 5)                    body.velocity.x = +Math.abs(body.velocity.x*0.9);
		else if (body.position.x > screenDims.width-10)  body.velocity.x = -Math.abs(body.velocity.x*0.9);
		if      (body.position.y < 0)                    body.velocity.y = +Math.abs(body.velocity.y*0.9);
		if      (body.position.y > screenDims.height-20) body.velocity.y = -Math.abs(body.velocity.y*0.9);
        
		if (this.iters%100==0) updateScreenDims();
		this.iters += 1;
    }
    
    display(bodyElements) {
        for (let i=0; i<3; i++) {
            bodyElements[i].style.left = this.bodies[i].position.x + 'px';
            bodyElements[i].style.top  = this.bodies[i].position.y + 'px';
        }
	}
}





let threebodyElement = document.getElementById("threebody");
let threebodyPos = {
	x: threebodyElement.getBoundingClientRect().left + 22,
	y: threebodyElement.getBoundingClientRect().top  + 0
};
let bodyElements;

let threebody = new Threebody(threebodyPos);

let threebodyLoop = null;
let simRunning = false;
function threebodyInit() {
    if (simRunning) return
    simRunning = true;
    threebodyElement.innerHTML  = '<div id="body0" style="position:absolute;"><img src="dot.png" width="3" style="image-rendering:pixelated;"></div>';
    threebodyElement.innerHTML += '<div id="body1" style="position:absolute;"><img src="dot.png" width="3" style="image-rendering:pixelated;"></div>';
    threebodyElement.innerHTML += '<div id="body2" style="position:absolute;"><img src="dot.png" width="3" style="image-rendering:pixelated;"></div>';
    bodyElements = [
        document.getElementById("body0"),
        document.getElementById("body1"),
        document.getElementById("body2")
    ];

    threebodyLoop = setInterval(iterThreebody, 20);
}

function iterThreebody() {
    threebody.calcPhysics();
    threebody.display(bodyElements)
}




screenDims = {};
function updateScreenDims() {
	screenDims = {
		width: Math.max(window.innerWidth, document.body.getBoundingClientRect().width),
		height: Math.max(window.innerHeight, document.body.getBoundingClientRect().height+25)
	};
}