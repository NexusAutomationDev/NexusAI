import { describe, it, expect, beforeEach } from 'vitest';

describe('FOUND-03 — appearance store', () => {
  beforeEach(() => {
    document.documentElement.className = '';
    document.documentElement.removeAttribute('data-accent');
    document.documentElement.style.removeProperty('--font-scale');
  });

  it('setTheme("dark") adds .dark class to document.documentElement', async () => {
    const { useAppearance } = await import('../src/lib/stores/appearance');
    await useAppearance.getState().setTheme('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('setTheme("light") removes .dark class from document.documentElement', async () => {
    const { useAppearance } = await import('../src/lib/stores/appearance');
    document.documentElement.classList.add('dark'); // start with dark
    await useAppearance.getState().setTheme('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('setFontScale("lg") sets --font-scale to "1.125"', async () => {
    const { useAppearance } = await import('../src/lib/stores/appearance');
    await useAppearance.getState().setFontScale('lg');
    expect(document.documentElement.style.getPropertyValue('--font-scale')).toBe('1.125');
  });

  it('setFontScale("sm") sets --font-scale to "0.875"', async () => {
    const { useAppearance } = await import('../src/lib/stores/appearance');
    await useAppearance.getState().setFontScale('sm');
    expect(document.documentElement.style.getPropertyValue('--font-scale')).toBe('0.875');
  });

  it('setFontScale("md") sets --font-scale to "1"', async () => {
    const { useAppearance } = await import('../src/lib/stores/appearance');
    await useAppearance.getState().setFontScale('md');
    expect(document.documentElement.style.getPropertyValue('--font-scale')).toBe('1');
  });

  it('setAccentColor("blue") sets data-accent="blue" on html element', async () => {
    const { useAppearance } = await import('../src/lib/stores/appearance');
    await useAppearance.getState().setAccentColor('blue');
    expect(document.documentElement.getAttribute('data-accent')).toBe('blue');
  });

  it('setAccentColor("orange") sets data-accent="orange" on html element', async () => {
    const { useAppearance } = await import('../src/lib/stores/appearance');
    await useAppearance.getState().setAccentColor('orange');
    expect(document.documentElement.getAttribute('data-accent')).toBe('orange');
  });

  it('ACCENT_COLORS has exactly 5 entries (D-08)', async () => {
    const { ACCENT_COLORS } = await import('../src/lib/stores/appearance');
    expect(ACCENT_COLORS).toHaveLength(5);
  });

  it('ACCENT_COLORS includes violet, blue, green, orange, red (D-08)', async () => {
    const { ACCENT_COLORS } = await import('../src/lib/stores/appearance');
    const values = ACCENT_COLORS.map((c) => c.value);
    expect(values).toContain('violet');
    expect(values).toContain('blue');
    expect(values).toContain('green');
    expect(values).toContain('orange');
    expect(values).toContain('red');
  });
});
