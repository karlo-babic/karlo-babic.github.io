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
    EYELID_TEXT : {
        1 : "       \n       \n= = = =\n       ",
        2 : ["    ", "    ", "----", "    "],
        3 : ["    ", "    ", "----", " -- "],
        4 : ["    ", "----", "----", " -- "]
    },
    iter : 0,
    state : "init",
    eyelidState : 1,
    distanceToTarget : 0,

    _states : {
        "init" : function() {
            eye.state = "";
            textField.buffer.push({text:"Welcome to Karlo's observatory.", delay:4000});
            setTimeout(eye._open, 3000);
        },
        "idle" : function() {
            return;
        },
        "closing" : function() {
            return;
        },
        "closed" : function() {
            setTimeout(eye._open, 200);
        }
    },

    _stateUpdate : function() {
        let time = eye.iter * eye.ANIMATE_SPEED;
        if (eye.iter%Math.round(Math.random()*100+40)==0 && eye.state == "idle") {
            eye.state = "closing";
            eye._close();
        }

        if (eye.state != "") {
            eye._states[eye.state]();
        }
    },

    _open : function() {
        if (eye.eyelidState == 4) {
            eye.eyelidState = false;
        }
        if (eye.eyelidState != false) {
            eye.eyelidState += 1;
            setTimeout(eye._open, 100);
        } else {
            eye.state = "idle";
        }
    },

    _close : function(howTight=1) {
        if (eye.eyelidState == false) {
            eye.eyelidState = 4;
        }
        if (eye.eyelidState != false && eye.eyelidState >= 2) {
            eye.eyelidState -= 1;
            setTimeout(eye._close, 66);
        } else {
            eye.state = "closed";
        }
    },

    _eyelidUpdate : function() {
        if (eye.state != "idle") return;

        if (eye.distanceToTarget < 50) {
            eye.eyelidState = 1;
        } else if (eye.distanceToTarget < 80) {
            eye.eyelidState = 2;
        } else if (eye.distanceToTarget < 120) {
            eye.eyelidState = 3;
        } else if (eye.distanceToTarget < 160) {
            eye.eyelidState = 4;
        } else {
            eye.eyelidState = false;
        }
    },

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
        eye.distanceToTarget = Math.sqrt(targetRelativePos.x**2 + targetRelativePos.y**2)
        let targetNormPos = {
            x : targetRelativePos.x / eye.distanceToTarget,
            y : targetRelativePos.y / eye.distanceToTarget,
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
    
    _calcPupilArray : function(pupilPos) {
        let pupilArray = [[0,0,0,0], [0,0,0,0], [0,0,0,0], [0,0,0,0]];
        if (isNaN(pupilPos.x)) {
            pupilArray = [[0,0,0,0], [0,1,1,0], [0,1,1,0], [0,0,0,0]];;
        } else {
            for (let y=0; y<pupilArray.length; y++) {
                for (let x=0; x<pupilArray[0].length; x++) {
                    if (Math.abs(pupilPos.x - x) < 2 && Math.abs(pupilPos.y - y) < 2) {
                        pupilArray[y][x] = 1;
                    }
                }
            }
        }
        return pupilArray;
    },

    _render : function(pupilPos) {
        let pupilArray = eye._calcPupilArray(pupilPos);

        let eyeText = "";
        if (eye.eyelidState == 1) {
            eyeText = eye.EYELID_TEXT[1];
        } else {
            eyeText = "";
            for (let y=0; y<4; y++) {
                for (let x=0; x<4; x++) {
                    if (x==0 && y==0 || x==3 && y==3 || x==3 && y==0 || x==0 && y==3) {
                        eyeText += "  ";
                    } else if (eye.eyelidState != false && eye.EYELID_TEXT[eye.eyelidState][y].charAt(x) != "-") {
                        eyeText += " " + eye.EYELID_TEXT[eye.eyelidState][y].charAt(x);
                    } else if (pupilArray[y][x] == 1) {
                        eyeText += " o";
                    } else {
                        eyeText += " -";
                    }
                }
                eyeText += " \n";
            }
        }
    
        document.getElementById("eye").innerHTML = eyeText;
    },
    
    loop : function() {
        eye._stateUpdate();
        eye._eyelidUpdate();
        let pupilPos = eye._calcPupilPos();
        eye._render(pupilPos);
        setTimeout(eye.loop, eye.ANIMATE_SPEED);
        mouse.moving = false;
        eye.iter += 1;
    }
};

// --------------------------------------------------------------------- //

let textField = {
    isWriting : false,
    buffer : [],

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

    loop : function() {
        if (textField.isWriting == false && textField.buffer.length > 0) {
            let args = textField.buffer.shift();
            textField._write(args.text, args.delay, args.speed, args.time, args.actionFunction, args.isQuestion);
        }
        setTimeout(textField.loop, 1000);
    }
};

// --------------------------------------------------------------------- //

document.getElementById("eye").innerHTML = eye.EYELID_TEXT[1];
eye.loop();
textField.loop();
