/**
 * DOM binding system using MutationObserver
 */
const OBSERVER = new MutationObserver(handleMutations);
let ROOT_ELEMENT;

function handleMutations(mutations) {
    mutations.forEach(({ addedNodes }) => {
        addedNodes.forEach(node => {
            if (node.nodeType === 1) bindElement(node);
        });
    });
}

function bindElement(el) {
    if (el.hasAttribute('data-bind')) {
        const expr = el.getAttribute('data-bind');
        effect(() => {
            el.textContent = evalExpression(expr);
        });
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