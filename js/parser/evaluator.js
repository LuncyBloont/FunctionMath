import { Compiler } from './compiler.js?v=9';
import { VM } from './vm.js?v=9';

export class Evaluator {
    constructor() {
        this.compiler = new Compiler();
        this.vm = new VM();
        this.code = null;
    }

    evaluate(ast, context) {
        try {
            if (!this.code) {
                 this.code = this.compiler.compile(ast);
            }
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
        return this.code;
    }
}
