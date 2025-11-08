import { useState, useEffect } from 'react';

interface VideoSettings {
  autoplayEnabled: boolean;
  muteEnabled: boolean;
  setAutoplayEnabled: (enabled: boolean) => void;
  setMuteEnabled: (enabled: boolean) => void;
}

export const useVideoSettings = (): VideoSettings => {
  const [autoplayEnabled, setAutoplayEnabledState] = useState(() => {
    const stored = localStorage.getItem('videoAutoplay');
    return stored === null ? true : stored === 'true';
  });

  const [muteEnabled, setMuteEnabledState] = useState(() => {
    const stored = localStorage.getItem('videoMute');
    return stored === null ? true : stored === 'true';
  });

  const setAutoplayEnabled = (enabled: boolean) => {
    setAutoplayEnabledState(enabled);
    localStorage.setItem('videoAutoplay', String(enabled));
  };

  const setMuteEnabled = (enabled: boolean) => {
    setMuteEnabledState(enabled);
    localStorage.setItem('videoMute', String(enabled));
  };

  return {
    autoplayEnabled,
    muteEnabled,
    setAutoplayEnabled,
    setMuteEnabled,
  };
};
