# EchoRTC

EchoRTC is a realtime video meeting app built with:

- `frontend/`: React + Vite + TypeScript + mediasoup-client
- `backend/`: Node.js + TypeScript + WebSocket (`ws`) + mediasoup

The app supports:

- Room creation/join by meeting code
- Multi-participant audio/video via mediasoup SFU
- In-meeting chat
- Basic meeting controls (mute/camera/leave/share/copy code)

## Project Structure

```text
webrtc/
  backend/
    src/
      index.ts        # WebSocket signaling server + room/peer lifecycle
      worker.ts       # mediasoup worker bootstrap
      router.ts       # mediasoup router + codec configuration
      transport.ts    # WebRTC transport factory
      types.ts        # Room/Peer/Chat shared backend types
  frontend/
    src/
      components/
        Landing.tsx   # Join/create screen + local preview
        Room.tsx      # Call UI, media transports, chat, participant grid
      App.tsx         # Router entry
```

## Architecture

[→ Diagram](https://excalidraw.com/#json=IBeI8744jKVrr3bp76YDc,Zb_FMMrkviE7lPjt_ZIUwg)  

## Case Study

A full technical breakdown — decisions, challenges, signaling flow, and learnings:
[→ Read the case study](https://mitesh1803.github.io/echoRtc)

## Prerequisites

- Node.js 20+ (recommended; mediasoup requires modern Node)
- npm
- Camera/microphone permissions in your browser
- Python 3, make, and a C++ compiler (mediasoup compiles native binaries on `npm install`)
  - Ubuntu/Debian: `sudo apt install build-essential python3`
  - macOS: Xcode Command Line Tools — `xcode-select --install`
  - Windows: not officially supported by mediasoup without WSL2

## Quick Start

1. Install backend dependencies:
  ```bash
   cd backend
   npm install
  ```
2. Install frontend dependencies:
  ```bash
   cd frontend
   npm install
  ```
3. Configure frontend environment:
  - `frontend/.env`
  - Example:
    ```env
    VITE_WS_URL=ws://localhost:8080
    ```
4. Start backend (terminal 1):
  ```bash
   cd backend
   node dist/index.js
  ```
5. Start frontend (terminal 2):
  ```bash
   cd frontend
   npm run dev
  ```
6. Open the Vite URL (usually `http://localhost:5173`), create a meeting, and join from another tab/browser.

## Notes

- The backend currently does not define a `build` script in `backend/package.json`. If you edit backend TypeScript, compile it to refresh `dist/` before running `node dist/index.js`.
- Frontend has standard scripts (`dev`, `build`, `lint`, `preview`) in `frontend/package.json`.

## Current Signaling Flow (High Level)

1. Client sends `joinRoom` with `roomId` and `displayName`.
2. Server returns `routerRtpCapabilities`.
3. Client sends `rtpCapabilities` and requests send/recv transports.
4. Producer side sends `produce`; server broadcasts `newProducer`.
5. Consumers send `consume`; server responds with `consumed` parameters.
6. Client creates consumer tracks and renders remote streams.
7. Chat messages are broadcast to all peers in the room.

