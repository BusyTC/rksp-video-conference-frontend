import type { WebRTCMessage, Peer } from '../types/WebRTC';

const configuration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
    ],
};

// This function is kept for future HTTP API endpoints
// that might be added to the backend service
// const getBackendUrl = () => {
//     if (import.meta.env.VITE_BACKEND_URL) {
//         return import.meta.env.VITE_BACKEND_URL;
//     }
//     const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
//     return `${protocol}//${window.location.hostname}:8080`;
// };

const getWebSocketUrl = () => {
    return "wss://rksp-video-conference-backend.onrender.com";
    // if (import.meta.env.VITE_BACKEND_URL) {
    //     const url = new URL(import.meta.env.VITE_BACKEND_URL);
    //     const wsProtocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    //     return `${wsProtocol}//${url.host}`;
    // }
    // const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // return `${wsProtocol}//${window.location.hostname}:8080`;
};

export class WebRTCService {
    private ws: WebSocket;
    private peers: Map<string, Peer>;
    private localStream: MediaStream | null;
    private clientId: string | null;
    private onPeerUpdate: (peers: Map<string, Peer>) => void;

    constructor(roomId: string, onPeerUpdate: (peers: Map<string, Peer>) => void) {
        const wsUrl = `${getWebSocketUrl()}/ws?room=${roomId}`;
        this.ws = new WebSocket(wsUrl);
        this.peers = new Map();
        this.localStream = null;
        this.clientId = null;
        this.onPeerUpdate = onPeerUpdate;

        this.setupWebSocket();
        
        // Add WebSocket connection state logging
        this.ws.onopen = () => {
            console.log('WebSocket connection established');
        };
        
        this.ws.onclose = () => {
            console.log('WebSocket connection closed');
            // Clean up peers when connection is lost
            this.peers.clear();
            this.onPeerUpdate(this.peers);
        };
        
        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
    }

    private setupWebSocket() {
        this.ws.onmessage = async (event) => {
            const message: WebRTCMessage = JSON.parse(event.data);
            console.log('Received WebSocket message:', message);

            switch (message.type) {
                case 'client-id':
                    this.clientId = message.payload.id;
                    console.log('Received client ID:', this.clientId);
                    break;

                case 'peers':
                    const peers = message.payload.peers as string[];
                    console.log('Received peer list:', peers);
                    // Clear existing peers before adding new ones
                    this.peers.clear();
                    for (const peerId of peers) {
                        await this.createPeerConnection(peerId, true);
                    }
                    this.onPeerUpdate(this.peers);
                    break;

                case 'user-joined':
                    console.log('User joined:', message.from);
                    if (!this.peers.has(message.from)) {
                        await this.createPeerConnection(message.from, false);
                        this.onPeerUpdate(this.peers);
                    }
                    break;

                case 'user-left':
                    console.log('User left:', message.from);
                    this.removePeer(message.from);
                    break;

                case 'offer':
                    console.log('Received offer from:', message.from);
                    await this.handleOffer(message);
                    break;

                case 'answer':
                    console.log('Received answer from:', message.from);
                    await this.handleAnswer(message);
                    break;

                case 'ice-candidate':
                    console.log('Received ICE candidate from:', message.from);
                    await this.handleIceCandidate(message);
                    break;
            }
        };
    }

    public async startLocalStream() {
        try {
            // Try to get both video and audio
            try {
                this.localStream = await navigator.mediaDevices.getUserMedia({
                    video: true,
                    audio: true,
                });
            } catch (error) {
                console.log('Failed to get video and audio, trying audio only:', error);
                // Try audio only
                try {
                    this.localStream = await navigator.mediaDevices.getUserMedia({
                        video: false,
                        audio: true,
                    });
                } catch (audioError) {
                    console.log('Failed to get audio, proceeding without media devices:', audioError);
                    // Proceed without any media devices
                    this.localStream = null;
                }
            }

            // Add local stream to all existing peer connections if we have one
            if (this.localStream) {
                console.log('Adding local stream to existing peers:', this.peers.size);
                for (const [peerId, peer] of this.peers) {
                    console.log('Adding tracks to peer:', peerId);
                    this.addLocalStreamTracks(peer.connection);
                }
            }

            return this.localStream;
        } catch (error) {
            console.error('Error accessing media devices:', error);
            throw error;
        }
    }

    private addLocalStreamTracks(peerConnection: RTCPeerConnection) {
        if (this.localStream) {
            const senders = peerConnection.getSenders();
            this.localStream.getTracks().forEach((track) => {
                // Check if we already have a sender for this track type
                const hasTrackType = senders.some(sender => 
                    sender.track && sender.track.kind === track.kind
                );
                
                if (!hasTrackType) {
                    console.log('Adding track to peer connection:', track.kind);
                    peerConnection.addTrack(track, this.localStream!);
                } else {
                    console.log('Track type already exists:', track.kind);
                }
            });
        }
    }

    private async createPeerConnection(peerId: string, isInitiator: boolean) {
        console.log(`Creating peer connection with ${peerId} (initiator: ${isInitiator})`);
        
        // Check if we already have this peer
        if (this.peers.has(peerId)) {
            console.log(`Peer ${peerId} already exists, cleaning up old connection`);
            this.removePeer(peerId);
        }

        const peerConnection = new RTCPeerConnection(configuration);

        const peer: Peer = {
            id: peerId,
            connection: peerConnection,
        };

        this.peers.set(peerId, peer);

        // Add local stream if available
        if (this.localStream) {
            console.log('Adding local stream tracks during peer creation');
            this.addLocalStreamTracks(peerConnection);
        }

        // Handle connection state changes
        peerConnection.onconnectionstatechange = () => {
            console.log(`Peer ${peerId} connection state:`, peerConnection.connectionState);
            if (peerConnection.connectionState === 'failed' || 
                peerConnection.connectionState === 'closed') {
                console.log(`Removing failed peer connection: ${peerId}`);
                this.removePeer(peerId);
            }
        };

        peerConnection.oniceconnectionstatechange = () => {
            console.log(`Peer ${peerId} ICE connection state:`, peerConnection.iceConnectionState);
            if (peerConnection.iceConnectionState === 'failed') {
                console.log('ICE connection failed, attempting to restart ICE');
                this.restartIce(peerId, peerConnection);
            }
        };

        // Handle ICE candidates
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                console.log(`Sending ICE candidate to ${peerId}:`, event.candidate.type);
                this.sendMessage({
                    type: 'ice-candidate',
                    from: this.clientId!,
                    to: peerId,
                    payload: event.candidate,
                });
            }
        };

        // Handle incoming streams
        peerConnection.ontrack = (event) => {
            console.log(`Received track from peer ${peerId}:`, event.track.kind);
            const peer = this.peers.get(peerId);
            if (peer) {
                peer.stream = event.streams[0];
                this.onPeerUpdate(this.peers);
            }
        };

        // Handle renegotiation needed
        peerConnection.onnegotiationneeded = async () => {
            console.log(`Negotiation needed for peer ${peerId}`);
            if (isInitiator) {
                try {
                    await this.createAndSendOffer(peerConnection, peerId);
                } catch (error) {
                    console.error('Error during renegotiation:', error);
                }
            }
        };

        if (isInitiator) {
            await this.createAndSendOffer(peerConnection, peerId);
        }

        this.onPeerUpdate(this.peers);
        return peer;
    }

    private async createAndSendOffer(peerConnection: RTCPeerConnection, peerId: string) {
        try {
            console.log(`Creating offer for peer ${peerId}`);
            const offer = await peerConnection.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: true,
                iceRestart: peerConnection.iceConnectionState === 'failed'
            });

            console.log('Setting local description:', offer.type);
            await peerConnection.setLocalDescription(offer);

            this.sendMessage({
                type: 'offer',
                from: this.clientId!,
                to: peerId,
                payload: offer,
            });
        } catch (error) {
            console.error(`Error creating offer for peer ${peerId}:`, error);
            this.removePeer(peerId);
        }
    }

    private async restartIce(peerId: string, peerConnection: RTCPeerConnection) {
        if (peerConnection.iceConnectionState === 'failed') {
            try {
                const offer = await peerConnection.createOffer({ iceRestart: true });
                await peerConnection.setLocalDescription(offer);
                this.sendMessage({
                    type: 'offer',
                    from: this.clientId!,
                    to: peerId,
                    payload: offer,
                });
            } catch (error) {
                console.error('Error restarting ICE:', error);
            }
        }
    }

    private async handleOffer(message: WebRTCMessage) {
        const peerId = message.from;
        let peer = this.peers.get(peerId);

        if (!peer) {
            peer = await this.createPeerConnection(peerId, false);
        }

        try {
            console.log('Setting remote description from offer');
            await peer.connection.setRemoteDescription(message.payload);
            
            console.log('Creating answer');
            const answer = await peer.connection.createAnswer();
            
            console.log('Setting local description from answer');
            await peer.connection.setLocalDescription(answer);

            this.sendMessage({
                type: 'answer',
                from: this.clientId!,
                to: peerId,
                payload: answer,
            });
        } catch (error) {
            console.error('Error handling offer:', error);
            this.removePeer(peerId);
        }
    }

    private async handleAnswer(message: WebRTCMessage) {
        const peer = this.peers.get(message.from);
        if (peer) {
            try {
                console.log('Setting remote description from answer');
                await peer.connection.setRemoteDescription(message.payload);
            } catch (error) {
                console.error('Error handling answer:', error);
                this.removePeer(message.from);
            }
        }
    }

    private async handleIceCandidate(message: WebRTCMessage) {
        const peer = this.peers.get(message.from);
        if (peer && peer.connection.remoteDescription) {
            try {
                await peer.connection.addIceCandidate(message.payload);
            } catch (error) {
                console.error('Error adding ICE candidate:', error);
            }
        } else {
            console.log('Postponing ICE candidate, no remote description yet');
        }
    }

    private removePeer(peerId: string) {
        const peer = this.peers.get(peerId);
        if (peer) {
            peer.connection.close();
            this.peers.delete(peerId);
            this.onPeerUpdate(this.peers);
        }
    }

    private sendMessage(message: WebRTCMessage) {
        if (this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        }
    }

    public cleanup() {
        this.localStream?.getTracks().forEach(track => track.stop());
        this.peers.forEach(peer => peer.connection.close());
        this.peers.clear();
        this.ws.close();
    }
} 