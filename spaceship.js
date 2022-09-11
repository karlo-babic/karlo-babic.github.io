class Spaceship {
    position = {x: 0, y: 0};
    size = 40;
    
    velocity = {x: 0, y: 0};
    rotation = 0;
    angularSpeed = 0;
    propulse = false;
    propulsionStrength = 10;
    mass = 15;
    maxAngularSpeed = 0.5;
    
    itersWithoutControl = 0;
    maxItersWithoutControl = 100;
    prevDistanceToTarget = 0;

    doDisplay = false;
    
    constructor(position, size, id) {
	this.position = position;
	this.size = size;
	this.id = id;
	if (this.id == 0) this.doDisplay = true;
    }

    playerControl() {
	this.propulse = false;
	if (!keyboard.keys) return
	if (this.id == 0) {
	    if (keyboard.keys[37] || keyboard.keys[39] || keyboard.keys[38]) {
		this.itersWithoutControl = 0;
		
		if (keyboard.keys[37]) this.angularSpeed -= 0.02;
		if (keyboard.keys[39]) this.angularSpeed += 0.02;
		if (keyboard.keys[38]) this.propulse = true;
	    } else {
		this.itersWithoutControl += 1;
	    }
	} else if (this.id == 1) {
	    if (keyboard.keys[50]) this.doDisplay = true;
	    if (keyboard.keys[65] || keyboard.keys[68] || keyboard.keys[87]) {
		this.itersWithoutControl = 0;
		
		if (keyboard.keys[65]) this.angularSpeed -= 0.02;
		if (keyboard.keys[68]) this.angularSpeed += 0.02;
		if (keyboard.keys[87]) this.propulse = true;
	    } else {
		this.itersWithoutControl += 1;
	    }
	}
    }

    automaticControl(otherShip) {
	if (this.itersWithoutControl > this.maxItersWithoutControl) { // automatic "AI" control if user doesnt control
	    let shipSpeed = Math.sqrt(this.velocity.x**2 + this.velocity.y**2);
	    let xyDistanceToTarget = {x: 0, y: 0};
	    if (this.id == 0) {
		xyDistanceToTarget = { x: mouse.x-this.position.x,
				       y: mouse.y-this.position.y };
	    } else {
		xyDistanceToTarget = { x: otherShip.position.x-this.position.x,
				       y: otherShip.position.y-this.position.y };
	    }
	    let distanceToTarget = Math.sqrt( (xyDistanceToTarget.x)**2 + (xyDistanceToTarget.y)**2 );
	    
	    if (Math.pow(shipSpeed,2)*10000 / (distanceToTarget*10) > 64) { // if ship gets too fast and/or too close
		let velocityAngle = Math.atan2(this.velocity.y, this.velocity.x);
		let velocityAngleRelative = normalizeRadians(velocityAngle - this.rotation);

		if (velocityAngleRelative < 0)
		    if (this.angularSpeed < 0.09)  this.angularSpeed += 0.02 * ( 0.1 + Math.min(Math.abs(this.angularSpeed)/10, 0.2) );
		else
		    if (this.angularSpeed > -0.09) this.angularSpeed -= 0.02 * (0.1 + Math.abs(this.angularSpeed)/10 );

		if ( Math.abs(velocityAngleRelative) > Math.PI/1.7 )
		    this.propulse = true;
	    }
	    else { // orient towards mouse
		let angleToTarget = Math.atan2(xyDistanceToTarget.y, xyDistanceToTarget.x);
		let relativeAngleToTarget = normalizeRadians(angleToTarget - this.rotation);
		let rotateAmount = 0.05 * ( Math.pow(relativeAngleToTarget,2) / Math.min(Math.pow(distanceToTarget,2),4) + Math.min(Math.abs(this.angularSpeed)/8, 0.2) );
		if (relativeAngleToTarget > 0) { if (this.angularSpeed < 0.09)  this.angularSpeed += rotateAmount; }
		else                           { if (this.angularSpeed > -0.09) this.angularSpeed -= rotateAmount; }

		let shipToTargetSpeed = distanceToTarget - this.prevDistanceToTarget;
		if (shipToTargetSpeed*1000 / distanceToTarget < 10)
		    if (Math.abs(relativeAngleToTarget) < Math.PI/1.5) // if oriented towards mouse
			this.propulse = true;
	    }
	    this.prevDistanceToTarget = distanceToTarget;
	}
    }

    calcPhysics() {
	if (this.angularSpeed > this.maxAngularSpeed)
	    this.angularSpeed = this.maxAngularSpeed;
	if (this.angularSpeed < -this.maxAngularSpeed)
	    this.angularSpeed = -this.maxAngularSpeed;
	
	if (this.propulse) {
	    this.velocity.x += this.propulsionStrength * Math.cos( this.rotation ) / this.mass;
	    this.velocity.y += this.propulsionStrength * Math.sin( this.rotation ) / this.mass;
	}
    }

    updateState() {
	this.position.x += this.velocity.x;
	this.position.y += this.velocity.y;
	
	if      (this.position.x < 0)                    this.position.x = screenDims.width-25;
	else if (this.position.x > screenDims.width-20)  this.position.x = 5;
	if      (this.position.y < 0)                    this.position.y = screenDims.height-35;
	else if (this.position.y > screenDims.height-30) this.position.y = 5;
	
	this.rotation += this.propulsionStrength * this.angularSpeed / (this.mass*0.6);
	this.rotation = normalizeRadians(this.rotation);
    }

    display(shipEl) {
	if (this.doDisplay) {
	    let onoff = "off";
	    if (this.propulse) { onoff = "on"; }
	    shipEl.innerHTML = '<img src="ship_'+onoff+'.png" width="'+this.size+'" style="transform:rotate('+ this.rotation +'rad);">';
	    shipEl.style.left = this.position.x-this.size/2 + 'px';
	    shipEl.style.top  = this.position.y-this.size/2 + 'px';
	}
    }
}


let shipElement = document.getElementById("spaceship");
let ship2Element = document.getElementById("spaceship2");
let shipSize = 40;
let shipPos = { x: shipElement.getBoundingClientRect().left + shipSize/2,
		y: shipElement.getBoundingClientRect().top  + shipSize/2};
let ship2Pos = { x: ship2Element.getBoundingClientRect().left + shipSize/2,
		 y: ship2Element.getBoundingClientRect().top  + shipSize/2};
spaceship = new Spaceship(shipPos, shipSize, id=0);
spaceship2 = new Spaceship(ship2Pos, shipSize, id=1);

screenDims = { width: Math.max(window.innerWidth, document.body.getBoundingClientRect().width),
	       height: Math.max(window.innerHeight, document.body.getBoundingClientRect().height+25) };



function spaceshipInit() {
    //shipElement.innerHTML = '<img src="ship_off.png" width="'+spaceship.size+'">';
    keyboard.init();
    mouse.init();
    let mainLoop = setInterval(iter, 50); // 50 ms -> 20 f/s
}

function iter() {
    spaceship.playerControl();
    spaceship.automaticControl();
    spaceship.calcPhysics();
    spaceship.updateState();
    spaceship.display(shipElement)

    spaceship2.playerControl();
    spaceship2.automaticControl(spaceship);
    spaceship2.calcPhysics();
    spaceship2.updateState();
    spaceship2.display(ship2Element)
}




var keyboard =
    {
	init : function()
	{
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

var mouse =
    {
	init : function()
	{
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
    return rad
}
