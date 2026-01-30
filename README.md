# FunctionMath

FunctionMath is a small JavaScript project that implements a math expression parser, compiler, evaluator, and a simple plotter UI for visualizing functions.

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

**Tests**
- Run the npm test script:

```
npm test
```

This runs the project's test runner as configured in `package.json`.

As an alternative you can run the tests directly with node:

```
node tests/run_all_tests.mjs
```

**Project Layout (high level)**
- `js/` — front-end scripts and plotter
- `parser/` — lexer, parser, evaluator, VM and compiler
- `tests/` — test suites and runners
- `server.py` — optional local server for development

**Contributing**
PRs welcome — please open issues for bugs or feature requests.
