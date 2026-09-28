import {
  getMidiRoot,
  getValidVoicings,
  applyVoicing,
  semitoneToHex,
  parseChordName,
  convertChords,
  CANONICAL_VOICINGS,
  getCanonicalVoicings,
  getCanonicalVoicingByIndex,
  applyCanonicalVoicingByIndex,
} from './chords';

describe('chords module', () => {
  it('getMidiRoot returns correct MIDI number', () => {
    expect(getMidiRoot('C')).toBe(60);
    expect(getMidiRoot('G')).toBe(67);
    expect(getMidiRoot('Bb')).toBe(70);
  });

  it('getValidVoicings returns array of voicing options', () => {
    const triad = [0, 4, 7];
    const voicings = getValidVoicings(triad);
    expect(Array.isArray(voicings)).toBe(true);
    expect(voicings.some(v => v.value === 'closed')).toBe(true);
  });

  it('applyVoicing returns transformed intervals', () => {
    const triad = [0, 4, 7];
    const drop2 = applyVoicing(triad, 'drop2');
    expect(Array.isArray(drop2)).toBe(true);
  });

  it('applyVoicing keeps E7 near visible register', () => {
    const voiced = applyVoicing([0, 4, 7, 10], 'closed', {
      root: 'E',
      type: '7'
    });
    expect(voiced.some(v => v >= -4 && v <= 20)).toBe(true);
  });

  it('semitoneToHex returns hex string', () => {
    expect(semitoneToHex(0)).toBe('00');
    expect(semitoneToHex(11)).toBe('0B');
    expect(semitoneToHex(12)).toBe('0C');
    expect(semitoneToHex(14)).toBe('0E');
    expect(semitoneToHex(17)).toBe('11');
    expect(semitoneToHex(21)).toBe('15');
    expect(semitoneToHex(-12)).toBe('F4');
  });

  it('parseChordName parses valid chord', () => {
    const chord = parseChordName('Cmaj7');
    expect(chord).toBeTruthy();
    expect(chord.root).toBe('C');
    expect(chord.type).toMatch(/maj7/i);
    expect(Array.isArray(chord.intervalOnly)).toBe(true);
  });

  it('parseChordName handles common aliases and casing', () => {
    expect(parseChordName('cmin7')).toBeTruthy();
    expect(parseChordName('CΔ7')).toBeTruthy();
    expect(parseChordName('Bø7')).toBeTruthy();
    expect(parseChordName('C♯m7')).toBeTruthy();
    expect(parseChordName('E(7)')).toBeTruthy();
    expect(parseChordName('C(maj7)')).toBeTruthy();

    // Test uppercase B accidental and capitalized qualities
    const bbm7 = parseChordName('BBm7');
    expect(bbm7).toBeTruthy();
    expect(bbm7.root).toBe('Bb');
    expect(bbm7.type).toBe('m7');

    const csDim = parseChordName('C#Dim');
    expect(csDim).toBeTruthy();
    expect(csDim.root).toBe('C#');
    expect(csDim.type).toBe('dim');

    const ebmaj7 = parseChordName('EBmaj7');
    expect(ebmaj7).toBeTruthy();
    expect(ebmaj7.root).toBe('Eb');
    expect(ebmaj7.type).toBe('maj7');
  });

  it('parseChordName returns null for unsupported token', () => {
    expect(parseChordName('Hmaj7')).toBeNull();
    expect(parseChordName('Cwhatever')).toBeNull();
  });

  it('convertChords returns structured result', () => {
    const result = convertChords('Cmaj7 Dm7', 'closed');
    expect(result).toHaveProperty('chords');
    expect(Array.isArray(result.chords)).toBe(true);
    expect(result.chords.length).toBeGreaterThan(0);
  });

  it('convertChords keeps valid mixed-symbol chords', () => {
    const result = convertChords('cmin7 CΔ7 Bø7 C♯m7 nope', 'closed');
    expect(result.chords.length).toBe(4);
  });

  it('convertChords assigns matching intervalId to chords with identical interval shapes', () => {
    const result = convertChords('Am7 Dm7 G7 Am7', 'closed');
    expect(result.chords[0].intervalId).toBe('00');
    expect(result.chords[1].intervalId).toBe('00');
    expect(result.chords[2].intervalId).toBe('01');
    expect(result.chords[3].intervalId).toBe('00');
    expect(result.uniqueGroups[0].intervalId).toBe('00');
    expect(result.uniqueGroups[1].intervalId).toBe('01');
  });

  it('preserves compound intervals (9th, 11th, 13th) in intervalOnlyHex without modulo-12 truncation', () => {
    const dm9 = parseChordName('Dm9');
    expect(dm9).toBeTruthy();
    expect(dm9?.intervalOnly).toEqual([0, 3, 7, 10, 14]);
    // 14 semitones should be '0E', NOT '02'
    expect(dm9?.intervalOnlyHex).toEqual(['00', '03', '07', '0A', '0E']);

    const g13 = parseChordName('G13');
    expect(g13).toBeTruthy();
    expect(g13?.intervalOnly).toEqual([0, 4, 7, 10, 14, 21]);
    // 14 -> '0E', 21 -> '15', NOT '02' and '09'
    expect(g13?.intervalOnlyHex).toEqual(['00', '04', '07', '0A', '0E', '15']);

    const converted = convertChords('Dm9 G13', 'closed');
    expect(converted.chords[0].intervalOnlyHex).toEqual(['00', '03', '07', '0A', '0E']);
    expect(converted.chords[1].intervalOnlyHex).toEqual(['00', '04', '07', '0A', '0E', '15']);
  });

  describe('canonical voicings', () => {
    const cmaj7 = [60, 64, 67, 71]; // C4, E4, G4, B4

    it('exposes exactly 7 canonical voicings', () => {
      expect(getCanonicalVoicings().length).toBe(7);
      expect(CANONICAL_VOICINGS.map((v) => v.label)).toEqual([
        'ROOT',
        'INV 1',
        'INV 2',
        'INV 3',
        'DROP 2',
        'SPREAD',
        'OCTAVE',
      ]);
    });

    it('applies ROOT voicing without change', () => {
      expect(applyCanonicalVoicingByIndex(cmaj7, 0)).toEqual([60, 64, 67, 71]);
    });

    it('applies INV 1 by raising first note an octave', () => {
      expect(applyCanonicalVoicingByIndex(cmaj7, 1)).toEqual([72, 64, 67, 71]);
    });

    it('applies INV 2 by raising first two notes an octave', () => {
      expect(applyCanonicalVoicingByIndex(cmaj7, 2)).toEqual([72, 76, 67, 71]);
    });

    it('applies INV 3 by raising first three notes an octave', () => {
      expect(applyCanonicalVoicingByIndex(cmaj7, 3)).toEqual([72, 76, 79, 71]);
    });

    it('applies DROP 2 by lowering second highest note an octave', () => {
      // second highest note in [60, 64, 67, 71] is 67 (index length - 2 = 2)
      expect(applyCanonicalVoicingByIndex(cmaj7, 4)).toEqual([60, 64, 55, 71]);
    });

    it('applies SPREAD by dropping lowest note and raising highest note', () => {
      expect(applyCanonicalVoicingByIndex(cmaj7, 5)).toEqual([48, 64, 67, 83]);
    });

    it('applies OCTAVE by raising every note an octave', () => {
      expect(applyCanonicalVoicingByIndex(cmaj7, 6)).toEqual([72, 76, 79, 83]);
    });

    it('gracefully wraps negative and out-of-bound indices', () => {
      expect(getCanonicalVoicingByIndex(-1).label).toBe('OCTAVE');
      expect(getCanonicalVoicingByIndex(7).label).toBe('ROOT');
    });
  });
});

