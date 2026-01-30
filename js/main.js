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

    // Toggle Panel
    toggleBtn.addEventListener('click', () => {
        rangePanel.classList.toggle('minimized');
        toggleBtn.textContent = rangePanel.classList.contains('minimized') ? '□' : '_';
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
