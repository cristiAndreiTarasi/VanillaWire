import { evalExpression } from "../core/expression";

/**
 * DOM binding system using MutationObserver
 */
const OBSERVER = new MutationObserver(handleMutations);
let ROOT_ELEMENT;

/**
 * Handles DOM mutations and binds new elements with [data-bind] attributes
 * @param {MutationRecord[]} mutations - Array of DOM mutations
 * @private
 */
function handleMutations(mutations) {
    mutations.forEach(({ addedNodes }) => {
        addedNodes.forEach(node => {
            if (node.nodeType === 1) bindElement(node);
        });
    });
}

/**
 * Binds a single element to reactive state
 * @param {HTMLElement} el - Element with [data-bind] attribute
 * @private
*/
function bindElement(el) {
    try {
        if (el.hasAttribute('data-bind')) {
            const expr = el.getAttribute('data-bind');
            effect(() => {
                el.textContent = evalExpression(expr);
            });
        }
    } catch (e) {
        console.error('Binding failed for element:', el);
        if (typeof window.__ATOMIC_ERROR_HANDLER === 'function') {
            window.__ATOMIC_ERROR_HANDLER(e);
        }
    }
}

/**
 * Initialize DOM binding
 * @param {HTMLElement} root - Root element to observe
 */
export function bindDOM(root) {
    ROOT_ELEMENT = root;
    OBSERVER.observe(root, {
        childList: true,
        subtree: true
    });
    Array.from(root.querySelectorAll('[data-bind]')).forEach(bindElement);
}

/*
Remaining Limitations:

No error boundaries

Limited array change granularity

Basic SSR hydration only

No true DOM diffing



*/