import { InteractiveText } from './engines/interactive_text.js';
import { P2PEngine } from './engines/p2p.js';

/**
 * ChatApp manages the terminal UI and P2P communication logic.
 */
const ChatApp = {
    ui: null,
    p2p: null,
    state: 'ASK_NAME',
    username: 'Anon',
    peerNames: {}, // Keyed by Peer ID

    init: async function(screenEl) {
        this.ui = new InteractiveText(screenEl, (text) => this.handleInput(text));
        this.p2p = new P2PEngine('p2p-terminal-chat-v1');

        this.ui.println("=== P2P Chat ===", "system-msg");
        this.ui.println("Please enter a username.", "prompt-msg");
        this.state = 'ASK_NAME';
    },

    /**
     * Configures listeners for peer discovery and incoming messages.
     */
    setupP2PListeners: function() {
        this.p2p.onPeerJoin = (peerId) => {
            // New peer connected; wait for HELO message to identify them.
            if (this.state === 'CHATTING') {
                this.p2p.broadcast({ type: 'HELO', username: this.username });
            }
        };

        this.p2p.onPeerLeave = (peerId) => {
            const name = this.peerNames[peerId] || 'Unknown User';
            this.ui.println(`[System] ${name} has left the chat.`, 'system-msg');
            delete this.peerNames[peerId];
        };

        this.p2p.onMessage = (data, peerId) => {
            if (data.type === 'HELO') {
                this.peerNames[peerId] = data.username;
                this.ui.println(`[System] ${data.username} joined the chat.`, 'system-msg');
            } 
            else if (data.type === 'MSG') {
                const name = this.peerNames[peerId] || 'Unknown';
                this.ui.println(`<${name}> ${data.text}`);
            }
        };
    },

    /**
     * Updates the UI prompt to reflect the current user's name.
     */
    updatePrompt: function() {
        if (this.ui && this.ui.inputWrapper) {
            const promptSpan = this.ui.inputWrapper.querySelector('span');
            if (promptSpan) {
                promptSpan.innerText = `<${this.username}> `;
            }
        }
    },

    handleInput: async function(text) {
        const input = text.trim();
        if (!input) return;

        if (this.state === 'ASK_NAME') {
            const sanitizedName = input.replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 15);
            
            if (!sanitizedName) {
                this.ui.println("Invalid name. Letters and numbers only. Try again:", "error");
                return;
            }

            this.username = sanitizedName;
            this.ui.println(`Connecting to decentralized network...`, "system-msg");

            try {
                await this.p2p.init('global-chat-room');
                this.setupP2PListeners();
                
                this.state = 'CHATTING';
                this.updatePrompt();
                this.ui.println(`Connected. Type '/users' for list or '/quit' to leave.`, 'system-msg');
                
                this.p2p.broadcast({ type: 'HELO', username: this.username });
            } catch (e) {
                this.ui.println(`Network Error: ${e.message}`, 'error');
            }
        } 
        else if (this.state === 'CHATTING') {
            // Handle Commands
            if (input === '/quit') {
                this.unload();
                this.ui.println("Disconnected.", "system-msg");
                if(this.ui.inputField) this.ui.inputField.disabled = true;
                return;
            }

            if (input === '/users') {
                const users = Object.values(this.peerNames);
                users.push(`${this.username} (you)`);
                this.ui.println(`Connected users (${users.length}): ${users.join(', ')}`, 'system-msg');
                return;
            }

            // Standard Message
            this.p2p.broadcast({ type: 'MSG', text: input });
        }
    },

    unload: function() {
        if (this.p2p) {
            this.p2p.disconnect();
            this.p2p = null;
        }
        if (this.ui) {
            this.ui.unload();
            this.ui = null;
        }
        this.peerNames = {};
    },

    onResize: function() {
        if (this.ui) this.ui.onResize();
    }
};

export default ChatApp;