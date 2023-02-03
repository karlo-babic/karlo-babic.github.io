var mouse = {
    init : function() {
	    // mouse controls
	    window.addEventListener('mousemove', function (e) {
            mouse.x = e.pageX;
            mouse.y = e.pageY;
            mouse.moving = true;
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
};
mouse.init();

// --------------------------------------------------------------------- //

let eye = {
    ANIMATE_SPEED : 100,
    INIT_TEXT : "  - -  \n- o o -\n- o o -\n  - -  ",

    _getPos : function() {
        let eyePos = document.getElementById("eye").getBoundingClientRect();
        eyePos = {
            x : (eyePos.left + eyePos.right) / 2,
            y : (eyePos.top + eyePos.bottom) / 2
        };
        return eyePos;
    },
    
    _calcPupilPos : function() {
        let eyePos = eye._getPos();
        let targetPos = {x:0, y:0};
        if (spaceship.propulse && mouse.moving == false) {
            targetPos = spaceship.position;
        } else {
            targetPos = {x:mouse.x, y:mouse.y};
        }
        let targetRelativePos = {
            x : targetPos.x - eyePos.x,
            y : targetPos.y - eyePos.y
        };
        let distance = Math.sqrt(targetRelativePos.x**2 + targetRelativePos.y**2)
        let targetNormPos = {
            x : targetRelativePos.x / distance,
            y : targetRelativePos.y / distance,
        };
        let pupilDistance = {
            x : Math.min(Math.abs(targetRelativePos.x/10), 2),
            y : Math.min(Math.abs(targetRelativePos.y/10), 2),
        };
        let pupilPos = {
            x : Math.floor( (targetNormPos.x)*pupilDistance.x+2 ),
            y : Math.floor( (targetNormPos.y)*pupilDistance.y+2 )
        };
        return pupilPos;
    },
    
    _render : function(pupilPos) {
        if (isNaN(pupilPos.x)) return;
    
        let eyeText = "";
        for (let y=0; y<4; y++) {
            for (let x=0; x<4; x++) {
                if (x==0 && y==0 || x==3 && y==3 || x==3 && y==0 || x==0 && y==3) eyeText += "  ";
                else if (Math.abs(pupilPos.x - x) < 2 && Math.abs(pupilPos.y - y) < 2) eyeText += " o";
                else eyeText += " -";
            }
            eyeText += " \n";
        }
    
        document.getElementById("eye").innerHTML = eyeText;
    },
    
    animationLoop : function() {
        let pupilPos = eye._calcPupilPos();
        eye._render(pupilPos);
        setTimeout(eye.animationLoop, eye.ANIMATE_SPEED);
        mouse.moving = false;
    }
};

// --------------------------------------------------------------------- //

let textField = {
    isWriting : false,
    buffer : [],
    state : "start",

    _clearText : function() {
        document.getElementById("eyeSpeech").innerHTML = "&nbsp;";
        textField.isWriting = false;
    },
    
    _typeWriter : function(text, speed, time, i) {
        if (i < text.length) {
            document.getElementById("eyeSpeech").innerHTML += text.charAt(i);
            i++;
            setTimeout(textField._typeWriter, speed, text, speed, time, i);
        } else {
            setTimeout(textField._clearText, time);
        }
    },
    
    _write : function(text, delay=0, speed=100, time=4000, actionFunction=null, isQuestion=false) {
        textField.isWriting = true;
        if (delay > 0) {
            setTimeout(textField._write, delay, text, delay=0, speed, time);
        } else {
            textField._typeWriter(text, speed, time, i=0);
        }
    },

    _states : {
        "start" : function() {
            textField.buffer.push({text:"Welcome to Karlo's observatory.", delay:4000});
            textField.state = "";
        }
    },

    writeLoop : function() {
        if (textField.state != "") textField._states[textField.state]();
        if (textField.isWriting == false && textField.buffer.length > 0) {
            let args = textField.buffer.shift();
            textField._write(args.text, args.delay, args.speed, args.time, args.actionFunction, args.isQuestion);
        }
        setTimeout(textField.writeLoop, 1000);
    }
};

// --------------------------------------------------------------------- //

document.getElementById("eye").innerHTML = eye.INIT_TEXT;
eye.animationLoop();
textField.writeLoop();
