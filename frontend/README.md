# EchoRTC Frontend

Frontend UI for EchoRTC video meetings.

## Tech Stack

- React 19
- TypeScript
- Vite
- mediasoup-client
- lucide-react icons

## Features

- Meeting create/join flow with preview (`Landing.tsx`)
- Local media controls (mic/camera)
- Remote participant grid
- Display names
- Meeting code copy/share
- Real-time chat panel with unread badge

## Important Files

- `src/components/Landing.tsx`: pre-join experience + local camera preview
- `src/components/Room.tsx`: call screen, media signaling, transports, chat, participant rendering
- `src/App.tsx`: app routing entry
- `.env`: frontend runtime variables

## Environment

Create or update `frontend/.env`:

```env
VITE_WS_URL=ws://localhost:8080
```

This should point to the backend WebSocket server.

## Install

```bash
cd frontend
npm install
```

## Run Scripts

```bash
npm run dev      # start Vite dev server
npm run build    # type-check + production build
npm run lint     # run eslint
npm run preview  # preview production build
```

## Usage

1. Start backend on `ws://localhost:8080`.
2. Start frontend via `npm run dev`.
3. Open app in browser.
4. Enter your name.
5. Create a meeting (or enter code to join).
6. Open same meeting in another tab/browser to test multi-user flow.

## Notes

- Browser permissions for camera/mic are required.
- If remote tiles duplicate unexpectedly, verify stream grouping uses peer ID (not producer ID) in `Room.tsx`.
- Keep backend and frontend signaling message contracts in sync when updating message payload fields.
