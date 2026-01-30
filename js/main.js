import { Plotter } from './plotter.js?v=16';
import { Lexer } from './parser/lexer.js?v=16';
import { Parser } from './parser/parser.js?v=16';
import { Evaluator } from './parser/evaluator.js?v=16';

document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('plotCanvas');
    const plotter = new Plotter(canvas);
    
    // UI Elements
    const inputPanel = document.getElementById('formulaInput');
    const plotBtn = document.getElementById('plotBtn');
    plotBtn.textContent = "Plot / Update";
    const clearBtn = document.getElementById('clearBtn');
    const rangePanel = document.getElementById('controlPanel');
    const toggleBtn = document.getElementById('togglePanelBtn');
    // SVG icons for the toggle button: minimize (bar) and restore (overlapping squares)
    const minimizeSvg = '<svg viewBox="0 0 12 12" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">'
        + '<rect x="2" y="7.2" width="8" height="1.2" rx="0.6" fill="currentColor" />'
        + '</svg>';
    const restoreSvg = '<svg viewBox="0 0 12 12" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">'
        + '<rect x="3.2" y="2.2" width="6.6" height="6.6" rx="0.8" fill="currentColor" />'
        + '<rect x="2" y="3.6" width="6.6" height="6.6" rx="0.8" fill="currentColor" opacity="0.95" />'
        + '</svg>';
    // Ensure initial icon content is the minimize icon (keeps compatibility with static HTML)
    if (toggleBtn && !toggleBtn.innerHTML.trim()) toggleBtn.innerHTML = minimizeSvg;
    const polarToggle = document.getElementById('polarToggle');
    const polarControls = document.getElementById('polarControls');
    const cartesianControls = document.getElementById('cartesianControls');
    const polarMinInput = document.getElementById('polarMin');
    const polarMaxInput = document.getElementById('polarMax');
    const polarStepInput = document.getElementById('polarStep');
    const continuityCartesianInput = document.getElementById('continuityCartesian');
    const continuityPolarInput = document.getElementById('continuityPolar');
    
    // Draggable Panel Logic
    let isPanelDragging = false;
    let panelOffsetX, panelOffsetY;
    const panelHeader = rangePanel.querySelector('.panel-header');
    
    panelHeader.addEventListener('mousedown', (e) => {
        // Don't start dragging when interacting with header controls (buttons)
        if (e.target.closest && e.target.closest('.window-controls')) return;
        isPanelDragging = true;
        panelOffsetX = e.clientX - rangePanel.offsetLeft;
        panelOffsetY = e.clientY - rangePanel.offsetTop;
    });
    
    document.addEventListener('mousemove', (e) => {
        if (isPanelDragging) {
            rangePanel.style.left = (e.clientX - panelOffsetX) + 'px';
            rangePanel.style.top = (e.clientY - panelOffsetY) + 'px';
        }
    });
    
    document.addEventListener('mouseup', () => isPanelDragging = false);

    // Toggle Panel (preserve SVG in button; use classes/aria for state)
    toggleBtn.addEventListener('click', () => {
        rangePanel.classList.toggle('minimized');
        const minimized = rangePanel.classList.contains('minimized');
        // Update button appearance and accessible info without replacing the element
        if (minimized) {
            toggleBtn.classList.add('minimized');
            toggleBtn.setAttribute('aria-pressed', 'true');
            toggleBtn.title = 'Restore panel';
            toggleBtn.innerHTML = restoreSvg;
        } else {
            toggleBtn.classList.remove('minimized');
            toggleBtn.setAttribute('aria-pressed', 'false');
            toggleBtn.title = 'Minimize panel';
            toggleBtn.innerHTML = minimizeSvg;
        }
    });


    // Clear Input
    clearBtn.addEventListener('click', () => {
        inputPanel.value = '';
        inputPanel.focus();
    });

    // Initial compile and plot
    const runPlot = () => {
        const code = inputPanel.value;
        console.log("Compiling...", code);
        // Clear parser/eval log area
        const errorLog = document.getElementById('errorLog');
        errorLog.textContent = '';

        const lexer = new Lexer(code);
        const tokens = lexer.tokenize();
        const parser = new Parser(tokens);
        const ast = parser.parse();

        if (ast.errors && ast.errors.length > 0) {
            // Display parser errors (AST syntax issues)
            errorLog.textContent = 'Parser Errors:\n' + ast.errors.join('\n');
            return;
        }

        // No parse errors — proceed to plot
        // Clear previous runtime error samples before running
        plotter.lastErrors = [];
        plotter.setFunction(ast);
        console.log("Parsed AST:", ast);

        // If runtime/evaluator errors were collected during plotting, show them
        if (plotter.lastErrors && plotter.lastErrors.length > 0) {
            const msgs = plotter.lastErrors.map(e => `x=${e.x.toPrecision(6)}: ${e.message}`);
            errorLog.textContent = 'Runtime Errors (sample):\n' + msgs.join('\n');
        } else {
            // Success — ensure error area is cleared
            errorLog.textContent = '';
        }
    };

        // Attach polar toggle after runPlot exists
        if (polarToggle) {
            polarToggle.addEventListener('change', () => {
                const enabled = polarToggle.checked;
                plotter.setPolarMode(enabled);
                // Show/hide polar-only controls
                if (polarControls) polarControls.style.display = enabled ? 'block' : 'none';
                if (cartesianControls) cartesianControls.style.display = enabled ? 'none' : 'block';
                // When enabling, apply current inputs to plotter
                if (enabled) {
                    const min = parseFloat(polarMinInput.value);
                    const max = parseFloat(polarMaxInput.value);
                    const step = parseFloat(polarStepInput.value);
                    plotter.setPolarParams(min, max, step);
                    // Apply continuity thresholds from UI
                    if (continuityCartesianInput) plotter.continuityThresholdCartesian = parseFloat(continuityCartesianInput.value);
                    if (continuityPolarInput) plotter.continuityThresholdPolar = parseFloat(continuityPolarInput.value);
                }
                runPlot();
            });
        }
    if (polarMinInput) polarMinInput.addEventListener('change', () => plotter.setPolarParams(parseFloat(polarMinInput.value), parseFloat(polarMaxInput.value), parseFloat(polarStepInput.value)));
    if (polarMaxInput) polarMaxInput.addEventListener('change', () => plotter.setPolarParams(parseFloat(polarMinInput.value), parseFloat(polarMaxInput.value), parseFloat(polarStepInput.value)));
    if (polarStepInput) polarStepInput.addEventListener('change', () => plotter.setPolarParams(parseFloat(polarMinInput.value), parseFloat(polarMaxInput.value), parseFloat(polarStepInput.value)));
    if (continuityCartesianInput) continuityCartesianInput.addEventListener('change', () => plotter.continuityThresholdCartesian = parseFloat(continuityCartesianInput.value));
    if (continuityPolarInput) continuityPolarInput.addEventListener('change', () => plotter.continuityThresholdPolar = parseFloat(continuityPolarInput.value));
    plotBtn.addEventListener('click', runPlot);
});
