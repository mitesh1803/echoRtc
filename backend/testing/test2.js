import {WebSocket} from 'ws';

const roomId = 'test-room-2';

const createPeer = (name) => {
  const ws = new WebSocket('ws://localhost:8080');

  ws.on('open', () => {
    console.log(`[${name}] connected`);
    ws.send(JSON.stringify({ type: 'joinRoom', roomId }));
  });

  ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    console.log(`[${name}] received: ${msg.type}`);

    if (msg.type === 'routerRtpCapabilities') {
      console.log(`[${name}] ✅ got router caps`);
    }

    if (msg.type === 'newProducer') {
      console.log(`[${name}] ✅ new producer from peer ${msg.peerId} kind:${msg.kind}`);
    }

    if (msg.type === 'peerLeft') {
      console.log(`[${name}] peer left: ${msg.peerId}`);
    }
  });

  ws.on('close', () => console.log(`[${name}] disconnected`));
  return ws;
};

// connect peer1 first, then peer2 after 1 second
const peer1 = createPeer('Peer1');
setTimeout(() => {
  const peer2 = createPeer('Peer2');

  // disconnect peer2 after 3 seconds to test cleanup
  setTimeout(() => {
    console.log('\n[Peer2] leaving...');
    peer2.close();
  }, 3000);
}, 1000);