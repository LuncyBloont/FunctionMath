import { Lexer } from '../parser/lexer.js';
import { Parser } from '../parser/parser.js';
import { Evaluator } from '../parser/evaluator.js';

export function runEvaluatorTests() {
    let failed = 0;

    const cases = [
        {
            code: 'y = x * 2 @; y2 = y + 1;',
            checks: (evaluator) => {
                // execute with x=3
                evaluator.compile(evaluatorLastAST);
            }
        }
    ];

    // We'll write explicit tests below rather than using `cases`

    // Test 1: compile & execute with context x=3 -> y=6, y2=7
    try {
        const code = 'y = x * 2 @; y2 = y + 1;';
        const lexer = new Lexer(code);
        const tokens = lexer.tokenize();
        const parser = new Parser(tokens);
        const ast = parser.parse();
        if (parser.errors && parser.errors.length) throw new Error('Parser errors: ' + parser.errors.join('; '));

        const evaluator = new Evaluator();
        evaluator.compile(ast);

        evaluator.evaluate(ast, { x: 3 });
        const g1 = evaluator.vm.globals.get('y');
        const g2 = evaluator.vm.globals.get('y2');
        console.log('After x=3 -> y=', g1, 'y2=', g2);
        if (g1 !== 6 || g2 !== 7) throw new Error(`Unexpected values for x=3: y=${g1} y2=${g2}`);

        // Test statelessness: run with x=4
        evaluator.evaluate(ast, { x: 4 });
        const g1b = evaluator.vm.globals.get('y');
        const g2b = evaluator.vm.globals.get('y2');
        console.log('After x=4 -> y=', g1b, 'y2=', g2b);
        if (g1b !== 8 || g2b !== 9) throw new Error(`Unexpected values for x=4: y=${g1b} y2=${g2b}`);

    } catch (e) {
        console.error('Evaluator test failed:', e);
        failed++;
    }

    if (failed > 0) {
        console.error(`Evaluator tests failed: ${failed}`);
        throw new Error('Evaluator tests failed');
    }
    console.log('Evaluator tests passed.');
}
