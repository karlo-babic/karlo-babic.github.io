import { Keyboard, Mouse, getScreenSize } from './utils.js';

// Preload asset
const img = new Image();
img.src = "imgs/paper.png";

// --- Physics Constants ---
const GRAVITY = 9;
const AIR_DENSITY = 1.2;
const MASS = 5;
const FRACTURES_FACTOR = 0.2;

// --- Control Constants ---
const AIR_RESISTANCE = 0.1;
const ROTATION_SMOOTHNESS = 0.01;
const ROTATION_BOUNDRY = 0.3;
const ROTATION_FACTOR = 0.05;

// --- Autopilot Constants ---
const AUTO_IDLE_DELAY = 1.5;

// --- Combat Constants ---
const MAX_HEALTH = 100;
const KILL_SPEED_THRESHOLD = 12; // Speed required to be lethal
const KILL_ANGLE_THRESHOLD = 0.4; // Radians (~23 degrees). Reduced from 0.8 to require precision.
const COLLISION_DISTANCE = 40;

// Track additional players
const secondaryPapers = [];

class Paper {
    active = false;
    docElement = null;

    // Physics State
    position = { x: 0, y: 0 };
    origin = { x: 0, y: 0 }; // Stores the initial spawn point
    velocity = { x: 0, y: 0 };
    rotation = 0; // radians
    rotationForce = 0;
    
    // Autopilot State
    idleTimer = AUTO_IDLE_DELAY;

    // Dimensions
    size = { width: 0, height: 0 };

    // Input Configuration
    inputMap = { left: "ArrowLeft", right: "ArrowRight" };

    constructor(docElement, inputMap = null) {
        this.docElement = docElement;
        if (inputMap) {
            this.inputMap = inputMap;
        }
    }

    activate() {
        if (this.active) return;
        this.active = true;

        const rect = this.docElement.getBoundingClientRect();
        this.size.width = rect.width || 30;
        this.size.height = rect.height || 30;

        // Calculate absolute position on page
        let startX = rect.left + window.scrollX + rect.width / 2;
        let startY = rect.top + window.scrollY + rect.height / 2;

        // If this is a secondary paper spawned dynamically (likely at 0,0), 
        // use the main paper's origin if available to ensure shared spawn point.
        if (paper?.origin?.x) {
            this.origin = { ...paper.origin };
        } else {
            this.origin = { x: startX, y: startY };
        }

        this.position = { ...this.origin };

        this.docElement.style.position = 'fixed';
        this.docElement.style.margin = '0';
        this.docElement.style.zIndex = '1000';
    }

    respawn() {
        // Return to the point of origin
        this.position.x = this.origin.x;
        this.position.y = this.origin.y;
        this.velocity = { x: 0, y: 0 };
        this.rotation = 0;
        this.rotationForce = 0;
        this.idleTimer = 0;
    }

    update(deltaTime) {
        if (!this.active) return;

        if (deltaTime > 0.1) deltaTime = 0.02;
        const timeScale = deltaTime * 60;

        this._physicsInput(timeScale, deltaTime);
        this._airDynamics(timeScale);
        this._move(deltaTime);
        this._screenWrap();
        
        // If this is the main player, coordinate the loop for others and check collisions
        if (this === paper) {
            this._manageMultiplayer(deltaTime);
        }

        this.display();
    }

    _manageMultiplayer(deltaTime) {
        secondaryPapers.forEach(p => {
            p.update(deltaTime);
            
            // Check collisions mutually
            this._checkKill(p);
            p._checkKill(this);
        });
    }

    _checkKill(target) {
        if (!target.active) return;

        const dx = target.position.x - this.position.x;
        const dy = target.position.y - this.position.y;
        const dist = Math.hypot(dx, dy);

        if (dist < COLLISION_DISTANCE) {
            const mySpeed = Math.hypot(this.velocity.x, this.velocity.y);
            const targetSpeed = Math.hypot(target.velocity.x, target.velocity.y);

            // 1. Must be moving fast enough to cut
            // 2. Must be moving significantly faster than the target (or target is slow)
            if (mySpeed > KILL_SPEED_THRESHOLD && mySpeed > targetSpeed + 2) {
                
                // 3. Angle Check: Is my velocity vector pointing towards the victim?
                const angleToVictim = Math.atan2(dy, dx);
                const myMoveAngle = Math.atan2(this.velocity.y, this.velocity.x);
                
                // Calculate difference and normalize to -PI to PI
                let angleDiff = myMoveAngle - angleToVictim;
                while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
                while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

                // If the movement vector is aligned with the target ("Sharp angle")
                if (Math.abs(angleDiff) < KILL_ANGLE_THRESHOLD) {
                    target.respawn();
                }
            }
        }
    }

    _physicsInput(timeScale, deltaTime) {
        const leftInput = Keyboard.keys[this.inputMap.left];
        const rightInput = Keyboard.keys[this.inputMap.right];
        const hasInput = leftInput || rightInput;

        if (hasInput) {
            this.idleTimer = 0;

            if (rightInput) {
                if (this.rotationForce < 0) this.rotationForce = 0;
                this.rotationForce += ROTATION_SMOOTHNESS * timeScale;
            } else if (leftInput) {
                if (this.rotationForce > 0) this.rotationForce = 0;
                this.rotationForce -= ROTATION_SMOOTHNESS * timeScale;
            }

            if (rightInput && leftInput) {
                this.rotationForce -= ROTATION_SMOOTHNESS * timeScale;
                this.rotationForce -= AIR_RESISTANCE * this.rotationForce * MASS * timeScale;
                if (Math.abs(this.rotationForce) <= ROTATION_SMOOTHNESS * timeScale) {
                    this.rotationForce = 0;
                }
            }
        } else {
            this.idleTimer += deltaTime;

            this.rotationForce -= AIR_RESISTANCE * this.rotationForce * MASS * timeScale;
            if (Math.abs(this.rotationForce) <= ROTATION_SMOOTHNESS * timeScale) {
                this.rotationForce = 0;
            }

            // Autopilot Behavior (Enabled for all players)
            if (this.idleTimer > AUTO_IDLE_DELAY) {
                // 1. Oscillate gently
                const sway = Math.sin(this.idleTimer * 0.8) * 0.05;

                // 2. Stronger bias to return to horizontal (0 radians)
                const horizontalCorrection = -this.rotation * 0.04;

                // 3. Counter-steer based on horizontal velocity to prevent excessive drifting
                const velocityDampening = -this.velocity.x * 0.0004;

                // 4. Mouse Bias (Only applies to Player 1)
                let mouseBias = 0;
                if (this === paper) {
                    const mouseDx = Mouse.x - this.position.x;
                    mouseBias = Math.max(-0.02, Math.min(0.02, mouseDx * 10));
                }

                const autoForce = (sway + horizontalCorrection + velocityDampening + mouseBias) * timeScale;
                this.rotationForce += autoForce;
            }
        }

        if (Math.abs(this.rotationForce) > ROTATION_BOUNDRY) {
            this.rotationForce = Math.sign(this.rotationForce) * ROTATION_BOUNDRY;
        }

        const speed = Math.hypot(this.velocity.x, this.velocity.y);
        const logVal = Math.log(speed + 1);
        this.rotation += (ROTATION_FACTOR * this.rotationForce * Math.min(10, Math.max(2, logVal))) * timeScale;
    }

    _airDynamics(timeScale) {
        const airAngleOnPaper = Math.atan2(-this.velocity.y, -this.velocity.x);
        const airAngleRelativeToPaper = airAngleOnPaper - this.rotation;
        
        const speed = Math.hypot(this.velocity.x, this.velocity.y);
        const airResistance = Math.sin(airAngleRelativeToPaper) * speed;

        const airForceY = Math.sin(this.rotation + Math.PI / 2) * airResistance * AIR_DENSITY;
        const airForceX = Math.cos(this.rotation + Math.PI / 2) * airResistance * AIR_DENSITY;

        const paperFractures = MASS / (Math.log(MAX_HEALTH + 2) * FRACTURES_FACTOR);

        this.velocity.y += ((airForceY + GRAVITY * MASS) / paperFractures) * timeScale;
        this.velocity.x += (airForceX / paperFractures) * timeScale;
    }

    _move(deltaTime) {
        this.position.x += this.velocity.x * deltaTime;
        this.position.y += this.velocity.y * deltaTime;
    }

    _screenWrap() {
        const screenSize = getScreenSize();
        const buffer = 5;

        if (this.position.x > screenSize.width + buffer) {
            this.position.x = -buffer;
        } else if (this.position.x < -buffer) {
            this.position.x = screenSize.width + buffer;
        }

        if (this.position.y > screenSize.height + buffer) {
            this.position.y = -buffer;
        } else if (this.position.y < -buffer) {
            this.position.y = screenSize.height + buffer;
        }
    }

    display() {
        const rotationDeg = this.rotation * (180 / Math.PI);
        const drawX = this.position.x - (this.size.width / 2);
        const drawY = this.position.y - (this.size.height / 2);

        this.docElement.style.transform = `translate(${drawX}px, ${drawY}px) rotate(${rotationDeg}deg)`;
        this.docElement.style.transformOrigin = "center center";
        this.docElement.style.left = '0px';
        this.docElement.style.top = '0px';
    }
}

export let paper = null;

function spawnPlayerTwo() {
    if (secondaryPapers.length > 0) return;

    const p2Element = document.createElement("img");
    p2Element.src = "imgs/paper.png";
    p2Element.width = 30;
    p2Element.title = "Player 2";
    p2Element.style.filter = "sepia(1) saturate(5) hue-rotate(-50deg)"; // Red tint
    document.body.appendChild(p2Element);

    const p2 = new Paper(p2Element, { left: "KeyA", right: "KeyD" });
    p2.activate();
    secondaryPapers.push(p2);
    
    console.log("Player 2 Spawned (Controls: A/D)");
}

export function paperInit() {
    const docElement = document.getElementById("paper");
    if (!docElement) return;

    if (paper === null) {
        paper = new Paper(docElement, { left: "ArrowLeft", right: "ArrowRight" });
    }

    if (!paper.active) {
        paper.activate();
    }

    window.addEventListener('keydown', (e) => {
        if (e.key === '2') {
            spawnPlayerTwo();
        }
    });
}