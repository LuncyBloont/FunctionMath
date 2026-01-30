// TokenType definitions
export const TokenType = {
    NUMBER: 'NUMBER',
    IDENTIFIER: 'IDENTIFIER',
    PLUS: 'PLUS',
    MINUS: 'MINUS',
    MULTIPLY: 'MULTIPLY',
    DIVIDE: 'DIVIDE',
    POWER: 'POWER',
    MODULO: 'MODULO',
    LPAREN: 'LPAREN',
    RPAREN: 'RPAREN',
    LBRACE: 'LBRACE',
    RBRACE: 'RBRACE',
    SEMICOLON: 'SEMICOLON',
    COMMA: 'COMMA',
    ASSIGN: 'ASSIGN',
    EQUAL: 'EQUAL',
    NOT_EQUAL: 'NOT_EQUAL',
    LESS: 'LESS',
    GREATER: 'GREATER',
    LESS_EQUAL: 'LESS_EQUAL',
    GREATER_EQUAL: 'GREATER_EQUAL',
    KEYWORD_IF: 'KEYWORD_IF',
    KEYWORD_ELSE: 'KEYWORD_ELSE',
    KEYWORD_FOR: 'KEYWORD_FOR',
    VIS_MARKER: 'VIS_MARKER', // @, $, or #Color
    EOF: 'EOF'
};

export class Token {
    constructor(type, value, line, column) {
        this.type = type;
        this.value = value;
        this.line = line;
        this.column = column;
    }
}
