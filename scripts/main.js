import { Mouse, Keyboard } from './utils.js';
import { startFuzzyEca, updateCanvasArea } from './fuzzyECA.js';
import { Eye, TextField } from './observerEye.js';
import { rocketInit, rocket, Smoke } from './rocket.js';
import { threebodyInit, threebody } from './threebody.js';
import { paperInit, paper } from './paper.js';
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

    document.getElementById('paper-placeholder').addEventListener('click', (event) => {
        event.preventDefault();
        paperInit();
    });

    // Add event listeners for section titles to load content into the console
    const sectionTitles = document.querySelectorAll('[data-section-file]');
    sectionTitles.forEach(title => {
        title.addEventListener('click', (e) => {
            e.preventDefault(); 
            
            const filename = title.dataset.sectionFile;
            if (filename) {
                const commandString = `read ${filename}`;
                Console.addToHistory(commandString);
                Console.loadProgram('read', { positional: [filename], named: {} });

                // Scroll the console into view for better user experience
                const consoleWindow = document.getElementById('console-window');
                if (consoleWindow) {
                    consoleWindow.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }
        });
    });

    // --- Initialize all modules ---
    startFuzzyEca();
    Eye.start();
    
    // Initialize console, checking for a program specified in the URL,
    // otherwise defaulting to 'gameoflife'.
    const urlParams = new URLSearchParams(window.location.search);
    const initialProgram = urlParams.get('run') || 'gameoflife';
    Console.init(initialProgram);

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

    if (paper && paper.active) {
        paper.update(deltaTime);
    }

    Mouse.update();
}

// Mousemove event for the radial gradient background effect
window.addEventListener('mousemove', e => {
    document.body.style.setProperty('--mouse-x', e.clientX + 'px');
    document.body.style.setProperty('--mouse-y', e.clientY + 'px');
});