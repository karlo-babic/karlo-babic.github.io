// engines/p2p.js

import { joinRoom } from 'https://esm.sh/trystero@0.22.0/torrent';

export class P2PEngine {
    constructor(appId) {
        this.appId = appId;
        this.room = null;
        this.sendAction = null;
        
        this.onPeerJoin = null;
        this.onPeerLeave = null;
        this.onMessage = null;
    }

    async init(roomId) {
        // No need to inject script tags or wait for window.trystero
        // joinRoom is already imported at the top
        const config = { appId: this.appId };
        this.room = joinRoom(config, roomId);

        // Define the messaging action
        const [send, get] = this.room.makeAction('chatMsg');
        this.sendAction = send;

        // Listeners
        this.room.onPeerJoin(peerId => {
            if (this.onPeerJoin) this.onPeerJoin(peerId);
        });

        this.room.onPeerLeave(peerId => {
            if (this.onPeerLeave) this.onPeerLeave(peerId);
        });

        get((data, peerId) => {
            if (this.onMessage) this.onMessage(data, peerId);
        });
    }

    broadcast(data) {
        if (this.sendAction) {
            this.sendAction(data); 
        }
    }

    disconnect() {
        if (this.room) {
            this.room.leave();
            this.room = null;
        }
    }
}