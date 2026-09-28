import {
  playChordProgression,
  stopChordProgression,
  playSingleChordGlobal,
} from "../core/audio";
import {
  saveProject,
  loadProject,
  deleteProject,
  exportProjectJson,
  importProjectJson,
  listProjects,
} from "../core/projectActions";
import { convertChords, parseChordName, getCanonicalVoicings } from "../core/chords";
import {
  convertChordsUI,
  getCurrentProgressionNotes,
  toggleIntervalMode,
} from "./chordCards";
import { showToast } from "./toast";
import { trackerStore, type StepLoadInput } from "./trackerStore";

// ─── Voicing select ─────────────────────────────────────────────────
export const getSelectedVoicing = (): string => "closed";

// ─── State delegation & backward compatibility ──────────────────────
export const getChordSetsData = (): string[] => trackerStore.getSetsData();
export const getActiveSetIndex = (): number => trackerStore.getActiveIndex();
export const getHasConverted = (): boolean => trackerStore.getHasConverted();

export let chordSetsData = trackerStore.getSetsData();
export let activeSetIndex = trackerStore.getActiveIndex();
export let hasConverted = trackerStore.getHasConverted();

// Subscribe to store updates to keep legacy exported references in sync
trackerStore.subscribe(() => {
  chordSetsData = trackerStore.getSetsData();
  activeSetIndex = trackerStore.getActiveIndex();
  hasConverted = trackerStore.getHasConverted();
});

export const setHasConverted = (val: boolean) => {
  trackerStore.setHasConverted(val);
};

export const loadSetsData = (sets: string[]) => {
  trackerStore.loadSetsData(sets);

  const input = document.getElementById("chordsInput") as HTMLInputElement;
  if (input) input.value = trackerStore.getActiveSet();

  updateSingleChordDropdownFromInput();
  renderStepStrip();

  document.getElementById("convertChordsBtn")?.click();
};

export const loadStepsData = (steps: (string | StepLoadInput)[]) => {
  trackerStore.loadStepsData(steps);

  const input = document.getElementById("chordsInput") as HTMLInputElement;
  if (input) input.value = trackerStore.getActiveSet();

  updateSingleChordDropdownFromInput();
  renderStepStrip();

  document.getElementById("convertChordsBtn")?.click();
};

/**
 * Maps a per-chord voicing token from a shared link (a canonical voicing id, e.g.
 * "inv1", or "-" for unset) to its CANONICAL_VOICINGS index. Falls back to ROOT (0)
 * for unrecognized tokens so a malformed link degrades gracefully.
 */
const voicingIndexFromToken = (token: string): number => {
  const idx = getCanonicalVoicings().findIndex((v) => v.id === token.toLowerCase());
  return idx === -1 ? 0 : idx;
};

export const renderStepStrip = (): void => {
  const strip = document.getElementById("step-strip");
  if (!strip) return;
  strip.innerHTML = "";

  if (!trackerStore.getHasConverted()) return;

  const currentSets = trackerStore.getSetsData();
  const currentActive = trackerStore.getActiveIndex();

  currentSets.forEach((_, i) => {
    const el = document.createElement("div");
    el.className = "step-num" + (i === currentActive ? " active" : "");
    el.textContent = (i + 1).toString();
    el.style.cursor = "pointer";
    el.addEventListener("click", () => switchSet(i));
    strip.appendChild(el);
  });

  const addBtn = document.createElement("div");
  addBtn.className = "step-num";
  addBtn.textContent = "+";
  addBtn.title = "Add Chord Set";
  addBtn.style.cursor = "pointer";
  addBtn.addEventListener("click", addSet);
  strip.appendChild(addBtn);

  const removeBtn = document.getElementById("removeSetBtn");
  if (removeBtn) {
    removeBtn.style.display = currentSets.length > 1 ? "inline-block" : "none";
  }
};

const addSet = (): void => {
  const newIdx = trackerStore.addSet();
  switchSet(newIdx);
};

const removeSet = (): void => {
  const currentSets = trackerStore.getSetsData();
  if (currentSets.length <= 1) return;
  const newIndex = trackerStore.removeSet();
  switchSet(newIndex);
};

const switchSet = (index: number): void => {
  if (!trackerStore.switchSet(index)) return;

  const activeContent = trackerStore.getActiveSet();
  const input = document.getElementById("chordsInput") as HTMLInputElement;
  if (input) input.value = activeContent;

  updateSingleChordDropdownFromInput();
  renderStepStrip();

  if (activeContent.trim() === "") {
    const outputBox = document.getElementById("outputBox");
    if (outputBox) outputBox.style.display = "none";
    const toggleBtn = document.getElementById("toggleOutputBoxBtn");
    if (toggleBtn) {
      toggleBtn.innerHTML = "CHORDS ▶";
      toggleBtn.setAttribute("aria-expanded", "false");
      toggleBtn.classList.add("dimmed");
    }
  } else {
    document.getElementById("convertChordsBtn")?.click();
  }
};

// ─── Storage UI Handlers ───────────────────────────────────────────
export const saveChordSet = (): void => {
  const input = (document.getElementById("chordsInput") as HTMLInputElement | null)?.value || "";
  trackerStore.updateActiveSet(input);

  const nameInput = document.getElementById("chordSetNameInput") as HTMLInputElement | null;
  const name = nameInput?.value.trim() || "";

  const res = saveProject(name);
  if (res.ok) {
    updateSavedChordSetsDropdown();
    showToast(res.message, "success");
  } else {
    showToast(res.message, "error");
  }
};

export const loadChordSet = (): void => {
  const select = document.getElementById("savedChordSetsSelect") as HTMLSelectElement | null;
  const idxStr = select?.value;
  if (!idxStr || isNaN(Number(idxStr))) {
    showToast("Please select a saved chord set to load.", "error");
    return;
  }
  const res = loadProject(parseInt(idxStr, 10));
  if (res.ok && res.data) {
    const input = document.getElementById("chordsInput") as HTMLInputElement;
    if (input) input.value = trackerStore.getActiveSet();
    updateSingleChordDropdownFromInput();
    renderStepStrip();
    document.getElementById("convertChordsBtn")?.click();
    showToast(res.message, "success");
  } else {
    showToast(res.message, "error");
  }
};

export const deleteChordSet = (): void => {
  const select = document.getElementById("savedChordSetsSelect") as HTMLSelectElement | null;
  const idxStr = select?.value;
  if (!idxStr || isNaN(Number(idxStr))) {
    showToast("Please select a saved chord set to delete.", "error");
    return;
  }
  const res = deleteProject(parseInt(idxStr, 10));
  if (res.ok) {
    updateSavedChordSetsDropdown();
    showToast(res.message, "success");
  } else {
    showToast(res.message, "error");
  }
};

export const updateSavedChordSetsDropdown = (): void => {
  const select = document.getElementById("savedChordSetsSelect") as HTMLSelectElement | null;
  if (!select) return;
  const sets = listProjects();
  select.innerHTML = '<option value="">Load saved set...</option>';
  sets.forEach((set, idx) => {
    select.innerHTML += `<option value="${idx}">${set.name}</option>`;
  });
};

export const exportChordSets = (): void => {
  const select = document.getElementById("savedChordSetsSelect") as HTMLSelectElement | null;
  const selectedIdx = select && select.value && !isNaN(Number(select.value)) ? parseInt(select.value, 10) : undefined;
  
  const res = exportProjectJson(selectedIdx);
  if (res.ok && res.data) {
    const blob = new Blob([res.data.json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = res.data.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(res.message, "success");
  } else {
    showToast(res.message, "error");
  }
};

export const importChordSets = (e: Event): void => {
  const fileInput = e.target as HTMLInputElement | null;
  if (!fileInput || !fileInput.files || !fileInput.files[0]) {
    showToast("No file selected.", "error");
    return;
  }
  const file = fileInput.files[0];
  const reader = new FileReader();
  reader.onload = function (event) {
    const resultStr = typeof event.target?.result === "string" ? event.target.result : "";
    const res = importProjectJson(resultStr);
    updateSavedChordSetsDropdown();
    if (res.ok) {
      showToast(res.message, res.data && res.data.addedCount > 0 ? "success" : "info");
    } else {
      showToast(res.message, "error");
    }
    fileInput.value = "";
  };
  reader.readAsText(file);
};

// ─── Clear input ────────────────────────────────────────────────────
export const clearInput = (): void => {
  const input = document.getElementById("chordsInput") as HTMLInputElement | null;
  if (input) {
    input.value = "";
    trackerStore.updateActiveSet("");
    updateSingleChordDropdownFromInput();

    const outputBox = document.getElementById("outputBox");
    if (outputBox) outputBox.style.display = "none";
    const toggleBtn = document.getElementById("toggleOutputBoxBtn");
    if (toggleBtn) {
      toggleBtn.innerHTML = "CHORDS ▶";
      toggleBtn.setAttribute("aria-expanded", "false");
      toggleBtn.classList.add("dimmed");
    }
  }
};

// ─── Single chord dropdown ──────────────────────────────────────────
export const updateSingleChordDropdownFromInput = (): void => {
  const input = document.getElementById("chordsInput") as HTMLInputElement | null;
  const select = document.getElementById("singleChordSelect") as HTMLSelectElement | null;
  if (!input || !select) return;

  const chordNames = input.value.split(/\s|,/).map((s) => s.trim()).filter(Boolean);
  const uniqueChords = Array.from(new Set(chordNames));

  select.innerHTML = "";
  if (uniqueChords.length === 0) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "(No chords)";
    select.appendChild(opt);
    select.disabled = true;
  } else {
    uniqueChords.forEach((chord) => {
      const opt = document.createElement("option");
      opt.value = chord;
      opt.textContent = chord;
      select.appendChild(opt);
    });
    select.disabled = false;
  }
};

export const playSingleChord = (): void => {
  const select = document.getElementById("singleChordSelect") as HTMLSelectElement | null;
  if (!select || !select.value) return;
  const parsed = parseChordName(select.value);
  if (!parsed) return;
  playSingleChordGlobal(parsed);
};

// ─── Wire all event listeners ───────────────────────────────────────
export const wireEventListeners = (): void => {
  document.addEventListener("DOMContentLoaded", () => {
    const inputInit = document.getElementById("chordsInput") as HTMLInputElement | null;
    if (inputInit) {
      trackerStore.updateActiveSet(inputInit.value);
    }

    // ── Playback ──
    let isPlaying = false;
    let isLooping = false;

    const PLAY_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`;
    const STOP_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="4" y="4" width="16" height="16"></rect></svg>`;

    const resetPlayBtn = () => {
      isPlaying = false;
      const btn = document.getElementById("mainPlayBtn");
      if (btn) {
        btn.innerHTML = PLAY_ICON;
        btn.classList.remove("btn-primary");
        btn.classList.add("btn-muted");
      }
    };

    document.getElementById("mainPlayBtn")?.addEventListener("click", () => {
      const btn = document.getElementById("mainPlayBtn");
      if (isPlaying) {
        stopChordProgression();
        resetPlayBtn();
      } else {
        const notesArray = getCurrentProgressionNotes();
        playChordProgression(notesArray, isLooping, resetPlayBtn);
        isPlaying = true;
        if (btn) {
          btn.innerHTML = STOP_ICON;
          btn.classList.remove("btn-muted");
          btn.classList.add("btn-primary");
        }
      }
    });

    document.getElementById("mainLoopBtn")?.addEventListener("click", () => {
      isLooping = !isLooping;
      const btn = document.getElementById("mainLoopBtn");
      if (isLooping) {
        if (btn) {
          btn.classList.remove("btn-muted");
          btn.classList.add("btn-primary");
        }
      } else {
        if (btn) {
          btn.classList.remove("btn-primary");
          btn.classList.add("btn-muted");
        }
      }
    });

    document.getElementById("intervalToggleBtn")?.addEventListener("click", () => {
      toggleIntervalMode();
    });

    // ── Chord set management ──
    document.getElementById("saveChordSetBtn")?.addEventListener("click", saveChordSet);
    document.getElementById("loadChordSetBtn")?.addEventListener("click", loadChordSet);
    document.getElementById("deleteChordSetBtn")?.addEventListener("click", deleteChordSet);
    document.getElementById("exportChordSetsBtn")?.addEventListener("click", exportChordSets);
    document.getElementById("importChordSetsInput")?.addEventListener("change", importChordSets);

    // ── Nav bar: Help Modal ──
    const helpModal = document.getElementById("helpModal") as HTMLDialogElement;
    document.getElementById("nav-settings-btn")?.addEventListener("click", () => {
      if (helpModal) helpModal.showModal();
    });
    document.getElementById("helpModalCloseBtn")?.addEventListener("click", () => {
      if (helpModal) helpModal.close();
    });
    helpModal?.addEventListener("click", (e) => {
      if (e.target === helpModal) {
        helpModal.close();
      }
    });

    // ── Nav bar: Disk Modal ──
    const diskModal = document.getElementById("diskModal") as HTMLDialogElement;
    document.getElementById("nav-disk-btn")?.addEventListener("click", () => {
      if (diskModal) diskModal.showModal();
    });
    document.getElementById("diskModalCloseBtn")?.addEventListener("click", () => {
      if (diskModal) diskModal.close();
    });
    diskModal?.addEventListener("click", (e) => {
      if (e.target === diskModal) {
        diskModal.close();
      }
    });

    // ── Disk Modal: New Project ──
    document.getElementById("newProjectBtn")?.addEventListener("click", () => {
      trackerStore.reset();
      renderStepStrip();

      const input = document.getElementById("chordsInput") as HTMLInputElement;
      if (input) input.value = "";
      const outputBox = document.getElementById("outputBox");
      if (outputBox) outputBox.style.display = "none";
      const toggleBtn = document.getElementById("toggleOutputBoxBtn");
      if (toggleBtn) {
        toggleBtn.innerHTML = "CHORDS ▶";
        toggleBtn.setAttribute("aria-expanded", "false");
        toggleBtn.classList.add("dimmed");
      }
      const intContainer = document.getElementById("intervalToggleContainer");
      if (intContainer) intContainer.style.display = "none";
      if (diskModal) diskModal.close();
      showToast("New project started.", "info");
    });

    // ── Convert / Clear / Single Chord ──
    document.getElementById("convertChordsBtn")?.addEventListener("click", () => {
      if (!trackerStore.getHasConverted()) {
        trackerStore.setHasConverted(true);
        renderStepStrip();
      }

      convertChordsUI(
        convertChords,
        () => "closed",
        updateSingleChordDropdownFromInput
      );
      stopChordProgression();
      resetPlayBtn();
    });
    document.getElementById("clearInputBtn")?.addEventListener("click", clearInput);
    document.getElementById("removeSetBtn")?.addEventListener("click", removeSet);
    document.getElementById("shareProgressionBtn")?.addEventListener("click", () => {
      const activeSets = trackerStore.getSetsData().map((s) => s.trim()).filter(Boolean);
      if (activeSets.length === 0) {
        showToast("No chords to share!", "error");
        return;
      }
      const serialized = activeSets.join(";");
      const url = new URL(window.location.href);
      url.searchParams.set("p", serialized);

      navigator.clipboard.writeText(url.toString())
        .then(() => {
          showToast("Shareable link copied to clipboard!", "success");
        })
        .catch(() => {
          showToast("Failed to copy link to clipboard.", "error");
        });
    });
    document.getElementById("playSingleChordBtn")?.addEventListener("click", playSingleChord);

    // ── Chords input → update single chord dropdown and store ──
    document.getElementById("chordsInput")?.addEventListener("input", (e) => {
      const target = e.target as HTMLInputElement;
      trackerStore.updateActiveSet(target.value);
      updateSingleChordDropdownFromInput();
    });

    // ── Output box toggle ──
    document.getElementById("toggleOutputBoxBtn")?.addEventListener("click", () => {
      const box = document.getElementById("outputBox");
      const btn = document.getElementById("toggleOutputBoxBtn");
      if (!box || !btn) return;
      const isOpen = box.style.display !== "none" && box.style.display !== "";
      box.style.display = isOpen ? "none" : "block";
      btn.setAttribute("aria-expanded", String(!isOpen));
      btn.innerHTML = isOpen ? "CHORDS ▶" : "CHORDS ▼";
    });

    // ── Initialise dropdowns ──
    updateSingleChordDropdownFromInput();
    updateSavedChordSetsDropdown();

    // ── Load progression from URL query string if present ──
    const params = new URLSearchParams(window.location.search);
    let pParams = params.getAll("p");
    if (pParams.length === 0) {
      pParams = params.getAll("progression");
    }
    if (pParams.length > 0) {
      const querySets: string[] = [];
      pParams.forEach((param) => {
        const parts = param.split(";");
        querySets.push(...parts);
      });

      // Optional per-chord voicings: "v" mirrors "p"'s set/chord layout (";"
      // between sets, whitespace between chords), with each chord token a
      // canonical voicing id (root, inv1, inv2, inv3, drop2, spread, octave).
      const vParams = params.getAll("v");
      const voicingSets: string[] = [];
      vParams.forEach((param) => {
        voicingSets.push(...param.split(";"));
      });

      if (querySets.length > 0 && querySets.some((s) => s.trim() !== "")) {
        if (voicingSets.length > 0) {
          const steps: (string | StepLoadInput)[] = querySets.map((chords, i) => {
            const tokens = (voicingSets[i] || "").trim().split(/\s+/).filter(Boolean);
            if (tokens.length === 0) return chords;
            return { chords, voicings: tokens.map(voicingIndexFromToken) };
          });
          loadStepsData(steps);
        } else {
          loadSetsData(querySets);
        }
      }
    }
  });
};
