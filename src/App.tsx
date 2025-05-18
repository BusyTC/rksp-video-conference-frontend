import { useState, useEffect } from 'react';
import type { Peer } from './types/WebRTC';
import { WebRTCService } from './services/WebRTCService';
import VideoGrid from './components/VideoGrid';

function App() {
  const [roomId, setRoomId] = useState('');
  const [isInRoom, setIsInRoom] = useState(false);
  const [webRTCService, setWebRTCService] = useState<WebRTCService | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [peers, setPeers] = useState<Map<string, Peer>>(new Map());
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    return () => {
      webRTCService?.cleanup();
    };
  }, [webRTCService]);

  const handleJoinRoom = async () => {
    if (!roomId.trim()) {
      alert('Please enter a room ID');
      return;
    }

    setIsLoading(true);
    try {
      const service = new WebRTCService(roomId, (updatedPeers) => {
        setPeers(new Map(updatedPeers));
      });

      const stream = await service.startLocalStream();
      setLocalStream(stream);
      setWebRTCService(service);
      setIsInRoom(true);
    } catch (error) {
      console.error('Error joining room:', error);
      alert('Failed to join room. Please check your camera and microphone permissions.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLeaveRoom = () => {
    webRTCService?.cleanup();
    setWebRTCService(null);
    setLocalStream(null);
    setPeers(new Map());
    setIsInRoom(false);
  };

  return (
    <div className="min-h-screen w-full bg-gray-100">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-center mb-8">Video Conference</h1>

        {!isInRoom ? (
          <div className="max-w-md mx-auto bg-white p-6 rounded-lg shadow-md">
            <div className="mb-4">
              <label htmlFor="roomId" className="block text-sm font-medium text-gray-700 mb-2">
                Room ID
              </label>
              <input
                type="text"
                id="roomId"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter room ID"
                disabled={isLoading}
              />
            </div>
            <button
              onClick={handleJoinRoom}
              disabled={isLoading}
              className={`w-full ${
                isLoading ? 'bg-blue-400' : 'bg-blue-500 hover:bg-blue-600'
              } text-white py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
            >
              {isLoading ? 'Joining...' : 'Join Room'}
            </button>
          </div>
        ) : (
          <div className="w-full">
            <div className="mb-4 flex justify-between items-center max-w-6xl mx-auto px-4">
              <h2 className="text-xl font-semibold">Room: {roomId}</h2>
              <button
                onClick={handleLeaveRoom}
                className="bg-red-500 text-white py-2 px-4 rounded-md hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
              >
                Leave Room
              </button>
            </div>
            <div className="max-w-[1920px] mx-auto">
              <VideoGrid localStream={localStream} peers={peers} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
