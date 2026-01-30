# Technical Issues Log

## 2026-01-29

### Issue 1: State Persistence ("Ghost Lines")
**Symptom**: 
*   When clicking "Plot" multiple times, old variables remained in memory.
*   This caused previous graphs to persist or horizontal "ghost lines" to appear where constants from previous runs conflicted with new variables.

**Root Cause**: 
The `VM` (Virtual Machine) instance and its `globals` map were reused across execution runs without being cleared.

**Resolution**: 
*   Added `reset()` method to `VM` class to clear the stack and global variables.
*   Added `reset()` method to `Evaluator` class.
*   Updated `Plotter.setFunction(ast)` to call `this.evaluator.reset()` before compiling the new AST.

---

### Issue 2: Partial Plotting ("Only First Line Drawn")
**Symptom**:
*   In multi-line scripts, only the variable on the first line was appearing on the graph, even if subsequent lines had markers.

**Root Cause**:
*   **AST Traversal Failure**: The `_analyzeAST` function used to build the plot configuration was not correctly traversing the AST.
*   The Parser wraps assignments (e.g., `y=x`) inside `ExpressionStatement` nodes.
*   The analyzer only checked for top-level `Assignment` nodes and ignored `ExpressionStatement`, causing it to miss nested markers.
*   This omission caused the `plotConfig` to be empty, triggering **Fallback Mode** (only draw `y`). If the first line was `y=...`, it drew; later lines were ignored.

**Resolution**:
*   Updated `_analyzeAST` in `js/plotter.js` to recursively unwrap `ExpressionStatement` nodes and analyze their inner expressions.

---

### Issue 3: Plotter Reference Design Alignment
**Observation**:
*   Project structure largely aligns with `project.md`.
*   **Deviation**: `js/parser/math_ops.js` is missing; math functions are currently implemented directly in `vm.js` builtins.
*   **Decision**: Accepted current state as valid for now.
*   **Deviation**: Rendering loop is event-driven (`mousemove`) rather than `requestAnimationFrame`. Accepted for current complexity level.
