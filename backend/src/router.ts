import type { types } from 'mediasoup';

const mediaCodecs: types.RtpCodecCapability[] = [
  {
    kind: 'audio',
    mimeType: 'audio/opus',
    preferredPayloadType: 111,
    clockRate: 48000,
    channels: 2,
  },
  {
    kind: 'video',
    mimeType: 'video/VP8',
    preferredPayloadType: 96,
    clockRate: 90000,
    parameters: {},
  },
];

export const createRouter = async (
  worker: types.Worker
): Promise<types.Router> => {
  const router = await worker.createRouter({ mediaCodecs });
  console.log('router created');
  return router;
};