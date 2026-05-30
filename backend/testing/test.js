import {WebSocket} from 'ws';

const ws = new WebSocket('ws://localhost:8080');
const roomId = 'test-room-1';

ws.on('open', () => {
  console.log('connected');

  // Step 1: join room
  ws.send(JSON.stringify({
    type: 'joinRoom',
    roomId,
  }));
});

ws.on('message', async (data) => {
  const message = JSON.parse(data.toString());
  console.log('received:', JSON.stringify(message, null, 2));

  // Step 2: when we get router capabilities, create send transport
  if (message.type === 'routerRtpCapabilities') {
    console.log('\n✅ Got router RTP capabilities');
    console.log('Router supports codecs:', 
      message.rtpCapabilities.codecs.map(c => c.mimeType)
    );

    // create send transport
    ws.send(JSON.stringify({
      type: 'createTransport',
      roomId,
      direction: 'send',
    }));
  }

  // Step 3: when transport is created
  if (message.type === 'transportCreated') {
    console.log(`\n✅ Transport created [direction:${message.direction}]`);
    console.log('Transport ID:', message.params.id);
    console.log('ICE candidates:', message.params.iceCandidates.length);
  }
});

ws.on('error', console.error);
ws.on('close', () => console.log('disconnected'));