import { OpCode } from './opcode.js';

export class VM {
    constructor() {
        this.stack = [];
        this.globals = new Map();
        this.debug = false; // toggle to enable internal logs
        this.builtins = {
            'sin': Math.sin,
            'cos': Math.cos,
            'tan': Math.tan,
            'abs': Math.abs,
            'sqrt': Math.sqrt,
            'log': Math.log,
            'exp': Math.exp,
            'floor': Math.floor,
            'ceil': Math.ceil,
            'min': Math.min,
            'max': Math.max,
            'pow': Math.pow,
            'PI': Math.PI,
            'E': Math.E
        };

        // Additional HLSL-like scalar functions (added 2026-01-29)
        Object.assign(this.builtins, {
            'asin': Math.asin,
            'acos': Math.acos,
            'atan': Math.atan,
            'atan2': Math.atan2,
            'sign': x => (x > 0 ? 1 : (x < 0 ? -1 : 0)),
            'fract': x => x - Math.floor(x),
            'fmod': (x, y) => x % y,
            'clamp': (x, a, b) => Math.min(Math.max(x, a), b),
            'saturate': x => Math.min(Math.max(x, 0), 1),
            'lerp': (a, b, t) => a + (b - a) * t,
            'step': (edge, x) => (x < edge ? 0 : 1),
            'smoothstep': (edge0, edge1, x) => {
                if (edge0 === edge1) return 0;
                const t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1);
                return t * t * (3 - 2 * t);
            },
            'rsqrt': x => 1 / Math.sqrt(x),
            'log2': x => Math.log(x) / Math.LN2,
            'exp2': x => Math.pow(2, x),
            'log10': x => Math.log(x) / Math.LN10
        });
    }

    reset() {
        if (this.debug) console.log("[VM] Resetting state (clearing globals)");
        this.globals.clear();
        this.stack = [];
    }

    execute(code, context = {}) {
        this.stack = [];
        this.globals.clear(); // Ensure stateless execution for each run
        // console.log("[VM] Execute frame, context keys:", Object.keys(context));
        
        // Load context into globals
        for(const k in context) {
            this.globals.set(k, context[k]);
        }

        let ip = 0;
        while (ip < code.length) {
            const instr = code[ip];
            switch (instr.op) {
                case OpCode.CONST:
                    this.stack.push(instr.operand);
                    break;
                case OpCode.ADD: {
                    const b = this.stack.pop();
                    const a = this.stack.pop();
                    this.stack.push(a + b);
                    break;
                }
                case OpCode.SUB: {
                    const b = this.stack.pop();
                    const a = this.stack.pop();
                    this.stack.push(a - b);
                    break;
                }
                case OpCode.MUL: {
                    const b = this.stack.pop();
                    const a = this.stack.pop();
                    this.stack.push(a * b);
                    break;
                }
                case OpCode.DIV: {
                    const b = this.stack.pop();
                    const a = this.stack.pop();
                    this.stack.push(a / b);
                    break;
                }
                case OpCode.POW: {
                    const b = this.stack.pop();
                    const a = this.stack.pop();
                    this.stack.push(Math.pow(a, b));
                    break;
                }
                case OpCode.XOR: {
                    const b = this.stack.pop();
                    const a = this.stack.pop();
                    // Perform 32-bit integer XOR semantics; convert operands to int32
                    const ai = a | 0;
                    const bi = b | 0;
                    this.stack.push((ai ^ bi));
                    break;
                }
                case OpCode.MOD: {
                    const b = this.stack.pop();
                    const a = this.stack.pop();
                    this.stack.push(a % b);
                    break;
                }
                case OpCode.NEG: {
                    const a = this.stack.pop();
                    this.stack.push(-a);
                    break;
                }
                case OpCode.EQ: {
                    const b = this.stack.pop();
                    const a = this.stack.pop();
                    this.stack.push(a === b ? 1 : 0);
                    break;
                }
                case OpCode.NEQ: {
                    const b = this.stack.pop();
                    const a = this.stack.pop();
                    this.stack.push(a !== b ? 1 : 0);
                    break;
                }
                case OpCode.LT: {
                    const b = this.stack.pop();
                    const a = this.stack.pop();
                    this.stack.push(a < b ? 1 : 0);
                    break;
                }
                case OpCode.GT: {
                    const b = this.stack.pop();
                    const a = this.stack.pop();
                    this.stack.push(a > b ? 1 : 0);
                    break;
                }
                case OpCode.LTE: {
                    const b = this.stack.pop();
                    const a = this.stack.pop();
                    this.stack.push(a <= b ? 1 : 0);
                    break;
                }
                case OpCode.GTE: {
                    const b = this.stack.pop();
                    const a = this.stack.pop();
                    this.stack.push(a >= b ? 1 : 0);
                    break;
                }
                case OpCode.LOAD: {
                    const name = instr.operand;
                    if (this.globals.has(name)) {
                        this.stack.push(this.globals.get(name));
                    } else if (name in this.builtins) {
                         if (typeof this.builtins[name] === 'number') {
                             this.stack.push(this.builtins[name]);
                         } else {
                             // Assuming calls are handled by CALL op node
                             throw new Error(`Cannot load function '${name}' as variable.`);
                         }
                    } else {
                        // Allow undefined variables to default to 0 to avoid crashes? 
                        // Or throw.
                        throw new Error(`Undefined variable '${name}'`);
                    }
                    break;
                }
                case OpCode.STORE: {
                    const val = this.stack.pop();
                    this.globals.set(instr.operand, val);
                    break;
                }
                case OpCode.DUP: {
                    this.stack.push(this.stack[this.stack.length - 1]);
                    break;
                }
                case OpCode.POP: {
                    this.stack.pop();
                    break;
                }
                case OpCode.JMP: {
                    ip = instr.operand;
                    continue;
                }
                case OpCode.JMP_FALSE: {
                    const val = this.stack.pop();
                    if (!val) {
                        ip = instr.operand;
                        continue;
                    }
                    break;
                }
                case OpCode.CALL: {
                     const { name, arity } = instr.operand;
                     const args = [];
                     for (let i = 0; i < arity; i++) args.push(this.stack.pop());
                     args.reverse();

                     if (name === 'mark_x' || name === 'mark_y') {
                         if (arity !== 1 || typeof args[0] !== 'number' || !Number.isFinite(args[0])) {
                             throw new Error(`${name} requires one finite number`);
                         }
                         if (this.markerHandler) this.markerHandler(name, args[0]);
                         this.stack.push(args[0]);
                     } else if (this.builtins[name]) {
                         const result = this.builtins[name](...args);
                         this.stack.push(result);
                     } else {
                         throw new Error(`Unknown function '${name}'`);
                     }
                     break;
                }
                case OpCode.RET: {
                    return this.stack.length > 0 ? this.stack.pop() : null;
                }
            }
            ip++;
        }
        return this.stack.length > 0 ? this.stack.pop() : null;
    }
}
