/**
 * SSR Hydration system
 */
export function hydrate(root, state) {
    root.querySelectorAll('[data-bind]').forEach(el => {
        const expr = el.getAttribute('data-bind');
        el.textContent = evalExpression(expr, state);
    });
}

export function serialize(state) {
    return JSON.stringify(state, (_, value) => {
        return value instanceof Node ? undefined : value;
    });
}