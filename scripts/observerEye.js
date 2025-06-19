import { Mouse } from './utils.js';
import { AppEvents } from './utils.js';
import { spaceship } from './spaceship.js';
// Note: spaceship is a circular dependency here. It's better if Eye doesn't know about spaceship directly.
// We will leave it for now, but this could be improved later with more event-driven logic.

export const TextField = {
    isWriting: false,
    buffer: [],

    _clearText: function () {
        document.getElementById("eyeSpeech").innerHTML = " ";
        TextField.isWriting = false;
    },

    _typeWriter: function (text, speed, time, i) {
        if (i < text.length) {
            document.getElementById("eyeSpeech").innerHTML += text.charAt(i);
            i++;
            setTimeout(TextField._typeWriter, speed, text, speed, time, i);
        } else {
            setTimeout(TextField._clearText, time);
        }
    },

    _write: function (text, delay = 0, speed = 100, time = 4000, actionFunction = null, isQuestion = false) {
        TextField.isWriting = true;
        if (delay > 0) {
            setTimeout(TextField._write, delay, text, 0, speed, time);
        } else {
            TextField._typeWriter(text, speed, time, 0);
        }
    },

    update: function () {
        if (this.isWriting == false && this.buffer.length > 0) {
            let args = this.buffer.shift();
            this._write(args.text, args.delay, args.speed, args.time, args.actionFunction, args.isQuestion);
        }
    }
};

export const Eye = {
    // --- Constants ---
    LERP_FACTOR: 0.2, // Controls the smoothness of the pupil's movement. Lower is slower.
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
    smoothedLookPos: null, // The smoothed position the eye is looking at, for fluid animation.
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
        // Randomly blink if the eye is idle and open
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
        if (Eye.eyelidState !== Eye.EYELID_STATES.OPEN && Eye.eyelidState > Eye.EYELID_STATES.CLOSED) {
            Eye.eyelidState -= 1;
            setTimeout(Eye._close, 66);
        } else {
            Eye.state = "closed";
        }
    },

    _checkWorld: function () {
        if (Eye.state != "idle") return;

        // Complain if the mouse gets too close
        if (this.distanceToTarget < 50 && this.iter % 60 == 0) {
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

        // Squint based on proximity to the mouse cursor
        if (this.distanceToTarget < this.DISTANCE_THRESHOLDS.CLOSED) {
            this.eyelidState = this.EYELID_STATES.CLOSED;
        } else if (this.distanceToTarget < this.DISTANCE_THRESHOLDS.SQUINT_HARD) {
            this.eyelidState = this.EYELID_STATES.SQUINT_HARD;
        } else if (this.distanceToTarget < this.DISTANCE_THRESHOLDS.SQUINT_MEDIUM) {
            this.eyelidState = this.EYELID_STATES.SQUINT_MEDIUM;
        } else if (this.distanceToTarget < this.DISTANCE_THRESHOLDS.SQUINT_LIGHT) {
            this.eyelidState = this.EYELID_STATES.SQUINT_LIGHT;
        } else {
            this.eyelidState = this.EYELID_STATES.OPEN;
        }
    },

    _getPos: function () {
        const eyeRect = document.getElementById("eye").getBoundingClientRect();
        return {
            x: (eyeRect.left + eyeRect.right) / 2,
            y: (eyeRect.top + eyeRect.bottom) / 2
        };
    },

    _getLookTarget: function (eyePos) {
        if (Mouse.isMoving) {
            return { x: Mouse.x, y: Mouse.y };
        }
        if (spaceship && spaceship.propulse) {
            return spaceship.position;
        }
        // If no active target, the target is the eye's own center,
        // causing the pupil to smoothly return to the middle.
        return eyePos;
    },

    _updateSmoothedLookPos: function (lookTarget) {
        // On the first valid position, snap to it to prevent the eye from flying across the screen
        if (!this.smoothedLookPos) {
            this.smoothedLookPos = { ...lookTarget };
            return;
        }

        // Use linear interpolation (lerp) to smoothly move the eye's gaze to the target
        this.smoothedLookPos.x += (lookTarget.x - this.smoothedLookPos.x) * this.LERP_FACTOR;
        this.smoothedLookPos.y += (lookTarget.y - this.smoothedLookPos.y) * this.LERP_FACTOR;
    },

    _calcPupilPos: function (eyePos, lookPos) {
        if (!lookPos) {
            return { x: NaN, y: NaN };
        }

        const targetRelativePos = {
            x: lookPos.x - eyePos.x,
            y: lookPos.y - eyePos.y
        };
        const distance = Math.sqrt(targetRelativePos.x ** 2 + targetRelativePos.y ** 2);

        // If the target is at the center of the eye, return NaN to trigger the default centered pupil.
        if (distance < 1) { // Use a small threshold to prevent jittering
            return { x: NaN, y: NaN };
        }

        const targetNormPos = {
            x: targetRelativePos.x / distance,
            y: targetRelativePos.y / distance,
        };

        // The pupil's 2x2 block moves within a 3x3 grid for its top-left corner.
        // Max travel distance from the center (1,1) is 1 unit.
        // The divisor controls sensitivity (how far the mouse must be to move the pupil to the edge).
        const SENSITIVITY_RADIUS = 30;
        const travelDistance = Math.min(distance / SENSITIVITY_RADIUS, 1);

        // Calculate the top-left corner of the 2x2 pupil block. Center is (1,1). Range is [0, 2].
        return {
            x: Math.round(targetNormPos.x * travelDistance + 1),
            y: Math.round(targetNormPos.y * travelDistance + 1)
        };
    },

    _calcPupilArray: function (pupilPos) {
        // Fallback to a centered pupil if position is invalid (e.g., on initialization or when centered)
        if (isNaN(pupilPos.x) || isNaN(pupilPos.y)) {
            return [[0, 0, 0, 0], [0, 1, 1, 0], [0, 1, 1, 0], [0, 0, 0, 0]];
        }

        let pupilArray = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
        const px = pupilPos.x;
        const py = pupilPos.y;

        // Draw a 2x2 pupil at the calculated top-left position, ensuring it's within bounds.
        if (px >= 0 && px < 3 && py >= 0 && py < 3) {
             pupilArray[py][px] = 1;
             pupilArray[py+1][px] = 1;
             pupilArray[py][px+1] = 1;
             pupilArray[py+1][px+1] = 1;
        } else {
             // If out of bounds, draw the centered pupil as a safe fallback.
             return [[0, 0, 0, 0], [0, 1, 1, 0], [0, 1, 1, 0], [0, 0, 0, 0]];
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
                    // Render corners as empty space
                    if ((x === 0 || x === 3) && (y === 0 || y === 3)) {
                        eyeText += "  ";
                    // Render eyelid characters if not fully open
                    } else if (this.eyelidState !== this.EYELID_STATES.OPEN && this.EYELID_TEXT[this.eyelidState][y].charAt(x) !== "-") {
                        eyeText += " " + this.EYELID_TEXT[this.eyelidState][y].charAt(x);
                    // Render pupil
                    } else if (pupilArray[y][x] === 1) {
                        eyeText += " o";
                    // Render empty eyeball space
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
        const eyePos = this._getPos();

        // Calculate distance to the mouse for proximity-based reactions like squinting.
        const dx = eyePos.x - Mouse.x;
        const dy = eyePos.y - Mouse.y;
        this.distanceToTarget = Math.sqrt(dx * dx + dy * dy);
        
        // Determine the target for the eye to look at (mouse, spaceship, or center).
        const lookTarget = this._getLookTarget(eyePos);

        // Update the eye's general state (blinking, squinting).
        this._checkWorld();
        this._stateUpdate();
        this._eyelidUpdate(); 

        // Smoothly update the position the eye is looking toward.
        this._updateSmoothedLookPos(lookTarget);

        // Calculate and render the pupil based on the smoothed position.
        const pupilPos = this._calcPupilPos(eyePos, this.smoothedLookPos);
        this._render(pupilPos);

        this.iter += 1;
    }
};