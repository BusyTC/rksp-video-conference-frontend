export interface WebRTCMessage {
    type: string;
    from: string;
    to?: string;
    payload: any;
}

export interface Peer {
    id: string;
    connection: RTCPeerConnection;
    stream?: MediaStream;
} 