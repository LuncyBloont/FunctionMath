
import { Lexer } from './js/parser/lexer.js';
import { Parser } from './js/parser/parser.js';
import { TokenType } from './js/parser/token.js';

const code = `y = x @
y2 = x #f00`;

console.log("Input Code:\n", code);

try {
    const lexer = new Lexer(code);
    const tokens = lexer.tokenize();
    console.log("\nTokens:", tokens.map(t => `${t.type}(${t.value})`).join(", "));
    
    // Check if VIS_MARKER is present
    const hasMarker = tokens.some(t => t.type === TokenType.VIS_MARKER);
    console.log("Has VIS_MARKER token?", hasMarker);

    const parser = new Parser(tokens);
    const ast = parser.parse();
    
    console.log("\nAST Structure:");
    ast.body.forEach((stmt, idx) => {
        if (stmt.type === 'ExpressionStatement') {
            const expr = stmt.expression;
            if (expr.type === 'Assignment') {
                console.log(`Statement ${idx+1}: Assignment to ${expr.name}, Markers:`, expr.markers);
            } else {
                console.log(`Statement ${idx+1}: Expr ${expr.type}`);
            }
        }
    });

} catch (e) {
    console.error("Error:", e);
}
