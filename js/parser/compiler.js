import { OpCode } from './opcode.js';
import { TokenType } from './token.js';

export class Compiler {
    constructor() {
        this.code = [];
    }

    compile(ast) {
        this.code = [];
        // AST is a Program node with body
        if (ast.type === 'Program') {
            for (const stmt of ast.body) {
                this.visit(stmt);
            }
        } else {
             // Fallback if AST is not wrapped in Program
             this.visit(ast);
        }
        this.emit(OpCode.RET);
        return this.code;
    }

    visit(node) {
        if (!node) return;
        switch (node.type) {
            case 'Block':
                for (const stmt of node.body) this.visit(stmt);
                break;
            case 'ExpressionStatement':
                this.visit(node.expression);
                this.emit(OpCode.POP); 
                break;
            case 'Assignment':
                this.visit(node.value);
                this.emit(OpCode.DUP);
                this.emit(OpCode.STORE, node.name);
                break;
            case 'IfStatement':
                this.visit(node.condition);
                const elseJump = this.emitJump(OpCode.JMP_FALSE);
                this.visit(node.thenBranch);
                const endJump = this.emitJump(OpCode.JMP);
                this.patchJump(elseJump);
                if (node.elseBranch) this.visit(node.elseBranch);
                this.patchJump(endJump);
                break;
            case 'ForStatement':
                // Init
                if (node.init) this.visit(node.init);
                
                const loopStart = this.code.length;
                
                // Condition
                if (node.condition) {
                    this.visit(node.condition);
                } else {
                    this.emit(OpCode.CONST, 1); // True
                }
                
                const exitJump = this.emitJump(OpCode.JMP_FALSE);
                
                // Body
                this.visit(node.body);
                
                // Increment
                if (node.increment) {
                    this.visit(node.increment);
                    this.emit(OpCode.POP);
                }
                
                this.emitLoop(loopStart);
                this.patchJump(exitJump);
                break;
            case 'Binary':
                this.visit(node.left);
                this.visit(node.right);
                switch (node.operator) {
                    case TokenType.PLUS: this.emit(OpCode.ADD); break;
                    case TokenType.MINUS: this.emit(OpCode.SUB); break;
                    case TokenType.MULTIPLY: this.emit(OpCode.MUL); break;
                    case TokenType.DIVIDE: this.emit(OpCode.DIV); break;
                    case TokenType.POWER: this.emit(OpCode.POW); break;
                    case TokenType.MODULO: this.emit(OpCode.MOD); break;
                    case TokenType.EQUAL: this.emit(OpCode.EQ); break;
                    case TokenType.NOT_EQUAL: this.emit(OpCode.NEQ); break;
                    case TokenType.LESS: this.emit(OpCode.LT); break;
                    case TokenType.LESS_EQUAL: this.emit(OpCode.LTE); break;
                    case TokenType.GREATER: this.emit(OpCode.GT); break;
                    case TokenType.GREATER_EQUAL: this.emit(OpCode.GTE); break;
                }
                break;
            case 'Unary':
                this.visit(node.right);
                if (node.operator === TokenType.MINUS) this.emit(OpCode.NEG);
                break;
            case 'Literal':
                this.emit(OpCode.CONST, node.value);
                break;
            case 'Variable':
                this.emit(OpCode.LOAD, node.name);
                break;
            case 'Call':
                for (const arg of node.args) {
                    this.visit(arg);
                }
                this.emit(OpCode.CALL, { name: node.name, arity: node.args.length });
                break;
        }
    }

    emit(op, operand = null) {
        this.code.push({ op, operand });
        return this.code.length - 1;
    }

    emitJump(op) {
        this.emit(op, 0xFFFF);
        return this.code.length - 1;
    }

    patchJump(offset) {
        if (offset < this.code.length) {
            this.code[offset].operand = this.code.length;
        }
    }

    emitLoop(loopStart) {
        this.emit(OpCode.JMP, loopStart);
    }
}
