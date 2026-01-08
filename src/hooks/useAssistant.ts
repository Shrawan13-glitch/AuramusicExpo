import { useState } from 'react';

export const useAssistant = () => {
  const [showAssistant, setShowAssistant] = useState(false);

  const openAssistant = () => setShowAssistant(true);
  const closeAssistant = () => setShowAssistant(false);

  return {
    showAssistant,
    openAssistant,
    closeAssistant,
  };
};