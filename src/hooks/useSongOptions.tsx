import { useState } from 'react';

export const useSongOptions = () => {
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedSong, setSelectedSong] = useState(null);

  const showOptions = (song: any) => {
    setSelectedSong(song);
    setModalVisible(true);
  };

  const hideOptions = () => {
    setModalVisible(false);
    setSelectedSong(null);
  };

  return {
    modalVisible,
    selectedSong,
    showOptions,
    hideOptions,
  };
};