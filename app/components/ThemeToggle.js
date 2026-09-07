'use client';
import { useState, useEffect } from 'react';

export default function ThemeToggle({ className = '', style = {} }) {
  const [themeMode, setThemeMode] = useState('arcade');

  useEffect(() => {
    const stored = localStorage.getItem('themeMode') || 'arcade';
    setThemeMode(stored);
    if (stored === 'simple') {
      document.body.classList.add('simple-theme');
    } else {
      document.body.classList.remove('simple-theme');
    }

    const onThemeChange = () => {
      const cur = localStorage.getItem('themeMode') || 'arcade';
      setThemeMode(cur);
      if (cur === 'simple') {
        document.body.classList.add('simple-theme');
      } else {
        document.body.classList.remove('simple-theme');
      }
    };

    window.addEventListener('themechange', onThemeChange);
    window.addEventListener('storage', onThemeChange);
    return () => {
      window.removeEventListener('themechange', onThemeChange);
      window.removeEventListener('storage', onThemeChange);
    };
  }, []);

  const toggle = () => {
    const next = themeMode === 'simple' ? 'arcade' : 'simple';
    setThemeMode(next);
    localStorage.setItem('themeMode', next);
    if (next === 'simple') {
      document.body.classList.add('simple-theme');
    } else {
      document.body.classList.remove('simple-theme');
    }
    window.dispatchEvent(new Event('themechange'));
  };

  return (
    <button
      type="button"
      className={`theme-toggle-btn ${className}`}
      onClick={toggle}
      style={style}
      title={themeMode === 'simple' ? 'Switch to Retro Arcade Theme' : 'Switch to Clean Light Theme'}
    >
      {themeMode === 'simple' ? '🕹️ ARCADE THEME' : '☀️ LIGHT THEME'}
    </button>
  );
}
