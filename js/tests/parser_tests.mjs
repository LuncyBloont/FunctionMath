import { Lexer } from '../parser/lexer.js';
import { Parser } from '../parser/parser.js';

export function runParserTests() {
    let failed = 0;

    const tests = [
        {
            code: 'y = sin(x) @; z = 2e3 #f00;',
            expectMarkers: { y: ['@'], z: ['#f00'] }
        },
        {
            code: 'a = 1.23e-4; b = .5E+2;',
            expectMarkers: { }
        }
    ];

    for (const t of tests) {
        const lexer = new Lexer(t.code);
        const tokens = lexer.tokenize();
        const parser = new Parser(tokens);
        const ast = parser.parse();

        console.log('TEST CODE:', t.code);
        if (parser.errors && parser.errors.length > 0) {
            console.error('  Parser errors:', parser.errors);
            failed++;
            continue;
        }

        // Build map of assignments to markers
        const found = {};
        if (ast.body && Array.isArray(ast.body)) {
            for (const stmt of ast.body) {
                if (stmt.type === 'ExpressionStatement' && stmt.expression && stmt.expression.type === 'Assignment') {
                    const asg = stmt.expression;
                    found[asg.name] = asg.markers || [];
                } else if (stmt.type === 'Assignment') {
                    // Some code paths may produce Assignment directly
                    found[stmt.name] = stmt.markers || [];
                }
            }
        }

        // Check expectations
        for (const [name, markers] of Object.entries(t.expectMarkers)) {
            const got = found[name] || [];
            const ok = markers.length === got.length && markers.every((m, i) => m === got[i]);
            console.log('  var', name, 'markers ->', got);
            if (!ok) {
                console.error('  EXPECT:', markers, 'GOT:', got);
                failed++;
            }
        }
    }

    if (failed > 0) {
        console.error(`Parser tests failed: ${failed}`);
        throw new Error('Parser tests failed');
    }
    console.log('Parser tests passed.');
}
