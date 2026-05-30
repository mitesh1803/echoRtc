import type { types } from 'mediasoup';

export const createWebRtcTransport = async (
  router: types.Router
): Promise<types.WebRtcTransport> => {
  const transport = await router.createWebRtcTransport({
    listenIps: [
      {
        ip: '0.0.0.0',
        announcedIp: process.env.ANNOUNCED_IP ?? '127.0.0.1',
      },
    ],
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,
  });

  console.log(`transport created [id:${transport.id}]`);
  return transport;
};