/**
 * Core reactive state management system using Proxies
 * Implements immutable array patterns for safe reactivity
 */
const STATE_TRACKER = new WeakMap();
let CURRENT_EFFECT = null;

const arrayHandlers = {
    push: target => notify(target, 'length'),
    pop: target => notify(target, 'length'),
    splice: target => notify(target, 'length'),
  // Add all mutable array methods
};

function notify(target, key) {
    const deps = STATE_TRACKER.get(target)?.get(key);
    deps?.forEach(effect => effect());
}

function createProxy(target) {
    return new Proxy(target, {
        get(obj, key) {
            if (CURRENT_EFFECT) {
                track(obj, key);
            }
            
            // Return immutable array methods
            if (Array.isArray(obj) && arrayHandlers[key]) {
                return (...args) => {
                const result = Array.prototype[key].apply(obj, args);
                arrayHandlers[key](obj);
                return result;
                };
            }
            
            return Reflect.get(obj, key);
        },
        set(obj, key, value) {
            const result = Reflect.set(obj, key, value);
            notify(obj, key);
            return result;
        }
    });
}

function track(target, key) {
    let deps = STATE_TRACKER.get(target);
    if (!deps) STATE_TRACKER.set(target, (deps = new Map()));
    
    let keyDeps = deps.get(key);
    if (!keyDeps) deps.set(key, (keyDeps = new Set()));
    
    keyDeps.add(CURRENT_EFFECT);
}

/**
 * Creates reactive state container
 * @param {Object} initialState 
 * @returns {Proxy} Reactive state
 */
export function createState(initialState) {
    return createProxy(initialState);
}

/**
 * Creates reactive effect
 * @param {Function} fn - Effect callback
 * @returns {Function} Effect disposer
 */
export function effect(fn) {
    CURRENT_EFFECT = fn;
    fn();
    CURRENT_EFFECT = null;
    return () => cleanup(fn);
}