const STORAGE_KEY = 'user';

const _defaults = {
    visitCount: 0,
    currentVisitStart: null,
    lastVisitStart: null,
    lastVisitEnd: null,
    totalTimeMs: 0,
    lastProgram: null,
};

let _state = {};

function _load() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? { ..._defaults, ...JSON.parse(raw) } : { ..._defaults };
    } catch {
        return { ..._defaults };
    }
}

function _save() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(_state));
    } catch {}
}

export const userState = {
    // ms the user was away before this visit; null on the very first visit
    gap: null,

    // Full init: counts as a visit, updates timestamps, flushes on unload.
    // Use this on the main page (index.html).
    init() {
        _state = _load();

        this.gap = _state.lastVisitEnd != null ? Date.now() - _state.lastVisitEnd : null;

        _state.lastVisitStart = _state.currentVisitStart;
        _state.currentVisitStart = Date.now();
        _state.visitCount += 1;

        _save();

        window.addEventListener('beforeunload', () => {
            const now = Date.now();
            _state.lastVisitEnd = now;
            _state.totalTimeMs += now - _state.currentVisitStart;
            _save();
        });
    },

    // Read-only load: reads state into memory without touching visitCount or timestamps.
    // Use this on secondary pages (console.html) so they share the same data
    // without double-counting visits.
    load() {
        _state = _load();
        this.gap = _state.lastVisitEnd != null ? Date.now() - _state.lastVisitEnd : null;
    },

    get(key) {
        return _state[key];
    },

    set(key, value) {
        _state[key] = value;
        _save();
    },
};
