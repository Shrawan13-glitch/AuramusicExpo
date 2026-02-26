type Listener = () => void;

const playerBgStyleListeners = new Set<Listener>();

export const notifyPlayerBgStyleChanged = () => {
  playerBgStyleListeners.forEach((listener) => listener());
};

export const subscribePlayerBgStyleChanged = (listener: Listener) => {
  playerBgStyleListeners.add(listener);
  return () => {
    playerBgStyleListeners.delete(listener);
  };
};
