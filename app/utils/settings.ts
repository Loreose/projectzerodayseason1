import { useState, useEffect } from 'react';

// Define available wallpapers
export const WALLPAPERS = [
  { 
    id: 'default', 
    name: 'Gece Yarısı Gradyanı', 
    value: 'bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460]' 
  },
  { 
    id: 'obsidian', 
    name: 'Obsidyen', 
    value: 'bg-black' 
  },
  { 
    id: 'forest', 
    name: 'Dijital Orman', 
    value: 'bg-gradient-to-br from-[#051410] via-[#0b2922] to-[#0f3460]' 
  },
  { 
    id: 'sunset', 
    name: 'Siber Gün Batımı', 
    value: 'bg-gradient-to-br from-[#2e1a1a] via-[#3e1628] to-[#600f34]' 
  },
  { 
    id: 'nebula', 
    name: 'Nebula', 
    value: 'bg-gradient-to-br from-[#200122] to-[#6f0000]' 
  },
  {
    id: 'custom',
    name: 'Özel Resim',
    value: 'bg-gray-900'
  }
];

export interface AppSettings {
  wallpaperId: string;
  customUrl?: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  wallpaperId: 'default',
  customUrl: ''
};

// Custom hook for managing settings with persistence
export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('app_settings');
    if (saved) {
      try {
        setSettings(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse settings", e);
      }
    }
  }, []);

  const updateSetting = (key: keyof AppSettings, value: any) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    localStorage.setItem('app_settings', JSON.stringify(newSettings));
  };

  const currentWallpaper = WALLPAPERS.find(w => w.id === settings.wallpaperId) || WALLPAPERS[0];

  return { settings, updateSetting, currentWallpaper, mounted };
}
