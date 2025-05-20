/**
 * Safely evaluates binding expressions
 * @param {string} expr - Expression to evaluate
 * @param {Object} state - Reactive state
 * @returns {any} Evaluated result
 * @throws {Error} On invalid expressions
 */
export function evalExpression(expr, state) {
    try {
        return new Function('state', `"use strict"; return ${expr}`)(state);
    } catch (e) {
        console.error(`Expression error: ${expr}`, e);
        throw new Error(`Invalid binding expression: ${expr}`);
    }
}