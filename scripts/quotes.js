      
let quotes = []; // Start with an empty array
const quoteElement = document.getElementById("quote");

/**
 * Fetches the quotes from the external JSON file.
 */
async function loadQuotes() {
    try {
        const response = await fetch('./data/quotes.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        quotes = await response.json();
    } catch (error) {
        console.error("Could not load quotes:", error);
        // Provide a fallback quote in case of an error
        quotes = ["Error: Could not load quotes."];
    }
}

export function showQuote() {
    // Don't try to show a quote if the array is empty (still loading)
    if (quotes.length === 0) return;

    const newQuote = quotes[Math.floor(Math.random() * quotes.length)];

    // Fade out the current quote
    quoteElement.style.opacity = '0';

    // Wait for the fade-out transition to finish, then update and fade in.
    setTimeout(() => {
        quoteElement.innerHTML = newQuote;
        quoteElement.style.opacity = '1';
    }, 1000); // This should match the transition duration in CSS
}

// Load the quotes when the module is first initialized
loadQuotes();

// Set the interval for subsequent quotes
setInterval(showQuote, 30 * 1000);
