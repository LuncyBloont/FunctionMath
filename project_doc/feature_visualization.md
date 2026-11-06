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

`mark_x(value)` and `mark_y(value)` annotate visible solid curves at their
intersections with the requested Cartesian x or y coordinate. Labels show
`(x, y)` and dashed segments connect each point to the axes. Guide curves are
excluded. These functions work in Cartesian and polar modes; intersection
searches are numerical, so arbitrarily close or isolated intersections are not
guaranteed. See the README for sampling and marker limits.

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

## TODOs

- **显示光标处曲线函数值与虚线**: 支持在鼠标位置显示每根曲线对应的 x 或 t 的函数值（在图例或悬浮提示中）；在图上绘制一条与鼠标位置对应的垂直虚线以便参照。涉及文件：`js/plotter.js`（交互与渲染）、`js/plotter.js` 的 UI 层或浮层组件、（如需）`js/evaluator.js`。验收标准：悬停时显示每条曲线的数值并在图上绘制虚线。

- **异步更新函数值并缓存顶点**: 为每条曲线缓存其采样顶点数据；在进行平移/缩放/拖拽等交互时，使用异步任务（worker 或 requestAnimationFrame 分批）更新所有曲线的函数值以保持界面流畅。涉及文件：`js/plotter.js`（缓存与调度）、可能新增的 worker 文件或调度模块。验收标准：交互期间无卡顿，曲线顶点逐步异步刷新完成。
