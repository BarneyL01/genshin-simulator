import type { Request, Response } from '../worker/protocol';

type Distribute<T> = T extends unknown ? Omit<T, 'id'> : never;

/** Promise wrapper around the simulation worker. */
class SimClient {
  private worker = new Worker(new URL('../worker/sim.worker.ts', import.meta.url), { type: 'module' });
  private next = 1;
  private pending = new Map<number, { resolve: (r: Response & { ok: true }) => void; reject: (e: Error) => void }>();

  constructor() {
    this.worker.onmessage = (e: MessageEvent<Response>) => {
      const p = this.pending.get(e.data.id);
      if (!p) return;
      this.pending.delete(e.data.id);
      if (e.data.ok) p.resolve(e.data);
      else p.reject(new Error(e.data.error));
    };
    this.worker.onerror = (e) => {
      for (const p of this.pending.values()) p.reject(new Error(e.message));
      this.pending.clear();
    };
  }

  request<T extends Response & { ok: true }>(req: Distribute<Request>): Promise<T> {
    const id = this.next++;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as never, reject });
      this.worker.postMessage({ ...req, id });
    });
  }
}

let client: SimClient | undefined;
export const sim = () => (client ??= new SimClient());
