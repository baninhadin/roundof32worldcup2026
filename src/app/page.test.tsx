// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import Page from './page';
import snapshot from '@/data/worldcup2026.snapshot.json';

// Serve the bundled snapshot via fetch so loadGroups resolves fast as "live".
vi.stubGlobal(
  'fetch',
  vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(snapshot) })),
);

afterEach(cleanup);

describe('Page (integration)', () => {
  it('renders the header and all 12 groups', async () => {
    render(<Page />);
    expect(screen.getByText('What does my team need to qualify?')).toBeTruthy();
    // Groups render from the bundled snapshot immediately.
    expect(await screen.findByText('GROUP A')).toBeTruthy();
    expect(screen.getByText('GROUP L')).toBeTruthy();
    expect(screen.getByText('Mexico')).toBeTruthy();
  });

  it('opens a team modal with a verdict when a row is clicked', async () => {
    render(<Page />);
    fireEvent.click(await screen.findByText('Mexico'));
    // The modal is a labelled dialog (accessibility) and shows the verdict.
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/Qualified for the Round of 32/i)).toBeTruthy();
  });

  it('toggles simulate mode and shows the banner', async () => {
    render(<Page />);
    await screen.findByText('GROUP A');
    fireEvent.click(screen.getByRole('button', { name: /Simulate/i }));
    expect(screen.getByText(/set scores on its upcoming matches/i)).toBeTruthy();
  });
});
