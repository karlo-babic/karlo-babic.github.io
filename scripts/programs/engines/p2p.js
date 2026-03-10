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
        /**
         * Configuration for decentralized discovery and NAT traversal.
         * trackerUrls: Public WebTorrent trackers used for signaling.
         * rtcConfig: Standard WebRTC configuration including public STUN servers.
         */
        const config = {
            appId: this.appId,
            trackerUrls: [
                'wss://tracker.openwebtorrent.com',
                'wss://tracker.files.fm:7073/announce',
                'wss://tracker.btorrent.xyz'
            ],
            rtcConfig: {
                iceServers: [
                    {urls: 'stun:stun.l.google.com:19302'},
                    {urls: 'stun:stun1.l.google.com:19302'},
                    {urls: 'stun:stun2.l.google.com:19302'}
                ]
            }
        };

        this.room = joinRoom(config, roomId);

        const [send, get] = this.room.makeAction('chatMsg');
        this.sendAction = send;

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