import { Evaluator } from './parser/evaluator.js?v=17';

export class Plotter {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        
        // World rendering state
        this.offsetX = 0;
        this.offsetY = 0;
        this.scaleX = 40; // Pixels per unit
        this.scaleY = 40;

        // Math Engine
        this.evaluator = new Evaluator();
        this.ast = null;
        this.lastErrors = []; // collect evaluator/runtime errors for display
        this.polarMode = false; // When true, treat variable `t` (and `x`) as angle in radians and plot r->(x,y)
        // Polar sampling defaults
        this.polarMin = -31.4159;
        this.polarMax = 31.4159;
        this.polarStep = 0.01;
        // Continuity / threshold settings
        this.continuityEps = 1e-8; // protect against tiny denominator
        this.continuityThresholdCartesian = 100.0; // default |Δy/Δx| threshold
        this.continuityThresholdPolar = 100.0; // default |Δr/Δt| threshold
        
        this.resize();
        window.addEventListener('resize', () => this.resize());
        
        // Input handling state
        this.isDragging = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;
        
        // Hover state for showing values at mouse
        this.hover = { screenX: null, screenY: null, active: false };
        // Map of currently visible variables and their draw config (populated each draw)
        this.visiblePlotInfo = new Map();

        this._initEvents();
    }

    setPolarMode(enabled) {
        this.polarMode = !!enabled;
        this.draw();
    }

    setPolarParams(min, max, step) {
        if (typeof min === 'number' && typeof max === 'number' && typeof step === 'number' && step > 0) {
            this.polarMin = min;
            this.polarMax = max;
            this.polarStep = step;
        }
    }
    
    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.draw();
    }
    
    _initEvents() {
        // Pan and Zoom event listeners
        this.canvas.addEventListener('mousedown', e => {
            this.isDragging = true;
            this.lastMouseX = e.clientX;
            this.lastMouseY = e.clientY;
        });

        this.canvas.addEventListener('mousemove', e => {
            if (this.isDragging) {
                const dx = e.clientX - this.lastMouseX;
                const dy = e.clientY - this.lastMouseY;
                this.offsetX += dx;
                this.offsetY += dy;
                this.lastMouseX = e.clientX;
                this.lastMouseY = e.clientY;
                this.hover.active = false;
                this.draw();
            } else {
                // Update hover position and request redraw to show values
                this.hover.screenX = e.clientX;
                this.hover.screenY = e.clientY;
                this.hover.active = true;
                this.draw();
            }
        });

        this.canvas.addEventListener('mouseup', () => this.isDragging = false);
        this.canvas.addEventListener('mouseleave', () => { this.hover.active = false; this.draw(); });
        this.canvas.addEventListener('wheel', e => this.handleZoom(e));
    }

    handleZoom(e) {
        e.preventDefault();
        const zoomIntensity = 0.1;
        const wheel = e.deltaY < 0 ? 1 : -1;
        const zoom = Math.exp(wheel * zoomIntensity);
        
        // Calculate world coordinates of the mouse before zoom
        const mouseWorldX = this.toWorldX(e.clientX);
        const mouseWorldY = this.toWorldY(e.clientY);
        
        // Apply zoom
        this.scaleX *= zoom;
        this.scaleY *= zoom;
        
        // Adjust offset to keep mouse world position constant under the mouse cursor
        // newScreenX = (mouseWorldX * newScaleX) + centerX + newOffsetX
        // e.clientX = (mouseWorldX * this.scaleX) + (width/2) + this.offsetX
        // Solve for newOffsetX:
        // this.offsetX = e.clientX - (width/2) - (mouseWorldX * this.scaleX)
        
        const { width, height } = this.canvas;
        this.offsetX = e.clientX - (width / 2) - (mouseWorldX * this.scaleX);
        this.offsetY = e.clientY - (height / 2) + (mouseWorldY * this.scaleY); // Note signs
        
        this.draw();
    }

    // Coordinate Transformations
    toScreenX(worldX) {
        return (worldX * this.scaleX) + (this.canvas.width / 2) + this.offsetX;
    }

    toScreenY(worldY) {
        return (this.canvas.height / 2) - (worldY * this.scaleY) + this.offsetY;
    }

    toWorldX(screenX) {
        return (screenX - (this.canvas.width / 2) - this.offsetX) / this.scaleX;
    }

    toWorldY(screenY) {
        return ((this.canvas.height / 2) - screenY + this.offsetY) / this.scaleY;
    }

    setFunction(ast) {
        this.ast = ast;
        this.plotConfig = new Map();
        
        console.log(">>> [Plotter] setFunction V15 called");
        console.log(">>> [Plotter] typeof ast:", typeof ast);
        if (ast) {
            console.log(">>> [Plotter] ast.type:", ast.type);
            if (ast.body && Array.isArray(ast.body)) console.log(">>> [Plotter] ast.body.length:", ast.body.length);
            console.log(">>> [Plotter] Array.isArray(ast.body):", Array.isArray(ast.body));
        }
        console.log(">>> [Plotter] setFunction AST: ", ast);

        if (ast) {
            try {
                this.evaluator.reset();
                this.evaluator.compile(ast);
                console.warn(">>> [Plotter] Starting _analyzeAST...");
                this._analyzeAST(ast); // This fills plotConfig
                console.warn(`>>> [Plotter] Finished _analyzeAST. Config size: ${this.plotConfig.size}`);
            } catch(e) {
                console.error("Compilation error in plotter", e);
                this.ast = null; 
            }
        }
        this.draw();
    }

    _analyzeAST(node) {
        if (!node) {
            console.log(">>> [Plotter] _analyzeAST called with null node");
            return;
        }
        console.log(`>>> [Plotter] _analyzeAST node:`, node);

        // Helper to process markers
        const processMarkers = (name, markers) => {
            console.log(`[Plotter] Processing markers for ${name}:`, markers);
            if (!markers || markers.length === 0) return;

            // Check for draw marker (@) or color marker (#)
            let shouldDraw = false;
            let color = '#ffffff'; // Default white
            let isGuide = false;

            for (const m of markers) {
                if (m === '@') shouldDraw = true;
                if (typeof m === 'string' && m.startsWith('#')) {
                    shouldDraw = true; // Implicitly draw if color specified
                    color = m;
                }
                if (m === '$') {
                    shouldDraw = true;
                    isGuide = true;
                }
            }

            if (shouldDraw) {
                this.plotConfig.set(name, { color, isGuide });
                console.log(`[Plotter] Added to config: ${name}`, this.plotConfig.get(name));
            }
        };

        if (node.type === 'Program' || node.type === 'Block') {
            console.log(">>> [Plotter] Entered Program/Block branch");
            if (node.body && Array.isArray(node.body)) {
                for (const child of node.body) this._analyzeAST(child);
            } else {
                console.log(">>> [Plotter] Program/Block node.body is not array", node.body);
            }
        } else if (node.type === 'ExpressionStatement') {
            console.log(">>> [Plotter] Recursing into ExpressionStatement", node);
            this._analyzeAST(node.expression);
        } else if (node.type === 'Assignment') {
            console.log(`>>> [Plotter] Inspecting Assignment: ${node.name}, markers:`, node.markers);
            processMarkers(node.name, node.markers);
        } else if (node.type === 'IfStatement') {
            console.log(">>> [Plotter] Entered IfStatement branch");
            this._analyzeAST(node.thenBranch);
            if (node.elseBranch) this._analyzeAST(node.elseBranch);
        } else if (node.type === 'ForStatement') {
            console.log(">>> [Plotter] Entered ForStatement branch");
            this._analyzeAST(node.body);
        } else {
            console.log(">>> [Plotter] _analyzeAST unknown node type:", node.type, node);
        }
    }

    draw() {
        const { width, height } = this.canvas;
        this.ctx.clearRect(0, 0, width, height);
        
        this.drawGrid();
        this.drawAxes();
        
        if (this.ast) {
            this.drawPlots();
            this._drawHover();
        }
    }

    _drawHover() {
        if (!this.hover || !this.hover.active || !this.ast) return;
        const ctx = this.ctx;
        const screenX = this.hover.screenX;
        const screenY = this.hover.screenY;
        const worldX = this.toWorldX(screenX);

        // Draw guide: vertical dashed line for Cartesian, radial ray for polar
        ctx.save();
        ctx.beginPath();
        ctx.setLineDash([6, 6]);
        ctx.strokeStyle = '#888';
        ctx.lineWidth = 1;
        if (this.polarMode) {
            // Ray from origin to mouse position
            const originX = this.toScreenX(0);
            const originY = this.toScreenY(0);
            ctx.moveTo(originX, originY);
            ctx.lineTo(screenX, screenY);
            ctx.stroke();

            // In polar mode, draw highlighted markers at every 2π multiple within view
            if (this.polarMode) {
                try {
                    const pMin = Math.min(this.polarMin, this.polarMax);
                    const pMax = Math.max(this.polarMin, this.polarMax);
                    const twoPi = 2 * Math.PI;
                    let kMin = Math.ceil(pMin / twoPi);
                    let kMax = Math.floor(pMax / twoPi);
                    // Cap to avoid too many markers
                    const maxMarkers = 200;
                    if (kMax - kMin + 1 > maxMarkers) {
                        const centerK = Math.round((this._hoverAngle || 0) / twoPi);
                        kMin = centerK - Math.floor(maxMarkers / 2);
                        kMax = kMin + maxMarkers - 1;
                    }

                    // Use mouse angle as base and draw markers at t = t0 + k*2π
                    const t0 = (typeof this._hoverAngle === 'number') ? this._hoverAngle : Math.atan2(this.toWorldY(screenY), this.toWorldX(screenX));
                    // Compute k range so that t0 + k*twoPi falls within [pMin, pMax]
                    let kMinAdj = Math.ceil((pMin - t0) / twoPi);
                    let kMaxAdj = Math.floor((pMax - t0) / twoPi);
                    // Cap to avoid too many markers (reuse outer maxMarkers)
                    if (kMaxAdj - kMinAdj + 1 > maxMarkers) {
                        const centerK = Math.round((t0) / twoPi);
                        kMinAdj = centerK - Math.floor(maxMarkers / 2);
                        kMaxAdj = kMinAdj + maxMarkers - 1;
                    }

                    for (let k = kMinAdj; k <= kMaxAdj; k++) {
                        const tK = t0 + k * twoPi;
                        try {
                            // evaluate with both t and x set to angle (consistent with sampling)
                            this.evaluator.evaluate(this.ast, { t: tK, x: tK });
                        } catch (e) {
                            // ignore evaluation errors for individual markers
                            continue;
                        }
                        // For each visible variable, draw marker if value is finite
                        for (const [varName, config] of this.visiblePlotInfo) {
                            const v = this.evaluator.vm.globals.get(varName);
                            if (typeof v === 'number' && isFinite(v)) {
                                const worldPX = v * Math.cos(tK);
                                const worldPY = v * Math.sin(tK);
                                const sx = this.toScreenX(worldPX);
                                const sy = this.toScreenY(worldPY);
                                // draw filled highlight with stroke
                                ctx.beginPath();
                                ctx.fillStyle = (config && config.color) || '#fff';
                                ctx.arc(sx, sy, 5, 0, Math.PI * 2);
                                ctx.fill();
                                ctx.lineWidth = 1;
                                ctx.strokeStyle = '#00000066';
                                ctx.stroke();
                            }
                        }
                    }
                } catch (e) {
                    // protect drawing from unexpected errors
                    console.error('Error drawing 2π markers', e);
                }
            }
            ctx.setLineDash([]);
            // Compute angle t relative to center (radians) using world coordinates
            const worldAtCursorX = this.toWorldX(screenX);
            const worldAtCursorY = this.toWorldY(screenY);
            const angle = Math.atan2(worldAtCursorY, worldAtCursorX);
            // store for use below
            this._hoverAngle = angle;
        } else {
            ctx.moveTo(screenX, 0);
            ctx.lineTo(screenX, this.canvas.height);
            ctx.stroke();
            ctx.setLineDash([]);
            this._hoverAngle = null;
        }

        // Build tooltip content: first show x or t, then values.
        const tooltipItems = [];
        if (this.polarMode) {
            const tCur = (typeof this._hoverAngle === 'number') ? this._hoverAngle : Math.atan2(this.toWorldY(screenY), this.toWorldX(screenX));
            tooltipItems.push({ kind: 'header', text: `t: ${tCur.toPrecision(6)} (rad)` });

            // Show values at t = t0 + k*2π within polarMin..polarMax (base at mouse angle)
            const pMin = Math.min(this.polarMin, this.polarMax);
            const pMax = Math.max(this.polarMin, this.polarMax);
            const twoPi = 2 * Math.PI;
            const t0 = (typeof this._hoverAngle === 'number') ? this._hoverAngle : Math.atan2(this.toWorldY(screenY), this.toWorldX(screenX));
            let kMinAdj = Math.ceil((pMin - t0) / twoPi);
            let kMaxAdj = Math.floor((pMax - t0) / twoPi);
            // Cap count to avoid huge tooltips
            const maxCount = 50;
            if (kMaxAdj - kMinAdj + 1 > maxCount) {
                const centerK = Math.round(t0 / twoPi);
                kMinAdj = centerK - Math.floor(maxCount/2);
                kMaxAdj = kMinAdj + maxCount - 1;
            }

            for (let k = kMinAdj; k <= kMaxAdj; k++) {
                const tK = t0 + k * twoPi;
                try {
                    this.evaluator.evaluate(this.ast, { t: tK, x: tK });
                } catch (e) {
                    // ignore
                }
                // Debug: print globals for this tK to help diagnose incorrect values
                try {
                    if (console && console.debug) {
                        const entries = Array.from(this.evaluator.vm.globals.entries()).slice(0,50);
                        console.debug(`[Plotter] hover polar tK=${tK.toPrecision(6)} globals:`, entries);
                    }
                } catch (e) {}
                // Build values line for this tK across visible variables
                const parts = [];
                for (const [name, cfg] of this.visiblePlotInfo) {
                    const val = this.evaluator.vm.globals.get(name);
                    const s = (typeof val === 'number' && isFinite(val)) ? val.toPrecision(6) : '—';
                    parts.push(`${name}: ${s}`);
                }
                tooltipItems.push({ kind: 'line', text: `t=${(tK/Math.PI).toFixed(2)}π (${tK.toPrecision(6)}): ${parts.join(', ')}` });
            }
        } else {
            // Cartesian: show x then single evaluation at worldX
            tooltipItems.push({ kind: 'header', text: `x: ${worldX.toPrecision(6)}` });
            try {
                this.evaluator.evaluate(this.ast, { x: worldX });
            } catch (e) {}
            const parts = [];
            for (const [name, cfg] of this.visiblePlotInfo) {
                const val = this.evaluator.vm.globals.get(name);
                const s = (typeof val === 'number' && isFinite(val)) ? val.toPrecision(6) : '—';
                parts.push({ name, text: `${name}: ${s}`, color: cfg.color });
            }
            // If no visible variables, bail
            if (this.visiblePlotInfo.size === 0) { ctx.restore(); return; }
            tooltipItems.push({ kind: 'vars', items: parts });
        }

        // Draw small marker for each visible variable at the hover position
        ctx.lineWidth = 1;
        let originX = null, originY = null, hoverAngle = this._hoverAngle;
        if (this.polarMode) {
            originX = this.toScreenX(0);
            originY = this.toScreenY(0);
            if (typeof hoverAngle !== 'number') {
                const worldAtCursorX = this.toWorldX(screenX);
                const worldAtCursorY = this.toWorldY(screenY);
                hoverAngle = Math.atan2(worldAtCursorY, worldAtCursorX);
            }
        }
        // Evaluate current hover values (single t or x) for markers
        const hoverValues = [];
        if (this.polarMode) {
            const tCur = (typeof this._hoverAngle === 'number') ? this._hoverAngle : Math.atan2(this.toWorldY(screenY), this.toWorldX(screenX));
            try { this.evaluator.evaluate(this.ast, { t: tCur, x: tCur }); } catch (e) {}
            for (const [name, cfg] of this.visiblePlotInfo) {
                const val = this.evaluator.vm.globals.get(name);
                hoverValues.push({ name, val, color: cfg.color });
            }
        } else {
            try { this.evaluator.evaluate(this.ast, { x: worldX }); } catch (e) {}
            for (const [name, cfg] of this.visiblePlotInfo) {
                const val = this.evaluator.vm.globals.get(name);
                hoverValues.push({ name, val, color: cfg.color });
            }
        }

        for (const item of hoverValues) {
            ctx.fillStyle = item.color || '#fff';
            if (this.polarMode && typeof item.val === 'number') {
                const r = item.val;
                const worldPX = r * Math.cos(hoverAngle);
                const worldPY = r * Math.sin(hoverAngle);
                const sx = this.toScreenX(worldPX);
                const sy = this.toScreenY(worldPY);
                ctx.beginPath();
                ctx.arc(sx, sy, 4, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#00000033';
                ctx.stroke();
            } else if (!this.polarMode && typeof item.val === 'number') {
                const sy = this.toScreenY(item.val);
                ctx.beginPath();
                ctx.arc(screenX, sy, 4, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#00000033';
                ctx.stroke();
            }
        }

        // Tooltip box near mouse based on tooltipItems
        const padding = 6;
        ctx.font = '12px sans-serif';
        let maxW = 0;
        let lineCount = 0;
        for (const it of tooltipItems) {
            if (it.kind === 'header' || it.kind === 'line') {
                const w = ctx.measureText(it.text).width;
                if (w > maxW) maxW = w;
                lineCount += 1;
            } else if (it.kind === 'vars') {
                for (const v of it.items) {
                    const w = ctx.measureText(v.text).width + 24; // include swatch
                    if (w > maxW) maxW = w;
                    lineCount += 1;
                }
            }
        }

        if (lineCount === 0) { ctx.restore(); return; }

        const boxW = Math.min(this.canvas.width - 16, maxW + padding * 2);
        const boxH = lineCount * 16 + padding * 2;

        // Prefer drawing box to the right of cursor if space permits
        let boxX = screenX + 12;
        if (boxX + boxW > this.canvas.width) boxX = screenX - 12 - boxW;
        let boxY = Math.max(8, screenY - boxH / 2);
        if (boxY + boxH > this.canvas.height - 8) boxY = this.canvas.height - 8 - boxH;

        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(boxX, boxY, boxW, boxH);

        // Draw each tooltip item
        let y = boxY + padding + 12;
        for (const it of tooltipItems) {
            if (it.kind === 'header') {
                ctx.fillStyle = '#fff';
                ctx.fillText(it.text, boxX + 8, y - 1);
                y += 16;
            } else if (it.kind === 'line') {
                ctx.fillStyle = '#ccc';
                ctx.fillText(it.text, boxX + 8, y - 1);
                y += 16;
            } else if (it.kind === 'vars') {
                for (const v of it.items) {
                    // color swatch
                    ctx.fillStyle = v.color || '#fff';
                    ctx.fillRect(boxX + 4, y - 10, 10, 10);
                    ctx.fillStyle = '#fff';
                    ctx.fillText(v.text, boxX + 20, y - 1);
                    y += 16;
                }
            }
        }

        ctx.restore();
    }

    drawPlots() {
        const ctx = this.ctx;
        const width = this.canvas.width;
        const height = this.canvas.height;
        
        ctx.lineWidth = 2;
        const pixelStep = 1;

        // Compute average scale and maximum visible radius (world units)
        const avgScale = (this.scaleX + this.scaleY) / 2;
        const cornersForR = [
            { x: this.toWorldX(0), y: this.toWorldY(0) },
            { x: this.toWorldX(width), y: this.toWorldY(0) },
            { x: this.toWorldX(0), y: this.toWorldY(height) },
            { x: this.toWorldX(width), y: this.toWorldY(height) }
        ];
        let maxR = 0;
        for (const c of cornersForR) {
            const r = Math.hypot(c.x, c.y);
            if (r > maxR) maxR = r;
        }

        // 1. Calculate all points first
        // We store them as: [ { sx: number, values: Map<string, number> }, ... ]
        const dataPoints = [];
        const foundVariables = new Set(); // Track all 'y' variables encountered
        const markers = { mark_x: new Set(), mark_y: new Set() };
        let markerLimitReported = false;
        this.evaluator.vm.markerHandler = (name, value) => {
            if (markers[name].has(value)) return;
            if (markers[name].size >= 100) {
                if (!markerLimitReported && this.lastErrors.length < 10) {
                    this.lastErrors.push({ x: value, message: 'At most 100 distinct values per marker function can be displayed.' });
                    markerLimitReported = true;
                }
                return;
            }
            markers[name].add(value);
        };
        const sample = (parameter, sx) => {
            const values = new Map();
            try {
                const context = this.polarMode ? { t: parameter, x: parameter } : { x: parameter };
                this.evaluator.evaluate(this.ast, context);
                for (const [name, val] of this.evaluator.vm.globals) {
                    if (typeof val === 'number' && Number.isFinite(val)) {
                        values.set(name, val);
                        foundVariables.add(name);
                    }
                }
            } catch (e) {
                if (this.lastErrors.length < 10) this.lastErrors.push({ x: parameter, message: e.message || String(e) });
            }
            return { sx, angle: parameter, values };
        };

        if (this.polarMode) {
            // Angle-uniform sampling (polar mode)
            const aMin = this.polarMin;
            const aMax = this.polarMax;
            // Adaptive angle step based on view scale and visible radius so sampling density
            // maps to roughly `desiredPixels` on screen. We respect user `polarStep` as
            // the minimum (i.e. we will not sample more finely than the user requested),
            // but we may coarsen (use a larger step) when zoomed out to reduce work.
            const desiredPixels = 3;
            let computed = desiredPixels / (Math.max(1e-6, maxR) * Math.max(1e-6, avgScale));
            let angleStep = this.polarStep;
            if (isFinite(computed) && computed > 0) {
                // computed is the angular step that would give ~desiredPixels at radius=maxR
                // Use the larger of computed and user-specified polarStep so we never sample
                // finer than `polarStep`.
                angleStep = Math.max(this.polarStep, computed);
            }
            // Cap number of samples to avoid freezes
            const maxSamples = 200000;
            const approxSamples = Math.ceil(Math.abs(aMax - aMin) / angleStep) || 1;
            if (approxSamples > maxSamples) angleStep = Math.abs(aMax - aMin) / maxSamples;

            for (let angle = aMin; angle < aMax; angle += angleStep) {
                dataPoints.push(sample(angle, angle));
            }
            if (aMax >= aMin) dataPoints.push(sample(aMax, aMax));
        } else {
            const names = this.plotConfig.size ? [...this.plotConfig.keys()] : ['y'];
            const visible = (point, name) => {
                const value = point.values.get(name);
                const y = this.toScreenY(value);
                return Number.isFinite(value) && y >= 0 && y <= height;
            };
            let previous = sample(this.toWorldX(0), 0);
            dataPoints.push(previous);
            for (let screenX = pixelStep; screenX <= width; screenX += pixelStep) {
                const next = sample(this.toWorldX(screenX), screenX);
                if (names.some(name => !visible(previous, name) || !visible(next, name))) {
                    const refined = [previous, next];
                    if (names.some(name => !visible(previous, name) && !visible(next, name))) {
                        for (let i = 1; i <= 8; i++) {
                            const sx = screenX - pixelStep + pixelStep * i / 9;
                            refined.push(sample(this.toWorldX(sx), sx));
                        }
                    } else {
                        for (let i = 0; i < 8; i++) {
                            let index = -1;
                            let largest = 0;
                            for (let j = 0; j + 1 < refined.length; j++) {
                                const left = refined[j], right = refined[j + 1];
                                if (right.sx - left.sx > largest &&
                                    names.some(name => visible(left, name) !== visible(right, name))) {
                                    largest = right.sx - left.sx;
                                    index = j;
                                }
                            }
                            if (index < 0) break;
                            const sx = (refined[index].sx + refined[index + 1].sx) / 2;
                            refined.splice(index + 1, 0, sample(this.toWorldX(sx), sx));
                        }
                    }
                    refined.sort((a, b) => a.sx - b.sx);
                    dataPoints.push(...refined.slice(1, -1));
                }
                dataPoints.push(next);
                previous = next;
            }
        }
        this.evaluator.vm.markerHandler = null;

        // 2. Draw each variable as a separate path
        // Use plotConfig if available, otherwise fallback to "y*" variables with default colors?
        // User requested strict @/Color usage.
        
        let targetVariables = new Map();
        
        if (this.plotConfig && this.plotConfig.size > 0) {
            console.log("[Plotter] Strict Mode. Config:", Array.from(this.plotConfig.keys()));
            
            // Explicit Strict Mode: If config has entries, ONLY draw what is in config.
            for (const [name, config] of this.plotConfig) {
                 targetVariables.set(name, config);
            }
        } else {
             console.log("[Plotter] Fallback Mode. Found vars:", Array.from(foundVariables));
            // Fallback: If no markers found AT ALL in the script, maybe plot 'y'?
            // But user said "@ functionality not effective", so strict mode is better.
            // BUT: What if user just types "y=x"? They get nothing?
            // Let's support legacy behavior ONLY IF plotConfig is empty.
            // "If no # color, use white".
            
            // To properly fix "only first line", we must rely on explicit drawing or better heuristics.
            // Let's strictly follow the user request: "Why need @?" -> Implies @ IS needed.
            // So if plotConfig is empty, we might draw nothing, or just 'y'.
            // Let's be helpful: If plotConfig is empty, draw 'y' in white.
            if (foundVariables.has('y')) {
                // targetVariables.set('y', { color: '#ffffff', isGuide: false });
            }
            
            // Wait, if I type "y=x \n y2=x", and no markers, probably expectation is to see them?
            // But strictly, let's respect markers if any exist.
            // Actually, let's just stick to "Plot what is in plotConfig".
            // If user typed "y = x", markers is empty. plotConfig empty.
            // Just for usability, I will add 'y' if nothing else is marked.
             if (foundVariables.has('y') || markers.mark_x.size > 0) {
                 targetVariables.set('y', { color: '#ffffff', isGuide: false });
             }
        }

        // --- NEW START: Explicit Strict Mode Check ---
        // If plotConfig was NOT empty (meaning user used markers), 
        // but for some reason targetVariables ended up empty (e.g. user marked a variable that wasn't computed),
        // we should NOT fallback to drawing 'y'.
        // The previous block only handles "if (this.plotConfig.size > 0) OR (fallback)".
        // It is actually correct as written above, because the fallback is inside the `else`.
        // So:
        // Case 1: Markers exist -> `if` block runs -> targetVariables populated ONLY from markers.
        // Case 2: No markers -> `else` block runs -> targetVariables populated with 'y'.
        // So strict mode logic is already sound.
        // --- NEW END ---

        // expose visible variables for hover rendering
        this.visiblePlotInfo = new Map(targetVariables);

        for (const [varName, config] of targetVariables) {
            ctx.beginPath();
            
            ctx.strokeStyle = config.color;
            if (config.isGuide) {
                ctx.setLineDash([5, 5]);
            } else {
                ctx.setLineDash([]);
            }

            let firstPoint = true;
            console.log(`[Plotter] Drawing ${varName} with color ${config.color}`);
            let lastSx = -100;
            let lastDrawX = -100;
            let lastDrawY = -100;
            let lastWorldX = NaN;
            let lastWorldY = NaN;
            let lastR = NaN;
            let lastAngle = NaN;
            const isolatedPoints = [];
            let pendingPoint = null;

            for (const point of dataPoints) {
                const sx = point.sx;
                const angle = point.angle;
                const val = point.values.get(varName);

                // Check continuity
                // If this point doesn't have the value, skip (gap in graph)
                if (val === undefined || isNaN(val) || !isFinite(val)) {
                    if (pendingPoint) isolatedPoints.push(pendingPoint);
                    pendingPoint = null;
                    firstPoint = true;
                    continue;
                }
                
                // Compute draw coordinates first so continuity checks can use them
                let drawX, drawY;
                if (this.polarMode) {
                    // Interpret val as r; use stored sample angle (world units)
                    const r = val;
                    const worldPX = r * Math.cos(angle);
                    const worldPY = r * Math.sin(angle);
                    drawX = this.toScreenX(worldPX);
                    drawY = this.toScreenY(worldPY);
                } else {
                    drawX = sx;
                    drawY = this.toScreenY(val);
                }

                // Also check if we skipped pixels. Use actual drawn screen X for polar mode continuity.
                if (this.polarMode) {
                    // Interpret val as r; use stored sample angle (world units)
                        const r = val;
                        const worldPX = r * Math.cos(angle);
                        const worldPY = r * Math.sin(angle);

                        // World-based quick clipping: skip samples whose radius exceed
                        // visible world radius + margin (converted from pixels)
                        const marginPixels = 50;
                        const marginWorld = marginPixels / Math.max(1e-6, avgScale);
                        if (Math.abs(r) > maxR + marginWorld) {
                            firstPoint = true;
                            lastR = r;
                            lastAngle = angle;
                            lastWorldX = worldPX;
                            lastWorldY = worldPY;
                            lastDrawX = drawX;
                            lastDrawY = drawY;
                            continue;
                        }

                        if (!firstPoint) {
                            // Use slope-based continuity: |Δr/Δt|
                            let dt = angle - lastAngle;
                            while (dt > Math.PI) dt -= 2 * Math.PI;
                            while (dt < -Math.PI) dt += 2 * Math.PI;
                            const den = Math.max(Math.abs(dt), this.continuityEps);
                            const slope = Math.abs((r - lastR) / den);
                            if (slope > this.continuityThresholdPolar) {
                                firstPoint = true;
                            }
                        }

                        lastDrawX = drawX;
                        lastDrawY = drawY;
                        lastWorldX = worldPX;
                        lastWorldY = worldPY;
                        lastR = r;
                        lastAngle = angle;
                } else {
                        const currWorldX = point.angle; // for Cartesian stored as worldX
                        const currWorldY = val;
                        if (!firstPoint) {
                            const dx = currWorldX - lastWorldX;
                            const den = Math.max(Math.abs(dx), this.continuityEps);
                            const slope = Math.abs((currWorldY - lastWorldY) / den);
                            if (slope > this.continuityThresholdCartesian) {
                                firstPoint = true;
                            }
                        }
                        lastSx = sx;
                        lastWorldX = currWorldX;
                        lastWorldY = currWorldY;
                }
                
                // Clamp / Filter huge jumps (screen-space margin preserved for edge rendering)
                // Add a small margin so points near the edge still render when partially visible
                const margin = 50;
                if (drawX < -margin || drawX > width + margin || drawY < -margin || drawY > height + margin) {
                    if (pendingPoint) isolatedPoints.push(pendingPoint);
                    pendingPoint = null;
                    firstPoint = true;
                    continue;
                }

                if (firstPoint) {
                    if (pendingPoint) isolatedPoints.push(pendingPoint);
                    ctx.moveTo(drawX, drawY);
                    pendingPoint = { x: drawX, y: drawY };
                    firstPoint = false;
                } else {
                    ctx.lineTo(drawX, drawY);
                    pendingPoint = null;
                }
            }
            if (pendingPoint) isolatedPoints.push(pendingPoint);
            ctx.stroke();
            ctx.fillStyle = config.color;
            for (const point of isolatedPoints) {
                ctx.beginPath();
                ctx.arc(point.x, point.y, 1, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        this._drawCoordinateMarkers(markers, dataPoints, targetVariables);
        // After drawing plots, draw hover overlay if active
        // (Note: draw() will call _drawHover after drawPlots)
    }

    _drawCoordinateMarkers(markers, dataPoints, targets) {
        if (!markers.mark_x.size && !markers.mark_y.size) return;
        const width = this.canvas.width;
        const height = this.canvas.height;
        const ctx = this.ctx;
        const seen = new Map();
        const readPoint = (sample, name) => {
            const value = sample.values.get(name);
            if (!Number.isFinite(value)) return null;
            const x = this.polarMode ? value * Math.cos(sample.angle) : sample.angle;
            const y = this.polarMode ? value * Math.sin(sample.angle) : value;
            return { x, y };
        };
        const evaluate = (parameter, name) => {
            try {
                this.evaluator.evaluate(this.ast, this.polarMode ? { x: parameter, t: parameter } : { x: parameter });
                return readPoint({ angle: parameter, values: this.evaluator.vm.globals }, name);
            } catch (e) {
                if (this.lastErrors.length < 10) this.lastErrors.push({ x: parameter, message: e.message || String(e) });
                return null;
            }
        };
        const drawPoint = (point, name, config) => {
            if (!point) return;
            const sx = this.toScreenX(point.x);
            const sy = this.toScreenY(point.y);
            if (!Number.isFinite(sx) || !Number.isFinite(sy) || sx < 0 || sx > width || sy < 0 || sy > height) return;
            const existing = seen.get(name) || [];
            if (existing.some(p => Math.hypot(p.x - sx, p.y - sy) < 1e-4)) return;
            existing.push({ x: sx, y: sy });
            seen.set(name, existing);

            ctx.save();
            ctx.strokeStyle = config.color;
            ctx.fillStyle = config.color;
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(sx, this.toScreenY(0));
            ctx.moveTo(sx, sy);
            ctx.lineTo(this.toScreenX(0), sy);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.beginPath();
            ctx.arc(sx, sy, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.font = '12px sans-serif';
            const format = value => Number(value.toPrecision(6)).toString();
            const text = `(${format(point.x)}, ${format(point.y)})`;
            const textWidth = ctx.measureText(text).width;
            const tx = Math.max(0, Math.min(width - textWidth, sx + 6));
            const ty = Math.max(12, Math.min(height - 2, sy - 6));
            ctx.fillText(text, tx, ty);
            ctx.restore();
        };
        const findRoots = (axis, target, name, config) => {
            const tolerance = 1e-6 / (axis === 'x' ? this.scaleX : this.scaleY);
            const points = dataPoints.map(sample => readPoint(sample, name));
            const difference = point => point ? point[axis] - target : NaN;
            const continuous = (a, b) => {
                const va = a.values.get(name), vb = b.values.get(name);
                const delta = b.angle - a.angle;
                const limit = this.polarMode ? this.continuityThresholdPolar : this.continuityThresholdCartesian;
                return Number.isFinite(va) && Number.isFinite(vb) &&
                    Math.abs((vb - va) / Math.max(Math.abs(delta), this.continuityEps)) <= limit;
            };
            for (let i = 0; i < dataPoints.length; i++) {
                const point = points[i];
                const f = difference(point);
                const prevF = i > 0 ? difference(points[i - 1]) : NaN;
                const nextF = i + 1 < points.length ? difference(points[i + 1]) : NaN;
                if (Number.isFinite(f) && Math.abs(f) <= tolerance &&
                    !(Math.abs(prevF) <= tolerance && Math.abs(nextF) <= tolerance)) {
                    drawPoint(point, name, config);
                }
                if (i === 0 || !Number.isFinite(f) || !Number.isFinite(prevF) ||
                    f * prevF >= 0 || !continuous(dataPoints[i - 1], dataPoints[i])) continue;
                let lo = dataPoints[i - 1].angle, hi = dataPoints[i].angle;
                let flo = prevF, root = null;
                for (let step = 0; step < 40; step++) {
                    const mid = (lo + hi) / 2;
                    const candidate = evaluate(mid, name);
                    const fm = difference(candidate);
                    if (!Number.isFinite(fm)) break;
                    if (Math.abs(fm) <= tolerance) {
                        root = candidate;
                        break;
                    }
                    if (Math.sign(fm) === Math.sign(flo)) {
                        lo = mid;
                        flo = fm;
                    } else {
                        hi = mid;
                    }
                }
                drawPoint(root, name, config);
            }
            // A tangential intersection does not change sign; minimize its distance to the line.
            for (let i = 1; i + 1 < dataPoints.length; i++) {
                const a = difference(points[i - 1]), b = difference(points[i]), c = difference(points[i + 1]);
                if (![a, b, c].every(Number.isFinite) || Math.abs(b) >= Math.abs(a) || Math.abs(b) >= Math.abs(c) ||
                    !continuous(dataPoints[i - 1], dataPoints[i]) || !continuous(dataPoints[i], dataPoints[i + 1])) continue;
                let lo = dataPoints[i - 1].angle, hi = dataPoints[i + 1].angle;
                for (let step = 0; step < 40; step++) {
                    const left = lo + (hi - lo) / 3, right = hi - (hi - lo) / 3;
                    const fl = Math.abs(difference(evaluate(left, name)));
                    const fr = Math.abs(difference(evaluate(right, name)));
                    if (!Number.isFinite(fl) || !Number.isFinite(fr)) break;
                    if (fl < fr) hi = right;
                    else lo = left;
                }
                const candidate = evaluate((lo + hi) / 2, name);
                if (Math.abs(difference(candidate)) <= tolerance) drawPoint(candidate, name, config);
            }
        };
        for (const [name, config] of targets) {
            if (config.isGuide) continue;
            for (const x of markers.mark_x) {
                if (this.polarMode) findRoots('x', x, name, config);
                else if (this.toScreenX(x) >= 0 && this.toScreenX(x) <= width) drawPoint(evaluate(x, name), name, config);
            }
            for (const y of markers.mark_y) findRoots('y', y, name, config);
        }
    }
    
    drawGrid() {
        const ctx = this.ctx;
        const width = this.canvas.width;
        const height = this.canvas.height;
        // Polar grid if enabled
        if (this.polarMode) {
            const originX = this.toScreenX(0);
            const originY = this.toScreenY(0);
            const avgScale = (this.scaleX + this.scaleY) / 2;

            // Determine step in world units similar to Cartesian grid but using avgScale
            const targetPixels = 100;
            const unitsPerGrid = targetPixels / avgScale;
            const log = Math.log10(unitsPerGrid);
            let step = Math.pow(10, Math.floor(log));
            const rem = unitsPerGrid / step;
            if (rem > 5) step *= 5;
            else if (rem > 2) step *= 2;

            // Compute max radius in world coords by checking canvas corners
            const corners = [
                { x: this.toWorldX(0), y: this.toWorldY(0) },
                { x: this.toWorldX(width), y: this.toWorldY(0) },
                { x: this.toWorldX(0), y: this.toWorldY(height) },
                { x: this.toWorldX(width), y: this.toWorldY(height) }
            ];
            let maxR = 0;
            for (const c of corners) {
                const r = Math.hypot(c.x, c.y);
                if (r > maxR) maxR = r;
            }

            ctx.beginPath();
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 1;

            // Draw concentric circles
            for (let r = step; r <= maxR + step; r += step) {
                const screenR = r * avgScale;
                ctx.beginPath();
                ctx.arc(originX, originY, screenR, 0, Math.PI * 2);
                ctx.stroke();

                // radial label at angle 0
                ctx.fillStyle = '#666';
                ctx.font = '10px sans-serif';
                const labelX = originX + screenR + 4;
                const labelY = originY - 4;
                ctx.fillText(r.toPrecision(4).replace(/\.0+$/, "").replace(/(\.\d+)0+$/, "$1"), labelX, labelY);
            }

            // Draw radial lines (every 30 degrees)
            const angleStep = Math.PI / 6; // 30deg
            const fullR = maxR * avgScale;
            ctx.beginPath();
            ctx.strokeStyle = '#333';
            for (let a = 0; a < Math.PI * 2; a += angleStep) {
                const x2 = originX + Math.cos(a) * fullR;
                const y2 = originY + Math.sin(a) * fullR;
                ctx.moveTo(originX, originY);
                ctx.lineTo(x2, y2);

                // angle label near edge
                const lx = originX + Math.cos(a) * (fullR + 12);
                const ly = originY + Math.sin(a) * (fullR + 12);
                ctx.fillStyle = '#666';
                ctx.font = '11px sans-serif';
                let deg = Math.round((a * 180 / Math.PI) % 360);
                if (deg < 0) deg += 360;
                ctx.fillText(deg + '°', lx - 8, ly + 4);
            }
            ctx.stroke();
            return;
        }

        // --- Cartesian fallback grid (unchanged) ---
        // Determine grid spacing based on scale
        // We want grid lines approx every 50-100 pixels
        const targetPixels = 100;
        const unitsPerGrid = targetPixels / this.scaleX;
        
        // Find closest power of 10 or 2/5 * power of 10
        const log = Math.log10(unitsPerGrid);
        let step = Math.pow(10, Math.floor(log));
        const rem = unitsPerGrid / step;
        
        if (rem > 5) step *= 5;
        else if (rem > 2) step *= 2;
        
        // Calculate visible world bounds
        const startWorldX = this.toWorldX(0);
        const endWorldX = this.toWorldX(width);
        const startWorldY = this.toWorldY(height);
        const endWorldY = this.toWorldY(0);

        // Snap start to grid step
        const startGridX = Math.floor(startWorldX / step) * step;
        const startGridY = Math.floor(startWorldY / step) * step;
        
        ctx.beginPath();
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;

        // Vertical lines
        for (let x = startGridX; x <= endWorldX; x += step) {
            const screenX = this.toScreenX(x);
            ctx.moveTo(screenX, 0);
            ctx.lineTo(screenX, height);
            
            // Text label
            ctx.fillStyle = '#666';
            ctx.font = '10px sans-serif';
            if (Math.abs(x) > 1e-10) // Don't draw over axis
                ctx.fillText(x.toPrecision(4).replace(/\.0+$/, "").replace(/(\.\d+)0+$/, "$1"), screenX + 2, height - 5);
        }

        // Horizontal lines
        for (let y = startGridY; y <= endWorldY; y += step) {
            const screenY = this.toScreenY(y);
            ctx.moveTo(0, screenY);
            ctx.lineTo(width, screenY);
            
             if (Math.abs(y) > 1e-10)
                ctx.fillText(y.toPrecision(4).replace(/\.0+$/, "").replace(/(\.\d+)0+$/, "$1"), 5, screenY - 2);
        }
        
        ctx.stroke();
    }
    
    drawAxes() {
        const ctx = this.ctx;
        const width = this.canvas.width;
        const height = this.canvas.height;
        const originX = this.toScreenX(0);
        const originY = this.toScreenY(0);

        ctx.beginPath();
        ctx.strokeStyle = '#888';
        ctx.lineWidth = 2;

        if (this.polarMode) {
            if (originY >= 0 && originY <= height) {
                ctx.moveTo(0, originY);
                ctx.lineTo(width, originY);
            }
            if (originX >= 0 && originX <= width) {
                ctx.moveTo(originX, 0);
                ctx.lineTo(originX, height);
            }
            ctx.stroke();

            // Origin marker
            ctx.beginPath();
            ctx.fillStyle = '#888';
            ctx.arc(originX, originY, 3, 0, Math.PI * 2);
            ctx.fill();
            return;
        }

        // Cartesian axes
        // X Axis
        if (originY >= 0 && originY <= height) {
            ctx.moveTo(0, originY);
            ctx.lineTo(width, originY);
        }
        
        // Y Axis
        if (originX >= 0 && originX <= width) {
            ctx.moveTo(originX, 0);
            ctx.lineTo(originX, height);
        }
        
        ctx.stroke();
    }
    
}
