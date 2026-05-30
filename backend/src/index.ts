import { WebSocketServer, WebSocket } from 'ws';
import { createWorker } from './worker.js';
import { createRouter } from './router.js';
import { createWebRtcTransport } from './transport.js';
import type { types } from 'mediasoup';
import type { Room, Peer, ChatMessage } from './types.js';
import { IncomingMessage } from 'http';
import { generateSummary } from './gemini.js'

const PORT = Number(process.env.PORT) || 8080;

const wss = new WebSocketServer({ port: PORT });
const rooms = new Map<string, Room>();

const bootstrap = async () => {
  const worker = await createWorker();
  console.log(`Server ready on ws://localhost:${PORT}`);

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    console.log('new client connected');

    // generate unique peer ID
    const peerId = crypto.randomUUID();

    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        await handleMessage(ws, peerId, message, worker);
      } catch (err) {
        console.error('message error', err);
        send(ws, { type: 'error', message: String(err) });
      }
    });

    ws.on('close', () => {
      console.log(`peer ${peerId} disconnected`);
      handleDisconnect(peerId);
    });

    ws.on('error', console.error);
  });
};

//  MESSAGE ROUTER 
const handleMessage = async (
  ws: WebSocket,
  peerId: string,
  message: any,
  worker: types.Worker
) => {
  console.log(`[${message.type}] from peer ${peerId}`);

  switch (message.type) {

    case 'joinRoom':
      await handleJoinRoom(ws, peerId, message.roomId, message.displayName, worker);
      break;

    case 'createTransport':
      await handleCreateTransport(ws, peerId, message.roomId, message.direction);
      break;

    case 'connectTransport':
      await handleConnectTransport(peerId, message.roomId, message.direction, message.dtlsParameters);
      break;

    case 'produce':
      await handleProduce(ws, peerId, message.roomId, message.transportId, message.kind, message.rtpParameters, message.correlationId, message.appData);
      break;

    case 'consume':
      await handleConsume(ws, peerId, message.roomId, message.producerId);
      break;

    case 'chatMessage':
      handleChatMessage(peerId, message.roomId, message.text, message.displayName);
      break;

    case 'rtpCapabilities':
      {
        const room = rooms.get(message.roomId);
        const peer = room?.peers.get(peerId);
        if (peer) peer.rtpCapabilities = message.rtpCapabilities;
        break;
      }
    case 'transcriptChunk':
      {
        const r = rooms.get(message.roomId);
        if (r) r.transcript.push({
          displayName: message.displayName,
          text: message.text,
          timestamp: message.timestamp,
        })
      };
      break;
    case 'generateSummary': {
      const summaryRoom = rooms.get(message.roomId);
      if (!summaryRoom) return;
      if (summaryRoom.transcript.length === 0) {
        send(ws, { type: 'No transcript yet — talk first!' });
        return;
      }
      const requestingPeer = summaryRoom.peers.get(peerId);
      if (!requestingPeer) return;
      await generateSummary(summaryRoom.transcript, [requestingPeer]);
      break;
    }
    default:
      console.log('unknown message type:', message.type);
  }
};

// JOIN ROOM 
const handleJoinRoom = async (
  ws: WebSocket,
  peerId: string,
  roomId: string,
  displayName: string,
  worker: types.Worker
) => {
  // create room if it doesnt exist
  if (!rooms.has(roomId)) {
    const router = await createRouter(worker);
    rooms.set(roomId, { router, peers: new Map(), producerPeerMap: new Map(), transcript: [] });
    console.log(`room ${roomId} created`);
  }

  const room = rooms.get(roomId)!;

  // create peer
  const peer: Peer = {
    id: peerId,
    socket: ws,
    displayName: String(displayName ?? 'Anonymous').slice(0, 40),
    producers: new Map(),
    consumers: new Map(),
  };

  room.peers.set(peerId, peer);
  console.log(`peer ${peerId} joined room ${roomId}`);

  // send router rtp capabilities to client
  // client needs this to load their mediasoup Device
  send(ws, {
    type: 'routerRtpCapabilities',
    rtpCapabilities: room.router.rtpCapabilities,
  });
};

//  CREATE TRANSPORT 
const handleCreateTransport = async (
  ws: WebSocket,
  peerId: string,
  roomId: string,
  direction: 'send' | 'recv'
) => {
  const room = rooms.get(roomId);
  if (!room) return;

  const peer = room.peers.get(peerId);
  if (!peer) return;

  const transport = await createWebRtcTransport(room.router);

  // store on peer by direction
  if (direction === 'send') {
    peer.sendTransport = transport;
  } else {
    peer.recvTransport = transport;
  }
  if (direction === 'recv') {
    // send all existing producers in the room to this peer
    const existingProducers: {
      producerId: string;
      peerId: string;
      displayName: string;
      kind: string;
      mediaTag: string | null;
    }[] = [];

    room.peers.forEach((otherPeer) => {
      if (otherPeer.id !== peerId) {
        otherPeer.producers.forEach((producer) => {
          existingProducers.push({
            producerId: producer.id,
            peerId: otherPeer.id,
            displayName: otherPeer.displayName,
            kind: producer.kind,
            mediaTag: (producer.appData as any)?.mediaTag ?? null,
          });
        });
      }
    });

    if (existingProducers.length > 0) {
      send(ws, {
        type: 'existingProducers',
        producers: existingProducers,
      });
    }
  }
  // send transport params to client so they can connect
  send(ws, {
    type: 'transportCreated',
    direction,
    params: {
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
    },
  });
};

// CONNECT TRANSPORT 
// client sends dtlsParameters after connecting their side
const handleConnectTransport = async (
  peerId: string,
  roomId: string,
  direction: 'send' | 'recv',
  dtlsParameters: types.DtlsParameters
) => {
  const room = rooms.get(roomId);
  if (!room) return;

  const peer = room.peers.get(peerId);
  if (!peer) return;

  const transport = direction === 'send'
    ? peer.sendTransport
    : peer.recvTransport;

  if (!transport) return;

  await transport.connect({ dtlsParameters });
  console.log(`transport connected [peer:${peerId} direction:${direction}]`);
};

//  PRODUCE 
// peer starts sending a track (camera or mic)
const handleProduce = async (
  ws: WebSocket,
  peerId: string,
  roomId: string,
  transportId: string,
  kind: types.MediaKind,
  rtpParameters: types.RtpParameters,
  correlationId: string,
  appData?: Record<string, unknown>
) => {
  const room = rooms.get(roomId);
  if (!room) return;

  const peer = room.peers.get(peerId);
  if (!peer || !peer.sendTransport) return;

  const producer = await peer.sendTransport.produce({ kind, rtpParameters, appData: appData ?? {} });
  peer.producers.set(producer.id, producer);
  room.producerPeerMap.set(producer.id, peerId);

  const mediaTag = (appData as any)?.mediaTag ?? null;

  console.log(`producer created [peer:${peerId} kind:${kind} id:${producer.id} tag:${mediaTag}]`);

  // tell the producer their producerId
  send(ws, {
    type: 'produced',
    producerId: producer.id,
    correlationId,
    kind,
  });

  // notify all OTHER peers in the room that a new producer exists
  room.peers.forEach((otherPeer) => {
    if (otherPeer.id !== peerId && otherPeer.recvTransport) {
      send(otherPeer.socket, {
        type: 'newProducer',
        producerId: producer.id,
        peerId,
        displayName: peer.displayName,
        kind,
        mediaTag,
      });
    }
  });
};

// CONSUME 
// peer wants to receive someone else's track
const handleConsume = async (
  ws: WebSocket,
  peerId: string,
  roomId: string,
  producerId: string
) => {

  const room = rooms.get(roomId);
  if (!room) return;

  const peer = room.peers.get(peerId);
  if (!peer || !peer.recvTransport) return;

  if (!peer.rtpCapabilities) {
    console.error(`peer ${peerId} has no rtpCapabilities yet — cannot consume`);
    send(ws, { type: 'error', message: 'rtpCapabilities not received yet, try again' });
    return;
  }

  const producerPeerId = room.producerPeerMap.get(producerId) ?? '';
  // Look up the actual producer object to read its appData
  const producerOwner = room.peers.get(producerPeerId);
  const producerObj = producerOwner?.producers.get(producerId);
  const mediaTag = (producerObj?.appData as any)?.mediaTag ?? null;

  // check if peer can consume this producer
  if (!room.router.canConsume({ producerId, rtpCapabilities: peer.rtpCapabilities })) {
    console.error(`peer ${peerId} cannot consume producer ${producerId}`);
    return;
  }

  const consumer = await peer.recvTransport.consume({
    producerId,
    rtpCapabilities: peer.rtpCapabilities,
    paused: false,
  });

  peer.consumers.set(consumer.id, consumer);

  console.log(`consumer created [peer:${peerId} kind:${consumer.kind} tag:${mediaTag}]`);

  // send consumer params to client so they can receive the track
  send(ws, {
    type: 'consumed',
    consumerId: consumer.id,
    producerId,
    kind: consumer.kind,
    rtpParameters: consumer.rtpParameters,
    mediaTag,
  });
};

// CHAT 
// broadcast a chat message to all peers in the room
const handleChatMessage = (
  peerId: string,
  roomId: string,
  text: string,
  displayName: string,
) => {
  const room = rooms.get(roomId);
  if (!room) return;

  if (!text || typeof text !== 'string' || text.trim().length === 0) return;
  if (text.length > 2000) {
    const peer = room.peers.get(peerId);
    if (peer) send(peer.socket, { type: 'error', message: 'Message too long (max 2000 chars)' });
    return;
  }

  const msg: ChatMessage = {
    id: crypto.randomUUID(),
    peerId,
    displayName: String(displayName ?? 'Anonymous').slice(0, 40),
    text: text.trim(),
    timestamp: Date.now(),
  };

  // broadcast to ALL peers including sender so everyone gets the same msg object
  room.peers.forEach((peer) => {
    send(peer.socket, { type: 'chatMessage', message: msg });
  });

  console.log(`[chat] room:${roomId} peer:${peerId} "${msg.text.slice(0, 60)}"`);
};

//  DISCONNECT 
const handleDisconnect = (peerId: string) => {
  for (const [roomId, room] of rooms) {
    const peer = room.peers.get(peerId);

    if (!peer) continue;

    console.log(`peer ${peerId} leaving room ${roomId}`);

    // collect this peer's producer IDs before closing
    const producerIds = [...peer.producers.keys()];

    peer.producers.forEach(p => p.close());
    peer.consumers.forEach(c => c.close());
    peer.sendTransport?.close();
    peer.recvTransport?.close();

    // close consumers on OTHER peers that were consuming this peer's producers,
    // and notify them so their UI can remove the video tile
    room.peers.forEach((otherPeer) => {
      if (otherPeer.id === peerId) return;

      otherPeer.consumers.forEach((consumer, consumerId) => {
        if (producerIds.includes(consumer.producerId)) {
          consumer.close();
          otherPeer.consumers.delete(consumerId);
        }
      });

      send(otherPeer.socket, {
        type: 'peerLeft',
        peerId,
      });
    });

    // clean up room-level producer map
    producerIds.forEach(id => room.producerPeerMap.delete(id));
    room.peers.delete(peerId);
    if (room.peers.size === 0) {
      rooms.delete(roomId);
      console.log(`room ${roomId} deleted`);
    }
    break;
  }
};

// HELPER
const send = (ws: WebSocket, message: object) => {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
};

// START 
bootstrap();