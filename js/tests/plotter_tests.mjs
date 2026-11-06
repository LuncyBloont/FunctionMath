import assert from 'node:assert/strict';
import { Lexer } from '../parser/lexer.js';
import { Parser } from '../parser/parser.js';
import { Evaluator } from '../parser/evaluator.js';
import { Plotter } from '../plotter.js';

function makePlot(code, config, polar = false) {
    const texts = [];
    const paths = [];
    const samples = [];
    let path = [];
    const ctx = {
        beginPath() { path = []; },
        moveTo(x, y) { path.push(['move', x, y]); },
        lineTo(x, y) { path.push(['line', x, y]); },
        stroke() { paths.push(path); },
        arc() {}, fill() {}, save() {}, restore() {}, setLineDash() {},
        fillText(text) { texts.push(text); },
        measureText(text) { return { width: text.length * 6 }; }
    };
    const plotter = Object.create(Plotter.prototype);
    Object.assign(plotter, {
        canvas: { width: 100, height: 100 }, ctx, offsetX: 0, offsetY: 0,
        scaleX: 10, scaleY: 10, evaluator: new Evaluator(),
        lastErrors: [], polarMode: polar, polarMin: 0, polarMax: 2 * Math.PI,
        polarStep: 0.01, continuityEps: 1e-8,
        continuityThresholdCartesian: 100, continuityThresholdPolar: 100,
        plotConfig: new Map(Object.entries(config))
    });
    plotter.ast = new Parser(new Lexer(code).tokenize()).parse();
    assert.equal(plotter.ast.errors, undefined);
    plotter.evaluator.compile(plotter.ast);
    const evaluate = plotter.evaluator.evaluate.bind(plotter.evaluator);
    plotter.evaluator.evaluate = (ast, context) => {
        samples.push(context.x);
        return evaluate(ast, context);
    };
    plotter.drawPlots();
    return { plotter, texts, paths, samples };
}

export function runPlotterTests() {
    const solid = { color: '#f00', isGuide: false };
    const guide = { color: '#fff', isGuide: true };
    let result = makePlot('y = x @; g = x + 1 $; mark_x(2); mark_y(-1);', { y: solid, g: guide });
    assert.deepEqual(result.texts.sort(), ['(-1, -1)', '(2, 2)']);
    assert.equal(result.paths.filter(path => path.length === 4).length, 2);

    result = makePlot('y = pow(x - 0.1234, 2); mark_y(0);', {});
    assert.ok(result.texts.some(text => text.startsWith('(0.1234, ')), result.texts.join(', '));

    result = makePlot('y = sqrt(-pow(x - 0.1234, 2)); mark_x(0.1234);', {});
    assert.deepEqual(result.texts, ['(0.1234, 0)']);

    result = makePlot('r = 2 @; mark_x(1); mark_y(1);', { r: solid }, true);
    assert.equal(result.texts.length, 4);
    assert.ok(result.texts.some(text => text.startsWith('(1, 1.73205)')));
    assert.ok(result.texts.some(text => text.startsWith('(-1.73205, 1)')));

    result = makePlot('y = sqrt(0.04 - pow(x - 0.05, 2));', {});
    assert.ok(result.paths.some(path => path.some(item => item[0] === 'line' && item[1] >= 50 && item[1] <= 51)));

    result = makePlot('y = sqrt(x - 0.0508);', {});
    const refinedScreenX = result.samples.map(x => x * 10 + 50).filter(x => x > 50 && x < 51);
    assert.deepEqual(refinedScreenX.map(x => Number(x.toFixed(3))), [50.5, 50.25, 50.75]);

    result = makePlot('y = sqrt(-1);', {});
    assert.equal(result.samples.length, 101);

    result = makePlot('y = sqrt(x - 0.0508);', {});
    assert.equal(new Set(result.samples.map(x => Math.round((x * 10 + 50) * 8))).size, result.samples.length);

    result = makePlot('y = 1 / (x - 0.01); mark_y(0);', {});
    assert.equal(result.texts.length, 0);

    result = makePlot('y = x; mark_x();', {});
    assert.ok(result.plotter.lastErrors.some(error => error.message.includes('requires one finite number')));
    console.log('Plotter tests passed.');
}
