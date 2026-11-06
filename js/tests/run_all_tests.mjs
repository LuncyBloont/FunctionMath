import { runParserTests } from './parser_tests.mjs';
import { runEvaluatorTests } from './evaluator_tests.mjs';
import { runControlFlowTests } from './control_flow_tests.mjs';
import { runErrorTests } from './error_tests.mjs';
import { runUndefinedInputTests } from './undefined_tests.mjs';
import { runEdgeCaseTests } from './edge_cases_tests.mjs';
import { runPlotterTests } from './plotter_tests.mjs';

(async () => {
    try {
        console.log('Running parser tests...');
        await runParserTests();

        console.log('\nRunning evaluator tests...');
        await runEvaluatorTests();

        console.log('\nRunning control flow tests...');
        await runControlFlowTests();

        console.log('\nRunning error handling tests...');
        await runErrorTests();

        console.log('\nRunning undefined input tests...');
        await runUndefinedInputTests();

        console.log('\nRunning edge case tests...');
        await runEdgeCaseTests();

        console.log('\nRunning plotter tests...');
        await runPlotterTests();

        console.log('\nAll module tests passed.');
        process.exit(0);
    } catch (e) {
        console.error('\nOne or more tests failed:', e.message || e);
        process.exit(1);
    }
})();
