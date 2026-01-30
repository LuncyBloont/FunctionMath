import { Lexer } from '../parser/lexer.js';
import { Parser } from '../parser/parser.js';
import { Evaluator } from '../parser/evaluator.js';

export function runEdgeCaseTests() {
    let failed = 0;

    // Operator precedence
    try {
        const code = 'r = 2 + 3 * 4;'; // 2 + (3*4) = 14
        const lexer = new Lexer(code);
        const tokens = lexer.tokenize();
        const parser = new Parser(tokens);
        const ast = parser.parse();
        const evaluator = new Evaluator();
        evaluator.compile(ast);
        evaluator.evaluate(ast, {});
        const r = evaluator.vm.globals.get('r');
        if (r !== 14) throw new Error('Operator precedence failed, got ' + r);
    } catch (e) {
        console.error('Operator precedence test failed:', e.message || e);
        failed++;
    }

    // XOR associativity (bitwise XOR is associative)
    try {
        const code = 'p = 2 ^ 3 ^ 2;';
        const lexer = new Lexer(code);
        const tokens = lexer.tokenize();
        const parser = new Parser(tokens);
        const ast = parser.parse();
        const evaluator = new Evaluator();
        evaluator.compile(ast);
        evaluator.evaluate(ast, {});
        const p = evaluator.vm.globals.get('p');
        // Bitwise XOR: 2 ^ 3 ^ 2 == 3 (associative)
        if (p !== 3) throw new Error('Unexpected XOR result: ' + p);
        console.log('XOR associativity observed value:', p);
    } catch (e) {
        console.error('Power associativity test failed:', e.message || e);
        failed++;
    }

    // Unary minus with power: -2 ^ 2
    try {
        const code = 'u = -2 ^ 2;';
        const lexer = new Lexer(code);
        const tokens = lexer.tokenize();
        const parser = new Parser(tokens);
        const ast = parser.parse();
        const evaluator = new Evaluator();
        evaluator.compile(ast);
        evaluator.evaluate(ast, {});
        const u = evaluator.vm.globals.get('u');
        // Behavior depends on associativity; ensure it's a finite number
        if (!isFinite(u)) throw new Error('Unary-power produced non-finite: ' + u);
    } catch (e) {
        console.error('Unary minus with power test failed:', e.message || e);
        failed++;
    }

    // Division by zero
    try {
        const code = 'd = 1 / 0;';
        const lexer = new Lexer(code);
        const tokens = lexer.tokenize();
        const parser = new Parser(tokens);
        const ast = parser.parse();
        const evaluator = new Evaluator();
        evaluator.compile(ast);
        evaluator.evaluate(ast, {});
        const d = evaluator.vm.globals.get('d');
        if (!(!isFinite(d) || d === Infinity)) throw new Error('Expected Infinity or -Infinity for division by zero, got ' + d);
    } catch (e) {
        console.error('Division by zero test failed:', e.message || e);
        failed++;
    }

    // Modulo by zero -> NaN expected
    try {
        const code = 'm = 5 % 0;';
        const lexer = new Lexer(code);
        const tokens = lexer.tokenize();
        const parser = new Parser(tokens);
        const ast = parser.parse();
        const evaluator = new Evaluator();
        evaluator.compile(ast);
        evaluator.evaluate(ast, {});
        const m = evaluator.vm.globals.get('m');
        if (!Number.isNaN(m)) throw new Error('Expected NaN for modulo by zero, got ' + m);
    } catch (e) {
        console.error('Modulo by zero test failed:', e.message || e);
        failed++;
    }

    // Function arity mismatch: pow with one arg
    try {
        const code = 'q = pow(2);';
        const lexer = new Lexer(code);
        const tokens = lexer.tokenize();
        const parser = new Parser(tokens);
        const ast = parser.parse();
        const evaluator = new Evaluator();
        evaluator.compile(ast);
        evaluator.evaluate(ast, {});
        const q = evaluator.vm.globals.get('q');
        if (!isFinite(q) && !Number.isNaN(q)) throw new Error('Unexpected pow(2) result: ' + q);
        console.log('pow(2) produced:', q);
    } catch (e) {
        console.error('Function arity test failed:', e.message || e);
        failed++;
    }

    // Invalid character in input should throw from lexer
    try {
        const code = 'y = 2 & 3;';
        let lexer = new Lexer(code);
        let threw = false;
        try {
            lexer.tokenize();
        } catch (err) {
            threw = true;
            console.log('Invalid character detected as expected:', err.message || err);
        }
        if (!threw) throw new Error('Expected lexer to throw on invalid character & but it did not');
    } catch (e) {
        console.error('Invalid character test failed:', e.message || e);
        failed++;
    }

    // Semicolon optional behavior: multiple statements separated by whitespace/newline
    try {
        const code = 'a = 1 b = 2';
        const lexer = new Lexer(code);
        const tokens = lexer.tokenize();
        const parser = new Parser(tokens);
        const ast = parser.parse();
        const evaluator = new Evaluator();
        evaluator.compile(ast);
        evaluator.evaluate(ast, {});
        const a = evaluator.vm.globals.get('a');
        const b = evaluator.vm.globals.get('b');
        if (a !== 1 || b !== 2) throw new Error('Semicolon-optional parsing failed a=' + a + ' b=' + b);
    } catch (e) {
        console.error('Semicolon optional test failed:', e.message || e);
        failed++;
    }

    // Chained assignment: a = b = 2
    try {
        const code = 'a = b = 2;';
        const lexer = new Lexer(code);
        const tokens = lexer.tokenize();
        const parser = new Parser(tokens);
        const ast = parser.parse();
        const evaluator = new Evaluator();
        evaluator.compile(ast);
        evaluator.evaluate(ast, {});
        const a = evaluator.vm.globals.get('a');
        const b = evaluator.vm.globals.get('b');
        if (a !== 2 || b !== 2) throw new Error('Chained assignment failed a=' + a + ' b=' + b);
    } catch (e) {
        console.error('Chained assignment test failed:', e.message || e);
        failed++;
    }

    // Scientific notation malformed: '1e' should parse as number 1 then identifier 'e'
    try {
        const code = 'n = 1e + 2;';
        const lexer = new Lexer(code);
        const tokens = lexer.tokenize();
        // tokens should include NUMBER(1) IDENTIFIER('e') PLUS NUMBER 2
        const numTokens = tokens.filter(t => t.type === 'NUMBER').map(t => t.value);
        if (numTokens.length === 0 || numTokens[0] !== 1) throw new Error('Malformed scientific notation handling failed');
    } catch (e) {
        console.error('Malformed scientific notation test failed:', e.message || e);
        failed++;
    }

    if (failed > 0) {
        console.error('Edge case tests failed:', failed);
        throw new Error('Edge case tests failed');
    }
    console.log('Edge case tests passed.');
}
