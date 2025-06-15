/**
 * A simple engine for displaying text and HTML content in the console screen.
 */
export class BaseText {
    constructor(screenEl) {
        this.screenEl = screenEl;
        this.textContainer = document.createElement('div');
        this.textContainer.className = 'text-program-container';
        this.screenEl.appendChild(this.textContainer);
    }

    /**
     * Renders HTML content to the screen.
     * @param {string} htmlContent The HTML string to display.
     */
    render(htmlContent) {
        this.textContainer.innerHTML = htmlContent;
    }

    /**
     * Cleans up the element created by the engine.
     */
    unload() {
        if (this.screenEl.contains(this.textContainer)) {
            this.screenEl.removeChild(this.textContainer);
        }
    }

    onResize() {
        // Text content reflows automatically, so this is often not needed.
    }
}