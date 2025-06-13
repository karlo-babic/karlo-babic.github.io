const Eye = {
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
            Eye.state = "";
            TextField.buffer.push({text:"Welcome to Karlo's observatory.", delay:4000});
            setTimeout(Eye._open, 3000);
        },
        "idle" : function() {
            return;
        },
        "closing" : function() {
            return;
        },
        "closed" : function() {
            setTimeout(Eye._open, 200);
        }
    },

    _worldDone : {
        "spaceship" : false
    },

    _stateUpdate : function() {
        if (Eye.iter%Math.round(Math.random()*70+40)==0 && Eye.state == "idle" && Eye.eyelidState == false) {
            Eye.state = "closing";
            Eye._close();
        }

        if (Eye.state != "") {
            Eye._states[Eye.state]();
        }
    },

    _open : function() {
        if (Eye.eyelidState == 4) {
            Eye.eyelidState = false;
        }
        if (Eye.eyelidState != false) {
            Eye.eyelidState += 1;
            setTimeout(Eye._open, 100);
        } else {
            Eye.state = "idle";
        }
    },

    _close : function(howTight=1) {
        if (Eye.eyelidState == false) {
            Eye.eyelidState = 4;
        }
        if (Eye.eyelidState != false && Eye.eyelidState >= 2) {
            Eye.eyelidState -= 1;
            setTimeout(Eye._close, 66);
        } else {
            Eye.state = "closed";
        }
    },

    _checkWorld : function() {
        if (Eye.state != "idle") return;

        if (threebody.bodies) {
            const planetSpeed = Math.sqrt(Math.pow(threebody.bodies[0].velocity.x, 2) + Math.pow(threebody.bodies[0].velocity.y, 2));
            if (planetSpeed > 170) {
                TextField.buffer.push({text:"Gravitational slingshot!", delay:0, speed:40});
            }
        }

        if (Eye.distanceToTarget < 50 && this.iter % 60 == 0) {
            TextField.buffer.push({text:"Stop it.", delay:5, speed:40, time:1000});
        }

        if (spaceship && !Eye._worldDone.spaceship) {
            Eye._worldDone.spaceship = true;
            TextField.buffer.push({text:"Lift off!", delay:5, speed:200, time:4000});
        }
    },

    _eyelidUpdate : function() {
        if (Eye.state != "idle") return;

        if (Eye.distanceToTarget < 50) {
            Eye.eyelidState = 1;
        } else if (Eye.distanceToTarget < 70) {
            Eye.eyelidState = 2;
        } else if (Eye.distanceToTarget < 90) {
            Eye.eyelidState = 3;
        } else if (Eye.distanceToTarget < 110) {
            Eye.eyelidState = 4;
        } else {
            Eye.eyelidState = false;
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
        let eyePos = Eye._getPos();
        let targetPos = {x:0, y:0};
        if (spaceship && spaceship.propulse && Mouse.isMoving == false) {
            targetPos = spaceship.position;
        } else {
            targetPos = {x:Mouse.x, y:Mouse.y};
        }
        let targetRelativePos = {
            x : targetPos.x - eyePos.x,
            y : targetPos.y - eyePos.y
        };
        Eye.distanceToTarget = Math.sqrt(targetRelativePos.x**2 + targetRelativePos.y**2)
        let targetNormPos = {
            x : targetRelativePos.x / Eye.distanceToTarget,
            y : targetRelativePos.y / Eye.distanceToTarget,
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
        if (!isNaN(pupilPos.x) && (Mouse.isMoving || spaceship && spaceship.propulse)) {
            for (let y=0; y<pupilArray.length; y++) {
                for (let x=0; x<pupilArray[0].length; x++) {
                    if (Math.abs(pupilPos.x - x) < 2 && Math.abs(pupilPos.y - y) < 2) {
                        pupilArray[y][x] = 1;
                    }
                }
            }
        } else {
            pupilArray = [[0,0,0,0], [0,1,1,0], [0,1,1,0], [0,0,0,0]];
        }
        return pupilArray;
    },

    _render : function(pupilPos) {
        let pupilArray = Eye._calcPupilArray(pupilPos);

        let eyeText = "";
        if (Eye.eyelidState == 1) {
            eyeText = Eye.EYELID_TEXT[1];
        } else {
            eyeText = "";
            for (let y=0; y<4; y++) {
                for (let x=0; x<4; x++) {
                    if (x==0 && y==0 || x==3 && y==3 || x==3 && y==0 || x==0 && y==3) {
                        eyeText += "  ";
                    } else if (Eye.eyelidState != false && Eye.EYELID_TEXT[Eye.eyelidState][y].charAt(x) != "-") {
                        eyeText += " " + Eye.EYELID_TEXT[Eye.eyelidState][y].charAt(x);
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
        Eye._checkWorld();
        Eye._stateUpdate();
        Eye._eyelidUpdate();
        let pupilPos = Eye._calcPupilPos();
        Eye._render(pupilPos);
        setTimeout(Eye.loop, Eye.ANIMATE_SPEED);
        Mouse.isMoving = false;
        Eye.iter += 1;
    }
};



// --------------------------------------------------------------------- //



const TextField = {
    isWriting : false,
    buffer : [],

    _clearText : function() {
        document.getElementById("eyeSpeech").innerHTML = " ";
        TextField.isWriting = false;
    },
    
    _typeWriter : function(text, speed, time, i) {
        if (i < text.length) {
            document.getElementById("eyeSpeech").innerHTML += text.charAt(i);
            i++;
            setTimeout(TextField._typeWriter, speed, text, speed, time, i);
        } else {
            setTimeout(TextField._clearText, time);
        }
    },
    
    _write : function(text, delay=0, speed=100, time=4000, actionFunction=null, isQuestion=false) {
        TextField.isWriting = true;
        if (delay > 0) {
            setTimeout(TextField._write, delay, text, delay=0, speed, time);
        } else {
            TextField._typeWriter(text, speed, time, i=0);
        }
    },

    loop : function() {
        if (TextField.isWriting == false && TextField.buffer.length > 0) {
            let args = TextField.buffer.shift();
            TextField._write(args.text, args.delay, args.speed, args.time, args.actionFunction, args.isQuestion);
        }
        setTimeout(TextField.loop, 1000);
    }
};



// --------------------------------------------------------------------- //


// The initial HTML is now in index.html, so this line is no longer needed.
Eye.loop();
TextField.loop();