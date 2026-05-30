# EchoRTC Backend

Backend signaling and SFU control server for EchoRTC.

## Tech Stack

- Node.js (ESM)
- TypeScript
- `ws` for WebSocket signaling
- `mediasoup` for SFU media routing

## Key Files

- `src/index.ts`: WebSocket server, message router, room/peer management
- `src/worker.ts`: mediasoup worker creation
- `src/router.ts`: router creation + codec list
- `src/transport.ts`: WebRTC transport creation options
- `src/types.ts`: backend room/peer/chat types

## Behavior Summary

- Creates rooms on first `joinRoom`
- Stores peers with:
  - display name
  - send/recv transports
  - producers and consumers
- Maps producer IDs to peer IDs for proper remote-stream grouping
- Broadcasts `newProducer` to other peers
- Handles `consume` and returns consumer parameters
- Broadcasts chat messages to all peers in the room
- Cleans up transports/producers/consumers and notifies peers on disconnect

## Install

```bash
cd backend
npm install
```

## Run

Current package scripts only define `test` placeholder. Runtime is typically started from built output:

```bash
cd backend
node dist/index.js
```

If you modify `src/` files, ensure `dist/` is up to date before running.

## WebSocket Message Types

Incoming from client:
- `joinRoom`
- `rtpCapabilities`
- `createTransport`
- `connectTransport`
- `produce`
- `consume`
- `chatMessage`

Outgoing to client:
- `routerRtpCapabilities`
- `transportCreated`
- `produced`
- `newProducer`
- `existingProducers`
- `consumed`
- `peerLeft`
- `chatMessage`
- `error`

## Default Network Settings

- Signaling WebSocket server: `ws://localhost:8080`
- mediasoup worker ports: `10000-10100`
- WebRTC transport listen IP: `0.0.0.0` (announced as `127.0.0.1` in current config)

Adjust transport configuration in `src/transport.ts` for deployment behind public IP / NAT.

