const listeners = new Set<() => void>();

export const emitWatchlistUpdated = () => {
  listeners.forEach((callback) => callback());
};

export const listenForWatchlistUpdates = (callback: () => void) => {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
};
