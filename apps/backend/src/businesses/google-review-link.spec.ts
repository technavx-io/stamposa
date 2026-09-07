import { normaliseGoogleReviewLink } from './businesses.service';

describe('normaliseGoogleReviewLink', () => {
  it('clears on empty input', () => {
    expect(normaliseGoogleReviewLink('')).toBeNull();
    expect(normaliseGoogleReviewLink('   ')).toBeNull();
    expect(normaliseGoogleReviewLink(null)).toBeNull();
  });

  it('turns a bare Place ID into the write-review URL', () => {
    expect(normaliseGoogleReviewLink('ChIJN1t_tDeuEmsRUsoyG83frY4')).toBe(
      'https://search.google.com/local/writereview?placeid=ChIJN1t_tDeuEmsRUsoyG83frY4',
    );
  });

  it('keeps Google links, adding https when missing', () => {
    expect(normaliseGoogleReviewLink('https://g.page/r/CaBcDeFgHiJkL/review')).toBe(
      'https://g.page/r/CaBcDeFgHiJkL/review',
    );
    expect(normaliseGoogleReviewLink('maps.app.goo.gl/AbC123')).toBe('https://maps.app.goo.gl/AbC123');
    expect(normaliseGoogleReviewLink('http://www.google.co.in/maps/place/x')).toBe(
      'https://www.google.co.in/maps/place/x',
    );
  });

  it('rejects non-Google hosts and garbage', () => {
    expect(() => normaliseGoogleReviewLink('https://yelp.com/biz/x')).toThrow(/Google/);
    expect(() => normaliseGoogleReviewLink('https://notgoogle.com/x')).toThrow(/Google/);
    expect(() => normaliseGoogleReviewLink('not a link at all')).toThrow(/link/);
  });
});
