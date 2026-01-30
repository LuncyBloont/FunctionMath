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

### HLSL Compatibility

Goal:尽可能兼容 HLSL 语法，以便在手工移除类型声明、未支持的函数与复杂流控制后，能够直接解析和运行小段 HLSL 代码。

- HLSL 语义差异示例：在 HLSL 中 `^` 是按位异或（bitwise XOR），**不是**幂运算。HLSL 中的幂使用内置函数 `pow(x, y)`。
- 建议：为了与 HLSL 保持一致，**将 `^` 视作按位异或**（并在需要时在 VM 中将数值转换为 32 位整数后进行 XOR 运算），并把幂运算保留为 `pow()` 函数调用。这样可以更可靠地解析 HLSL 片段并降低意外语义差异。
- 迁移/解析建议：当尝试直接解析 HLSL 代码片段时，手工或脚本化地做以下处理会提高兼容性：
    - 移除类型声明（如 `float`, `int` 等）和语义修饰符（`in`, `out`, `uniform` 等）。
    - 删除或替换引擎不支持的系统函数或 shader-specific 特性（如纹理采样函数），或把它们映射到等价的占位函数。
    - 将 HLSL 的幂写法（如果原代码使用 `^` 误作幂）改为显式 `pow(a,b)`。
    - 去除复杂的流控制或将其拆分为较小的片段以便逐句验证。

- 实现注意事项（如果采纳 `^` 为 XOR）：
    - 词法器 `^` token 应映射为 `XOR`（而非 `POWER`）。
    - 编译器需要生成 `XOR` 指令，VM 在执行时对操作数应用 32 位整数转换（例如 `a|0 ^ b|0`）再返回数值结果（以浮点形式或整数形式视需求）。
    - 文档与测试需更新以反映该语义，并提供示例（例如 `a = 5 ^ 2` 应得到 `7` 而非 `25`）。

- 如果保持当前实现（将 `^` 作为幂运算），请在文档中明确声明这一点并建议 HLSL 用户使用 `pow()` 来避免歧义。

我可以按你的偏好做两件事之一：
- 将引擎修改为 HLSL 风格（`^` → XOR，新增 `XOR` 指令并在 VM 中实现），并把相关测试和文档更新为一致；或
- 在文档中明确声明当前语法（`^` 为幂运算）并向 HLSL 用户提供迁移建议（推荐使用 `pow()`）。

请选择你更倾向的方案，我将实施对应变更并更新测试与文档。

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

## 6. Revision History

- 2026-01-30：完善视觉标记、严格/回退模式、VM状态管理、AST遍历修正等内容，详见 `project_doc/`.

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

Updated behavior (2026-01-30):

- Sampling: the plotter samples angles from `polarMin` to `polarMax` using `polarStep` as the user-visible sampling interval. The default `polarStep` is `0.01`. For performance the renderer may *coarsen* sampling (increase step) when the full interval would produce an excessive number of samples, but it will not automatically sample *finer* than the user-specified `polarStep`. This maintains the semantic meaning of the configured `t` interval while avoiding freezes on extremely large ranges.

- Continuity detection: the renderer no longer uses a pixel-distance heuristic to decide where to break paths. Continuity is determined by slope in the parameter direction:
    - Cartesian mode: use `|Δy/Δx|` to decide breaks (configurable threshold).
    - Polar mode: use normalized angular difference `dt` (wrapped to `[-π, π]`) and `|Δr/Δt|` to decide breaks (configurable threshold).
    - A small `eps` protects against division by very small `Δx`/`Δt`.

- UI / Controls: the control panel exposes per-line inputs for `Angle Min`, `Angle Max`, and `Angle Step` (polar). Additionally two numeric inputs let the user configure continuity thresholds:
    - `Continuity |Δy/Δx| Threshold` (used in Cartesian mode)
    - `Continuity |Δr/Δt| Threshold` (used in Polar mode)
    The Cartesian continuity control is shown only when Polar Mode is disabled; labels are associated with their inputs for accessibility and numeric fields are right-aligned.

- Pixel thresholds removed: the slope-based criteria are the primary determinant for path breaks. If visual tuning is required, adjust the continuity thresholds via the UI or reduce `polarStep` to increase sampling density in a region.

## 7. How to Debug / Toggle Verbose Output

- The codebase currently emits helpful debug logs for AST traversal and marker detection. To temporarily enable or disable verbose logs, edit `plotter.js` and look for `console.log` lines prefixed with `>>> [Plotter]`.

- Recommended workflow when diagnosing plotting issues:
    1. Open Developer Tools Console in your browser.
    2. Enter formulas in the input panel and click `Plot / Update`.
    3. Inspect `>>> [Plotter]` messages to see AST structure, detected markers, and which variables are chosen for drawing.

## 8. Next Steps / TODOs

- Consider adding a runtime toggle (UI checkbox) to enable verbose debugging without editing source files.
- Add unit tests for parser marker extraction and VM statelessness.

## 10. Tests

This repository includes a small test-suite for core engine modules (lexer, parser, compiler, evaluator/VM).

- Location: `js/tests/`
- Runner: `node js/tests/run_all_tests.mjs` (or `npm test` after installing node and running `npm test`)

Included tests:
- `run_tests.mjs` - numeric parsing tests (includes scientific notation checks).
- `parser_tests.mjs` - parser marker and AST checks.
- `evaluator_tests.mjs` - compile & execute correctness and VM statelessness checks.
- `control_flow_tests.mjs` - `if`/`else` and `for` loop behavior.
- `error_tests.mjs` - syntax error detection, unknown function runtime errors, undefined variable runtime errors.
- `undefined_tests.mjs` - explicit tests where user inputs / variables are undefined.

Notes:
- The project uses ESM modules; `package.json` sets `type: "module"` and provides a `test` script.
- Run all tests with:

```bash
node js/tests/run_all_tests.mjs
```

or

```bash
npm test
```

If you'd like, I can convert these into a proper test framework (`uvu`/`mocha`) and add CI integration.

### 5.3 Error Handling
- Never let the application crash due to a syntax error in the function string.
- Wrap evaluation logic in `try-catch` blocks.
