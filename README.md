# FunctionMath

FunctionMath is a small JavaScript project that implements a math expression parser, compiler, evaluator, and a simple plotter UI for visualizing functions.

### Online use --> [GO](https://luncybloont.github.io/FunctionMath/)

**Requirements**
- Node.js (14+)
- (Optional) Python for the simple server (`server.py`)

**Install**
- Install dependencies (if any):

```
npm install
```

**Usage**
- Open the UI: open [index.html](index.html) in a browser.
- Run a local server (optional):

```
python server.py
```

Then open http://localhost:8000 in your browser if the server is started.

**Coordinate markers**

Add `mark_x(value)` or `mark_y(value)` to the script to mark intersections
of visible solid curves with the vertical or horizontal line, respectively:

```
y = sin(x) @
z = cos(x) #f00
guide = x $
mark_x(1)
mark_y(0)
```

Each visible intersection is labelled `(x, y)` with dashed projections to the
axes. Dashed guide curves are excluded. Both Cartesian and polar plots use
Cartesian coordinates for these markers; `mark_x` and `mark_y` each take one
finite number. Calls are evaluated as the script executes, so constants or
expressions independent of the sampled `x`/`t` are recommended. At most 100
distinct values per marker function are collected per draw; exceeding the
limit reports an error.

Horizontal intersections and polar intersections are found numerically in the
sampled domain. Closely spaced intersections or isolated points can be missed;
a curve coincident with the requested line has infinitely many intersections
and is represented by its sampled endpoints. Cartesian plots sample at one
pixel and add up to eight samples inside intervals touching invalid or
off-screen values. This improves boundary rendering but cannot guarantee
detection of arbitrarily narrow domains.

**Tests**
- Run the npm test script:

```
npm test
```

This runs the project's test runner as configured in `package.json`.

As an alternative you can run the tests directly with node:

```
node js/tests/run_all_tests.mjs
```

**Project Layout (high level)**
- `js/` — front-end scripts and plotter
- `js/parser/` — lexer, parser, evaluator, VM and compiler
- `js/tests/` — test suites and runners
- `server.py` — optional local server for development

**Contributing**
PRs welcome — please open issues for bugs or feature requests.
