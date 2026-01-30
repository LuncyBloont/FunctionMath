import { Lexer } from '../parser/lexer.js';
import { Parser } from '../parser/parser.js';
import { Evaluator } from '../parser/evaluator.js';

export function runControlFlowTests() {
    let failed = 0;

    // Test if/else
    try {
        const code = 'y = 0; if (x > 0) { y = 1 } else { y = -1 }';
        const lexer = new Lexer(code);
        const tokens = lexer.tokenize();
        const parser = new Parser(tokens);
        const ast = parser.parse();
        if (parser.errors && parser.errors.length) throw new Error('Parser errors: ' + parser.errors.join('; '));

        const evaluator = new Evaluator();
        evaluator.compile(ast);

        evaluator.evaluate(ast, { x: 5 });
        const y1 = evaluator.vm.globals.get('y');
        if (y1 !== 1) throw new Error('if-branch failed for x=5 expected y=1 got ' + y1);

        evaluator.evaluate(ast, { x: -2 });
        const y2 = evaluator.vm.globals.get('y');
        if (y2 !== -1) throw new Error('else-branch failed for x=-2 expected y=-1 got ' + y2);

    } catch (e) {
        console.error('If/Else control flow test failed:', e.message || e);
        failed++;
    }

    // Test for-loop
    try {
        const code = 'sum = 0; for (i = 0; i < 4; i = i + 1) { sum = sum + i }';
        const lexer = new Lexer(code);
        const tokens = lexer.tokenize();
        const parser = new Parser(tokens);
        const ast = parser.parse();
        if (parser.errors && parser.errors.length) throw new Error('Parser errors: ' + parser.errors.join('; '));

        const evaluator = new Evaluator();
        evaluator.compile(ast);

        evaluator.evaluate(ast, {});
        const sum = evaluator.vm.globals.get('sum');
        // sum 0+1+2+3 = 6
        if (sum !== 6) throw new Error('for-loop sum expected 6 got ' + sum);

    } catch (e) {
        console.error('For-loop test failed:', e.message || e);
        failed++;
    }

    if (failed > 0) {
        console.error('Control flow tests failed:', failed);
        throw new Error('Control flow tests failed');
    }
    console.log('Control flow tests passed.');
}
