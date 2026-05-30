import * as mediasoup from 'mediasoup';
import type { types } from 'mediasoup';

let worker: types.Worker;

export const createWorker = async (): Promise<types.Worker> => {
  worker = await mediasoup.createWorker({
    logLevel: 'warn',
    rtcMinPort: 10000,
    rtcMaxPort: 10100,
  });

  console.log(`mediasoup worker created [pid:${worker.pid}]`);

  worker.on('died', () => {
    console.error('mediasoup worker died — exiting');
    process.exit(1);
  });

  return worker;
};

export const getWorker = () => worker;