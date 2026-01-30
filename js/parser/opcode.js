export const OpCode = {
    CONST: 'CONST',       // Push constant to stack
    ADD: 'ADD',           // Pop a, b; Push a + b
    SUB: 'SUB',           // Pop a, b; Push a - b
    MUL: 'MUL',           // Pop a, b; Push a * b
    DIV: 'DIV',           // Pop a, b; Push a / b
    POW: 'POW',           // Pop a, b; Push a ^ b (deprecated - use pow() builtin for exponent)
    XOR: 'XOR',           // Pop a, b; Push a ^ b (bitwise XOR)
    MOD: 'MOD',           // Pop a, b; Push a % b
    NEG: 'NEG',           // Pop a; Push -a
    LOAD: 'LOAD',         // Push variable value
    STORE: 'STORE',       // Pop value; Store in variable
    POP: 'POP',           // Pop value and discard
    JMP: 'JMP',           // Unconditional jump
    JMP_FALSE: 'JMP_FALSE', // Pop value; Jump if false/zero
    EQ: 'EQ',             // Equal
    NEQ: 'NEQ',           // Not Equal
    LT: 'LT',             // Less Than
    GT: 'GT',             // Greater Than
    LTE: 'LTE',           // Less Than or Equal
    GTE: 'GTE',           // Greater Than or Equal
    CALL: 'CALL',         // Call built-in function
    RET: 'RET',           // Return (end of script)
    DUP: 'DUP'            // Duplicate top of stack
};
