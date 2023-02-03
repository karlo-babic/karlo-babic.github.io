class Spaceship {
    position = {x: 0, y: 0};
    SIZE = 12;
    
    velocity = {x: 0, y: 0};
    rotation = 0;
    angularSpeed = 0;
    propulse = false;
    PROPULSION_STRENGTH = 0.8;
    MASS = 10;
    MAX_ANGULAR_SPEED = 0.5;
    
    itersWithoutControl = 0;
    MAX_ITERS_WITHOUT_CONTROL = 100;
    prevDistanceToTarget = 0;
    
    constructor(position, size) {
		this.position = position;
		this.SIZE = size;
    }

    playerControl() {
		this.propulse = false;
		if (!keyboard.keys) { this.itersWithoutControl = 0; return; }
		if (keyboard.keys[37] || keyboard.keys[39] || keyboard.keys[38]) {
			this.itersWithoutControl = 0;
			
			if (keyboard.keys[37]) this.angularSpeed -= 0.02;
			if (keyboard.keys[39]) this.angularSpeed += 0.02;
			if (keyboard.keys[38]) this.propulse = true;
		} else {
			this.itersWithoutControl += 1;
		}
	}

    automaticControl() {
		if (this.itersWithoutControl <= this.MAX_ITERS_WITHOUT_CONTROL) return;  // user is controlling it
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
		this.velocity.y += 0.003 * this.MASS;
    }

    updateState() {
		this.position.x += this.velocity.x;
		this.position.y += this.velocity.y;
		
		if      (this.position.x < 0)                    this.position.x = screenDims.width-25;
		else if (this.position.x > screenDims.width-20)  this.position.x = 5;
		if      (this.position.y < 0)                    this.position.y = screenDims.height-35;
		else if (this.position.y > screenDims.height-30) this.position.y = 5;
	
		this.rotation += this.PROPULSION_STRENGTH * this.angularSpeed / (this.MASS*0.3);
		this.rotation = normalizeRadians(this.rotation);
    }

    display(shipEl) {
		let onoff = "off";
		if (this.propulse) { onoff = "on"; }
		shipEl.innerHTML = '<img src="ship_'+onoff+'.png" width="'+this.SIZE+'" style="transform:rotate('+ this.rotation +'rad);">';
		shipEl.style.left = this.position.x-this.SIZE/2 + 'px';
		shipEl.style.top  = this.position.y-this.SIZE/2 + 'px';
	}
}






let shipElement = document.getElementById("spaceship");
let shipSize = 12;
let shipPos = {
	x: shipElement.getBoundingClientRect().left + shipSize/2,
	y: shipElement.getBoundingClientRect().top  + shipSize/2
};
let spaceship = new Spaceship(shipPos, shipSize);

screenDims = { 
	width: Math.max(window.innerWidth, document.body.getBoundingClientRect().width),
	height: Math.max(window.innerHeight, document.body.getBoundingClientRect().height+25)
};



function spaceshipInit() {
    //shipElement.innerHTML = '<img src="ship_off.png" width="'+spaceship.size+'">';
    keyboard.init();
    mouse.init();
    let mainLoop = setInterval(iter, 20); // 50 ms -> 20 f/s
}

function iter() {
    spaceship.playerControl();
    spaceship.automaticControl();
    spaceship.calcPhysics();
    spaceship.updateState();
    spaceship.display(shipElement)
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
