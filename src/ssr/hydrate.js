import { evalExpression } from "../core/expression";

/**
 * Hydrates server-rendered DOM with reactive state bindings
 * @param {HTMLElement} root - Root element containing [data-bind] attributes
 * @param {Proxy} state - Reactive state object
*/
export function hydrate(root, state) {
    root.querySelectorAll('[data-bind]').forEach(el => {
        const expr = el.getAttribute('data-bind');
        el.textContent = evalExpression(expr, state);
    });
}

/**
 * Safely serializes reactive state for SSR/SSG
 * @param {Proxy} state - Reactive state to serialize
 * @returns {string} JSON string with DOM nodes removed
 * @note Filters out DOM nodes to prevent circular references
 */
export function serialize(state) {
    return JSON.stringify(state, (_, value) => {
        return value instanceof Node ? undefined : value;
    });
}