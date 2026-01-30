import { Token, TokenType } from './token.js';

export class Lexer {
    constructor(input) {
        this.input = input;
        this.pos = 0;
        this.line = 1;
        this.column = 1;
        this.tokens = [];
    }

    tokenize() {
        while (this.pos < this.input.length) {
            const char = this.input[this.pos];

            if (/\s/.test(char)) {
                this.skipWhitespace();
                continue;
            }

            const _peek = this.peek();
            if (/[0-9]/.test(char) || (char === '.' && _peek && /[0-9]/.test(_peek))) {
                this.tokens.push(this.readNumber());
                continue;
            }

            if (/[a-zA-Z_]/.test(char)) {
                this.tokens.push(this.readIdentifier());
                continue;
            }

            // Handle comments
            if (char === '/' && this.peek() === '/') {
                this.skipComment();
                continue;
            }

            // Visual Markers
            if (char === '@' || char === '$' || char === '#') {
                this.tokens.push(this.readVisMarker());
                continue;
            }

            switch (char) {
                case '+': this.addToken(TokenType.PLUS, '+'); break;
                case '-': this.addToken(TokenType.MINUS, '-'); break;
                case '*': this.addToken(TokenType.MULTIPLY, '*'); break;
                case '/': this.addToken(TokenType.DIVIDE, '/'); break;
                case '^': this.addToken(TokenType.XOR, '^'); break;
                case '%': this.addToken(TokenType.MODULO, '%'); break;
                case '(': this.addToken(TokenType.LPAREN, '('); break;
                case ')': this.addToken(TokenType.RPAREN, ')'); break;
                case '{': this.addToken(TokenType.LBRACE, '{'); break;
                case '}': this.addToken(TokenType.RBRACE, '}'); break;
                case ';': this.addToken(TokenType.SEMICOLON, ';'); break;
                case ',': this.addToken(TokenType.COMMA, ','); break;
                case '=': 
                    if (this.peek() === '=') {
                        this.advance();
                        this.addToken(TokenType.EQUAL, '==');
                    } else {
                        this.addToken(TokenType.ASSIGN, '=');
                    }
                    break;
                case '!': 
                    if (this.peek() === '=') {
                        this.advance();
                        this.addToken(TokenType.NOT_EQUAL, '!=');
                    } else {
                        throw new Error(`Unexpected character '!' at line ${this.line} column ${this.column}`);
                    }
                    break;
                case '<': 
                    if (this.peek() === '=') {
                        this.advance();
                        this.addToken(TokenType.LESS_EQUAL, '<=');
                    } else {
                        this.addToken(TokenType.LESS, '<');
                    }
                    break;
                case '>': 
                    if (this.peek() === '=') {
                        this.advance();
                        this.addToken(TokenType.GREATER_EQUAL, '>=');
                    } else {
                        this.addToken(TokenType.GREATER, '>');
                    }
                    break;
                default:
                    throw new Error(`Unexpected character '${char}' at line ${this.line} column ${this.column}`);
            }
            this.advance();
        }

        this.tokens.push(new Token(TokenType.EOF, null, this.line, this.column));
        return this.tokens;
    }

    peek() {
        return this.pos + 1 < this.input.length ? this.input[this.pos + 1] : null;
    }

    advance() {
        const char = this.input[this.pos];
        this.pos++;
        this.column++;
        if (char === '\n') {
            this.line++;
            this.column = 1;
        }
        return char;
    }

    addToken(type, value) {
        this.tokens.push(new Token(type, value, this.line, this.column));
    }

    skipWhitespace() {
        while (this.pos < this.input.length && /\s/.test(this.input[this.pos])) {
            this.advance();
        }
    }

    skipComment() {
        while (this.pos < this.input.length && this.input[this.pos] !== '\n') {
            this.advance();
        }
    }

    readNumber() {
        let start = this.pos;
        let startCol = this.column;
        let hasDot = false;
        while (this.pos < this.input.length) {
            const char = this.input[this.pos];
            if (/[0-9]/.test(char)) {
                this.advance();
            } else if (char === '.' && !hasDot) {
                hasDot = true;
                this.advance();
            } else {
                break;
            }
        }

        // Support scientific notation: e or E followed by optional +/-, then digits
        const rest = this.input.substring(this.pos);
        const expMatch = rest.match(/^[eE][+-]?[0-9]+/);
        if (expMatch) {
            // consume exponent characters
            for (let i = 0; i < expMatch[0].length; i++) this.advance();
        }

        const value = this.input.substring(start, this.pos);
        return new Token(TokenType.NUMBER, parseFloat(value), this.line, startCol);
    }

    readIdentifier() {
        let start = this.pos;
        let startCol = this.column;

        while (this.pos < this.input.length && /[a-zA-Z0-9_]/.test(this.input[this.pos])) {
            this.advance();
        }

        const value = this.input.substring(start, this.pos);
        let type = TokenType.IDENTIFIER;

        if (value === 'if') type = TokenType.KEYWORD_IF;
        else if (value === 'else') type = TokenType.KEYWORD_ELSE;
        else if (value === 'for') type = TokenType.KEYWORD_FOR;

        return new Token(type, value, this.line, startCol);
    }

    readVisMarker() {
        let start = this.pos;
        let startCol = this.column;
        this.advance(); // consume @, $, or #

        while (this.pos < this.input.length && /[a-zA-Z0-9_]/.test(this.input[this.pos])) {
            this.advance();
        }
        
        const value = this.input.substring(start, this.pos);
        return new Token(TokenType.VIS_MARKER, value, this.line, startCol);
    }
}
