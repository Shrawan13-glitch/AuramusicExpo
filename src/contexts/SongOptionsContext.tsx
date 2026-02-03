import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import SongOptionsModal, { SongOptionItem } from '../components/SongOptionsModal';

interface SongOptionsContextValue {
  openSongOptions: (song: SongOptionItem) => void;
}

const SongOptionsContext = createContext<SongOptionsContextValue | null>(null);

export const SongOptionsProvider = ({ children }: { children: React.ReactNode }) => {
  const [visible, setVisible] = useState(false);
  const [song, setSong] = useState<SongOptionItem | null>(null);

  const openSongOptions = useCallback((nextSong: SongOptionItem) => {
    setSong(nextSong);
    setVisible(true);
  }, []);

  const handleDismiss = useCallback(() => {
    setVisible(false);
  }, []);

  const value = useMemo(() => ({ openSongOptions }), [openSongOptions]);

  return (
    <SongOptionsContext.Provider value={value}>
      {children}
      <SongOptionsModal
        visible={visible}
        song={song}
        onDismiss={handleDismiss}
      />
    </SongOptionsContext.Provider>
  );
};

export const useSongOptions = () => {
  const context = useContext(SongOptionsContext);
  if (!context) {
    throw new Error('useSongOptions must be used within SongOptionsProvider');
  }
  return context;
};
