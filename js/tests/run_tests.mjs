import { Lexer } from '../parser/lexer.js';
import { TokenType } from '../parser/token.js';

function extractNumbers(code) {
    const lexer = new Lexer(code);
    const tokens = lexer.tokenize();
    return tokens.filter(t => t.type === TokenType.NUMBER).map(t => t.value);
}

const tests = [
    { code: 'y = 1e-3 * x;', expect: [0.001] },
    { code: 'a = .5E+6; b = 2.5; c = 3.; d = 4e-2;', expect: [500000, 2.5, 3, 0.04] },
    { code: 'n = 1E-2; m = 6.022e23;', expect: [0.01, 6.022e23] },
    { code: 'x = 123; // simple int', expect: [123] },
    { code: 'f = .123; g = 5.0e-1;', expect: [0.123, 0.5] }
];

let failed = 0;
for (const t of tests) {
    const nums = extractNumbers(t.code);
    const ok = nums.length === t.expect.length && nums.every((v, i) => Math.abs(v - t.expect[i]) <= Math.max(1e-12, Math.abs(t.expect[i]) * 1e-12));
    console.log('CODE:', t.code);
    console.log('  ->', nums);
    if (!ok) {
        console.error('  EXPECT:', t.expect);
        console.error('  GOT   :', nums);
        failed++;
    }
}

if (failed > 0) {
    console.error(`TESTS FAILED: ${failed}`);
    process.exit(1);
} else {
    console.log('All tests passed.');
    process.exit(0);
}
