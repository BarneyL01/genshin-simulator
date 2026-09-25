/// <reference lib="webworker" />
// Entry point for the simulation Web Worker. Engine wiring arrives in M2.
self.onmessage = (e: MessageEvent) => {
  self.postMessage({ type: 'echo', payload: e.data });
};
