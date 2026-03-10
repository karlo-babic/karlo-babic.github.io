import { joinRoom } from 'https://esm.sh/trystero@0.22.0/torrent';

/**
 * P2PEngine provides a decentralized communication layer using WebRTC.
 * It uses WebTorrent trackers for signaling and public STUN servers for NAT traversal.
 */
export class P2PEngine {
    constructor(appId) {
        this.appId = appId;
        this.room = null;
        this.sendAction = null;
        
        this.onPeerJoin = null;
        this.onPeerLeave = null;
        this.onMessage = null;
    }

    /**
     * Initializes the connection to the decentralized network.
     * @param {string} roomId - The unique identifier for the chat room.
     */
    async init(roomId) {
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

    /**
     * Broadcasts data to all connected peers in the room.
     */
    broadcast(data) {
        if (this.sendAction) {
            this.sendAction(data); 
        }
    }

    /**
     * Leaves the room and closes the network connection.
     */
    disconnect() {
        if (this.room) {
            this.room.leave();
            this.room = null;
        }
    }
}