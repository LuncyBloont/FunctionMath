import { Compiler } from './compiler.js?v=9';
import { VM } from './vm.js?v=9';

export class Evaluator {
    constructor() {
        this.compiler = new Compiler();
        this.vm = new VM();
        this.code = null;
        this.lastAST = null;
    }

    evaluate(ast, context) {
        try {
            // If an AST is provided and it's different from the last compiled AST,
            // recompile. This avoids silently using stale bytecode while also
            // preventing recompilation on repeated evaluations with the same AST.
            if (ast && ast !== this.lastAST) {
                this.compile(ast);
            }

            if (!this.code) throw new Error('No compiled code available. Call compile(ast) first.');

            this.lastError = null;
            return this.vm.execute(this.code, context);
        } catch (e) {
            this.lastError = e.message || String(e);
            throw e;
        }
    }

    reset() {
        this.vm.reset();
    }

    // Force recompile if AST changes (though AST is passed to evaluate, usually we compile once and run many times)
    // To support that pattern, maybe we separate compile and execute.
    // But keeping it simple for now.
    compile(ast) {
        this.code = this.compiler.compile(ast);
        this.lastAST = ast;
        return this.code;
    }

    execute(context) {
        if (!this.code) throw new Error('No compiled code to execute. Call compile(ast) first.');
        return this.vm.execute(this.code, context);
    }
}
