const STORAGE_KEY = 'bonsai';

// --- Tunable growth parameters ---
const GROWTH = {
    WARMUP_STEPS:         16,      // sim steps in the fast warm-up phase (trunk + first branches)
    STEPS_PER_MS_WARMUP:  0.008,   // speed during warm-up (trunk visible in seconds)
    STEPS_PER_MS_SLOW:    0.0000005, // speed after warm-up (full tree in a few days)
    STEP_SIZE:        8,        // logical px grown per sim step
    INFLUENCE_RADIUS: 70,       // how far a tip "sees" attraction points (px)
    KILL_RADIUS:      16,       // consumption radius around each node (px)
    ATTRACTION_COUNT: 350,      // growth targets scattered in crown
    FORK_CHANCE_MIN:  0.1,     // fork probability at trunk (depth 0)
    FORK_CHANCE_MAX:  0.18,      // fork probability at full branch depth
    FORK_DEPTH:       20,       // depth at which fork chance reaches max
    MAX_TIPS:         200,      // cap on concurrent active growing tips
    REP_RADIUS_MULT:  1,        // repulsion acts within KILL_RADIUS * this (px)
    REP_STRENGTH:     1.0,      // how hard tips push each other apart
    MOMENTUM:         0.8,      // fraction of previous growth direction retained each step
    UPWARD_BIAS:      0.1,      // constant upward pull added to every tip's direction
    WIDTH_MIN:        1.0,      // line width at tips (px)
    WIDTH_MAX:        30.0,      // line width at trunk (px)
    WIDTH_EXP:        1.4,      // taper curve exponent: 0.5=sqrt (da Vinci), 1=linear
};

// Fixed logical canvas space — tree coordinates live here, scaled to screen on render
const LW = 800;
const LH = 600;

// Crown ellipse — attraction points fill this region
const CROWN_CX = LW / 2;
const CROWN_CY = LH * 0.34;
const CROWN_RX = LW * 0.36;
const CROWN_RY = LH * 0.28;

// Trunk base position
const TRUNK_X = LW / 2;
const TRUNK_Y = LH * 0.87;

// Seeded PRNG (mulberry32) for deterministic attraction point layout
function mulberry32(a) {
    return () => {
        a |= 0; a = a + 0x6D2B79F5 | 0;
        let t = Math.imul(a ^ a >>> 15, 1 | a);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

// Generate attraction points from seed: crown ellipse + scaffold up the trunk
function generatePoints(seed, count) {
    const rng = mulberry32(seed);
    const pts = [];
    let attempts = 0;
    while (pts.length < count && attempts < count * 12) {
        attempts++;
        const x = CROWN_CX + (rng() * 2 - 1) * CROWN_RX;
        const y = CROWN_CY + (rng() * 2 - 1) * CROWN_RY;
        const nx = (x - CROWN_CX) / CROWN_RX;
        const ny = (y - CROWN_CY) / CROWN_RY;
        if (nx * nx + ny * ny <= 1) pts.push([x, y]);
    }
    // Scaffold: vertical spine from trunk into crown base to guide initial trunk growth
    const scaffoldCount = 12;
    for (let i = 0; i < scaffoldCount; i++) {
        const t = (i + 1) / (scaffoldCount + 1);
        const sy = TRUNK_Y - t * (TRUNK_Y - (CROWN_CY + CROWN_RY * 0.85));
        pts.push([TRUNK_X + (rng() * 2 - 1) * 18, sy]);
    }
    return pts;
}

// ─── Simulation ──────────────────────────────────────────────────────────────

class BonsaiTree {
    constructor() {
        this._state = null;
        this._attrPts = null;
        this._activeAttr = null;
        this._consumedSet = null;
        this._tips = null;
    }

    load() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                this._state = JSON.parse(raw);
                this._rebuild();
                this._fastForward();
                return;
            }
        } catch {}
        this._initFresh();
    }

    save() {
        this._state.consumed = Array.from(this._consumedSet);
        this._state.lastSaved = Date.now();
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this._state)); } catch {}
    }

    _initFresh() {
        const seed = (Math.random() * 0xFFFFFF | 0) + 1;
        this._state = {
            seed,
            lastSaved: Date.now(),
            simStep: 0,
            x: [TRUNK_X | 0],
            y: [TRUNK_Y | 0],
            p: [-1],
            dead: [0],
            depth: [0],
            consumed: [],
        };
        this._attrPts = generatePoints(seed, GROWTH.ATTRACTION_COUNT);
        this._consumedSet = new Set();
        this._activeAttr = new Set(this._attrPts.map((_, i) => i));
        this._tips = new Set([0]);
        this._consumeNear(0);
    }

    _rebuild() {
        const s = this._state;
        this._attrPts = generatePoints(s.seed, GROWTH.ATTRACTION_COUNT);
        this._consumedSet = new Set(s.consumed);
        this._activeAttr = new Set();
        for (let i = 0; i < this._attrPts.length; i++) {
            if (!this._consumedSet.has(i)) this._activeAttr.add(i);
        }
        if (!s.depth) {
            s.depth = new Array(s.x.length).fill(0);
            for (let i = 1; i < s.x.length; i++) {
                if (s.p[i] >= 0) s.depth[i] = s.depth[s.p[i]] + 1;
            }
        }
        this._rebuildTips();
    }

    _rebuildTips() {
        const s = this._state;
        const hasLivingChild = new Set();
        for (let i = 0; i < s.p.length; i++) {
            if (!s.dead[i] && s.p[i] !== -1) hasLivingChild.add(s.p[i]);
        }
        this._tips = new Set();
        for (let i = 0; i < s.p.length; i++) {
            if (!s.dead[i] && !hasLivingChild.has(i)) this._tips.add(i);
        }
    }

    _fastForward() {
        const elapsed = Date.now() - this._state.lastSaved;
        const savedStep = this._state.simStep;
        const remainingWarmup = Math.max(0, GROWTH.WARMUP_STEPS - savedStep);
        const warmupMs = remainingWarmup / GROWTH.STEPS_PER_MS_WARMUP;

        let steps;
        if (elapsed <= warmupMs) {
            steps = Math.floor(elapsed * GROWTH.STEPS_PER_MS_WARMUP);
        } else {
            steps = remainingWarmup + Math.floor((elapsed - warmupMs) * GROWTH.STEPS_PER_MS_SLOW);
        }
        for (let i = 0; i < steps; i++) this._step();
    }

    step() { this._step(); }

    _step() {
        if (this._activeAttr.size === 0) return;
        const s = this._state;
        const tips = Array.from(this._tips);

        // For each attraction point find the nearest tip within influence radius,
        // accumulate normalised direction vectors per tip
        const tipDirs = new Map();
        for (const ai of this._activeAttr) {
            const [ax, ay] = this._attrPts[ai];
            let closestTip = -1;
            let closestD2 = GROWTH.INFLUENCE_RADIUS * GROWTH.INFLUENCE_RADIUS;
            for (const ti of tips) {
                const dx = ax - s.x[ti], dy = ay - s.y[ti];
                const d2 = dx * dx + dy * dy;
                if (d2 < closestD2) { closestD2 = d2; closestTip = ti; }
            }
            if (closestTip !== -1) {
                if (!tipDirs.has(closestTip)) tipDirs.set(closestTip, { dx: 0, dy: 0 });
                const d = tipDirs.get(closestTip);
                const len = Math.sqrt(closestD2);
                d.dx += (ax - s.x[closestTip]) / len;
                d.dy += (ay - s.y[closestTip]) / len;
            }
        }

        // Inertia fallback: uninfluenced tips continue in their current direction
        // instead of all converging on the nearest remaining attraction point
        for (const ti of tips) {
            if (tipDirs.has(ti)) continue;
            const pi = s.p[ti];
            let dx = 0, dy = -1;
            if (pi >= 0) {
                const pdx = s.x[ti] - s.x[pi];
                const pdy = s.y[ti] - s.y[pi];
                const plen = Math.hypot(pdx, pdy);
                if (plen > 0) { dx = pdx / plen; dy = pdy / plen; }
            }
            tipDirs.set(ti, { dx, dy });
        }

        // Normalize, then blend with parent direction (momentum) and add upward bias
        for (const [ti, dir] of tipDirs) {
            const attrLen = Math.hypot(dir.dx, dir.dy);
            if (attrLen > 0) { dir.dx /= attrLen; dir.dy /= attrLen; }
            const pi = s.p[ti];
            if (pi >= 0) {
                const pdx = s.x[ti] - s.x[pi];
                const pdy = s.y[ti] - s.y[pi];
                const plen = Math.hypot(pdx, pdy);
                if (plen > 0) {
                    dir.dx = dir.dx * (1 - GROWTH.MOMENTUM) + (pdx / plen) * GROWTH.MOMENTUM;
                    dir.dy = dir.dy * (1 - GROWTH.MOMENTUM) + (pdy / plen) * GROWTH.MOMENTUM;
                }
            }
            dir.dy -= GROWTH.UPWARD_BIAS;
        }

        // Repulsion: push tips away from nearby siblings so parallel branches diverge
        const REP_R = GROWTH.KILL_RADIUS * GROWTH.REP_RADIUS_MULT;
        const REP_R2 = REP_R * REP_R;
        for (const ti of tips) {
            const dir = tipDirs.get(ti);
            if (!dir) continue;
            for (const other of tips) {
                if (other === ti) continue;
                const dx = s.x[ti] - s.x[other];
                const dy = s.y[ti] - s.y[other];
                const d2 = dx * dx + dy * dy;
                if (d2 < REP_R2 && d2 > 0) {
                    const d = Math.sqrt(d2);
                    const f = (1 - d / REP_R) * GROWTH.REP_STRENGTH;
                    dir.dx += (dx / d) * f;
                    dir.dy += (dy / d) * f;
                }
            }
        }

        // Grow each tip one step in its averaged direction
        const newTips = new Set(this._tips);
        for (const [ti, dir] of tipDirs) {
            if (newTips.size >= GROWTH.MAX_TIPS) break;
            const len = Math.hypot(dir.dx, dir.dy);
            if (len === 0) continue;

            const nx = s.x[ti] + (dir.dx / len) * GROWTH.STEP_SIZE;
            const ny = s.y[ti] + (dir.dy / len) * GROWTH.STEP_SIZE;

            const newIdx = s.x.length;
            s.x.push(nx | 0);
            s.y.push(ny | 0);
            s.p.push(ti);
            s.dead.push(0);
            s.depth.push(s.depth[ti] + 1);

            newTips.delete(ti);
            newTips.add(newIdx);
            this._consumeNear(newIdx);

            // Fork: perpendicular child; repulsion will push it apart over time
            const forkRng = mulberry32((s.seed + s.simStep * 1000003 + newIdx) | 0);
            const forkChance = GROWTH.FORK_CHANCE_MIN + (GROWTH.FORK_CHANCE_MAX - GROWTH.FORK_CHANCE_MIN) * Math.min(1, s.depth[ti] / GROWTH.FORK_DEPTH);
            if (newTips.size < GROWTH.MAX_TIPS && forkRng() < forkChance) {
                const side = forkRng() < 0.5 ? 1 : -1;
                const fsx = (s.x[ti] - (dir.dy / len) * side * GROWTH.STEP_SIZE) | 0;
                const fsy = (s.y[ti] + (dir.dx / len) * side * GROWTH.STEP_SIZE) | 0;
                // Skip if an unrelated tip is already within KILL_RADIUS of the fork position.
                // Exclude newIdx (the forward sibling) — it's always close by design.
                const sep2 = GROWTH.KILL_RADIUS * GROWTH.KILL_RADIUS;
                let tooClose = false;
                for (const other of newTips) {
                    if (other === newIdx) continue;
                    const ddx = fsx - s.x[other], ddy = fsy - s.y[other];
                    if (ddx * ddx + ddy * ddy < sep2) { tooClose = true; break; }
                }
                if (!tooClose) {
                    const forkIdx = s.x.length;
                    s.x.push(fsx);
                    s.y.push(fsy);
                    s.p.push(ti);
                    s.dead.push(0);
                    s.depth.push(s.depth[ti] + 1);
                    newTips.add(forkIdx);
                    this._consumeNear(forkIdx);
                }
            }
        }

        this._tips = newTips;
        this._state.simStep++;
    }

    _consumeNear(nodeIdx) {
        const nx = this._state.x[nodeIdx];
        const ny = this._state.y[nodeIdx];
        const kr2 = GROWTH.KILL_RADIUS * GROWTH.KILL_RADIUS;
        const toRemove = [];
        for (const ai of this._activeAttr) {
            const [ax, ay] = this._attrPts[ai];
            const dx = ax - nx, dy = ay - ny;
            if (dx * dx + dy * dy <= kr2) toRemove.push(ai);
        }
        for (const ai of toRemove) {
            this._activeAttr.delete(ai);
            this._consumedSet.add(ai);
        }
    }

    // Returns true if a branch was pruned, false if click missed
    prune(lx, ly) {
        const s = this._state;
        const HIT = 10;
        let bestNode = -1, bestDist = HIT;
        for (let i = 1; i < s.x.length; i++) {
            if (s.dead[i]) continue;
            const pi = s.p[i];
            if (pi < 0 || s.dead[pi]) continue;
            const dist = this._ptSegDist(lx, ly, s.x[pi], s.y[pi], s.x[i], s.y[i]);
            if (dist < bestDist) { bestDist = dist; bestNode = i; }
        }
        if (bestNode === -1) return false;
        this._killSubtree(bestNode);
        this._rebuildTips();
        return true;
    }

    _killSubtree(rootIdx) {
        const s = this._state;
        // Build children map then BFS — O(n) and avoids recursive depth issues
        const children = new Map();
        for (let i = 0; i < s.p.length; i++) {
            if (!s.dead[i] && s.p[i] !== -1) {
                if (!children.has(s.p[i])) children.set(s.p[i], []);
                children.get(s.p[i]).push(i);
            }
        }
        const dead = [];
        const queue = [rootIdx];
        while (queue.length) {
            const cur = queue.pop();
            s.dead[cur] = 1;
            dead.push(cur);
            for (const ch of (children.get(cur) || [])) queue.push(ch);
        }

        // Release consumed attraction points that were near dead nodes so
        // regrowth fans out into the freed space rather than clumping
        const kr2 = GROWTH.KILL_RADIUS * GROWTH.KILL_RADIUS;
        for (const ai of [...this._consumedSet]) {
            const [ax, ay] = this._attrPts[ai];
            for (const di of dead) {
                const dx = ax - s.x[di], dy = ay - s.y[di];
                if (dx * dx + dy * dy <= kr2) {
                    this._consumedSet.delete(ai);
                    this._activeAttr.add(ai);
                    break;
                }
            }
        }
    }

    _ptSegDist(px, py, ax, ay, bx, by) {
        const dx = bx - ax, dy = by - ay;
        const lenSq = dx * dx + dy * dy;
        if (lenSq === 0) return Math.hypot(px - ax, py - ay);
        const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
        return Math.hypot(px - ax - t * dx, py - ay - t * dy);
    }

    get state() { return this._state; }
    get tips() { return this._tips; }
}

// ─── Renderer ─────────────────────────────────────────────────────────────────

class BonsaiRenderer {
    constructor(screenEl) {
        this.screenEl = screenEl;
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.canvas.style.cssText = 'display:block;width:100%;height:100%;';
        this.screenEl.appendChild(this.canvas);
        this.scale = 1;
        this.ox = 0;
        this.oy = 0;
        this._zoom = 1;
        this._panX = 0;
        this._panY = 0;
    }

    applyZoom(pivotCX, pivotCY, factor) {
        const newZoom = Math.max(0.5, Math.min(10, this._zoom * factor));
        const f = newZoom / this._zoom;
        const px = pivotCX - this.ox;
        const py = pivotCY - this.oy;
        this._panX = px - (px - this._panX) * f;
        this._panY = py - (py - this._panY) * f;
        this._zoom = newZoom;
    }

    resize() {
        const rect = this.screenEl.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width  = rect.width  * dpr;
        this.canvas.height = rect.height * dpr;
        this.canvas.style.width  = rect.width  + 'px';
        this.canvas.style.height = rect.height + 'px';
        this.scale = Math.min(this.canvas.width / LW, this.canvas.height / LH);
        this.ox = (this.canvas.width  - LW * this.scale) / 2;
        this.oy = (this.canvas.height - LH * this.scale) / 2;
    }

    // Convert CSS client coords → logical tree coords
    toLogical(clientX, clientY) {
        const rect = this.canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        return {
            x: ((clientX - rect.left) * dpr - this.ox - this._panX) / (this.scale * this._zoom),
            y: ((clientY - rect.top)  * dpr - this.oy - this._panY) / (this.scale * this._zoom),
        };
    }

    render(tree) {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.save();
        ctx.translate(this.ox + this._panX, this.oy + this._panY);
        ctx.scale(this.scale * this._zoom, this.scale * this._zoom);
        this._drawPot(ctx);
        this._drawTree(ctx, tree);
        ctx.restore();
    }

    _drawPot(ctx) {
        const pw = 130, ph = 38, flare = 10;
        const px = TRUNK_X - pw / 2;
        const py = TRUNK_Y + 4;

        ctx.beginPath();
        ctx.moveTo(px + flare,      py);
        ctx.lineTo(px + pw - flare, py);
        ctx.lineTo(px + pw,         py + ph);
        ctx.lineTo(px,              py + ph);
        ctx.closePath();
        ctx.shadowBlur  = 10;
        ctx.shadowColor = '#00ffcc';
        ctx.strokeStyle = '#00ffcc';
        ctx.lineWidth   = 2;
        ctx.stroke();
        ctx.shadowBlur  = 0;

        // Soil line
        ctx.beginPath();
        ctx.moveTo(px + flare, py);
        ctx.lineTo(px + pw - flare, py);
        ctx.strokeStyle = 'rgba(0,255,204,0.3)';
        ctx.lineWidth   = 1;
        ctx.stroke();
    }

    _drawTree(ctx, tree) {
        const s = tree.state;
        if (!s || s.x.length < 2) return;

        // Forward pass: depth from root (hue only)
        const depth = new Int16Array(s.x.length);
        let maxDepth = 1;
        for (let i = 1; i < s.p.length; i++) {
            if (!s.dead[i] && s.p[i] !== -1) {
                depth[i] = depth[s.p[i]] + 1;
                if (depth[i] > maxDepth) maxDepth = depth[i];
            }
        }

        // Rank live nodes by creation order, skipping dead (pruned) ones so they
        // don't inflate the denominator and skew the age ratios of live nodes.
        let liveCount = 0;
        const liveRank = new Int32Array(s.x.length).fill(-1);
        for (let i = 0; i < s.x.length; i++) {
            if (!s.dead[i]) liveRank[i] = liveCount++;
        }
        const maxLiveRank = liveCount - 1 || 1;

        // Crisp bright line
        for (let i = 1; i < s.x.length; i++) {
            if (s.dead[i]) continue;
            const pi = s.p[i];
            if (pi < 0 || s.dead[pi]) continue;
            const t = depth[i] / maxDepth;
            const hue = 170 + t * 110;
            const age = 1 - liveRank[i] / maxLiveRank;
            const w   = GROWTH.WIDTH_MIN + (GROWTH.WIDTH_MAX - GROWTH.WIDTH_MIN) * Math.pow(age * age, GROWTH.WIDTH_EXP);
            ctx.beginPath();
            ctx.moveTo(s.x[pi], s.y[pi]);
            ctx.lineTo(s.x[i],  s.y[i]);
            ctx.lineWidth   = w;
            ctx.strokeStyle = `hsl(${hue},100%,65%)`;
            ctx.stroke();
        }

        // Leaves at active tips
        ctx.shadowBlur  = 12;
        ctx.shadowColor = '#aaff00';
        ctx.fillStyle   = '#aaff00';
        for (const ti of tree.tips) {
            if (s.dead[ti]) continue;
            ctx.beginPath();
            ctx.arc(s.x[ti], s.y[ti], 3, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.shadowBlur = 0;
    }

    remove() {
        if (this.canvas.parentElement) this.canvas.parentElement.removeChild(this.canvas);
    }
}

// ─── Input ────────────────────────────────────────────────────────────────────

class BonsaiInput {
    constructor(canvas, tree, renderer, onPrune, onReset) {
        this.canvas   = canvas;
        this.tree     = tree;
        this.renderer = renderer;
        this.onPrune  = onPrune;
        this.onReset  = onReset;
        this._pinch   = null;
        this._onClick     = this._onClick.bind(this);
        this._onTouch     = this._onTouch.bind(this);
        this._onTouchMove = this._onTouchMove.bind(this);
        this._onTouchEnd  = this._onTouchEnd.bind(this);
        this._onWheel     = this._onWheel.bind(this);
    }

    attach() {
        this.canvas.addEventListener('click',      this._onClick);
        this.canvas.addEventListener('touchstart', this._onTouch,     { passive: false });
        this.canvas.addEventListener('touchmove',  this._onTouchMove, { passive: false });
        this.canvas.addEventListener('touchend',   this._onTouchEnd);
        this.canvas.addEventListener('wheel',      this._onWheel,     { passive: false });
    }

    detach() {
        this.canvas.removeEventListener('click',      this._onClick);
        this.canvas.removeEventListener('touchstart', this._onTouch);
        this.canvas.removeEventListener('touchmove',  this._onTouchMove);
        this.canvas.removeEventListener('touchend',   this._onTouchEnd);
        this.canvas.removeEventListener('wheel',      this._onWheel);
    }

    _inPot(lx, ly) {
        const pw = 130, ph = 38;
        const px = TRUNK_X - pw / 2;
        const py = TRUNK_Y + 4;
        return lx >= px && lx <= px + pw && ly >= py && ly <= py + ph;
    }

    _onClick(e) {
        const { x, y } = this.renderer.toLogical(e.clientX, e.clientY);
        if (this._inPot(x, y)) { this.onReset(); return; }
        if (this.tree.prune(x, y)) this.onPrune();
    }

    _onTouch(e) {
        e.preventDefault();
        if (e.touches.length === 2) {
            const t0 = e.touches[0], t1 = e.touches[1];
            this._pinch = { dist: Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY) };
            return;
        }
        if (this._pinch) return;
        const t = e.touches[0];
        const { x, y } = this.renderer.toLogical(t.clientX, t.clientY);
        if (this._inPot(x, y)) { this.onReset(); return; }
        if (this.tree.prune(x, y)) this.onPrune();
    }

    _onTouchMove(e) {
        e.preventDefault();
        if (e.touches.length !== 2 || !this._pinch) return;
        const t0 = e.touches[0], t1 = e.touches[1];
        const newDist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
        const rect = this.canvas.getBoundingClientRect();
        const dpr  = window.devicePixelRatio || 1;
        const mx   = ((t0.clientX + t1.clientX) / 2 - rect.left) * dpr;
        const my   = ((t0.clientY + t1.clientY) / 2 - rect.top)  * dpr;
        this.renderer.applyZoom(mx, my, newDist / this._pinch.dist);
        this._pinch.dist = newDist;
    }

    _onTouchEnd(e) {
        if (e.touches.length < 2) this._pinch = null;
    }

    _onWheel(e) {
        e.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        const dpr  = window.devicePixelRatio || 1;
        const cx   = (e.clientX - rect.left) * dpr;
        const cy   = (e.clientY - rect.top)  * dpr;
        this.renderer.applyZoom(cx, cy, e.deltaY < 0 ? 1.1 : 1 / 1.1);
    }
}

// ─── Program ─────────────────────────────────────────────────────────────────

class BonsaiProgram {
    constructor(screenEl, args = {}) {
        this._args     = args;
        this._tree     = new BonsaiTree();
        this._renderer = new BonsaiRenderer(screenEl);
        this._input    = new BonsaiInput(
            this._renderer.canvas,
            this._tree,
            this._renderer,
            () => this._tree.save(),
            () => this._resetTree()
        );
        this._rafId       = null;
        this._lastTime    = 0;
        this._stepAccum   = 0;
        this._saveTimer   = 0;
        this.run          = this.run.bind(this);
        this.onResize     = this.onResize.bind(this);
    }

    _resetTree() {
        localStorage.removeItem(STORAGE_KEY);
        this._tree.load();
        this._stepAccum = 0;
        this._saveTimer = 0;
    }

    init() {
        const reset = this._args?.named?.r || this._args?.positional?.includes('r');
        if (reset) localStorage.removeItem(STORAGE_KEY);
        this._tree.load();
        this._renderer.resize();
        this._input.attach();
        window.addEventListener('resize', this.onResize);
        this._lastTime = performance.now();
        this._rafId = requestAnimationFrame(this.run);
        this._showIntro();
    }

    _showIntro() {
        const el = this._renderer.screenEl;
        el.style.position = 'relative';
        const overlay = document.createElement('div');
        overlay.style.cssText = [
            'position:absolute', 'top:0', 'left:0', 'right:0',
            'padding:14px 18px', 'background:rgba(0,0,0,0.82)',
            'font-family:monospace', 'font-size:0.8rem', 'line-height:1.7',
            'color:#888', 'z-index:10', 'border-bottom:1px solid #222',
        ].join(';');
        overlay.innerHTML =
            '<div>Your tree grows even while you\'re away.</div>' +
            '<div>Click or tap any branch to prune it.</div>' +
            '<div>Click or tap the pot to start over.</div>' +
            '<div style="margin-top:10px;">' +
            '<button style="background:none;border:1px solid #50c0f0;color:#50c0f0;' +
            'padding:3px 14px;font-family:monospace;cursor:pointer;font-size:0.8rem;">ok</button>' +
            '</div>';
        overlay.querySelector('button').addEventListener('click', () => overlay.remove());
        el.appendChild(overlay);
        this._introOverlay = overlay;
    }

    run(timestamp) {
        const dt = timestamp - this._lastTime;
        this._lastTime = timestamp;

        const speed = this._tree.state.simStep < GROWTH.WARMUP_STEPS
            ? GROWTH.STEPS_PER_MS_WARMUP
            : GROWTH.STEPS_PER_MS_SLOW;
        this._stepAccum += dt * speed;
        while (this._stepAccum >= 1) {
            this._tree.step();
            this._stepAccum--;
        }

        this._renderer.render(this._tree);

        // Persist state every 30 s so offline fast-forward stays accurate
        this._saveTimer += dt;
        if (this._saveTimer >= 30_000) {
            this._tree.save();
            this._saveTimer = 0;
        }

        this._rafId = requestAnimationFrame(this.run);
    }

    onResize() { this._renderer.resize(); }

    unload() {
        cancelAnimationFrame(this._rafId);
        this._input.detach();
        window.removeEventListener('resize', this.onResize);
        this._tree.save();
        this._renderer.remove();
        if (this._introOverlay) this._introOverlay.remove();
    }
}

// ─── Export ───────────────────────────────────────────────────────────────────

const Bonsai = {
    instance: null,

    init(screenEl, args) {
        this.instance = new BonsaiProgram(screenEl, args);
        this.instance.init();
    },

    unload() {
        if (this.instance) {
            this.instance.unload();
            this.instance = null;
        }
    },

    onResize() {
        if (this.instance) this.instance.onResize();
    },
};

export default Bonsai;
