import { Mouse, Keyboard } from './utils.js';
import { startFuzzyEca, updateCanvasArea } from './fuzzyECA.js';
import { Eye, TextField } from './observerEye.js';
import { rocketInit, rocket, Smoke } from './rocket.js';
import { threebodyInit, threebody } from './threebody.js';
import { showQuote } from './quotes.js';
import { Console } from './console.js';

// This function runs once the entire HTML document has been loaded.
document.addEventListener('DOMContentLoaded', () => {
    // --- Initialize imported utilities ---
    Mouse.init();
    Keyboard.init();
    
    // --- Add event listeners for interactive elements ---
    document.getElementById('rocket-placeholder').addEventListener('click', (event) => {
        event.preventDefault();
        rocketInit();
    });

    document.getElementById('threebody-link').addEventListener('click', (event) => {
        event.preventDefault();
        threebodyInit();
    });

    // --- Initialize all modules ---
    startFuzzyEca();
    Eye.start();
    Console.init('gameoflife');
    setTimeout(showQuote, 100);

    // Start the master animation loop
    requestAnimationFrame(mainLoop);
});


// --- Master Animation Loop ---
let lastTime = 0;
// Timers to control update frequency
let fuzzyEcaTimer = 0;
let eyeTimer = 0;
let textFieldTimer = 0;

function mainLoop(currentTime) {
    // Schedule the next frame
    requestAnimationFrame(mainLoop);

    const deltaTime = (currentTime - lastTime) / 1000 || 0;
    lastTime = currentTime;

    // --- Call update functions for each module ---
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

    if (threebody && threebody.running) {
        threebody.update(deltaTime);
    }
    
    if (rocket && rocket.active) {
        rocket.update(deltaTime);
    }

    Mouse.update();
}

// Mousemove event for the radial gradient background effect
window.addEventListener('mousemove', e => {
    document.body.style.setProperty('--mouse-x', e.clientX + 'px');
    document.body.style.setProperty('--mouse-y', e.clientY + 'px');
});