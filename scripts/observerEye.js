import { Mouse } from './utils.js';
import { AppEvents } from './utils.js';
import { spaceship } from './spaceship.js'; 
// Note: spaceship is a circular dependency here. It's better if Eye doesn't know about spaceship directly.
// We will leave it for now, but this could be improved later with more event-driven logic.

export const TextField = {
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
            setTimeout(TextField._write, delay, text, 0, speed, time);
        } else {
            TextField._typeWriter(text, speed, time, 0);
        }
    },

    update : function() {
        if (this.isWriting == false && this.buffer.length > 0) {
            let args = this.buffer.shift();
            this._write(args.text, args.delay, args.speed, args.time, args.actionFunction, args.isQuestion);
        }
    }
};

export const Eye = {
    // --- Constants ---
    ANIMATE_SPEED: 100,
    EYELID_STATES: {
        CLOSED: 1,
        SQUINT_HARD: 2,
        SQUINT_MEDIUM: 3,
        SQUINT_LIGHT: 4,
        OPEN: false
    },
    DISTANCE_THRESHOLDS: {
        CLOSED: 50,
        SQUINT_HARD: 70,
        SQUINT_MEDIUM: 90,
        SQUINT_LIGHT: 110,
    },
    EYELID_TEXT: {
        1: "       \n       \n= = = =\n       ", // CLOSED
        2: ["    ", "    ", "----", "    "],    // SQUINT_HARD
        3: ["    ", "    ", "----", " -- "],    // SQUINT_MEDIUM
        4: ["    ", "----", "----", " -- "]     // SQUINT_LIGHT
    },

    // --- State ---
    iter: 0,
    state: "init",
    eyelidState: 1, // Start with EYELID_STATES.CLOSED
    distanceToTarget: 0,
    _worldDone: { "spaceship": false },

    _states: {
        "init": function () {
            Eye.state = "";
            TextField.buffer.push({ text: "Welcome to Karlo's observatory.", delay: 4000 });
            setTimeout(Eye._open, 3000);
        },
        "idle": function () { return; },
        "closing": function () { return; },
        "closed": function () {
            setTimeout(Eye._open, 200);
        }
    },

    _stateUpdate: function () {
        if (Eye.iter % Math.round(Math.random() * 70 + 40) == 0 && Eye.state == "idle" && Eye.eyelidState === this.EYELID_STATES.OPEN) {
            Eye.state = "closing";
            Eye._close();
        }
        if (Eye.state != "") {
            Eye._states[Eye.state]();
        }
    },

    _open: function () {
        if (Eye.eyelidState === Eye.EYELID_STATES.SQUINT_LIGHT) {
            Eye.eyelidState = Eye.EYELID_STATES.OPEN;
        }
        if (Eye.eyelidState !== Eye.EYELID_STATES.OPEN) {
            Eye.eyelidState += 1;
            setTimeout(Eye._open, 100);
        } else {
            Eye.state = "idle";
        }
    },

    _close: function () {
        if (Eye.eyelidState === Eye.EYELID_STATES.OPEN) {
            Eye.eyelidState = Eye.EYELID_STATES.SQUINT_LIGHT;
        }
        if (Eye.eyelidState !== Eye.EYELID_STATES.OPEN && Eye.eyelidState >= Eye.EYELID_STATES.SQUINT_HARD) {
            Eye.eyelidState -= 1;
            setTimeout(Eye._close, 66);
        } else {
            Eye.state = "closed";
        }
    },

    _checkWorld: function () {
        if (Eye.state != "idle") return;

        if (Eye.distanceToTarget < 50 && this.iter % 60 == 0) {
            TextField.buffer.push({ text: "Stop it.", delay: 5, speed: 40, time: 1000 });
        }
    },

    handleLiftoff: function () {
        if (!this._worldDone.spaceship) {
            this._worldDone.spaceship = true;
            TextField.buffer.push({ text: "Lift off!", delay: 5, speed: 200, time: 4000 });
        }
    },

    handleSlingshot: function () {
        TextField.buffer.push({ text: "Gravitational slingshot!", delay: 0, speed: 40 });
    },

    _eyelidUpdate: function () {
        if (Eye.state != "idle") return;

        if (Eye.distanceToTarget < this.DISTANCE_THRESHOLDS.CLOSED) {
            Eye.eyelidState = this.EYELID_STATES.CLOSED;
        } else if (Eye.distanceToTarget < this.DISTANCE_THRESHOLDS.SQUINT_HARD) {
            Eye.eyelidState = this.EYELID_STATES.SQUINT_HARD;
        } else if (Eye.distanceToTarget < this.DISTANCE_THRESHOLDS.SQUINT_MEDIUM) {
            Eye.eyelidState = this.EYELID_STATES.SQUINT_MEDIUM;
        } else if (Eye.distanceToTarget < this.DISTANCE_THRESHOLDS.SQUINT_LIGHT) {
            Eye.eyelidState = this.EYELID_STATES.SQUINT_LIGHT;
        } else {
            Eye.eyelidState = this.EYELID_STATES.OPEN;
        }
    },

    _getPos: function () {
        let eyePos = document.getElementById("eye").getBoundingClientRect();
        return {
            x: (eyePos.left + eyePos.right) / 2,
            y: (eyePos.top + eyePos.bottom) / 2
        };
    },

    _calcPupilPos: function () {
        let eyePos = Eye._getPos();
        let targetPos = { x: 0, y: 0 };
        if (spaceship && spaceship.propulse && !Mouse.isMoving) {
            targetPos = spaceship.position;
        } else {
            targetPos = { x: Mouse.x, y: Mouse.y };
        }
        let targetRelativePos = {
            x: targetPos.x - eyePos.x,
            y: targetPos.y - eyePos.y
        };
        Eye.distanceToTarget = Math.sqrt(targetRelativePos.x ** 2 + targetRelativePos.y ** 2)
        let targetNormPos = {
            x: targetRelativePos.x / Eye.distanceToTarget,
            y: targetRelativePos.y / Eye.distanceToTarget,
        };
        let pupilDistance = {
            x: Math.min(Math.abs(targetRelativePos.x / 10), 2),
            y: Math.min(Math.abs(targetRelativePos.y / 10), 2),
        };
        return {
            x: Math.floor((targetNormPos.x) * pupilDistance.x + 2),
            y: Math.floor((targetNormPos.y) * pupilDistance.y + 2)
        };
    },

    _calcPupilArray: function (pupilPos) {
        let pupilArray = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
        if (!isNaN(pupilPos.x) && (Mouse.isMoving || (spaceship && spaceship.propulse))) {
            for (let y = 0; y < pupilArray.length; y++) {
                for (let x = 0; x < pupilArray[0].length; x++) {
                    if (Math.abs(pupilPos.x - x) < 2 && Math.abs(pupilPos.y - y) < 2) {
                        pupilArray[y][x] = 1;
                    }
                }
            }
        } else {
            pupilArray = [[0, 0, 0, 0], [0, 1, 1, 0], [0, 1, 1, 0], [0, 0, 0, 0]];
        }
        return pupilArray;
    },

    _render: function (pupilPos) {
        const pupilArray = this._calcPupilArray(pupilPos);
        let eyeText = "";
        
        if (this.eyelidState === this.EYELID_STATES.CLOSED) {
            eyeText = this.EYELID_TEXT[this.EYELID_STATES.CLOSED];
        } else {
            for (let y = 0; y < 4; y++) {
                for (let x = 0; x < 4; x++) {
                    if (x === 0 && y === 0 || x === 3 && y === 3 || x === 3 && y === 0 || x === 0 && y === 3) {
                        eyeText += "  ";
                    } else if (this.eyelidState !== this.EYELID_STATES.OPEN && this.EYELID_TEXT[this.eyelidState][y].charAt(x) !== "-") {
                        eyeText += " " + this.EYELID_TEXT[this.eyelidState][y].charAt(x);
                    } else if (pupilArray[y][x] === 1) {
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

    start: function () {
        AppEvents.on('spaceship:liftoff', this.handleLiftoff.bind(this));
        AppEvents.on('threebody:slingshot', this.handleSlingshot.bind(this));
    },

    update: function () {
        this._checkWorld();
        this._stateUpdate();
        this._eyelidUpdate();
        let pupilPos = this._calcPupilPos();
        this._render(pupilPos);
        this.iter += 1;
    }
};
