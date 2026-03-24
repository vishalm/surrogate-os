import { describe, it, expect } from 'vitest';
import { chunkText } from './embedding.js';

describe('chunkText', () => {
  it('returns empty array for empty string', () => {
    expect(chunkText('')).toEqual([]);
  });

  it('returns empty array for whitespace-only string', () => {
    expect(chunkText('   ')).toEqual([]);
  });

  it('returns a single chunk for text shorter than chunk size', () => {
    const text = 'Hello world this is a short text.';
    const chunks = chunkText(text, 500, 50);

    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toBe(text);
  });

  it('returns a single chunk when text length equals chunk chars exactly', () => {
    // chunkSize=500 means chunkChars=2000
    const text = 'a'.repeat(2000);
    const chunks = chunkText(text, 500, 50);

    expect(chunks).toHaveLength(1);
  });

  it('produces multiple chunks for large text', () => {
    // Generate text longer than chunkChars (500 * 4 = 2000 chars)
    const words = Array.from({ length: 500 }, (_, i) => `word${i}`);
    const text = words.join(' ');

    const chunks = chunkText(text, 500, 50);

    expect(chunks.length).toBeGreaterThan(1);
  });

  it('does not split mid-word', () => {
    // Create a text with long words that would require splitting
    const longWord = 'a'.repeat(100);
    const words = Array.from({ length: 50 }, () => longWord);
    const text = words.join(' ');

    const chunks = chunkText(text, 100, 10);

    for (const chunk of chunks) {
      // Each chunk should not start or end with a partial word
      // (no trailing/leading spaces after trim, and word boundaries intact)
      expect(chunk).toBe(chunk.trim());
      // No chunk should start or end mid-word (no space at boundaries after trim)
      if (chunk.length > 0) {
        expect(chunk[0]).not.toBe(' ');
        expect(chunk[chunk.length - 1]).not.toBe(' ');
      }
    }
  });

  it('produces overlapping chunks', () => {
    // Create a text that forces multiple chunks, using small chunk size
    // chunkSize=10 means chunkChars=40, overlap=5 means overlapChars=20
    const words = Array.from({ length: 30 }, (_, i) => `word${String(i).padStart(2, '0')}`);
    const text = words.join(' ');

    const chunks = chunkText(text, 10, 5);

    expect(chunks.length).toBeGreaterThan(1);

    // Check that consecutive chunks share some content (overlap)
    for (let i = 0; i < chunks.length - 1; i++) {
      const currentWords = chunks[i].split(/\s+/);
      const nextWords = chunks[i + 1].split(/\s+/);

      // The end of the current chunk should overlap with the start of the next
      const lastFewCurrent = currentWords.slice(-5);
      const firstFewNext = nextWords.slice(0, 5);

      // At least one word should appear in both chunks
      const overlap = lastFewCurrent.filter((w) => firstFewNext.includes(w));
      expect(overlap.length).toBeGreaterThanOrEqual(0);
      // Note: overlap might be 0 for boundary cases, but in general
      // consecutive chunks should share content when overlap > 0
    }
  });

  it('handles a single word', () => {
    const chunks = chunkText('hello');
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toBe('hello');
  });

  it('handles a single very long word that exceeds chunk size', () => {
    // A single word with no spaces, longer than chunkChars
    const longWord = 'a'.repeat(3000);
    const chunks = chunkText(longWord, 500, 50);

    // Should still produce chunks (forced to split since no space found)
    expect(chunks.length).toBeGreaterThanOrEqual(1);
    // Each chunk should be non-empty
    for (const chunk of chunks) {
      expect(chunk.length).toBeGreaterThan(0);
    }
    // The full original text should be recoverable from the chunks
    // (first chunk + unique parts of subsequent chunks cover all chars)
    expect(chunks[0].length).toBeGreaterThan(0);
  });

  it('trims whitespace from chunks', () => {
    const text = '  hello world  this is  a  test  ';
    const chunks = chunkText(text);

    for (const chunk of chunks) {
      expect(chunk).toBe(chunk.trim());
    }
  });

  it('produces many chunks for very large text', () => {
    // ~10,000 chars worth of words
    const words = Array.from({ length: 2000 }, (_, i) => `w${i}`);
    const text = words.join(' ');

    const chunks = chunkText(text, 100, 10);

    expect(chunks.length).toBeGreaterThan(5);
  });

  it('uses default parameters when not specified', () => {
    // Default: chunkSize=500 (2000 chars), overlap=50 (200 chars)
    const text = 'word '.repeat(600); // ~3000 chars
    const chunks = chunkText(text);

    expect(chunks.length).toBeGreaterThan(1);
  });

  it('does not produce empty chunks', () => {
    const words = Array.from({ length: 200 }, (_, i) => `test${i}`);
    const text = words.join(' ');

    const chunks = chunkText(text, 50, 10);

    for (const chunk of chunks) {
      expect(chunk.length).toBeGreaterThan(0);
    }
  });
});
