// chat.js
import { InteractiveText } from './engines/interactive_text.js';
import { P2PEngine } from './engines/p2p.js';

const ChatApp = {
    ui: null,
    p2p: null,
    state: 'ASK_NAME', // States: ASK_NAME, CHATTING
    username: 'Guest',
    peerNames: {}, // Maps peerIds to usernames

init: async function(screenEl) {
        /**
         * Initialize UI and P2P engine. 
         * Network connection is deferred until a username is provided.
         */
        this.ui = new InteractiveText(screenEl, (text) => this.handleInput(text));
        this.p2p = new P2PEngine('my-awesome-web-console-v1');

        this.ui.println("=== P2P TERMINAL CHAT ===", "system-msg");
        this.ui.println("Please enter a username:", "prompt-msg");
        this.state = 'ASK_NAME';
    },

    setupP2PListeners: function() {
        // When a new person connects
        this.p2p.onPeerJoin = (peerId) => {
            // We don't know their name yet, so we just log a generic connection
            this.ui.println(`[System] A peer is connecting...`, 'system-msg');
            
            // Send our username to the new person so they know who we are
            if (this.state === 'CHATTING') {
                this.p2p.broadcast({ type: 'HELO', username: this.username });
            }
        };

        // When someone disconnects
        this.p2p.onPeerLeave = (peerId) => {
            const name = this.peerNames[peerId] || 'Unknown User';
            this.ui.println(`[System] ${name} has left the chat.`, 'system-msg');
            delete this.peerNames[peerId];
        };

        // When we receive data
        this.p2p.onMessage = (data, peerId) => {
            if (data.type === 'HELO') {
                // Another user telling us their name
                this.peerNames[peerId] = data.username;
                this.ui.println(`[System] ${data.username} joined the chat.`, 'system-msg');
            } 
            else if (data.type === 'MSG') {
                // A normal chat message
                const name = this.peerNames[peerId] || 'Unknown';
                this.ui.println(`<${name}> ${data.text}`);
            }
        };
    },

    handleInput: async function(text) {
        if (this.state === 'ASK_NAME') {
            const name = text.trim().replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 15);
            
            if (!name) {
                this.ui.println("Invalid name. Letters and numbers only. Try again:", "error");
                return;
            }

            this.username = name;
            this.ui.println(`Establishing connection as ${this.username}...`, "system-msg");

            try {
                /**
                 * Joins the decentralized room only after identity is established locally.
                 */
                await this.p2p.init('global-chat');
                this.setupP2PListeners();
                
                this.state = 'CHATTING';
                this.ui.println(`Connected. Type '/quit' to leave.`, 'system-msg');
                
                // Announce presence to existing peers
                this.p2p.broadcast({ type: 'HELO', username: this.username });
            } catch (e) {
                this.ui.println(`Network Error: ${e.message}`, 'error');
            }
        } 
        else if (this.state === 'CHATTING') {
            if (text === '/quit') {
                this.unload();
                this.ui.println("Disconnected.", "system-msg");
                if(this.ui.inputField) this.ui.inputField.disabled = true;
                return;
            }

            this.p2p.broadcast({ type: 'MSG', text: text });
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
    },

    onResize: function() {
        if (this.ui) this.ui.onResize();
    }
};

export default ChatApp;