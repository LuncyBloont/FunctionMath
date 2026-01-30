import { Evaluator } from './parser/evaluator.js?v=9';

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
        this.polarStep = 0.00314159;
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
                this.draw();
            }
        });

        this.canvas.addEventListener('mouseup', () => this.isDragging = false);
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
        }
    }

    drawPlots() {
        const ctx = this.ctx;
        const width = this.canvas.width;
        const height = this.canvas.height;
        
        ctx.lineWidth = 2;
        const pixelStep = 2; // Resolution step for Cartesian sampling (pixels)

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

            for (let angle = aMin; angle <= aMax; angle += angleStep) {
                try {
                    this.evaluator.evaluate(this.ast, { t: angle, x: angle });
                    const currentVars = new Map();
                    for (const [name, val] of this.evaluator.vm.globals) {
                        if (typeof val === 'number' && isFinite(val)) {
                            currentVars.set(name, val);
                            foundVariables.add(name);
                        }
                    }
                    if (currentVars.size > 0) {
                        dataPoints.push({ sx: angle, angle: angle, values: currentVars });
                    }
                } catch (e) {
                    if (!this.lastErrors) this.lastErrors = [];
                    if (this.lastErrors.length < 10) this.lastErrors.push({ x: angle, message: e.message || String(e) });
                }
            }
        } else {
            // Cartesian: sample by screen X
            for (let screenX = 0; screenX <= width; screenX += pixelStep) {
                const worldX = this.toWorldX(screenX);
                try {
                    this.evaluator.evaluate(this.ast, { x: worldX });
                    // Debug random sample
                    if (screenX === Math.floor(width/2)) {
                        console.log(`[Plotter] Sample x=${worldX} Globals:`, Array.from(this.evaluator.vm.globals.keys()));
                    }

                    const currentVars = new Map();
                    for (const [name, val] of this.evaluator.vm.globals) {
                        if (typeof val === 'number' && isFinite(val)) {
                            currentVars.set(name, val);
                            foundVariables.add(name);
                        }
                    }

                    if (currentVars.size > 0) {
                        dataPoints.push({ sx: screenX, angle: worldX, values: currentVars });
                    }
                } catch (e) {
                    if (!this.lastErrors) this.lastErrors = [];
                    if (this.lastErrors.length < 10) this.lastErrors.push({ x: worldX, message: e.message || String(e) });
                }
            }
        }

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
             if (foundVariables.has('y')) {
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

            for (const point of dataPoints) {
                const sx = point.sx;
                const angle = point.angle;
                const val = point.values.get(varName);

                // Check continuity
                // If this point doesn't have the value, skip (gap in graph)
                if (val === undefined || isNaN(val) || !isFinite(val)) {
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
                    firstPoint = true;
                    continue;
                }

                if (firstPoint) {
                    ctx.moveTo(drawX, drawY);
                    firstPoint = false;
                } else {
                    ctx.lineTo(drawX, drawY);
                }
            }
            ctx.stroke();
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
            // In polar mode draw main radial axis (angle=0) and a small origin marker
            const maxRadius = Math.max(this.canvas.width, this.canvas.height);
            const x2 = originX + maxRadius;
            const y2 = originY;
            ctx.moveTo(originX, originY);
            ctx.lineTo(x2, y2);
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
