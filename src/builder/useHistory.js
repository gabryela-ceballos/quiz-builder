// useHistory.js — useState with undo/redo. Rapid consecutive edits (typing) are merged into one history entry.
import { useReducer, useCallback } from 'react';

const LIMIT = 100;
const MERGE_MS = 700;

function reducer(state, action) {
    switch (action.type) {
        case 'set': {
            const next = typeof action.value === 'function' ? action.value(state.present) : action.value;
            if (next === state.present) return state;
            const now = Date.now();
            const merge = !action.checkpoint && now - state.lastAt < MERGE_MS && state.past.length > 0;
            return {
                past: merge ? state.past : [...state.past.slice(-LIMIT + 1), state.present],
                present: next,
                future: [],
                lastAt: now,
                version: state.version + 1,
            };
        }
        case 'undo': {
            if (!state.past.length) return state;
            return { past: state.past.slice(0, -1), present: state.past[state.past.length - 1], future: [state.present, ...state.future], lastAt: 0, version: state.version + 1 };
        }
        case 'redo': {
            if (!state.future.length) return state;
            return { past: [...state.past, state.present], present: state.future[0], future: state.future.slice(1), lastAt: 0, version: state.version + 1 };
        }
        case 'clear':
            return { ...state, past: [], future: [], lastAt: 0 };
        case 'reset':
            return { past: [], present: action.value, future: [], lastAt: 0, version: state.version + 1 };
        default:
            return state;
    }
}

export default function useHistory(initial) {
    const [state, dispatch] = useReducer(reducer, { past: [], present: initial, future: [], lastAt: 0, version: 0 });
    const set = useCallback((value, opts = {}) => dispatch({ type: 'set', value, checkpoint: opts.checkpoint }), []);
    const undo = useCallback(() => dispatch({ type: 'undo' }), []);
    const redo = useCallback(() => dispatch({ type: 'redo' }), []);
    const reset = useCallback(value => dispatch({ type: 'reset', value }), []);
    const clear = useCallback(() => dispatch({ type: 'clear' }), []);
    return [state.present, set, { undo, redo, reset, clear, canUndo: state.past.length > 0, canRedo: state.future.length > 0, version: state.version }];
}
