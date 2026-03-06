// --- Constants & Configuration ---

const GAME_WIDTH = 1800;
const GAME_HEIGHT = 1000;

// Physics Constants (Adapted for Canvas pixel space)
const GRAVITY = 0.1;
const AIR_DENSITY = 0.3;
const MASS = 5;
const FRACTURES_FACTOR = 0.2;
const MAX_HEALTH = 100;

// Control Constants
const AIR_RESISTANCE = 0.02;
const ROTATION_SMOOTHNESS = 0.01;
const ROTATION_BOUNDRY = 0.3;
const ROTATION_FACTOR = 0.05;

// Environment Constants
const WIND_START_Y = GAME_HEIGHT * (4 / 5);
const MAX_WIND_SPEED = 20; // Strongest at the very bottom edge

/**
 * Handles the physics, input, and rendering of a paper glider.
 */
class Glider {
    constructor(x, y, controls, glowColor = '#ffffff') {
        this.origin = { x, y };
        this.position = { x, y };
        this.velocity = { x: 0, y: 0 };
        this.rotation = 0;
        this.rotationForce = 0;
        this.width = 80;
        this.height = 10;
        this.controls = controls;
        this.glowColor = glowColor;
        this.isDead = false;
    }

    reset() {
        this.position = { x: this.origin.x, y: this.origin.y };
        this.velocity = { x: 0, y: 0 };
        this.rotation = 0;
        this.rotationForce = 0;
        this.isDead = false;
    }

    update(deltaTime, keys) {
        if (this.isDead) return;

        // Cap deltaTime to avoid physics explosions on lag spikes
        if (deltaTime > 0.1) deltaTime = 0.02;
        const timeScale = deltaTime * 60;

        this._applyInput(keys, timeScale);
        this._applyPhysics(timeScale);
        
        this.position.x += this.velocity.x * deltaTime * 60; // Scale movement to framerate
        this.position.y += this.velocity.y * deltaTime * 60;
    }

    _applyInput(keys, timeScale) {
        const leftInput = keys[this.controls.left] || keys['TouchLeft'];
        const rightInput = keys[this.controls.right] || keys['TouchRight'];
        const hasInput = leftInput || rightInput;

        if (hasInput) {
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
            // Natural dampening when no input
            this.rotationForce -= AIR_RESISTANCE * this.rotationForce * MASS * timeScale;
            if (Math.abs(this.rotationForce) <= ROTATION_SMOOTHNESS * timeScale) {
                this.rotationForce = 0;
            }
        }

        if (Math.abs(this.rotationForce) > ROTATION_BOUNDRY) {
            this.rotationForce = Math.sign(this.rotationForce) * ROTATION_BOUNDRY;
        }

        const speed = Math.hypot(this.velocity.x, this.velocity.y);
        const logVal = Math.log(speed + 1);
        this.rotation += (ROTATION_FACTOR * this.rotationForce * Math.min(10, Math.max(2, logVal))) * timeScale;
    }

_applyPhysics(timeScale) {
        // Calculate environmental wind force (upward)
        let windSpeedY = 0;
        if (this.position.y > WIND_START_Y) {
            // Calculate a linear ratio (0 to 1)
            const linearRatio = Math.min(1, (this.position.y - WIND_START_Y) / (GAME_HEIGHT - WIND_START_Y));
            // Square the ratio so the force increases exponentially as we approach the bottom
            const exponentialRatio = Math.pow(linearRatio, 2);
            windSpeedY = -MAX_WIND_SPEED * exponentialRatio;
        }

        // Relative velocity of the glider through the air mass
        const relVelX = this.velocity.x;
        const relVelY = this.velocity.y - windSpeedY;

        const airAngleOnPaper = Math.atan2(-relVelY, -relVelX);
        const airAngleRelativeToPaper = airAngleOnPaper - this.rotation;
        
        const speedThroughAir = Math.hypot(relVelX, relVelY);
        const airResistance = Math.sin(airAngleRelativeToPaper) * speedThroughAir;

        const airForceY = Math.sin(this.rotation + Math.PI / 2) * airResistance * AIR_DENSITY;
        const airForceX = Math.cos(this.rotation + Math.PI / 2) * airResistance * AIR_DENSITY;

        const paperFractures = MASS / (Math.log(MAX_HEALTH + 2) * FRACTURES_FACTOR);

        this.velocity.y += ((airForceY + GRAVITY * MASS) / paperFractures) * timeScale;
        this.velocity.x += (airForceX / paperFractures) * timeScale;
    }

    render(ctx, image) {
        if (this.isDead || !image.complete || image.naturalWidth === 0) return;

        ctx.save();
        ctx.translate(this.position.x, this.position.y);
        ctx.rotate(this.rotation);
        
        // Apply neon glow
        ctx.shadowBlur = 8;
        ctx.shadowColor = this.glowColor;
        
        ctx.drawImage(image, -this.width / 2, -this.height / 2, this.width, this.height);
        
        // Straightforward tinting: Overlay color on the glider image
        ctx.globalCompositeOperation = 'source-atop';
        ctx.fillStyle = this.glowColor;
        ctx.globalAlpha = 0.7; // Blend to keep some texture
        ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);
        
        ctx.globalAlpha = 1.0;
        ctx.globalCompositeOperation = 'source-over';
        ctx.shadowBlur = 0;
        ctx.restore();
    }
}

/**
 * Handles ball physics, constant speed movement, collisions, and color logic.
 */
class Ball {
    constructor(x, y) {
        this.position = { x, y };
        this.velocity = { x: 0, y: 0 };
        this.radius = 12;
        this.baseSpeed = 200;
        this.speed = this.baseSpeed;
        this.color = '#FFFFFF';
        this.active = false;
        this.mode = 1;
        this.owner = null;
    }

    reset(x, y, mode, startOwner = 'p1') {
        this.position = { x, y };
        this.mode = mode;
        this.speed = this.baseSpeed;
        this.active = true;

        if (this.mode === 2) {
            this.setOwner(startOwner);
        } else {
            this.color = '#FFFFFF';
            this.owner = null;
        }

        const angle = -Math.PI / 4 - (Math.random() * Math.PI / 2);
        this.velocity = {
            x: Math.cos(angle) * this.speed,
            y: Math.sin(angle) * this.speed
        };
    }

    setOwner(owner) {
        this.owner = owner;
        this.color = (owner === 'p1') ? '#44aaff' : '#ff4444';
    }

    update(deltaTime, gliders, bricks, onGameOver) {
        if (!this.active) return;

        this.position.x += this.velocity.x * deltaTime;
        this.position.y += this.velocity.y * deltaTime;

        // Wall Collisions
        if (this.position.x - this.radius < 0) {
            this.position.x = this.radius;
            this.velocity.x *= -1;
        } else if (this.position.x + this.radius > GAME_WIDTH) {
            this.position.x = GAME_WIDTH - this.radius;
            this.velocity.x *= -1;
        }

        if (this.position.y - this.radius < 0) {
            this.position.y = this.radius;
            this.velocity.y *= -1;
        }

        if (this.position.y + this.radius > GAME_HEIGHT) {
            this.active = false;
            onGameOver(this.owner);
            return;
        }

        // Glider Collisions
        gliders.forEach((glider, index) => {
            // Transform ball position to glider's local space
            const dx = this.position.x - glider.position.x;
            const dy = this.position.y - glider.position.y;
            
            const cosR = Math.cos(glider.rotation);
            const sinR = Math.sin(glider.rotation);
            
            const localX = dx * cosR + dy * sinR;
            const localY = -dx * sinR + dy * cosR;

            // Simple Box Check
            const halfW = glider.width / 2 + this.radius;
            const halfH = glider.height / 2 + this.radius;

            if (Math.abs(localX) < halfW && Math.abs(localY) < halfH) {
                let normalX, normalY;

                // Determine normal based on which side (top/bottom) is closer
                if (localY < 0) {
                    normalX = Math.sin(glider.rotation);
                    normalY = -Math.cos(glider.rotation);
                } else {
                    normalX = -Math.sin(glider.rotation);
                    normalY = Math.cos(glider.rotation);
                }

                // RELATIVE VELOCITY FIX:
                // Calculate velocity relative to the moving glider
                const relVx = this.velocity.x - glider.velocity.x;
                const relVy = this.velocity.y - glider.velocity.y;

                // Check dot product using relative velocity
                const dot = relVx * normalX + relVy * normalY;
                
                // Only bounce if they are moving towards each other
                if (dot < 0) {
                    // Speed up slightly on every hit
                    this.speed *= 1.05;

                    // 2P Mode: Switch owner
                    if (this.mode === 2) {
                        this.setOwner(this.owner === 'p1' ? 'p2' : 'p1');
                    }

                    // Reflect the ball's velocity vector
                    // We use the full reflection formula on the ball's actual velocity
                    // But we boost it slightly to ensure it escapes the moving collider
                    this.velocity.x -= (2 * dot * normalX);
                    this.velocity.y -= (2 * dot * normalY);

                    // Re-normalize to ensure consistent game speed
                    const currentSpeed = Math.hypot(this.velocity.x, this.velocity.y);
                    this.velocity.x = (this.velocity.x / currentSpeed) * this.speed;
                    this.velocity.y = (this.velocity.y / currentSpeed) * this.speed;
                    
                    // Push the ball out of the glider to prevent sticking
                    // We add a small buffer (0.5) to the push
                    const overlap = (halfH - Math.abs(localY)) + 0.5;
                    // Push in direction of normal (which points away from glider center)
                    // If we hit top (localY < 0), normal points up. If bottom, down.
                    // We want to push out in the direction we came from approx.
                    const pushDir = localY < 0 ? -1 : 1;
                    
                    // Rotate the push vector back to world space
                    const pushX = -sinR * pushDir * overlap;
                    const pushY = cosR * pushDir * overlap;

                    this.position.x += pushX;
                    this.position.y += pushY;
                }
            }
        });

        // Brick Collisions (1 Player Mode)
        if (bricks && bricks.length > 0) {
            for (const brick of bricks) {
                if (!brick.active) continue;

                const closestX = Math.max(brick.x, Math.min(this.position.x, brick.x + brick.width));
                const closestY = Math.max(brick.y, Math.min(this.position.y, brick.y + brick.height));
                const dx = this.position.x - closestX;
                const dy = this.position.y - closestY;

                if ((dx * dx + dy * dy) < this.radius * this.radius) {
                    brick.active = false;
                    if (Math.abs(dx) > Math.abs(dy)) {
                        this.velocity.x *= -1;
                    } else {
                        this.velocity.y *= -1;
                    }
                    break;
                }
            }
        }
    }

    render(ctx) {
        if (!this.active) return;
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 15;
        ctx.shadowColor = this.color;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.closePath();
    }
}

/**
 * Represents a destructible brick in 1-player mode.
 */
class Brick {
    constructor(x, y, width, height, color) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.color = color;
        this.active = true;
    }

    render(ctx) {
        if (!this.active) return;
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 0;
        ctx.shadowColor = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);
        ctx.shadowBlur = 0;
    }
}

/**
 * Main Game Program Engine.
 */
class GliderPongProgram {
    constructor(screenEl) {
        this.screenEl = screenEl;
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Ensure the canvas fully covers the container cleanly
        this.canvas.style.display = 'block';
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        this.screenEl.appendChild(this.canvas);

        // Game State
        this.gameState = 'startScreen'; // 'startScreen', 'playing', 'gameOver'
        this.lastTime = 0;
        this.animationFrameId = null;
        this.keys = {};
        
        // Mode Management
        this.numPlayers = 1; 
        this.nextStartPlayer = 'p1'; // Alternates in 2P mode
        this.winner = null;

        // Entities
        this.gliders = [];
        this.ball = new Ball(GAME_WIDTH / 2, GAME_HEIGHT / 2);
        this.bricks = [];
        
        // Wind visuals
        this.particles = [];
        const MAX_PARTICLES = 100;
        for (let i = 0; i < MAX_PARTICLES; i++) {
            this.particles.push({
                x: Math.random() * GAME_WIDTH,
                y: WIND_START_Y + Math.random() * (GAME_HEIGHT - WIND_START_Y),
                speed: 0.5 + Math.random() * 2,
                opacity: Math.random()
            });
        }

        // Assets
        this.assets = {
            paperImg: new Image()
        };
        this.assets.paperImg.src = '../../imgs/paper.png';

        // Bindings
        this.run = this.run.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleKeyUp = this.handleKeyUp.bind(this);
        this.handleTouchStart = this.handleTouchStart.bind(this);
        this.handleTouchEnd = this.handleTouchEnd.bind(this);
        this.onResize = this.onResize.bind(this);
    }

    init() {
        this.setupEntities();
        this.attachEventListeners();
        this.onResize();
        this.animationFrameId = requestAnimationFrame(this.run);
    }

    unload() {
        cancelAnimationFrame(this.animationFrameId);
        this.removeEventListeners();
        if (this.canvas.parentElement) {
            this.canvas.parentElement.removeChild(this.canvas);
        }
    }

    attachEventListeners() {
        window.addEventListener('resize', this.onResize);
        window.addEventListener('keydown', this.handleKeyDown);
        window.addEventListener('keyup', this.handleKeyUp);
        
        this.canvas.addEventListener('touchstart', this.handleTouchStart, { passive: false });
        this.canvas.addEventListener('touchend', this.handleTouchEnd, { passive: false });
        this.canvas.addEventListener('mousedown', this.handleTouchStart); // Map mouse to touch for testing
        this.canvas.addEventListener('mouseup', this.handleTouchEnd);
    }

    removeEventListeners() {
        window.removeEventListener('resize', this.onResize);
        window.removeEventListener('keydown', this.handleKeyDown);
        window.removeEventListener('keyup', this.handleKeyUp);
        
        this.canvas.removeEventListener('touchstart', this.handleTouchStart);
        this.canvas.removeEventListener('touchend', this.handleTouchEnd);
        this.canvas.removeEventListener('mousedown', this.handleTouchStart);
        this.canvas.removeEventListener('mouseup', this.handleTouchEnd);
    }

    setupEntities() {
        this.gliders = [];
        this.bricks = [];
        
        if (this.numPlayers === 1) {
            // Single Player (Neon White)
            this.gliders.push(new Glider(GAME_WIDTH / 2, GAME_HEIGHT * 0.8, {
                left: 'ArrowLeft',
                right: 'ArrowRight'
            }, '#ffffff'));

            // Setup Bricks for 1 Player Mode
            const rows = 3;
            const cols = 16;
            const pad = 15;
            const bWidth = (GAME_WIDTH - (cols + 1) * pad) / cols;
            const bHeight = 30;
            const colors = ['#ff00ffaa', '#00ffffaa', '#ffff00aa', '#00ff00aa', '#ff0000aa'];

            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    const x = pad + c * (bWidth + pad);
                    const y = pad + r * (bHeight + pad) + 60; // Offset from top
                    const color = colors[Math.floor(Math.random() * colors.length)];
                    this.bricks.push(new Brick(x, y, bWidth, bHeight, color));
                }
            }

        } else {
            // Player 1 (Neon Blue)
            this.gliders.push(new Glider(GAME_WIDTH * 0.75, GAME_HEIGHT * 0.75, {
                left: 'ArrowLeft',
                right: 'ArrowRight'
            }, '#44aaff')); 

            // Player 2 (Neon Red)
            this.gliders.push(new Glider(GAME_WIDTH * 0.25, GAME_HEIGHT * 0.75, {
                left: 'KeyA',
                right: 'KeyD'
            }, '#ff4444'));
        }
    }

    startGame() {
        if (this.gameState === 'playing') return;
        
        // Regenerate bricks and gliders for a fresh start
        this.setupEntities();

        this.gameState = 'playing';
        this.winner = null;
        this.gliders.forEach(g => g.reset());
        
        let startOwner = 'p1';
        if (this.numPlayers === 2) {
            startOwner = this.nextStartPlayer;
            this.nextStartPlayer = (this.nextStartPlayer === 'p1') ? 'p2' : 'p1';
        }

        this.ball.reset(GAME_WIDTH / 2, GAME_HEIGHT / 2, this.numPlayers, startOwner);
    }

    handleKeyDown(e) {
        this.keys[e.code] = true;

        if (e.code === 'Escape') {
            if (this.gameState === 'playing') {
                this.gameState = 'startScreen';
            } else if (this.gameState === 'startScreen' && this.ball.active) {
                // If a game session is already in progress, resume it
                this.gameState = 'playing';
            } else {
                this.gameState = 'startScreen';
            }
            return;
        }

        if (this.gameState !== 'playing') {
            if (e.code === 'Space' || e.code === 'Enter') {
                e.preventDefault();
                this.startGame();
            }
            // Mode Switching
            if (e.code === 'Digit1') {
                this.numPlayers = 1;
                this.setupEntities();
            }
            if (e.code === 'Digit2') {
                this.numPlayers = 2;
                this.setupEntities();
            }
        }
    }

    handleKeyUp(e) {
        this.keys[e.code] = false;
    }

    handleTouchStart(e) {
        e.preventDefault();
        
        if (this.gameState !== 'playing') {
            this.startGame();
            return;
        }

        // Handle mobile touch input (left/right screen division)
        let clientX = e.clientX;
        if (e.touches && e.touches.length > 0) {
            clientX = e.touches[0].clientX;
        }

        const rect = this.canvas.getBoundingClientRect();
        const touchX = clientX - rect.left;

        if (touchX < rect.width / 2) {
            this.keys['TouchLeft'] = true;
            this.keys['TouchRight'] = false;
        } else {
            this.keys['TouchRight'] = true;
            this.keys['TouchLeft'] = false;
        }
    }

    handleTouchEnd(e) {
        e.preventDefault();
        this.keys['TouchLeft'] = false;
        this.keys['TouchRight'] = false;
    }

    onResize() {
        const rect = this.screenEl.getBoundingClientRect();
        // Match actual display resolution to maintain crispness
        this.canvas.width = rect.width * window.devicePixelRatio;
        this.canvas.height = rect.height * window.devicePixelRatio;
        
        // Set CSS size to container bounds
        this.canvas.style.width = `${rect.width}px`;
        this.canvas.style.height = `${rect.height}px`;

        this.scaleRatio = Math.min(
            this.canvas.width / GAME_WIDTH,
            this.canvas.height / GAME_HEIGHT
        );

        this.offsetX = (this.canvas.width - GAME_WIDTH * this.scaleRatio) / 2;
        this.offsetY = (this.canvas.height - GAME_HEIGHT * this.scaleRatio) / 2;
    }

    run(timestamp) {
        if (!this.lastTime) this.lastTime = timestamp;
        const deltaTime = (timestamp - this.lastTime) / 1000;
        this.lastTime = timestamp;

        this.update(deltaTime);
        this.render();

        this.animationFrameId = requestAnimationFrame(this.run);
    }

    update(deltaTime) {
        if (this.gameState !== 'playing') return;

        // Update wind particles
        this.particles.forEach(p => {
            const windRatio = Math.min(1, (p.y - WIND_START_Y) / (GAME_HEIGHT - WIND_START_Y));
            const speedMult = 1 + (windRatio * 5); 
            p.y -= p.speed * speedMult * deltaTime * 60;
            p.opacity = Math.max(0, (p.y - WIND_START_Y) / (GAME_HEIGHT - WIND_START_Y));
            if (p.y < WIND_START_Y || p.opacity <= 0) {
                p.y = GAME_HEIGHT;
                p.x = Math.random() * GAME_WIDTH;
                p.opacity = 0;
            }
        });

        // Update gliders and check bounds
        this.gliders.forEach((glider, index) => {
            glider.update(deltaTime, this.keys);
            const pad = 20;
            if (glider.position.x < -pad || glider.position.x > GAME_WIDTH + pad ||
                glider.position.y < -pad || glider.position.y > GAME_HEIGHT + pad) {
                this.gameState = 'gameOver';
                if (this.numPlayers === 2) {
                    this.winner = (index === 0) ? "Player 2 (Red) Wins!" : "Player 1 (Blue) Wins!";
                } else {
                    this.winner = "";
                }
            }
        });

        // Update ball with reference to gliders, bricks, and game over callback
        this.ball.update(deltaTime, this.gliders, this.bricks, (losingColorOwner) => {
            this.gameState = 'gameOver';
            if (this.numPlayers === 2) {
                if (losingColorOwner === 'p1') {
                    this.winner = "Player 2 (Red) Wins!";
                } else if (losingColorOwner === 'p2') {
                    this.winner = "Player 1 (Blue) Wins!";
                }
            } else {
                this.winner = "";
            }
        });

        // Check Win Condition for 1 Player
        if (this.numPlayers === 1 && this.bricks.every(b => !b.active)) {
            this.gameState = 'gameOver';
            this.winner = "You Win! All Bricks Destroyed!";
        }
    }

    render() {
        // Transparent background clear
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.save();
        
        // Apply letterboxing/scaling to maintain logical resolution
        this.ctx.translate(this.offsetX, this.offsetY);
        this.ctx.scale(this.scaleRatio, this.scaleRatio);

        // Draw visible world borders
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

        // Draw Wind visualization
        this.drawWindEffect();

        // Render entities
        this.bricks.forEach(brick => brick.render(this.ctx));
        this.ball.render(this.ctx);
        this.gliders.forEach(glider => glider.render(this.ctx, this.assets.paperImg));

        this.ctx.restore();

        // Draw UI Overlays based on state
        this.drawUI();
    }

    drawWindEffect() {
        // Draw the background wind zone gradient
        const gradient = this.ctx.createLinearGradient(0, GAME_HEIGHT, 0, WIND_START_Y);
        gradient.addColorStop(0, 'rgba(178, 129, 196, 0.15)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, WIND_START_Y, GAME_WIDTH, GAME_HEIGHT - WIND_START_Y);

        // Draw rising air particles
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        this.particles.forEach(p => {
            this.ctx.globalAlpha = p.opacity;
            // Particles are small vertical streaks
            this.ctx.fillRect(p.x, p.y, 4, 20);
        });
        this.ctx.globalAlpha = 1.0;
    }

    drawUI() {
        this.ctx.fillStyle = 'white';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';

        const cx = this.canvas.width / 2;
        const cy = this.canvas.height / 2;
        const px = window.devicePixelRatio;

        if (this.gameState === 'startScreen') {
            this.ctx.font = `bold ${32 * px}px "Courier New", monospace`;
            this.ctx.fillText("Glider Pong", cx, cy - 60 * px);
            
            // Mode Selection
            this.ctx.font = `${18 * px}px "Courier New", monospace`;
            this.ctx.fillStyle = this.numPlayers === 1 ? '#44aaff' : '#888';
            this.ctx.fillText("Press 1: Single Player", cx, cy - 20 * px);
            this.ctx.fillStyle = this.numPlayers === 2 ? '#ff4444' : '#888';
            this.ctx.fillText("Press 2: Two Players", cx, cy + 10 * px);

            this.ctx.fillStyle = 'white';
            this.ctx.font = `${16 * px}px "Courier New", monospace`;
            this.ctx.fillText("Press Space or Touch to Start", cx, cy + 50 * px);
            
            this.ctx.font = `${12 * px}px "Courier New", monospace`;
            if (this.numPlayers === 1) {
                this.ctx.fillText("Controls: Arrows or Tap Sides", cx, cy + 90 * px);
            } else {
                this.ctx.fillText("P1 (Blue): Arrows | P2 (Red): A / D", cx, cy + 90 * px);
            }
        } else if (this.gameState === 'gameOver') {
            this.ctx.font = `bold ${32 * px}px "Courier New", monospace`;
            this.ctx.fillText("Game Over", cx, cy - 30 * px);
            
            if (this.winner) {
                this.ctx.font = `bold ${24 * px}px "Courier New", monospace`;
                this.ctx.fillStyle = this.winner.includes("Red") ? '#ff4444' : '#44aaff';
                this.ctx.fillText(this.winner, cx, cy + 10 * px);
                this.ctx.fillStyle = 'white';
            }

            this.ctx.font = `${16 * px}px "Courier New", monospace`;
            this.ctx.fillText("Press SPACE or Touch to Restart", cx, cy + 50 * px);
        }
    }
}

// Module Export for console integration
const GliderPong = {
    instance: null,

    init: function(screenEl) {
        this.instance = new GliderPongProgram(screenEl);
        this.instance.init();
    },

    unload: function() {
        if (this.instance) {
            this.instance.unload();
            this.instance = null;
        }
    },

    onResize: function() {
        if (this.instance) {
            this.instance.onResize();
        }
    }
};

export default GliderPong;