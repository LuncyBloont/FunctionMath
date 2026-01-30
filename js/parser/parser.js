import { TokenType } from './token.js';

export class Parser {
    constructor(tokens) {
        this.tokens = tokens;
        this.current = 0;
    }

    parse() {
        const statements = [];
        this.errors = [];
        while (!this.isAtEnd()) {
            try {
                statements.push(this.statement());
            } catch (e) {
                // Collect error and attempt to resynchronize to next statement
                this.errors.push(e.message || String(e));
                // Advance to next semicolon or next token to continue parsing
                while (!this.isAtEnd() && !this.check(TokenType.SEMICOLON)) {
                    this.advance();
                }
                if (this.check(TokenType.SEMICOLON)) this.advance();
            }
        }

        const program = { type: 'Program', body: statements };
        if (this.errors.length > 0) program.errors = this.errors;
        return program;
    }

    statement() {
        if (this.match(TokenType.KEYWORD_IF)) {
            return this.ifStatement();
        }
        if (this.match(TokenType.KEYWORD_FOR)) {
            return this.forStatement();
        }
        if (this.match(TokenType.LBRACE)) {
            return this.block();
        }
        return this.expressionStatement();
    }

    ifStatement() {
        this.consume(TokenType.LPAREN, "Expect '(' after 'if'.");
        const condition = this.expression();
        this.consume(TokenType.RPAREN, "Expect ')' after if condition.");
        
        const thenBranch = this.statement();
        let elseBranch = null;
        
        if (this.match(TokenType.KEYWORD_ELSE)) {
            elseBranch = this.statement();
        }
        
        return { type: 'IfStatement', condition, thenBranch, elseBranch };
    }

    forStatement() {
        this.consume(TokenType.LPAREN, "Expect '(' after 'for'.");
        
        let init;
        if (this.match(TokenType.SEMICOLON)) {
            init = null;
        } else {
            init = this.expressionStatement(); // Parses expression then consumes semicolon
        }
        // Note: expressionStatement consumes the semicolon if it finds one usually? 
        // My expressionStatement implementation below will need to handle or not handle semicolon.
        // Let's refine expressionStatement to be purely statement ending with semicolon.
        
        let condition = null;
        if (!this.check(TokenType.SEMICOLON)) {
            condition = this.expression();
        }
        this.consume(TokenType.SEMICOLON, "Expect ';' after loop condition.");
        
        let increment = null;
        if (!this.check(TokenType.RPAREN)) {
            increment = this.expression();
        }
        this.consume(TokenType.RPAREN, "Expect ')' after for clauses.");
        
        const body = this.statement();
        
        return { type: 'ForStatement', init, condition, increment, body };
    }

    block() {
        const statements = [];
        while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
            statements.push(this.statement());
        }
        this.consume(TokenType.RBRACE, "Expect '}' after block.");
        return { type: 'Block', body: statements };
    }

    expressionStatement() {
        const expr = this.expression();
        // Semicolon is optional or mandatory? 
        // HLSL usually has semicolons.
        // Let's expect semicolon if present, but maybe flexible.
        if (this.check(TokenType.SEMICOLON)) {
            this.advance();
        }
        return { type: 'ExpressionStatement', expression: expr };
    }

    expression() {
        if (this.check(TokenType.IDENTIFIER)) {
            // Lookahead for assignment: IDENTIFIER = ...
            const next = this.tokens[this.current + 1];
            if (next && next.type === TokenType.ASSIGN) {
                return this.assignment();
            }
        }
        return this.comparison();
    }

    assignment() {
        const name = this.consume(TokenType.IDENTIFIER, "Expect variable name.").value;
        this.consume(TokenType.ASSIGN, "Expect '=' after variable name.");
        const value = this.expression();
        
        const markers = [];
        while (this.check(TokenType.VIS_MARKER)) {
             const m = this.advance().value;
             markers.push(m);
             console.log(`[Parser] Found marker for ${name}: ${m}`);
        }
        
        return { type: 'Assignment', name, value, markers };
    }

    comparison() {
        let expr = this.additive();

        while (this.match(TokenType.EQUAL, TokenType.NOT_EQUAL, TokenType.LESS, TokenType.LESS_EQUAL, TokenType.GREATER, TokenType.GREATER_EQUAL)) {
            const operator = this.previous().type;
            const right = this.additive();
            expr = { type: 'Binary', operator, left: expr, right };
        }

        return expr;
    }

    additive() {
        let expr = this.multiplicative();

        while (this.match(TokenType.PLUS, TokenType.MINUS)) {
            const operator = this.previous().type;
            const right = this.multiplicative();
            expr = { type: 'Binary', operator, left: expr, right };
        }

        return expr;
    }

    multiplicative() {
        let expr = this.unary();

        while (this.match(TokenType.MULTIPLY, TokenType.DIVIDE, TokenType.MODULO)) {
            const operator = this.previous().type;
            const right = this.unary();
            expr = { type: 'Binary', operator, left: expr, right };
        }

        return expr;
    }

    unary() {
        if (this.match(TokenType.MINUS)) {
            const operator = this.previous().type;
            const right = this.unary();
            return { type: 'Unary', operator, right };
        }
        return this.power();
    }

    power() {
        let expr = this.primary();
        
        while (this.match(TokenType.POWER)) {
            const operator = this.previous().type;
            const right = this.unary();
            expr = { type: 'Binary', operator, left: expr, right };
        }
        
        return expr;
    }

    primary() {
        if (this.match(TokenType.NUMBER)) {
            return { type: 'Literal', value: this.previous().value };
        }

        if (this.match(TokenType.IDENTIFIER)) {
            const name = this.previous().value;
            // Function call
            if (this.match(TokenType.LPAREN)) {
                const args = [];
                if (!this.check(TokenType.RPAREN)) {
                    do {
                        args.push(this.expression());
                    } while (this.match(TokenType.COMMA));
                }
                this.consume(TokenType.RPAREN, "Expect ')' after arguments.");
                return { type: 'Call', name, args };
            }
            return { type: 'Variable', name };
        }
        
        if (this.match(TokenType.VIS_MARKER)) {
             return { type: 'Literal', value: this.previous().value }; // Treat like a literal string or special var
        }

        if (this.match(TokenType.LPAREN)) {
            const expr = this.expression();
            this.consume(TokenType.RPAREN, "Expect ')' after expression.");
            return expr;
        }

        // Error handling
        throw new Error(`Expect expression at line ${this.peek().line}`);
    }

    match(...types) {
        for (const type of types) {
            if (this.check(type)) {
                this.advance();
                return true;
            }
        }
        return false;
    }

    check(type) {
        if (this.isAtEnd()) return false;
        return this.peek().type === type;
    }

    advance() {
        if (!this.isAtEnd()) this.current++;
        return this.previous();
    }

    isAtEnd() {
        return this.peek().type === TokenType.EOF;
    }

    peek() {
        return this.tokens[this.current];
    }

    previous() {
        return this.tokens[this.current - 1];
    }

    consume(type, message) {
        if (this.check(type)) return this.advance();
        const token = this.peek();
        throw new Error(`${message} at line ${token ? token.line : 'end'}`);
    }
}
