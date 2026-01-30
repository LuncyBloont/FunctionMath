# Visualization Markers & Plotting Logic

## Overview
The plotter supports a set of visual markers to control which variables are drawn and how they are styled. This allows users to calculate intermediate values without plotting them, and to distinguish multiple curves.

## Visual Markers

The markers are suffix annotations added after a variable assignment.

| Marker | Description | Example |
| :--- | :--- | :--- |
| `@` | **Draw**: Explicitly marks the variable to be plotted. | `y = x @` |
| `#hex` | **Color**: Sets the stroke color. Implicitly marks as **Draw**. | `y = x #f00` (Red) |
| `$` | **Guide**: Draws the line as a dashed guide (helper) line. | `y = x $` |

## Plotting Behavior Modes

The rendering engine operates in two distinct modes based on the presence of markers in the code.

### 1. Strict Mode (Explicit)
**Trigger**: The code contains **at least one** visual marker (`@`, `#`, or `$`).

**Behavior**:
*   **Only** variables with explicit markers are drawn.
*   Unmarked variables (even if named `y`) are treated as intermediate calculations and are **ignored**.
*   This allows for complex multi-step calculations without cluttering the graph.

**Example**:
```javascript
// Strict Mode triggered by @
temp = x * 2      // Not drawn
y1 = sin(temp) @  // Drawn in White (default)
y2 = cos(temp) #f00 // Drawn in Red
```

### 2. Fallback Mode (Implicit)
**Trigger**: The code contains **zero** visual markers.

**Behavior**:
*   The engine looks for a variable named `y`.
*   If found, it is drawn in **White**.
*   This ensures simple "hello world" style equations (`y = x`) work immediately without extra syntax.

**Example**:
```javascript
// Fallback Mode
y = x^2   // Drawn in White
```

## Parsing Logic
*   Markers can be chained (though usually one is sufficient).
*   Markers are parsed part of the `Assignment` node in the AST.
*   The plotter analyzes the AST before execution to build a `plotConfig` map.
*   **Note**: The AST analyzer recursively checks `ExpressionStatement` nodes to find assignments nested within top-level statements.
