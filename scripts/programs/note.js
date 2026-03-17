import { BaseText } from './engines/base_text.js';

/**
 * The public Google Apps Script Web App URL.
 */
const API_URL = 'https://script.google.com/macros/s/AKfycbzyHLl4MtHDKjRVTqR3C0rWlr_XQ02uSCyQ0hzchGgu1Ho4QurNzW8tZbcYDBjkRTML7Q/exec';

/**
 * Escapes HTML special characters to prevent injection when rendering sheet data.
 * @param {string} text The raw text to escape.
 * @returns {string} The safely escaped HTML string.
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.innerText = text;
    return div.innerHTML;
}

const Note = {
    engine: null,
    password: null,
    boundSubmitHandler: null,
    boundKeyDownHandler: null,
    boundPasswordHandler: null,

    init: async function(screenEl, args = { positional: [], named: {} }) {
        this.engine = new BaseText(screenEl);
        this.renderPasswordPrompt();
    },

    /**
     * Renders a password input field.
     * Status messages are shown directly within the input's value for a compact UI.
     */
    renderPasswordPrompt: function() {
        const htmlOutput = '<div style="margin:0;padding:0;">' +
            '<form id="note-auth-form" style="margin:0;padding:0;display:block;">' +
            '<input type="password" id="note-password-input" placeholder="Enter password" style="width:100%;box-sizing:border-box;margin:0;padding:2px 4px;background:transparent;color:inherit;border:1px solid #444;font-family:inherit;font-size:inherit;display:block;line-height:1;" autocomplete="off" autofocus>' +
            '</form>' +
            '</div>';

        this.engine.render(htmlOutput);

        const form = document.getElementById('note-auth-form');
        if (form) {
            this.boundPasswordHandler = this.handlePasswordSubmit.bind(this);
            form.addEventListener('submit', this.boundPasswordHandler);
            document.getElementById('note-password-input').focus();
        }
    },

    /**
     * Handles the password submission and shows connection status in the input field.
     * @param {Event} e The standard DOM submit event.
     */
    handlePasswordSubmit: async function(e) {
        e.preventDefault();
        const inputEl = document.getElementById('note-password-input');
        
        this.password = inputEl.value;
        if (!this.password) return;

        inputEl.disabled = true;
        inputEl.type = 'text'; // Convert to text to show status message
        inputEl.value = 'Connecting...';

        await this.loadSheetData();
    },

    apiCall: async function(payload) {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain;charset=utf-8'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        return await response.json();
    },

    /**
     * Attempts to fetch data; on failure, displays the error in the authentication input.
     */
    loadSheetData: async function() {
        try {
            const result = await this.apiCall({
                password: this.password,
                action: 'read'
            });

            if (result.success) {
                this.renderInterface(result.data);
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            console.error('Fetch error:', error);
            const authInput = document.getElementById('note-password-input');
            if (authInput) {
                authInput.disabled = false;
                authInput.type = 'text';
                authInput.value = 'Error: ' + (error.message || 'Access Denied');
                authInput.select();
            } else {
                this.engine.render('<span style="color:red;">Error: ' + escapeHtml(error.message) + '</span>');
            }
        }
    },

    /**
     * Renders the data entry textarea and the fetched rows.
     * The status message container is removed as messages now appear in the input.
     */
    renderInterface: function(rows) {
        let htmlOutput = '<div class="note-program-container" style="margin:0;padding:0;font-size:0.9em;line-height:1;">' +
            '<form id="note-append-form" style="margin:0;padding:0;display:block;">' +
            '<textarea id="note-new-row-input" placeholder="Enter new record" style="width:100%;box-sizing:border-box;margin:0;padding:2px 4px;display:block;background:transparent;color:inherit;border:1px solid #444;resize:vertical;font-family:inherit;font-size:inherit;line-height:1.2;" rows="3" autocomplete="off" autofocus></textarea>' +
            '</form>';
        
        if (rows.length === 0) {
            htmlOutput += '<p style="margin:0;padding:4px 0;line-height:1.2;">The note is currently empty.</p>';
        } else {
            htmlOutput += '<ul style="list-style-type:none;padding:0;margin:0;">';
            const reversedRows = [...rows].reverse();
            reversedRows.forEach((row) => {
                const rowData = row.map(cell => escapeHtml(String(cell).trim()).replace(/\n/g, '<br>')).join(' | ');
                htmlOutput += `<li style="padding:4px 0;margin:0;border-top:1px solid #333;line-height:1.3;">${rowData}</li>`;
            });
            htmlOutput += '</ul>';
        }

        htmlOutput += '</div>';

        this.engine.render(htmlOutput);
        this.attachEventListeners();
    },

    attachEventListeners: function() {
        const form = document.getElementById('note-append-form');
        const inputEl = document.getElementById('note-new-row-input');

        if (form && inputEl) {
            this.boundSubmitHandler = this.handleFormSubmit.bind(this);
            this.boundKeyDownHandler = this.handleKeyDown.bind(this);
            
            form.addEventListener('submit', this.boundSubmitHandler);
            inputEl.addEventListener('keydown', this.boundKeyDownHandler);
            
            inputEl.focus();
        }
    },

    handleKeyDown: function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            this.handleFormSubmit(e);
        }
    },

    /**
     * Transmits the new row and updates the input field value with operation status.
     * @param {Event} e The standard DOM submit or keyboard event.
     */
    handleFormSubmit: async function(e) {
        e.preventDefault();
        const inputEl = document.getElementById('note-new-row-input');
        
        const newRecord = inputEl.value.trim();
        if (!newRecord) return;

        const originalText = inputEl.value;
        inputEl.disabled = true;
        inputEl.value = 'Writing to note...';

        try {
            const result = await this.apiCall({
                password: this.password,
                action: 'write',
                row: newRecord
            });
            
            if (result.success) {
                inputEl.value = 'Success. Refreshing...';
                await this.loadSheetData();
            } else {
                throw new Error(result.error || 'Unknown write error');
            }
        } catch (error) {
            console.error('Write error:', error);
            inputEl.disabled = false;
            inputEl.value = 'Error: ' + error.message;
            inputEl.focus();
            inputEl.select();
        }
    },

    unload: function() {
        const authForm = document.getElementById('note-auth-form');
        const appendForm = document.getElementById('note-append-form');
        const inputEl = document.getElementById('note-new-row-input');

        if (authForm && this.boundPasswordHandler) {
            authForm.removeEventListener('submit', this.boundPasswordHandler);
        }

        if (appendForm && this.boundSubmitHandler) {
            appendForm.removeEventListener('submit', this.boundSubmitHandler);
        }
        
        if (inputEl && this.boundKeyDownHandler) {
            inputEl.removeEventListener('keydown', this.boundKeyDownHandler);
        }
        
        if (this.engine) {
            this.engine.unload();
            this.engine = null;
        }
    },

    onResize: function() {
        // Handled by BaseText engine natively.
    }
};

export default Note;