import { Lexer } from '../parser/lexer.js';
import { Parser } from '../parser/parser.js';
import { Evaluator } from '../parser/evaluator.js';

export function runErrorTests() {
    let failed = 0;

    // Syntax error - parser should collect errors
    try {
        const code = 'y = ;';
        const lexer = new Lexer(code);
        const tokens = lexer.tokenize();
        const parser = new Parser(tokens);
        const ast = parser.parse();
        if (!ast.errors || ast.errors.length === 0) throw new Error('Expected parser errors but none found');
        console.log('Parser error detected as expected:', ast.errors[0]);
    } catch (e) {
        console.error('Syntax error test failed:', e.message || e);
        failed++;
    }

    // Runtime error - unknown function
    try {
        const code = 'y = foo(x);';
        const lexer = new Lexer(code);
        const tokens = lexer.tokenize();
        const parser = new Parser(tokens);
        const ast = parser.parse();
        if (parser.errors && parser.errors.length) throw new Error('Parser errors: ' + parser.errors.join('; '));

        const evaluator = new Evaluator();
        evaluator.compile(ast);
        let threw = false;
        try {
            evaluator.evaluate(ast, { x: 1 });
        } catch (err) {
            threw = true;
            if (!/Unknown function/.test(err.message) && !/Unknown function/.test(String(err))) {
                throw new Error('Expected unknown function error, got: ' + err.message);
            }
            console.log('Unknown function runtime error detected as expected:', err.message);
        }
        if (!threw) throw new Error('Expected runtime error for unknown function but no error thrown');
    } catch (e) {
        console.error('Runtime unknown function test failed:', e.message || e);
        failed++;
    }

    // Runtime error - undefined variable
    try {
        const code = 'y = a + 1;';
        const lexer = new Lexer(code);
        const tokens = lexer.tokenize();
        const parser = new Parser(tokens);
        const ast = parser.parse();
        if (parser.errors && parser.errors.length) throw new Error('Parser errors: ' + parser.errors.join('; '));

        const evaluator = new Evaluator();
        evaluator.compile(ast);
        let threw = false;
        try {
            evaluator.evaluate(ast, { x: 0 });
        } catch (err) {
            threw = true;
            if (!/Undefined variable/.test(err.message)) {
                throw new Error('Expected undefined variable error, got: ' + err.message);
            }
            console.log('Undefined variable runtime error detected as expected:', err.message);
        }
        if (!threw) throw new Error('Expected undefined variable runtime error but no error thrown');
    } catch (e) {
        console.error('Undefined variable runtime test failed:', e.message || e);
        failed++;
    }

    if (failed > 0) {
        console.error('Error tests failed:', failed);
        throw new Error('Error tests failed');
    }
    console.log('Error tests passed.');
}
