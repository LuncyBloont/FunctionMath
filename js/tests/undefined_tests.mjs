import { Lexer } from '../parser/lexer.js';
import { Parser } from '../parser/parser.js';
import { Evaluator } from '../parser/evaluator.js';

export function runUndefinedInputTests() {
    let failed = 0;

    try {
        const code = 'y = x + z @;';
        const lexer = new Lexer(code);
        const tokens = lexer.tokenize();
        const parser = new Parser(tokens);
        const ast = parser.parse();
        if (parser.errors && parser.errors.length) throw new Error('Parser errors: ' + parser.errors.join('; '));

        const evaluator = new Evaluator();
        evaluator.compile(ast);
        let threw = false;
        try {
            evaluator.evaluate(ast, { x: 1 }); // z undefined
        } catch (err) {
            threw = true;
            if (!/Undefined variable/.test(err.message)) {
                throw new Error('Expected undefined variable error, got: ' + err.message);
            }
            console.log('Undefined input detected as expected:', err.message);
        }
        if (!threw) throw new Error('Expected runtime error for undefined input but none thrown');

    } catch (e) {
        console.error('Undefined input test failed:', e.message || e);
        failed++;
    }

    if (failed > 0) {
        console.error('Undefined input tests failed:', failed);
        throw new Error('Undefined input tests failed');
    }
    console.log('Undefined input tests passed.');
}
