/**
 * Core reactive state management system using Proxies
 * Implements immutable array patterns for safe reactivity
 */
const STATE_TRACKER = new WeakMap();
let CURRENT_EFFECT = null;
const EFFECT_REGISTRY = new Set();
const methodWrapperCache = new WeakMap();
const NOTIFICATION_QUEUE = new Set();
let NOTIFICATION_FLUSH_PENDING = false;

/**
 * Handler methods for array mutations to maintain reactivity
 * @type {Object.<string, function>}
 * @private
 * * @description
 * Overrides native array methods to trigger reactivity:
 * - Tracks array length changes
 * - Wrapped methods still return expected values
*/
const arrayHandlers = {
    push: target => notify(target, 'length'),
    pop: target => notify(target, 'length'),
    splice: target => notify(target, 'length'),
    shift: target => {
        notify(target, 'length');
        notify(target, '0'); // First element changed
    },
    unshift: target => {
        const newLength = target.length;
        notify(target, 'length');
        // Notify all new indices
        for (let i = 0; i < newLength; i++) {
            notify(target, i.toString());
        }
    },
    reverse: target => {
        // Notify for all elements since positions changed
        for (let i = 0; i < target.length; i++) {
            notify(target, i.toString());
        }
    },
    sort: target => {
        // Notify for all elements since order changed
        for (let i = 0; i < target.length; i++) {
            notify(target, i.toString());
        }
    },
    copyWithin: target => {
        // Notify affected indices
        notify(target, 'length');
        // Note: This is conservative - could optimize by tracking ranges
        for (let i = 0; i < target.length; i++) {
            notify(target, i.toString());
        }
    },
    fill: target => {
        // Notify affected indices
        notify(target, 'length');
        // Conservative approach - could track fill range
        for (let i = 0; i < target.length; i++) {
            notify(target, i.toString());
        }
    },
    
    // Special cases for less common methods
    [Symbol.iterator]: () => {
        /* No reactivity needed for iteration */
        return Array.prototype[Symbol.iterator];
    }
};

/**
 * Fallback handler for custom array methods
 * @param {Array} target 
 * @param {string} method 
 * @param {Function} original 
 * @returns {Function}
 * @private
 */
function createArrayMethodWrapper(target, method, original) {
    if (!methodWrapperCache.has(target)) {
        methodWrapperCache.set(target, new Map());
    }
    
    const methodCache = methodWrapperCache.get(target);
    if (methodCache.has(method)) return methodCache.get(method);
    
    const wrapper = function(...args) {
        const prevLength = target.length;
        const result = original.apply(target, args);
        const newItems = args.length;

        // Enhanced notification logic
        switch(method) {
            case 'push':
                // Notify new indices and length
                for (let i = prevLength; i < target.length; i++) {
                    notify(target, i.toString());
                }
                notify(target, 'length');
                break;
                
            case 'unshift':
                // Notify all affected indices
                for (let i = 0; i < newItems; i++) { // New items
                    notify(target, i.toString());
                }
                for (let i = newItems; i < target.length; i++) { // Shifted items
                    notify(target, i.toString());
                }
                notify(target, 'length');
                break;
                
            case 'pop':
                notify(target, (target.length).toString()); // New length
                if (prevLength > 0) {
                    notify(target, (prevLength - 1).toString()); // Removed index
                }
                break;
                
            case 'shift':
                notify(target, 'length');
                for (let i = 0; i < target.length; i++) { // Shifted items
                    notify(target, i.toString());
                }
                if (prevLength > 0) {
                    notify(target, (prevLength - 1).toString()); // Removed index
                }
                break;
                
            case 'splice':
                // Handle removed and added items
                const start = args[0] ?? 0;
                const deleteCount = args[1] ?? 0;
                const added = args.slice(2);
                
                // Notify removed indices
                for (let i = start; i < start + deleteCount; i++) {
                    notify(target, i.toString());
                }
                
                // Notify added/affected indices
                for (let i = start; i < start + added.length; i++) {
                    notify(target, i.toString());
                }
                
                // Notify length change
                if (deleteCount !== added.length) {
                    notify(target, 'length');
                }
                break;
                
            default:
                // Conservative notification for unknown methods
                notify(target, 'length');
                for (let i = 0; i < target.length; i++) {
                    notify(target, i.toString());
                }
        }

        return result;
    };

    methodCache.set(method, wrapper);
    return wrapper;
}

/**
 * Notifies all effects tracking a specific property
 * @param {Object} target - Reactive object
 * @param {string|Symbol} key - Property that changed
 * @private
*/
function notify(target, key) {
    const deps = STATE_TRACKER.get(target)?.get(key);
    if (deps) {
        deps.forEach(effect => NOTIFICATION_QUEUE.add(effect));
    }
    
    if (!NOTIFICATION_FLUSH_PENDING) {
        NOTIFICATION_FLUSH_PENDING = true;
        queueMicrotask(() => {
            NOTIFICATION_QUEUE.forEach(effect => {
                try {
                    effect();
                } catch (e) {
                    console.error('Effect error:', e);
                }
            });
            NOTIFICATION_QUEUE.clear();
            NOTIFICATION_FLUSH_PENDING = false;
        });
    }
}

/**
 * Creates reactive Proxy wrapper around target object
 * @param {Object} target - Object to make reactive
 * @returns {Proxy} Reactive proxy
 * @private
 * @description
 * - Tracks property access during effect execution
 * - Wraps array methods to trigger reactivity
 * - Uses Reflect for default behavior
 */
function createProxy(target) {
    return new Proxy(target, {
        get(obj, key) {
            if (key === Symbol.unscopables) return undefined;
            if (CURRENT_EFFECT) track(obj, key);

            // Get the value first to handle arrays properly
            const value = Reflect.get(obj, key);

            // Handle array methods
            if (Array.isArray(obj)) {
                if (arrayHandlers[key]) {
                    return (...args) => {
                        const result = Array.prototype[key].apply(obj, args);
                        arrayHandlers[key](obj);
                        return result;
                    };
                }

                const originalMethod = obj[key];
                if (typeof originalMethod === 'function') {
                    return createArrayMethodWrapper(obj, key, originalMethod);
                }
            }

            // Recursively wrap nested objects
            if (value !== null && typeof value === 'object') {
                return createProxy(value);
            }

            return value;
        },

        set(obj, key, value) {
            const oldValue = obj[key];
            
            // Handle nested objects
            if (value && typeof value === 'object') {
                value = createProxy(value);
            }
            
            const result = Reflect.set(obj, key, value);
            
            // Only notify if value actually changed
            if (result && oldValue !== value) {
                notify(obj, key);
            }
            return result;
        }
    });
}

/**
 * Tracks property access for effect dependencies
 * @param {Object} target - Reactive object
 * @param {string|Symbol} key - Accessed property
 * @private
 * @description
 * Maintains nested WeakMap structure:
 * STATE_TRACKER (WeakMap)
 *   -> target (Map)
 *     -> key (Set of effects)
 */
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
    const wrappedFn = () => {
        try {
            fn();
        } catch (e) {
            // Error handling
        }
    };
    
    EFFECT_REGISTRY.add(wrappedFn);
    CURRENT_EFFECT = wrappedFn;
    wrappedFn();
    CURRENT_EFFECT = null;
    
    return () => {
        EFFECT_REGISTRY.delete(wrappedFn);
        cleanup(wrappedFn);
    };
}

function cleanup(fn) {
    STATE_TRACKER.forEach(targetMap => {
        targetMap.forEach((_, key) => {
            targetMap.get(key)?.delete(fn);
        });
    });
}