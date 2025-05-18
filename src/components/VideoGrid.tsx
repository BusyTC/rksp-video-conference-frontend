import React from 'react';
import type { Peer } from '../types/WebRTC';

interface VideoGridProps {
    localStream: MediaStream | null;
    peers: Map<string, Peer>;
}

const VideoGrid: React.FC<VideoGridProps> = ({ localStream, peers }) => {
    const hasVideoTrack = (stream: MediaStream | null | undefined) => {
        if (!stream) return false;
        return stream.getVideoTracks().length > 0;
    };

    const hasAudioTrack = (stream: MediaStream | null | undefined) => {
        if (!stream) return false;
        return stream.getAudioTracks().length > 0;
    };

    const renderPlaceholder = (label: string, hasAudio: boolean) => (
        <div className="flex items-center justify-center bg-gray-700 w-full h-full">
            <div className="text-center">
                <div className="w-20 h-20 bg-gray-600 rounded-full flex items-center justify-center mx-auto mb-2">
                    <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                </div>
                <p className="text-gray-300 text-sm">{label}</p>
                {hasAudio && (
                    <p className="text-green-400 text-xs mt-1">
                        Audio Only
                    </p>
                )}
            </div>
        </div>
    );

    return (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4">
            {/* Local video */}
            <div className="relative aspect-video bg-gray-800 rounded-lg overflow-hidden">
                {hasVideoTrack(localStream) ? (
                    <video
                        autoPlay
                        playsInline
                        muted
                        ref={(video) => {
                            if (video) video.srcObject = localStream;
                        }}
                        className="w-full h-full object-cover"
                    />
                ) : (
                    renderPlaceholder("You", hasAudioTrack(localStream))
                )}
                <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 px-2 py-1 rounded text-white text-sm">
                    You
                </div>
            </div>

            {/* Remote videos */}
            {Array.from(peers.entries()).map(([peerId, peer]) => (
                <div key={peerId} className="relative aspect-video bg-gray-800 rounded-lg overflow-hidden">
                    {hasVideoTrack(peer.stream) ? (
                        <video
                            autoPlay
                            playsInline
                            ref={(video) => {
                                if (video && peer.stream) video.srcObject = peer.stream;
                            }}
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        renderPlaceholder(`Participant ${peerId}`, hasAudioTrack(peer.stream))
                    )}
                    <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 px-2 py-1 rounded text-white text-sm">
                        Participant {peerId}
                    </div>
                </div>
            ))}
        </div>
    );
};

export default VideoGrid; 