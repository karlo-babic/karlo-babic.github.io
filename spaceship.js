var botSize = 20;
var x = document.getElementById("spaceship").getBoundingClientRect().left+botSize/2;
var y = document.getElementById("spaceship").getBoundingClientRect().top+botSize/2;
var speed = 0;
var screenWidth = Math.max(window.innerWidth, document.body.getBoundingClientRect().width);
var screenHeight = Math.max(window.innerHeight, document.body.getBoundingClientRect().height+25);
var state = 0;
var destination = false;
var text = "";
var textWidth = 0;
var textTop = 0;
var holdingClick = false;
var mouseSpeed = 0;
var pressedKey = false;
var rotate = 0;
var rotate_speed = 0;
var engine = false;
var last_time_control = 0;
var distanceMouse = 0;
var distanceMouse_old;

document.getElementById("spaceship").ondragstart = function() { return false; };

function notxbot_start()
{
    state = 1;
    mouse.init();
    keyboard.init();
    mouse.x = 0;
    mouse.y = 0;
    var bot = document.getElementById("spaceship");
    bot.innerHTML = '<img src="ship_off.png" width="'+botSize+'">';
    var xSpeed = 0, ySpeed = 0;
    var mousePrevXY = [mouse.x, mouse.y];

    var loop = 0;
    var mainloop = setInterval(frame, 50); // 50 ms -> 20 f/s   old 10
    function frame()
    {
	engine = false;
	if (keyboard.keys) // keyboard
	{
	    if (keyboard.keys[37]) rotate_speed -= 1;
	    if (keyboard.keys[39]) rotate_speed += 1;
	    if (keyboard.keys[38]) engine = true;
	}

	last_time_control += 1;
	if (pressedKey)
	    last_time_control = 0;

	screenWidth = Math.max(window.innerWidth, document.body.getBoundingClientRect().width);
	screenHeight = Math.max(window.innerHeight, document.body.getBoundingClientRect().height+25);

	var mouseSpeedX = mouse.x - mousePrevXY[0];
	var mouseSpeedY = mouse.y - mousePrevXY[1];
	mouseSpeed = Math.sqrt(mouseSpeedX**2 + mouseSpeedY**2);
	mousePrevXY = [mouse.x, mouse.y];

	var xDistanceMouse = mouse.x - x;
	var yDistanceMouse = mouse.y - y;
	distanceMouse_old = distanceMouse;
	distanceMouse = Math.sqrt( xDistanceMouse**2 + yDistanceMouse**2 );

	clickedOnBot(distanceMouse); // change state if clicked, and other stuff

	if (state == 1) // moving
	{
	    // if clicked anywhere
	    if (mouse.clickX)
	    {
		if (destination[2] != "element") destination = [mouse.clickX, mouse.clickY, "click"];
		text = "";
	    }
	    if (destination && false) // send to destination
	    {
		var xDistanceDest = destination[0] - x;
		var yDistanceDest = destination[1] - y;
		var distanceDest = Math.sqrt( xDistanceDest**2 + yDistanceDest**2 );
		speed = distanceDest / 20; // old 100
		speed = Math.min(10, speed); // old 2
		if (distanceDest)
		{
		    xSpeed = speed * xDistanceDest / distanceDest;
		    ySpeed = speed * yDistanceDest / distanceDest;
		}
		// stop going towards destination when there
		if (x >= destination[0]-10 && x <= destination[0]+10 &&
		    y >= destination[1]-10 && y <= destination[1]+10)
		    destination = false;
		// run away from mouse if it gets too close
		if (destination[2] == "click" && distanceMouse < 50) destination = false;
	    }
	    else if (last_time_control > 100) // follow mouse
	    {
		let ship_mouse_speed = distanceMouse_old - distanceMouse;
		let ship_speed = Math.sqrt(xSpeed**2 + ySpeed**2);
		let angle_mouse = Math.atan2(yDistanceMouse, xDistanceMouse);
		//let angle_shipspeed = Math.atan2(ySpeed, xSpeed);
		let angle_ship = rotate - 90;
		angle_ship = (360*(angle_ship/360-Math.floor(angle_ship/360))) / 180.*Math.PI;
		if (angle_ship > Math.PI) { angle_ship -= Math.PI*2; }
		let angle_diff = angle_mouse - angle_ship;
		if (angle_diff > Math.PI) { angle_diff -= Math.PI*2; }
		else if (angle_diff < -Math.PI) { angle_diff += Math.PI*2; }

		if (Math.pow(ship_speed,2)*1000 / distanceMouse > 64) // if ship gets too fast and too close
		{
		    let angle_speed = Math.atan2(ySpeed, xSpeed);
		    let angle_speed_diff = angle_speed - angle_ship;
		    if (angle_speed_diff > Math.PI) { angle_speed_diff -= Math.PI*2; }
		    else if (angle_speed_diff < -Math.PI) { angle_speed_diff += Math.PI*2; }

		    if (angle_speed_diff < 0)  { if (rotate_speed < 5)  rotate_speed += 0.1 + Math.min(Math.abs(rotate_speed)/10, 0.2); }
		    else                       { if (rotate_speed > -5) rotate_speed -= 0.1 + Math.abs(rotate_speed)/10; }

		    if ( Math.abs(angle_speed_diff) > Math.PI/1.5 )
			engine = true;
		}
		else
		{
		    // orient towards mouse
		    let rotate_delta = Math.pow(angle_diff,2) / Math.min(Math.pow(distanceMouse,2),4) + Math.min(Math.abs(rotate_speed)/8, 0.2);
		    if (angle_diff > 0)  { if (rotate_speed < 5)  rotate_speed += rotate_delta; }
		    else                 { if (rotate_speed > -5) rotate_speed -= rotate_delta; }

		    if ( ship_mouse_speed*1000 / distanceMouse < 10 )
		    {
			if ( Math.abs(angle_diff) < Math.PI/1.5 ) // if oriented towards mouse
			{
			    engine = true;
			}
		    }
		}
	    }
	}
	else if (state == 2) // standing
	{
	    xSpeed = 0;
	    ySpeed = 0;
	}

	if (holdingClick) // move bot
	{
	    x = mouse.x;
	    y = mouse.y;
	    xSpeed = mouseSpeedX/2;
	    ySpeed = mouseSpeedY/2;
	}

	// updating positon
	rotate += rotate_speed;
	if (engine)
	{
	    xSpeed += 0.2 * Math.cos( (rotate-90)/180.*Math.PI );
	    ySpeed += 0.2 * Math.sin( (rotate-90)/180.*Math.PI );
	}
	x += xSpeed;
	y += ySpeed;
	if (x < 0) x = screenWidth-25;
	else if (x > screenWidth-20) x = 5;
	if (y < 0) y = screenHeight-35;
	else if (y > screenHeight-30) y = 5;
	/*if (x < 0 || x > screenWidth-20)  { x -= xSpeed; xSpeed = 0; }
	if (y < 0 || y > screenHeight-30) { y -= ySpeed; ySpeed = 0; }*/

	botDisplay();

	loop++;
    }
}

function botDisplay()
{
    let bot = document.getElementById("spaceship");

    let onoff = "off";
    if (engine) { onoff = "on"; }
    // text
    if (text === "")
    {
	bot.innerHTML = '<img src="ship_'+onoff+'.png" width="'+botSize+'" style="transform:rotate('+rotate+'deg);">';
	textWidth = 0;
    }
    else if (text !== false)
    {
	bot.innerHTML = '<div id="bot_text" style="background-color: #181818; border-radius: 4px; padding: 2px 2px; color: white; text-align: center; display: inline-block; font-size: 12px;border: 2px solid gray; width:200px">'+text+'</div>' + ' <img src="ship_off.png" width="'+botSize+'">';
	textWidth = 210;
	text = false;
    }

    bot.style.left = x-botSize/2-textWidth + 'px';
    bot.style.top  = y-botSize/2 + 'px';
}

function clickedOnBot(distanceMouse)
{
    if (mouse.clickX && distanceMouse <= botSize/2)
    {
	if (!holdingClick)
	{}
	holdingClick = true;
    }
    if (mouse.clickX && mouse.x && holdingClick) {} // if clicked and moving mouse
    else holdingClick = false; // when not holding anymore
}

function notxbotSendTo(id)
{
    element = document.getElementById(id);
    var dx = element.getBoundingClientRect().left;
    var dy;
    var yTp = element.getBoundingClientRect().top;
    var yBm = element.getBoundingClientRect().bottom;
    if (id.slice(0,2) == "h_") // header
    {
	dx -= 40;
	dy = (yTp + yBm) / 2;
    }
    else if (id.slice(0,2) == "i_") // info
    {
	dx -= 80;
	dy = (yTp + yBm) / 2;
	var about = document.getElementById('about' + id.slice(2,));
	text = about.innerHTML;
    }
    destination = [dx, dy, "element"];
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

var keyboard =
    {
	init : function()
	{
	    // keyboard controls
            window.addEventListener('keydown', function (e) {
		keyboard.keys = (keyboard.keys || []);
		keyboard.keys[e.keyCode] = true;
		pressedKey = e.keyCode;
            })
            window.addEventListener('keyup', function (e) {
		keyboard.keys[e.keyCode] = false;
		pressedKey = false;
            })
	}
    }
