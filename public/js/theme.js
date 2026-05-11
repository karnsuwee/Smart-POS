import { els } from './dom.js';
import { renderDashboard } from './dashboard.js';

export function initTheme() {
  const theme = localStorage.getItem('smartPosTheme') || 'light';
  document.body.classList.toggle('dark', theme === 'dark');
  els.themeToggle.textContent = theme === 'dark' ? 'Light mode' : 'Dark mode';
}

export function toggleTheme() {
  const next = document.body.classList.contains('dark') ? 'light' : 'dark';
  document.body.classList.toggle('dark', next === 'dark');
  localStorage.setItem('smartPosTheme', next);
  els.themeToggle.textContent = next === 'dark' ? 'Light mode' : 'Dark mode';
  renderDashboard();
}
