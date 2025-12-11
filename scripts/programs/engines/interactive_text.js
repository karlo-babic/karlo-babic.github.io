/**
 * An engine for interactive text programs requiring user input.
 * Handles the output stream, input field, and auto-scrolling.
 * Designed to mimic a terminal interface (monospaced, no borders).
 */
export class InteractiveText {
    constructor(screenEl, onInputCallback) {
        this.screenEl = screenEl;
        this.onInputCallback = onInputCallback;

        // Container for the whole interface
        this.container = document.createElement('div');
        this.container.className = 'interactive-program-container';
        this.container.style.display = 'flex';
        this.container.style.flexDirection = 'column';
        this.container.style.height = '100%';
        // Terminal styling: Monospace font and tighter line height
        this.container.style.fontFamily = '"Courier New", Courier, monospace';
        this.container.style.fontSize = '0.8rem';
        this.container.style.lineHeight = '1.2'; 

        // Output area (scrollable)
        this.outputArea = document.createElement('div');
        this.outputArea.className = 'output-area';
        this.outputArea.style.flexGrow = '1';
        this.outputArea.style.overflowY = 'auto';
        this.outputArea.style.whiteSpace = 'pre-wrap'; // Preserve terminal formatting
        this.outputArea.style.wordBreak = 'break-word';
        this.outputArea.style.paddingBottom = '0.5em';

        // Input area (form)
        this.inputWrapper = document.createElement('form');
        this.inputWrapper.className = 'input-area';
        this.inputWrapper.style.display = 'flex';
        this.inputWrapper.style.flexShrink = '0';
        this.inputWrapper.style.marginTop = '0'; 

        // The prompt symbol (e.g., ">")
        const promptLabel = document.createElement('span');
        promptLabel.innerText = '> ';
        promptLabel.style.whiteSpace = 'pre';

        // The actual text input
        this.inputField = document.createElement('input');
        this.inputField.type = 'text';
        this.inputField.style.flexGrow = '1';
        this.inputField.style.background = 'transparent';
        this.inputField.style.border = 'none';
        this.inputField.style.color = 'inherit';
        this.inputField.style.fontFamily = 'inherit';
        this.inputField.style.fontSize = 'inherit';
        this.inputField.style.outline = 'none';
        this.inputField.style.padding = '0';
        this.inputField.style.margin = '0';
        this.inputField.style.boxShadow = 'none';
        this.inputField.autocomplete = 'off';
        this.inputField.spellcheck = false;

        // Assemble DOM
        this.inputWrapper.appendChild(promptLabel);
        this.inputWrapper.appendChild(this.inputField);
        this.container.appendChild(this.outputArea);
        this.container.appendChild(this.inputWrapper);
        this.screenEl.appendChild(this.container);

        // Event Listeners
        this.inputWrapper.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleSubmit();
        });

        // Auto-focus logic: Keep focus on input unless user selects text elsewhere
        this.container.addEventListener('click', () => {
            const selection = window.getSelection();
            if (selection.toString().length === 0) {
                this.inputField.focus();
            }
        });

        // Initial focus
        setTimeout(() => this.inputField.focus(), 0);
    }

    /**
     * Handles the submit event.
     */
    handleSubmit() {
        const text = this.inputField.value;
        if (!text.trim()) return;

        // Echo user input to screen
        this.println(`> ${text}`, 'user-input');
        
        // Clear input
        this.inputField.value = '';

        // Send to program logic
        if (this.onInputCallback) {
            this.onInputCallback(text);
        }
    }

    /**
     * Prints text to the output area.
     * @param {string} text - The text to display.
     * @param {string} [className] - Optional CSS class for styling.
     */
    println(text, className = '') {
        const line = document.createElement('div');
        line.innerText = text;
        if (className) line.className = className;
        
        this.outputArea.appendChild(line);
        this.scrollToBottom();
    }

    /**
     * Ensures the newest content is visible.
     */
    scrollToBottom() {
        this.outputArea.scrollTop = this.outputArea.scrollHeight;
    }

    /**
     * Cleans up the DOM.
     */
    unload() {
        if (this.screenEl.contains(this.container)) {
            this.screenEl.removeChild(this.container);
        }
    }

    onResize() {
        this.scrollToBottom();
    }
}