import {
  formatCode,
  generateCode,
  normalizeCodeInput,
  slugify,
} from './codes.util';

describe('codes.util', () => {
  describe('generateCode', () => {
    it('produces 8 chars from the unambiguous alphabet', () => {
      for (let i = 0; i < 200; i++) {
        const code = generateCode();
        expect(code).toMatch(/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$/);
      }
    });

    it('never contains lookalike characters', () => {
      for (let i = 0; i < 200; i++) {
        expect(generateCode()).not.toMatch(/[01OIL]/);
      }
    });
  });

  describe('formatCode', () => {
    it('groups as XXXX-XXXX', () => {
      expect(formatCode('7F3K9QZP')).toBe('7F3K-9QZP');
    });

    it('leaves non-8-char values untouched', () => {
      expect(formatCode('ABC')).toBe('ABC');
    });
  });

  describe('normalizeCodeInput', () => {
    it('strips separators and uppercases', () => {
      expect(normalizeCodeInput(' 7f3k-9qzp ')).toBe('7F3K9QZP');
    });
  });

  describe('slugify', () => {
    it('lowercases and dashes', () => {
      expect(slugify('Brew & Bean Coffee')).toBe('brew-bean-coffee');
    });

    it('strips diacritics', () => {
      expect(slugify('Café Résumé')).toBe('cafe-resume');
    });

    it('falls back for empty results', () => {
      expect(slugify('!!!')).toBe('business');
    });
  });
});
