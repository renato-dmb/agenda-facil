import { describe, it, expect } from 'vitest';

describe('smoke', () => {
  it('test runner works', () => {
    expect(1 + 1).toBe(2);
  });

  it('env is loaded from setup.js', () => {
    expect(process.env.NODE_ENV).toBe('test');
    expect(process.env.DEFAULT_TIMEZONE).toBe('America/Sao_Paulo');
  });
});
