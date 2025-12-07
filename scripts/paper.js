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
const AUTO_IDLE_DELAY = 1.5; // Seconds before autopilot engages

// --- Health (Constant for physics calculations) ---
const MAX_HEALTH = 100;

class Paper {
    active = false;
    docElement = null;

    // Physics State
    position = { x: 0, y: 0 };
    velocity = { x: 0, y: 0 };
    rotation = 0; // radians
    rotationForce = 0;
    
    // Autopilot State
    idleTimer = AUTO_IDLE_DELAY;

    // Dimensions for centering
    size = { width: 0, height: 0 };

    constructor(docElement) {
        this.docElement = docElement;
    }

    activate() {
        if (this.active) return;
        this.active = true;

        // Capture dimensions and initial position
        const rect = this.docElement.getBoundingClientRect();
        this.size.width = rect.width;
        this.size.height = rect.height;

        this.position.x = rect.left + window.scrollX + rect.width / 2;
        this.position.y = rect.top + window.scrollY + rect.height / 2;

        // Switch to fixed positioning for animation
        this.docElement.style.position = 'fixed';
        this.docElement.style.margin = '0';
        this.docElement.style.zIndex = '1000';
    }

    update(deltaTime) {
        if (!this.active) return;

        // Prevent physics explosion on tab switching or lag spikes
        if (deltaTime > 0.1) deltaTime = 0.02;

        // Godot logic runs in _physics_process (usually 60 FPS).
        // To maintain identical behavior in a variable timestep environment,
        // we scale the per-frame additive logic by the ratio of actual time to a 60 FPS frame.
        const timeScale = deltaTime * 60;

        this._physicsInput(timeScale, deltaTime);
        this._airDynamics(timeScale);
        this._move(deltaTime); // Movement uses standard deltaTime (pixels per second)
        
        this._screenWrap();
        this.display();
    }

    _physicsInput(timeScale, deltaTime) {
        const leftInput = Keyboard.keys["ArrowLeft"] || Keyboard.keys["KeyA"];
        const rightInput = Keyboard.keys["ArrowRight"] || Keyboard.keys["KeyD"];
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

            // Standard Damping
            this.rotationForce -= AIR_RESISTANCE * this.rotationForce * MASS * timeScale;
            if (Math.abs(this.rotationForce) <= ROTATION_SMOOTHNESS * timeScale) {
                this.rotationForce = 0;
            }

            // Autopilot Behavior
            if (this.idleTimer > AUTO_IDLE_DELAY) {
                // 1. Oscillate gently
                const sway = Math.sin(this.idleTimer * 0.8) * 0.05;

                // 2. Stronger bias to return to horizontal (0 radians)
                const horizontalCorrection = -this.rotation * 0.04;

                // 3. Counter-steer based on horizontal velocity to prevent excessive drifting
                const velocityDampening = -this.velocity.x * 0.0004;

                // 4. Slightly prefer the direction (horizontal) of the mouse cursor
                const mouseDx = Mouse.x - this.position.x;
                const mouseBias = Math.max(-0.02, Math.min(0.02, mouseDx * 10));

                const autoForce = (sway + horizontalCorrection + velocityDampening + mouseBias) * timeScale;
                this.rotationForce += autoForce;
            }
        }

        // Clamp rotation force
        if (Math.abs(this.rotationForce) > ROTATION_BOUNDRY) {
            this.rotationForce = Math.sign(this.rotationForce) * ROTATION_BOUNDRY;
        }

        // Apply rotation
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
        
        // Offset translate by half-width/height to ensure this.position represents the center
        const drawX = this.position.x - (this.size.width / 2);
        const drawY = this.position.y - (this.size.height / 2);

        this.docElement.style.transform = `translate(${drawX}px, ${drawY}px) rotate(${rotationDeg}deg)`;
        
        this.docElement.style.transformOrigin = "center center";
        this.docElement.style.left = '0px';
        this.docElement.style.top = '0px';
    }
}

export let paper = null;

export function paperInit() {
    const docElement = document.getElementById("paper");
    if (!docElement) return;

    if (paper === null) {
        paper = new Paper(docElement);
    }

    if (!paper.active) {
        paper.activate();
    }
}