// This function runs once the entire HTML document has been loaded and parsed.
document.addEventListener('DOMContentLoaded', () => {
    // --- Add event listeners for interactive elements ---
    document.getElementById('spaceship-link').addEventListener('click', (event) => {
        event.preventDefault(); // Prevent the <a> tag's default behavior
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
    canvasArea.start(); // fuzzyECA background
    Eye.start();        // Eye and TextField
    //showQuote();        // Initial call to show a quote immediately

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

    // Update background cellular automaton (target: 5 fps)
    fuzzyEcaTimer += deltaTime;
    if (fuzzyEcaTimer > 1 / 5) {
        updateCanvasArea();
        fuzzyEcaTimer = 0;
    }

    // Update the eye (target: 10 fps)
    eyeTimer += deltaTime;
    if (eyeTimer > 1 / 10) {
        Eye.update();
        eyeTimer = 0;
    }
    
    // Update the text field buffer (target: 1 fps)
    textFieldTimer += deltaTime;
    if (textFieldTimer > 1) {
        TextField.update();
        textFieldTimer = 0;
    }

    // Update snake if it's running (target: 10 fps)
    if (snake && snake.running) {
        snakeTimer += deltaTime;
        if (snakeTimer > 1 / 10) {
            snake.update();
            snakeTimer = 0;
        }
    }

    // Update three-body simulation if it's running (runs every frame for smoothness)
    if (threebody && threebody.running) {
        threebody.update(deltaTime);
    }
    
    // Update spaceship if it's active (runs every frame for smoothness)
    if (spaceship && spaceship.active) {
        spaceship.update(deltaTime);
    }

    // Update mouse state at the end of the frame
    Mouse.update();
}