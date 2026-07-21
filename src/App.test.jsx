import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { STORAGE_KEYS } from './constants.js';
import App from './App.jsx';

describe('application shell', () => {
  beforeEach(() => localStorage.clear());

  it('renders Arabic-first navigation and switches the persisted theme', async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(screen.getByRole('heading', { name: 'ملاحظاتي', level: 1 })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'كل الملاحظات' }).length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: 'تبديل السمة' }));
    await waitFor(() => expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.settings)).theme).toBe('dark'));
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('searches existing Arabic and English content without navigation', async () => {
    localStorage.setItem(STORAGE_KEYS.notes, JSON.stringify([
      { id: 'ar', text: 'خطة الدراسة', createdAt: 1, updatedAt: 1 },
      { id: 'en', text: 'English meeting', createdAt: 2, updatedAt: 2 },
    ]));
    const user = userEvent.setup();
    render(<App />);
    const search = screen.getByRole('searchbox', { name: 'البحث في الملاحظات' });
    await user.type(search, 'ENGLISH');
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'خطة الدراسة' })).not.toBeInTheDocument();
    });
    expect(screen.getByRole('heading', { name: 'English meeting' })).toBeInTheDocument();
  });
});
