// This function runs once the entire HTML document has been loaded and parsed.
document.addEventListener('DOMContentLoaded', () => {
    // --- Add event listeners for interactive elements ---
    document.getElementById('spaceship-placeholder').addEventListener('click', (event) => {
        event.preventDefault();
        spaceshipInit();
    });

    document.getElementById('threebody-link').addEventListener('click', (event) => {
        event.preventDefault();
        threebodyInit();
    });

    document.getElementById('snake').addEventListener('click', () => {
        snakeInit();
    });

    // --- Initialize all modules ---
    canvasArea.start();
    Eye.start();
    //setTimeout(showQuote, 100);

    // Start the master animation loop
    requestAnimationFrame(mainLoop);
});


// --- Master Animation Loop ---

let lastTime = 0;
// Timers to control update frequency for different modules
let fuzzyEcaTimer = 0;
let eyeTimer = 0;
let textFieldTimer = 0;
let snakeTimer = 0;

function mainLoop(currentTime) {
    // Schedule the next frame
    requestAnimationFrame(mainLoop);

    // Calculate time elapsed since the last frame
    const deltaTime = (currentTime - lastTime) / 1000;
    lastTime = currentTime;

    // --- Call update functions for each module based on their required frequency ---
    fuzzyEcaTimer += deltaTime;
    if (fuzzyEcaTimer > 1 / 5) {
        updateCanvasArea();
        fuzzyEcaTimer = 0;
    }

    eyeTimer += deltaTime;
    if (eyeTimer > 1 / 10) {
        Eye.update();
        eyeTimer = 0;
    }
    
    textFieldTimer += deltaTime;
    if (textFieldTimer > 1) {
        TextField.update();
        textFieldTimer = 0;
    }

    if (snake && snake.running) {
        snakeTimer += deltaTime;
        if (snakeTimer > 1 / 10) {
            snake.update();
            snakeTimer = 0;
        }
    }

    if (threebody && threebody.running) {
        threebody.update(deltaTime);
    }
    
    if (spaceship && spaceship.active) {
        spaceship.update(deltaTime);
    }

    Mouse.update();
}



window.addEventListener('mousemove', e => {
    document.body.style.setProperty('--mouse-x', e.clientX + 'px');
    document.body.style.setProperty('--mouse-y', e.clientY + 'px');
});