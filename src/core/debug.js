/**
 * Advanced debugging system with time travel
 */
const DEBUG_LOG = [];
let TIME_TRAVEL = null;

export const Debug = {
    /**
     * Start recording state changes
     */
    start() {
        TIME_TRAVEL = [];
    },

    /**
     * Record state mutation
     * @param {Object} details - Change details
     */
    record(details) {
        if (TIME_TRAVEL) {
            TIME_TRAVEL.push({
                timestamp: performance.now(),
                ...details
            });
        }
        DEBUG_LOG.push(details);
    },

    /**
     * Time travel to previous state
     * @param {number} steps - Steps to revert
     */
    revert(steps) {
        return TIME_TRAVEL.slice(-steps);
    },

    /**
     * Get dependency graph
     * @returns {Object} Current dependencies
     */
    inspect() {
        return STATE_TRACKER;
    }
};