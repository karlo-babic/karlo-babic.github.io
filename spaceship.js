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
	screenWidth = Math.max(window.innerWidth, document.body.getBoundingClientRect().width);
	screenHeight = Math.max(window.innerHeight, document.body.getBoundingClientRect().height+25);

	var mouseSpeedX = mousePrevXY[0] - mouse.x;
	var mouseSpeedY = mousePrevXY[1] - mouse.y;
	mouseSpeed = Math.sqrt(mouseSpeedX**2 + mouseSpeedY**2);
	mousePrevXY = [mouse.x, mouse.y];

	var xDistanceMouse = mouse.x - x;
	var yDistanceMouse = mouse.y - y;
	var distanceMouse = Math.sqrt( xDistanceMouse**2 + yDistanceMouse**2 );

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
		var xDistanceMouse = mouse.x - x;
		var yDistanceMouse = mouse.y - y;
		var distanceMouse = Math.sqrt( xDistanceMouse**2 + yDistanceMouse**2 );
		if (destination[2] == "click" && distanceMouse < 50) destination = false;
	    }
	    else if (false)  // follow or run from mouse
	    {
		if (mouseSpeed > 10)
		{
		    speed = (distanceMouse - 300) / 40; // old 200
		    speed = Math.min(10, speed); // old 2
		    if (distanceMouse != 0)
		    {
			xSpeed = speed * xDistanceMouse / distanceMouse;
			ySpeed = speed * yDistanceMouse / distanceMouse;
		    }
		}
		//if (Math.abs(xSpeed) < 0.01) xSpeed = 0;
		//if (Math.abs(ySpeed) < 0.01) ySpeed = 0;
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
	}

	engine = false;
	if (keyboard.keys) // keyboard
	{
	    if (keyboard.keys[37]) rotate_speed -= 1;
	    if (keyboard.keys[39]) rotate_speed += 1;
	    if (keyboard.keys[38]) engine = true;
	}

	// updating positon
	rotate += rotate_speed;
	if (engine)
	{
	    xSpeed += 0.3 * Math.cos( (rotate-90)/180.*Math.PI );
	    ySpeed += 0.3 * Math.sin( (rotate-90)/180.*Math.PI );
	}
	x += xSpeed;
	y += ySpeed;
	if (x < 0) x = screenWidth-5;
	else if (x > screenWidth) x = 5;
	if (y < 0) y = screenHeight-5;
	else if (y > screenHeight) y = 5;

	botDisplay();

	loop++;
    }
}

function botDisplay()
{
    var bot = document.getElementById("spaceship");
    // text
    if (text === "")
    {
	bot.innerHTML = '<img src="ship_off.png" width="'+botSize+'" style="transform:rotate('+rotate+'deg);">';
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
