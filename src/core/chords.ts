import * as Chord from "@tonaljs/chord";
import * as Interval from "@tonaljs/interval";
import * as Midi from "@tonaljs/midi";
import * as Voicing from "@tonaljs/voicing";
import * as VoicingDictionary from "@tonaljs/voicing-dictionary";

/**
 * Note name to semitone mapping.
 * Used for converting note names (e.g., C, D#, Bb) to semitone offsets.
 */
const notes = {
  C: 0,
  "C#": 1,
  Db: 1,
  D: 2,
  "D#": 3,
  Eb: 3,
  E: 4,
  F: 5,
  "F#": 6,
  Gb: 6,
  G: 7,
  "G#": 8,
  Ab: 8,
  A: 9,
  "A#": 10,
  Bb: 10,
  B: 11,
};

/**
 * Returns the MIDI root note for a given root string (C, D#, etc.).
 *
 * @param {string} root - The root note name (e.g., "C", "D#", "Bb").
 * @returns {number} The MIDI note number for the root (C4=60).
 */
export const getMidiRoot = (root) => {
  const midiRootMap = {
    C: 60,
    "C#": 61,
    Db: 61,
    D: 62,
    "D#": 63,
    Eb: 63,
    E: 64,
    F: 65,
    "F#": 66,
    Gb: 66,
    G: 67,
    "G#": 68,
    Ab: 68,
    A: 69,
    "A#": 70,
    Bb: 70,
    B: 71,
  };
  return midiRootMap[root] || 60;
};

export interface CanonicalVoicing {
  id: string;
  label: string;
  fn: (notes: number[]) => number[];
}

export const CANONICAL_VOICINGS: CanonicalVoicing[] = [
  { id: "root", label: "ROOT", fn: (n) => n.slice() },
  { id: "inv1", label: "INV 1", fn: (n) => n.map((v, i) => (i === 0 ? v + 12 : v)) },
  { id: "inv2", label: "INV 2", fn: (n) => n.map((v, i) => (i <= 1 ? v + 12 : v)) },
  { id: "inv3", label: "INV 3", fn: (n) => n.map((v, i) => (i <= 2 ? v + 12 : v)) },
  { id: "drop2", label: "DROP 2", fn: (n) => n.map((v, i) => (i === n.length - 2 ? v - 12 : v)) },
  { id: "spread", label: "SPREAD", fn: (n) => n.map((v, i) => (i === 0 ? v - 12 : i === n.length - 1 ? v + 12 : v)) },
  { id: "octave", label: "OCTAVE", fn: (n) => n.map((v) => v + 12) },
];

export const getCanonicalVoicings = (): CanonicalVoicing[] => CANONICAL_VOICINGS;

export const getCanonicalVoicingByIndex = (index: number): CanonicalVoicing => {
  const total = CANONICAL_VOICINGS.length;
  const idx = ((index % total) + total) % total;
  return CANONICAL_VOICINGS[idx] || CANONICAL_VOICINGS[0];
};

export const applyCanonicalVoicingByIndex = (notes: number[], index: number): number[] => {
  const voicing = getCanonicalVoicingByIndex(index);
  return voicing.fn(notes);
};

/**
 * Returns an array of valid voicing option objects for a given interval array.

 *
 * @param {number[]} intervals - The chord intervals.
 * @returns {Array<{value: string, label: string}>} Array of valid voicing options for the chord.
 */
export const getValidVoicings = (intervals) => {
  const n = Array.isArray(intervals) ? intervals.length : 0;
  const voicingOptions = [
    { value: "closed", label: "Closed Voicing", valid: true },
    { value: "open-triad", label: "Open Triad", valid: n === 3 },
    { value: "drop2", label: "Drop-2", valid: n >= 3 },
    { value: "drop3", label: "Drop-3", valid: n >= 4 },
    { value: "spread", label: "Spread", valid: n >= 2 },
    { value: "octave", label: "Octave Doubling", valid: n >= 2 },
    { value: "first-inversion", label: "First Inversion", valid: n >= 2 },
    { value: "second-inversion", label: "Second Inversion", valid: n >= 3 },
    { value: "third-inversion", label: "Third Inversion", valid: n >= 4 },
    { value: "shell-dominant", label: "Shell Dominant", valid: n >= 3 },
    { value: "altered-dominant", label: "Altered Dominant", valid: n >= 3 },
  ];
  return voicingOptions.filter((opt) => opt.valid);
}

const tonalSymbolByType = {
  maj: "maj",
  m: "m",
  m7: "m7",
  maj7: "maj7",
  m7b5: "m7b5",
  dim7: "dim7",
  aug: "aug",
  mMaj7: "mMaj7",
};

const intervalsFromTonalNotes = (notesWithOctave, root) => {
  if (!Array.isArray(notesWithOctave) || !root) return null;
  const baseMidi = getMidiRoot(root);
  const semitones = notesWithOctave
    .map((n) => Midi.toMidi(n))
    .filter((m) => typeof m === "number" && isFinite(m))
    .map((m) => m - baseMidi)
    .sort((a, b) => a - b);
  return semitones.length > 0 ? semitones : null;
};

const tonalRangeForRoot = (root) => [`${root}2`, `${root}6`];

const resolveTonalDictionary = (voicing) => {
  if (voicing === "open-triad") {
    return VoicingDictionary.triads;
  }
  if (voicing === "shell-dominant" || voicing === "altered-dominant") {
    return VoicingDictionary.lefthand;
  }
  return VoicingDictionary.defaultDictionary;
};

const pickTonalCandidate = (candidates, voicing, root) => {
  if (!Array.isArray(candidates) || candidates.length === 0) return null;
  const targetMidi = getMidiRoot(root) + 5;
  const parsed = candidates
    .map((notes) => {
      const midis = notes
        .map((n) => Midi.toMidi(n))
        .filter((m) => typeof m === "number" && isFinite(m));
      if (midis.length === 0) return null;
      const avg = midis.reduce((sum, m) => sum + m, 0) / midis.length;
      const span = Math.max(...midis) - Math.min(...midis);
      return { notes, avg, span };
    })
    .filter(Boolean);
  if (parsed.length === 0) return null;

  parsed.sort((a, b) => {
    const aDist = Math.abs(a.avg - targetMidi);
    const bDist = Math.abs(b.avg - targetMidi);
    if (aDist !== bDist) return aDist - bDist;
    return a.span - b.span;
  });

  const nearest = parsed.slice(0, Math.min(6, parsed.length));
  if (voicing === "spread" || voicing === "octave") {
    return nearest.slice().sort((a, b) => b.span - a.span)[0].notes;
  }
  if (voicing === "drop2" || voicing === "first-inversion") {
    return nearest[Math.min(1, nearest.length - 1)].notes;
  }
  if (voicing === "drop3" || voicing === "second-inversion") {
    return nearest[Math.min(2, nearest.length - 1)].notes;
  }
  if (voicing === "third-inversion") {
    return nearest[Math.min(3, nearest.length - 1)].notes;
  }
  return nearest[0].notes;
};

const tryApplyTonalVoicing = (intervals, voicing, chordMeta) => {
  if (!chordMeta || !chordMeta.root || !chordMeta.type) return null;
  const tonalType = tonalSymbolByType[chordMeta.type] || chordMeta.type;
  const chordSymbol = `${chordMeta.root}${tonalType}`;
  const tonalChord = Chord.get(chordSymbol);
  if (!tonalChord || tonalChord.empty) {
    return null;
  }
  const dictionary = resolveTonalDictionary(voicing);
  let candidates = Voicing.search(
    chordSymbol,
    tonalRangeForRoot(chordMeta.root),
    dictionary
  );
  if (!Array.isArray(candidates) || candidates.length === 0) {
    candidates = Voicing.search(
      chordSymbol,
      tonalRangeForRoot(chordMeta.root),
      VoicingDictionary.defaultDictionary
    );
  }
  const voicedNotes = pickTonalCandidate(candidates, voicing, chordMeta.root);
  return intervalsFromTonalNotes(voicedNotes, chordMeta.root);
};

const applyFallbackVoicing = (intervals: number[], voicing: string): number[] => {
  if (!Array.isArray(intervals)) return intervals;
  const sorted = [...intervals].sort((a, b) => a - b);
  function isDominant(ints: number[]) {
    return ints.includes(4) && ints.includes(10);
  }
  switch (voicing) {
    case "drop2":
      if (sorted.length >= 2) {
        const idx = sorted.length - 2;
        sorted[idx] -= 12;
      }
      return sorted.slice().sort((a, b) => a - b);
    case "open-triad":
      if (sorted.length === 3) {
        const open = [sorted[0], sorted[2], sorted[1] + 12];
        return open.sort((a, b) => a - b);
      }
      return sorted;
    case "drop3":
      if (sorted.length >= 3) {
        const idx = sorted.length - 3;
        sorted[idx] -= 12;
      }
      return sorted.slice().sort((a, b) => a - b);
    case "spread":
      return sorted.map((v, i) => (i % 2 === 1 ? v + 12 : v));
    case "octave":
      const doubled = [...sorted];
      if (doubled.length > 0) doubled.push(doubled[0] + 12);
      if (doubled.length > 2) doubled.push(doubled[2] + 12);
      return doubled;
    case "first-inversion":
      if (sorted.length > 1) {
        const inv = [...sorted];
        inv[0] += 12;
        return inv.slice(1).concat(inv[0]).sort((a, b) => a - b);
      }
      return sorted;
    case "second-inversion":
      if (sorted.length > 2) {
        const inv = [...sorted];
        inv[0] += 12;
        inv[1] += 12;
        return inv.slice(2).concat(inv[0], inv[1]).sort((a, b) => a - b);
      }
      return sorted;
    case "third-inversion":
      if (sorted.length > 3) {
        const inv = [...sorted];
        inv[0] += 12;
        inv[1] += 12;
        inv[2] += 12;
        return inv.slice(3).concat(inv[0], inv[1], inv[2]).sort((a, b) => a - b);
      }
      return sorted;
    case "shell-dominant":
      if (isDominant(sorted)) {
        return sorted.filter((v) => v === 0 || v === 4 || v === 10);
      }
      return sorted;
    case "altered-dominant":
      if (isDominant(sorted)) {
        const base: number[] = sorted.filter((v) => v === 0 || v === 4 || v === 10);
        return base.concat([1, 5, 6, 8]).sort((a, b) => a - b);
      }
      return sorted;
    case "closed":
    default:
      return intervals;
  }
};

/**
 * Returns an array of intervals transformed by the selected voicing.
 *
 * Applies voicing types like drop2, open-triad, spread, etc. to the chord intervals.
 *
 * @param {number[]} intervals - The chord intervals.
 * @param {string} voicing - The voicing type to apply.
 * @param {object|null} chordMeta - Optional metadata about the chord.
 * @returns {number[]} The transformed intervals.
 */
export const applyVoicing = (intervals: number[], voicing: string, chordMeta: any = null): number[] => {
  const tonalVoiced = tryApplyTonalVoicing(intervals, voicing, chordMeta);
  if (Array.isArray(tonalVoiced) && tonalVoiced.length > 0) {
    return tonalVoiced;
  }
  return applyFallbackVoicing(intervals, voicing);
};

/**
 * Converts a semitone value to a 2-digit hexadecimal string (modulo 12).
/**
 * Converts a semitone value to a hex string (for debugging/visualization).
 *
 * @param {number} semitone - The semitone value.
 * @returns {string} The hex string.
 */
/**
 * Converts a semitone value to a 2-digit hexadecimal string.
 * Supports compound intervals >= 12 (octaves, 9ths, 11ths, 13ths) and negative
 * offsets (inversions/spreads) formatted as 8-bit two's complement hex for Dirtywave M8 Hypersynth.
 *
 * @param {number} semitone - The semitone value.
 * @returns {string} The hex string (e.g. 00-7F for positive, F0-FF for negative).
 */
export const semitoneToHex = (semitone) => {
  if (typeof semitone !== "number" || isNaN(semitone)) return "--";
  const val = (semitone & 0xFF) >>> 0;
  return val.toString(16).toUpperCase().padStart(2, "0");
}

/**
 * Mapping of chord type strings to their corresponding intervals.
 * Used for chord name to hex conversion and interval calculation.
 *
 * @type {Object.<string, number[]>}
 */
const chordTypes = {
  maj: [0, 4, 7],
  min: [0, 3, 7],
  m: [0, 3, 7],
  dim: [0, 3, 6],
  aug: [0, 4, 8],
  "+": [0, 4, 8],
  7: [0, 4, 7, 10],
  m7: [0, 3, 7, 10],
  min7: [0, 3, 7, 10],
  maj7: [0, 4, 7, 11],
  M7: [0, 4, 7, 11],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  6: [0, 4, 7, 9],
  m6: [0, 3, 7, 9],
  9: [0, 4, 7, 10, 14],
  m9: [0, 3, 7, 10, 14],
  maj9: [0, 4, 7, 11, 14],
  11: [0, 4, 7, 10, 14, 17],
  13: [0, 4, 7, 10, 14, 21],
  add9: [0, 4, 7, 14],
  add11: [0, 4, 7, 10, 14],
  add13: [0, 4, 7, 10, 14, 21],
  sus: [0, 5, 7],
  5: [0, 7],
  madd9: [0, 3, 7, 14],
  maj6: [0, 4, 7, 9],
  min9: [0, 3, 7, 10, 14],
  min11: [0, 3, 7, 10, 14, 17],
  min13: [0, 3, 7, 10, 14, 21],
  "7alt": [0, 4, 7, 10, 13, 15, 18, 20], // altered dominant: 1, 3, 5, b7, b9, #9, b5, #5
  ø7: [0, 3, 6, 10], // half-diminished seventh
  m7b5: [0, 3, 6, 10], // alias for half-diminished seventh
  dim7: [0, 3, 6, 9], // fully diminished seventh
  "maj7#5": [0, 4, 8, 11], // major seventh sharp five
  mMaj7: [0, 3, 7, 11], // minor major seventh
  add2: [0, 2, 4, 7],
  add4: [0, 4, 5, 7],
  add6: [0, 4, 7, 9],
  "7b9": [0, 4, 7, 10, 13],
  "7#9": [0, 4, 7, 10, 15],
  "7b5": [0, 4, 6, 10],
  "7#5": [0, 4, 8, 10],
  "9b5": [0, 4, 6, 10, 14],
  "9#5": [0, 4, 8, 10, 14],
  "13b9": [0, 4, 7, 10, 13, 21],
  "13#9": [0, 4, 7, 10, 15, 21],
};

const typeAliases = {
  "": "maj",
  major: "maj",
  min: "m",
  minor: "m",
  "-": "m",
  "Δ": "maj7",
  "Δ7": "maj7",
  M7: "maj7",
  min7: "m7",
  "ø": "m7b5",
  "ø7": "m7b5",
  "°7": "dim7",
  o7: "dim7",
  "+": "aug",
  mM7: "mMaj7",
  mmaj7: "mMaj7",
};

const tonalTypeVariants = {
  maj: ["", "maj"],
  m: ["m", "min"],
  maj7: ["maj7", "M7"],
  m7: ["m7", "min7"],
  m7b5: ["m7b5", "ø7"],
  aug: ["aug", "+"],
  mMaj7: ["mMaj7", "mM7"],
};

const fallbackTypeVariants = {
  maj: ["maj"],
  m: ["m", "min"],
  maj7: ["maj7", "M7"],
  m7: ["m7", "min7"],
  m7b5: ["m7b5", "ø7"],
  aug: ["aug", "+"],
  mMaj7: ["mMaj7"],
};

const normalizeRoot = (rootToken) => {
  if (!rootToken) return null;
  const letter = rootToken.charAt(0).toUpperCase();
  if (!/[A-G]/.test(letter)) return null;
  const accidental = rootToken
    .slice(1)
    .replace(/♯/g, "#")
    .replace(/♭/g, "b")
    .replace(/B/g, "b");
  if (!["", "#", "b"].includes(accidental)) return null;
  return letter + accidental;
};

const normalizeType = (rawType) => {
  let compact = (rawType || "").trim().replace(/\s+/g, "");
  compact = compact
    .replace(/major/i, "major")
    .replace(/minor/i, "minor")
    .replace(/maj/i, "maj")
    .replace(/min/i, "min")
    .replace(/dim/i, "dim")
    .replace(/aug/i, "aug")
    .replace(/sus/i, "sus")
    .replace(/add/i, "add");
  const unwrapped = compact.match(/^\((.+)\)$/)?.[1] || compact;
  if (Object.prototype.hasOwnProperty.call(typeAliases, compact)) {
    return typeAliases[compact];
  }
  if (Object.prototype.hasOwnProperty.call(typeAliases, unwrapped)) {
    return typeAliases[unwrapped];
  }
  return unwrapped || "maj";
};

const getVariants = (lookup, type) => {
  const variants = lookup[type] || [type];
  const deduped = [];
  variants.forEach((v) => {
    if (typeof v === "string" && v.length >= 0 && !deduped.includes(v)) {
      deduped.push(v);
    }
  });
  return deduped;
};

const parseIntervalsWithTonal = (root, type) => {
  const candidates = getVariants(tonalTypeVariants, type);
  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    const symbol = `${root}${candidate}`;
    const chordData = Chord.get(symbol);
    if (!chordData || chordData.empty || !Array.isArray(chordData.intervals)) {
      continue;
    }
    const intervalOnly = chordData.intervals
      .map((iv) => Interval.semitones(iv))
      .filter((n) => typeof n === "number" && isFinite(n));
    if (intervalOnly.length > 0) {
      return {
        intervalOnly,
        type: candidate === "" ? "maj" : candidate,
      };
    }
  }
  return null;
};

const parseIntervalsWithFallbackMap = (type) => {
  const candidates = getVariants(fallbackTypeVariants, type);
  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    const intervals = chordTypes[candidate];
    if (Array.isArray(intervals) && intervals.length > 0) {
      return {
        intervalOnly: intervals.slice(),
        type: candidate,
      };
    }
  }
  return null;
};

/**
 * Parses a chord name and returns its components and hex representations.
 *
 * @param {string} chordName - The chord name (e.g., "Cmaj7", "Dm", "G7").
 * @returns {object|null} An object with chordName, root, type, rootBaked, intervalOnlyHex, intervalOnly; or null if invalid.
 */
export const parseChordName = (chordName) => {
  if (typeof chordName !== "string") return null;
  const trimmed = chordName.trim();
  if (!trimmed) return null;
  const rootMatch = trimmed.match(/^[A-Ga-g][bB#♭♯]?/);
  if (!rootMatch) return null;
  const root = normalizeRoot(rootMatch[0]);
  if (!root || typeof notes[root] !== "number") return null;
  const type = normalizeType(trimmed.slice(rootMatch[0].length));
  const tonalParsed = parseIntervalsWithTonal(root, type);
  const fallbackParsed = tonalParsed || parseIntervalsWithFallbackMap(type);
  if (!fallbackParsed) return null;

  const intervalOnly = fallbackParsed.intervalOnly;
  const parsedType = fallbackParsed.type;
  const rootSemitone = notes[root];

  // Root-baked chord: add root semitone, wrap modulo 12
  const rootBaked = intervalOnly.map((i) => semitoneToHex(i + rootSemitone));

  // Interval-only hex for display
  const intervalOnlyHex = intervalOnly.map((i) => semitoneToHex(i));

  return {
    chordName: trimmed,
    root,
    type: parsedType,
    rootBaked,
    intervalOnlyHex,
    intervalOnly,
  };
}

/**
 * Removes duplicate chords by their interval shape.
 *
 * @param {Array<object>} chords - Array of parsed chord objects.
 * @returns {Array<object>} Array of unique chord group objects.
 */
function getUniqueChordTypes(chords) {
  // Map: intervalKey -> { typeKey, chords: [], intervalOnlyHex: [] }
  const typeOrder = [];
  const typeMap = {};
  chords.forEach((chord, idx) => {
    const key = chord.intervalOnly.join("-");
    // Debug: show intervals and hex after voicing
    // console.log(
    //   `[Chord Debug] ${chord.chordName} (${chord.type}) intervals: [${chord.intervalOnly.join(", ")}] hex: [${chord.intervalOnlyHex.join(" ")}]`
    // );
    if (!typeMap[key]) {
      typeOrder.push(key);
      typeMap[key] = {
        typeKey: key,
        chords: [],
        intervalOnlyHex: chord.intervalOnlyHex.slice(),
      };
    }
    typeMap[key].chords.push(chord.chordName);
  });
  const result = typeOrder.map((key) => typeMap[key]);
  return result;
}

/**
 * Converts input chord names to hex and groups results by interval shape.
 *
 * Used for UI rendering and deduplication of chord types.
 *
 * @param {string} input - The input string containing chord names (space or comma separated).
 * @param {string} voicing - The voicing type to apply to each chord.
 * @returns {object} Structured result for UI rendering, including inputChordNames, uniqueGroups, voicing, and chords.
 */
export const convertChords = (input, voicing) => {
  const chordNames = input.split(/[\s,]+/).filter((s) => s.length > 0);
  // Parse and apply voicing to intervals for display
  const parsed = chordNames
    .map(parseChordName)
    .filter((c) => c !== null)
    .map((chord) => {
      // Apply voicing to intervals
      const intervals = applyVoicing(chord.intervalOnly, voicing, chord);
      // Defensive: ensure intervals is array
      const safeIntervals = Array.isArray(intervals) ? intervals : [];
      return {
        ...chord,
        intervalOnly: safeIntervals,
        intervalOnlyHex: safeIntervals.map(semitoneToHex),
        rootBaked: safeIntervals.map((i) =>
          semitoneToHex(i + (notes[chord.root] || 0))
        ),
      };
    });

  // Defensive: filter out chords with undefined chordName
  const validParsed = parsed.filter((c) => typeof c.chordName === "string");

  // Group by interval shape (with voicing applied) and assign unique interval numbers
  const uniqueKeys: string[] = [];
  const validParsedWithIds = validParsed.map((chord) => {
    const key = chord.intervalOnly.join("-");
    let idx = uniqueKeys.indexOf(key);
    if (idx === -1) {
      uniqueKeys.push(key);
      idx = uniqueKeys.length - 1;
    }
    const intervalId = String(idx).padStart(2, "0");
    return {
      ...chord,
      intervalIndex: idx,
      intervalId,
    };
  });

  const uniqueGroups = getUniqueChordTypes(validParsedWithIds);
  let details = uniqueGroups.map((group, idx) => {
    return {
      index: idx,
      intervalId: String(idx).padStart(2, "0"),
      chords: Array.isArray(group.chords) ? group.chords : [],
      interval: Array.isArray(group.intervalOnlyHex)
        ? group.intervalOnlyHex
        : [],
    };
  });

  // Return structured result for UI rendering
  return {
    inputChordNames: validParsedWithIds.map((c) => c.chordName),
    uniqueGroups: details,
    voicing,
    chords: validParsedWithIds,
  };
}
