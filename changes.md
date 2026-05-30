# Changes

## Styling Improvements (Vibrant Update)
- Replaced the simple dark mode with an animated, multi-colored mesh gradient background in `index.css`.
- Updated primary buttons to feature striking violet-to-pink gradients with dynamic glow shadows.
- Refined the `Landing.tsx` UI:
  - **Premium Split Layout**: Transformed the centered landing page into a professional two-column layout (Text & Actions on the left, Camera Preview on the right).
  - **Dynamic Backgrounds**: Added a large animated glowing gradient blob behind the camera preview.
  - **Typography**: Increased main title size to 72px and tightened line-height for a bolder, modern appearance.
  - Applied gradient text and a smooth floating animation to the main title.
  - Added hover zoom effects and larger drop-shadows to the live camera preview.

## New Features
- **Dynamic Auto-Scaling Grid**: The meeting room now automatically adjusts its grid layout based on how many participants have joined:
  - 1 Participant: Takes up the full center stage (`.grid-1`).
  - 2 Participants: Evenly splits the screen side-by-side (`.grid-2`).
  - 3-4 Participants: Creates a 2x2 grid (`.grid-4`).
  - 5+ Participants: Uses responsive wrapping (`.grid-auto`).
  - *Note*: Updated `Room.tsx` to actively map and render *all* remote participant streams, resolving an issue where only the first remote user was rendered.
- Added a "Share" button in the active meeting room header.
  - Utilizes the native Web Share API (`navigator.share`) to seamlessly share the meeting code to other apps.
  - Automatically falls back to copying the meeting code to the clipboard if the native share API is unavailable.

## Bug Fixes
- Fixed a bug where a single participant joining would increase the participant count by 2.
  - **Root Cause**: The frontend was grouping `MediaStream` tracks using Mediasoup's `producerId`. Because one participant produces two tracks (audio and video), it resulted in two map entries per user.
  - **Resolution**: Updated `Room.tsx` to maintain a mapping of `producerId -> peerId` when receiving `newProducer` and `existingProducers` messages from the backend. Grouping is now correctly done by `peerId`, ensuring only 1 entry per participant.

## Frontend Redesign
- Replaced basic CSS with a modern design system in `index.css`. Added glassmorphism components, new typography, and a dark theme.
- Updated `App.css` to act as a component library with styles for buttons, input fields, and specific components for the landing and room pages.
- Installed `lucide-react` for high-quality SVG icons.
- Redesigned `Landing.tsx`:
  - Added a glassmorphism panel for the join/create meeting interface.
  - Implemented a camera preview with loading states.
  - Improved layout with clear calls to action and better visual hierarchy.
- Redesigned `Room.tsx`:
  - Created a new header with participant count and a "Copy Room ID" button.
  - Implemented a responsive video grid layout for local and remote streams.
  - Added participant name tags overlays on videos.
  - Updated the control bar with modern icon buttons for mic, camera, and leave actions.
- Maintained all existing WebRTC/Mediasoup wiring logic; only the `RENDER` block and imports were modified in `Room.tsx`.
