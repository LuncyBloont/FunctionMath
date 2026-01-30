# 2D Function Plotter - Project Reference

## 1. Project Overview
This project is a web-based tool for plotting 2D mathematical functions. It is designed to be lightweight, running entirely in the browser using static files (HTML, CSS, JS).

**Goal**: Provide a clean interface for users to input mathematical formulas (e.g., `y = sin(x)`) and visualize them on a Cartesian coordinate system.

## 2. Technology Stack
- **HTML5**: Structure and Canvas API for rendering.
- **CSS3**: Styling and responsive layout.
- **JavaScript (ES6+)**: Logic for parsing inputs, handling user interaction, and rendering graphics.
- **Custom Math Engine**: 
    - **Architecture**: Stack-based Virtual Machine (VM).
    - **Pipeline**: Source -> Lexer -> Parser (AST) -> Compiler (Bytecode) -> VM.
    - **Language**: HLSL-like syntax, Python-like variables (implicit declaration, global scope).
    - **Portability**: Core VM and math logic designed for easy porting to C++ (no DOM/JS specific deps).

## 3. Directory Structure
The project follows a standard static web layout:

```text
/
├── index.html          # Main application entry point
├── css/
│   └── style.css       # Global styles and layout
├── js/
│   ├── main.js         # Event handlers and app initialization
│   ├── parser/         # Custom Math Engine
│   │   ├── token.js    # Token definitions
│   │   ├── lexer.js    # Lexical analyzer (State Machine)
│   │   ├── parser.js   # AST generator
│   │   ├── compiler.js # AST to Bytecode Compiler
│   │   ├── vm.js       # Stack-based Virtual Machine
│   │   └── math_ops.js # Pure math implementation (Portable)
│   └── plotter.js      # Core logic for drawing axes, grid, and functions
├── project_doc/        # Detailed documentation (Features, Logs)
├── server.py           # Python server script
└── project.md          # Project documentation
```

## 4. Functional Requirements

### 4.1. Visual Interface
- **Canvas Area**: Full-screen HTML5 `<canvas>` acting as the main viewport.
- **Formula Input Panel**:
    - **Draggable & Floatable**: A UI panel overlay that can be moved and hidden/toggled.
    - **Code Editor**: A multi-line textarea for entering math script (HLSL-style).
    - **Controls**: "Plot/Update" button, "Clear" button.

### 4.2. Core Features
- **Coordinate System**:
    - Default: 2D Cartesian (Dynamic X/Y axes).
    - **Extensibility**: Logic should be structured to support Polar coordinates in the future.
    - Grid lines (major/minor) and Axis labels.
- **Navigation**:
    - **Pan**: Drag on canvas.
    - **Zoom**: Mouse wheel at cursor position.
- **Execution Model**:
    - The entire script in the input panel is executed **once per X-coordinate** (pixel column).
    - **Stateless Execution**: The VM state (variables) must be **reset** before each full plot cycle to prevent "ghost lines" from previous inputs.
    - `x` is provided as a built-in pre-defined variable.
    - Computes values for multiple curves in a single pass.

### 4.3. Math Logic & Syntax
- **Syntax**: HLSL-style operators and function calls (`sin(x)`, `pow(a, b)`).
- **Variables**: 
    - **Python-style**: No type declarations needed. Variables are created on assignment.
    - **Scope**: Flat/Global scope (no block scope inside ifs/loops).
- **Control Flow**:
    - `if (cond) { ... } else { ... }` (Compiled to Jump instructions).
    - `for (init; cond; step) { ... }` (Compiled to Loop/Jump instructions).
- **Visual Markers** (New Feature):
    - **Markers**: Suffixes used to control visibility and style of variables.
        - `@`: Explicit Draw (White default).
        - `#hex`: Draw with specific color (e.g., `#f00`).
        - `$`: Draw as Guide (dashed).
    - **Strict Mode**: If *any* marker is present, **only** marked variables are drawn.
    - **Fallback Mode**: If *no* markers are present, the variable named `y` is drawn in white.

### 4.5. Engine Architecture (VM & Compiler)
The core logic must be decoupled from JavaScript idioms to allow future C++ porting.

#### Pipeline:
1.  **Lexer**: Tokenizes input string.
2.  **Parser**: Builds a simple AST.
3.  **Compiler**: Flattens AST into a linear list of **Instructions (OpCodes)**.
4.  **Virtual Machine (VM)**:
    - **Stack-based execution**: Push/Pop values.
    - **Registers/Context**: Holds variable map (e.g., `map<string, float>`).
    - **Instruction Set**: `PUSH`, `POP`, `ADD`, `MUL`, `SIN`, `JMP`, `JMP_IF_FALSE`, `STORE_VAR`, `LOAD_VAR`, etc.
    - **Math Module**: A dedicated stateless module (e.g., `MathOps.add(a, b)`) that encapsulates the actual math.

#### Portability Requirements:
- The VM loop and Math Module should **not** rely on JS closures, `eval`, or DOM APIs.
- Use simple array-based stacks and loose coupling.

## 5. Development Guidelines for AI

When generating code for this project, please adhere to the following logic and conventions:

### 5.1 Coordinate Mapping
We need to convert between **World Coordinates** (Math space) and **Screen Coordinates** (Pixel space).
- **World Space**: `(x, y)` where x might range from -10 to 10.
- **Screen Space**: `(u, v)` where u ranges from 0 to `canvas.width`.

**Formulas**:
- `scale`: Pixels per mathematical unit.
- `offsetX`, `offsetY`: Translation in rendering.
- **World to Screen**:
  ```javascript
  screenX = (worldX * scaleX) + centerX + offsetX;
  screenY = centerY - (worldY * scaleY) + offsetY; // Y is inverted in screen space
  ```
- **Screen to World** (for mouse interaction):
  ```javascript
  worldX = (screenX - centerX - offsetX) / scaleX;
  worldY = (centerY - screenY + offsetY) / scaleY;
  ```

### 5.2 Rendering Loop
Use `requestAnimationFrame` for the rendering loop if implementing smooth interactions (pan/zoom).
1. **Clear Canvas**: `ctx.clearRect(...)`
2. **Draw Grid**: Draw vertical and horizontal lines based on current bounds.
3. **Draw Axes**: Draw the main X and Y axes (x=0, y=0).
4. **Draw Functions**: 
    - Loop through x-coordinates in screen space.
    - Convert screen x to world x.
    - Evaluate `y = f(x)`.
    - Convert world y to screen y.
    - Draw line segments.

## 6. Recent Fixes & Debugging Notes

- 2026-01-29: Fixed multiple issues discovered during debugging:
    - VM execution is now stateless per-evaluation: `VM.execute` clears `globals` before loading the per-x `context`.
    - Visual marker parsing and plotting: `@`, `#hex`, and `$` markers are parsed by the `Parser` and recognized by `plotter.js`; marked variables are now drawn in strict mode.
    - Removed an accidental duplicate `setFunction` implementation that previously prevented AST analysis from running.

- Debug logs: Non-invasive logs remain in `plotter.js` to aid diagnosis (`>>> [Plotter] ...` entries). These logs run on `setFunction` and during plotting start/finish, and a single sample log is emitted per plot pass; they are intentionally lightweight to avoid frame drops.

## 9. Supported Math Functions (Scalar)

The VM exposes the following built-in scalar math functions (HLSL-like names supported):

- Trigonometric: `sin`, `cos`, `tan`, `asin`, `acos`, `atan`, `atan2`
- Exponent / Log: `exp`, `exp2`, `log` (natural), `log2`, `log10`, `pow`
- Rounding / Sign: `floor`, `ceil`, `sign`, `rsqrt`
- Basic: `abs`, `sqrt`, `min`, `max`, `fmod`
- Utilities: `fract`, `clamp`, `saturate`, `lerp`, `step`, `smoothstep`

Notes:
- `log` is natural logarithm (ln). Use `log2` / `log10` when required.
- `saturate(x)` is equivalent to `clamp(x, 0, 1)`.
- `lerp(a, b, t)` computes linear interpolation: `a + (b - a) * t`.
- Vector functions (e.g., `dot`, `cross`, `normalize`, `reflect`) are not implemented yet — request if needed.

## Polar Mode

A new UI toggle `Polar Mode` plots functions in polar coordinates. When enabled:

- The evaluator exposes `t` (angle in radians) and `x` (alias for `t`) to user scripts.
- Values produced by plotted variables are interpreted as radius `r` and are rendered at `(r*cos(t), r*sin(t))`.

Example:

- `r = sin(x) @` will draw a polar curve when `Polar Mode` is enabled (here `x` is treated as radians).

## 7. How to Debug / Toggle Verbose Output

- The codebase currently emits helpful debug logs for AST traversal and marker detection. To temporarily enable or disable verbose logs, edit `plotter.js` and look for `console.log` lines prefixed with `>>> [Plotter]`.

- Recommended workflow when diagnosing plotting issues:
    1. Open Developer Tools Console in your browser.
    2. Enter formulas in the input panel and click `Plot / Update`.
    3. Inspect `>>> [Plotter]` messages to see AST structure, detected markers, and which variables are chosen for drawing.

## 8. Next Steps / TODOs

- Consider adding a runtime toggle (UI checkbox) to enable verbose debugging without editing source files.
- Add unit tests for parser marker extraction and VM statelessness.

### 5.3 Error Handling
- Never let the application crash due to a syntax error in the function string.
- Wrap evaluation logic in `try-catch` blocks.
