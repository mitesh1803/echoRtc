import type { types } from 'mediasoup';
import { WebSocket } from 'ws';

export type Peer = {
  id: string;
  socket: WebSocket;
  displayName: string;   
  sendTransport?: types.WebRtcTransport;
  recvTransport?: types.WebRtcTransport;
  producers: Map<string, types.Producer>;
  consumers: Map<string, types.Consumer>;
  rtpCapabilities?: types.RtpCapabilities;

};

export type Room = {
    router: types.Router;
    peers: Map<string, Peer>;
    producerPeerMap: Map<string, string>; // producerId → peerId
    transcript: TranscriptChunk[]; 

  };

export type ChatMessage = {
    id: string;
    peerId: string;
    displayName: string;
    text: string;
    timestamp: number;
  };

export type TranscriptChunk = {
    displayName: string;
    text: string;
    timestamp: number;
  };