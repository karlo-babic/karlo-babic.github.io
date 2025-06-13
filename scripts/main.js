// This function runs once the entire HTML document has been loaded and parsed.
document.addEventListener('DOMContentLoaded', () => {
    // Initialize background and other startup scripts
    startFuzzyEca();
    showQuote(); // Initial call to show a quote immediately without waiting for the interval

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
});