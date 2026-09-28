import {
  getSelectedVoicing,
  updateSingleChordDropdownFromInput,
  wireEventListeners
} from './events';

describe('events module', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <select id="voicingSelect">
        <option value="closed">Closed</option>
        <option value="open">Open</option>
      </select>
      <input id="chordsInput" value="C Dm G7" />
      <select id="singleChordSelect"></select>
      <button id="playBtn"></button>
      <button id="stopBtn"></button>
      <button id="saveChordSetBtn"></button>
      <button id="loadChordSetBtn"></button>
      <button id="deleteChordSetBtn"></button>
      <button id="exportChordSetsBtn"></button>
      <input id="importChordSetsInput" />
      <button id="sidebarToggle"></button>
      <button id="toggleVideoBtn"></button>
      <input id="volumeSlider" value="50" />
      <span id="volumeLabel"></span>
      <button id="convertChordsBtn"></button>
      <button id="clearInputBtn"></button>
      <button id="shareProgressionBtn"></button>
      <button id="playSingleChordBtn"></button>
      <button id="toggleOutputBoxBtn">▶</button>
      <div id="outputBox" style="display:none"></div>
      <div id="output"></div>
      <div id="sidebar"></div>
      <button id="sidebarCloseBtn"></button>
      <div id="keyboardViz"></div>
      <div id="toastContainer"></div>
      <select id="savedChordSetsSelect"></select>
    `;
  });
  it('getSelectedVoicing always returns "closed"', () => {
    expect(getSelectedVoicing()).toBe('closed');
  });

  it('clearInput clears the chords input', () => {
    // @ts-ignore: access private
    const { clearInput } = require('./events');
    const input = document.getElementById('chordsInput') as HTMLInputElement;
    input.value = 'Cmaj7';
    clearInput();
    expect(input.value).toBe('');
  });

  it('playSingleChord does nothing if select missing or empty', () => {
    // @ts-ignore: access private
    const { playSingleChord } = require('./events');
    document.getElementById('singleChordSelect')?.remove();
    expect(() => playSingleChord()).not.toThrow();
    // Add back, but empty
    const select = document.createElement('select');
    select.id = 'singleChordSelect';
    document.body.appendChild(select);
    expect(() => playSingleChord()).not.toThrow();
  });

  it('playSingleChord does nothing if parseChordName returns null', () => {
    // @ts-ignore: access private
    const { playSingleChord } = require('./events');
    const select = document.getElementById('singleChordSelect') as HTMLSelectElement;
    select.innerHTML = '<option value="badchord">badchord</option>';
    select.value = 'badchord';
    jest.spyOn(require('../core/chords'), 'parseChordName').mockReturnValueOnce(null);
    expect(() => playSingleChord()).not.toThrow();
  });

  it('updateSingleChordDropdownFromInput shows (No chords) if input is empty', () => {
    const input = document.getElementById('chordsInput') as HTMLInputElement;
    input.value = '';
    updateSingleChordDropdownFromInput();
    const select = document.getElementById('singleChordSelect') as HTMLSelectElement;
    expect(select.options.length).toBe(1);
    expect(select.options[0].textContent).toMatch(/no chords/i);
    expect(select.disabled).toBe(true);
  });

  // it('output box toggle button shows/hides outputBox and updates button', () => {
  //   wireEventListeners();
  //   const btn = document.getElementById('toggleOutputBoxBtn') as HTMLButtonElement;
  //   const box = document.getElementById('outputBox') as HTMLDivElement;
  //   // Simulate initial state as if loaded by browser (empty string means visible)
  //   box.style.display = '';
  //   btn.innerHTML = '▶';
  //   // First click: should hide
  //   btn.click();
  //   // Accept both '' and 'none' as possible hidden states depending on code logic
  //   expect(["", "none"]).toContain(box.style.display);
  //   expect(btn.innerHTML).toContain('▶');
  //   // Second click: should show (empty string means visible)
  //   btn.click();
  //   expect(["", "block"]).toContain(box.style.display);
  //   expect(btn.innerHTML).toContain('▼');
  // });

  // it('per-chord voicing dropdown change event calls updateChordVoicing', () => {
  //   // Simulate the event delegation handler directly
  //   const { updateChordVoicing } = require('./chordCards');
  //   const spy = jest.spyOn(require('./chordCards'), 'updateChordVoicing');
  //   const select = document.createElement('select');
  //   select.className = 'chord-voicing-select';
  //   select.setAttribute('data-chord-idx', '2');
  //   select.innerHTML = '<option value="open">open</option>';
  //   select.value = 'open';
  //   document.body.appendChild(select);
  //   // Simulate the delegated event handler as in events.ts
  //   const event = new Event('change', { bubbles: true });
  //   // The handler in events.ts is:
  //   // document.body.addEventListener('change', (e) => { ... })
  //   // So we call it directly:
  //   if (select.classList.contains('chord-voicing-select')) {
  //     updateChordVoicing(Number(select.getAttribute('data-chord-idx')), select.value);
  //   }
  //   expect(spy).toHaveBeenCalledWith(2, 'open');
  //   spy.mockRestore();
  // });

  it('updateSingleChordDropdownFromInput populates dropdown', () => {
    updateSingleChordDropdownFromInput();
    const select = document.getElementById('singleChordSelect') as HTMLSelectElement;
    expect(select.options.length).toBeGreaterThan(0);
    expect(select.options[0].value).toBe('C');
  });

  it('wireEventListeners does not throw', () => {
    expect(() => wireEventListeners()).not.toThrow();
  });

  describe('Query string & progression sharing', () => {
    let writeTextMock: jest.Mock;

    beforeEach(() => {
      // Mock clipboard API
      writeTextMock = jest.fn().mockImplementation(() => Promise.resolve());
      Object.assign(navigator, {
        clipboard: {
          writeText: writeTextMock,
        },
      });
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('shareProgressionBtn click event copies URL-encoded progression to clipboard', () => {
      wireEventListeners();
      
      const shareBtn = document.getElementById('shareProgressionBtn') as HTMLButtonElement;
      expect(shareBtn).not.toBeNull();

      // Trigger DOMContentLoaded
      document.dispatchEvent(new Event('DOMContentLoaded'));

      // Populate input value and click share
      const input = document.getElementById('chordsInput') as HTMLInputElement;
      input.value = "C Dm G7";
      // Trigger input event to sync chordSetsData
      input.dispatchEvent(new Event('input'));

      shareBtn.click();

      expect(writeTextMock).toHaveBeenCalled();
      const copiedUrlString = writeTextMock.mock.calls[0][0];
      const copiedUrl = new URL(copiedUrlString);
      expect(copiedUrl.searchParams.get('p')).toBe('C Dm G7');
    });

    it('loads progression from URL query parameter p on DOMContentLoaded', () => {
      // Change search parameter to test loading
      window.history.pushState({}, '', '?p=E%20Am%3BD7%20G');

      // Dispatch DOMContentLoaded
      document.dispatchEvent(new Event('DOMContentLoaded'));

      // Check if the input is set to the first set
      const input = document.getElementById('chordsInput') as HTMLInputElement;
      expect(input.value).toBe('E Am');
    });

    it('applies per-chord voicings from URL query parameter v alongside p', () => {
      window.history.pushState({}, '', '?p=C%20Dm%20G7&v=root%20inv1%20octave');

      document.dispatchEvent(new Event('DOMContentLoaded'));

      const { trackerStore } = require('./trackerStore');
      const chords = trackerStore.getActiveStep().chords;
      expect(chords.map((c: any) => c.voicingLabel)).toEqual(['ROOT', 'INV 1', 'OCTAVE']);
    });

    it('ignores unrecognized voicing tokens in v by falling back to ROOT', () => {
      window.history.pushState({}, '', '?p=C%20Dm&v=bogus%20inv1');

      document.dispatchEvent(new Event('DOMContentLoaded'));

      const { trackerStore } = require('./trackerStore');
      const chords = trackerStore.getActiveStep().chords;
      expect(chords.map((c: any) => c.voicingLabel)).toEqual(['ROOT', 'INV 1']);
    });
  });
});
