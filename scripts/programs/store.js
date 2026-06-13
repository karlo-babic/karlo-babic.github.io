import { BaseText } from './engines/base_text.js';

/**
 * The public Google Apps Script Web App URL for Drive storage.
 */
const API_URL = 'https://script.google.com/macros/s/AKfycbxBw1SnWdROpwRE81cqled6rGu0bUBqhXZjVNoOzifc62istkZH0huB_IKQ_nEpQ9wm/exec';

/**
 * Maximum file size allowed for upload.
 */
const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB

/**
 * Escapes HTML special characters for safe rendering.
 * @param {string} text The raw text to escape.
 * @returns {string} The safely escaped HTML string.
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.innerText = text;
    return div.innerHTML;
}

const StoreProgram = {
    engine: null,
    password: null,
    boundPasswordHandler: null,
    boundFileHandler: null,
    boundListClickHandler: null,

    init: async function(screenEl, args = { positional: [], named: {} }) {
        this.engine = new BaseText(screenEl);
        this.renderPasswordPrompt();
    },

    /**
     * Renders a password input field. Status is shown inside the input.
     */
    renderPasswordPrompt: function() {
        const htmlOutput =
            '<form id="store-auth-form" style="margin:0;padding:0;">' +
            '<input type="password" id="store-password-input" class="console-auth-input" placeholder="Enter password" autocomplete="off" autofocus>' +
            '</form>';

        this.engine.render(htmlOutput);

        const form = document.getElementById('store-auth-form');
        if (form) {
            this.boundPasswordHandler = this.handlePasswordSubmit.bind(this);
            form.addEventListener('submit', this.boundPasswordHandler);
            document.getElementById('store-password-input').focus();
        }
    },

    /**
     * Authenticates and triggers the initial file list load.
     */
    handlePasswordSubmit: async function(e) {
        e.preventDefault();
        const inputEl = document.getElementById('store-password-input');
        this.password = inputEl.value;
        if (!this.password) return;

        inputEl.disabled = true;
        inputEl.type = 'text';
        inputEl.value = 'Connecting...';

        await this.loadFileList();
    },

    /**
     * Communicates with the Google Apps Script backend.
     */
    apiCall: async function(payload) {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error('Network response failed');
        return await response.json();
    },

    /**
     * Fetches the file list from the Drive folder.
     */
    loadFileList: async function() {
        try {
            const result = await this.apiCall({
                password: this.password,
                action: 'list'
            });

            if (result.success) {
                this.renderInterface(result.data);
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            console.error('Store fetch error:', error);
            const authInput = document.getElementById('store-password-input');
            if (authInput) {
                authInput.disabled = false;
                authInput.value = 'Error: ' + (error.message || 'Access Denied');
                authInput.select();
            }
        }
    },

    /**
     * Renders the upload zone and lists files as clickable secure download links.
     * @param {Array<Object>} files List of file objects {name, id, date}.
     */
    renderInterface: function(files) {
        let htmlOutput =
            '<div id="store-upload-zone" class="console-upload-zone">' +
            '<span id="store-status-text">Click to upload (max 100MB)</span>' +
            '<input type="file" id="store-file-input" style="display:none;">' +
            '</div>';

        if (!files || files.length === 0) {
            htmlOutput += '<div class="console-dim" style="padding:4px 0;">The folder is empty.</div>';
        } else {
            htmlOutput += '<ul id="store-file-list" class="console-list">';
            files.forEach((file) => {
                const dateTimeStr = new Date(file.date).toLocaleString('en-GB', {
                    day: '2-digit', month: '2-digit', year: 'numeric',
                    hour: '2-digit', minute: '2-digit'
                });
                htmlOutput += `<li class="console-list-row is-flex">` +
                    `<span class="store-download-link console-list-link" data-id="${file.id}" data-name="${escapeHtml(file.name)}">${escapeHtml(file.name)}</span>` +
                    `<span class="console-list-meta">${dateTimeStr}</span>` +
                    `</li>`;
            });
            htmlOutput += '</ul>';
        }

        this.engine.render(htmlOutput);
        this.attachEventListeners();
    },

    /**
     * Binds events for uploads and file downloads.
     */
    attachEventListeners: function() {
        const zone = document.getElementById('store-upload-zone');
        const input = document.getElementById('store-file-input');
        const list = document.getElementById('store-file-list');

        if (zone && input) {
            zone.onclick = () => input.click();
            this.boundFileHandler = this.handleFileSelect.bind(this);
            input.addEventListener('change', this.boundFileHandler);
        }

        if (list) {
            this.boundListClickHandler = this.handleListClick.bind(this);
            list.addEventListener('click', this.boundListClickHandler);
        }
    },

    /**
     * Delegates click events on the file list to trigger downloads.
     */
    handleListClick: function(e) {
        const target = e.target;
        if (target.classList.contains('store-download-link')) {
            const fileId = target.getAttribute('data-id');
            const fileName = target.getAttribute('data-name');
            this.downloadFile(fileId, fileName);
        }
    },

    /**
     * Fetches file content from the proxy and triggers a browser download.
     */
    downloadFile: async function(fileId, fileName) {
        const statusText = document.getElementById('store-status-text');
        const originalText = statusText.innerText;
        
        statusText.innerText = 'Downloading ' + fileName + '...';

        try {
            const result = await this.apiCall({
                password: this.password,
                action: 'download',
                id: fileId
            });

            if (result.success) {
                const byteCharacters = atob(result.base64Data);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], { type: result.mimeType });
                
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = result.filename;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                statusText.innerText = originalText;
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            statusText.innerHTML = '<span class="console-error">Download failed: ' + escapeHtml(error.message) + '</span>';
        }
    },

    /**
     * Processes file upload.
     */
    handleFileSelect: async function(e) {
        const file = e.target.files[0];
        if (!file) return;

        const statusText = document.getElementById('store-status-text');
        if (file.size > MAX_FILE_SIZE_BYTES) {
            statusText.innerHTML = '<span style="color:red;">Error: Max 100MB</span>';
            return;
        }

        const reader = new FileReader();
        reader.onload = async () => {
            const base64Data = reader.result.split(',')[1];
            statusText.innerText = 'Uploading...';
            try {
                const result = await this.apiCall({
                    password: this.password,
                    action: 'upload',
                    filename: file.name,
                    mimeType: file.type,
                    base64Data: base64Data
                });
                if (result.success) {
                    statusText.innerText = 'Success. Refreshing...';
                    await this.loadFileList();
                } else {
                    throw new Error(result.error);
                }
            } catch (error) {
                statusText.innerHTML = '<span class="console-error">Failed: ' + escapeHtml(error.message) + '</span>';
            }
        };
        reader.readAsDataURL(file);
    },

    unload: function() {
        const authForm = document.getElementById('store-auth-form');
        const fileInput = document.getElementById('store-file-input');
        const list = document.getElementById('store-file-list');

        if (authForm && this.boundPasswordHandler) authForm.removeEventListener('submit', this.boundPasswordHandler);
        if (fileInput && this.boundFileHandler) fileInput.removeEventListener('change', this.boundFileHandler);
        if (list && this.boundListClickHandler) list.removeEventListener('click', this.boundListClickHandler);
        
        if (this.engine) {
            this.engine.unload();
            this.engine = null;
        }
    }
};

export default StoreProgram;