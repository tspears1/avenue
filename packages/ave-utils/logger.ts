/* eslint-disable no-console */
interface LogTypeConfig {
    badge: string;
    color: string;
    label: string;
    logLevel: 'debug' | 'error' | 'info' | 'time' | 'timeEnd' | 'warn';
}

const logTypes = {
    error: { badge: '✖', color: 'red', label: 'error', logLevel: 'error' },
    fatal: { badge: '✖', color: 'red', label: 'fatal', logLevel: 'error' },
    fav: { badge: '❤', color: 'fuchsia', label: 'favorite', logLevel: 'info' },
    info: {
        badge: 'ℹ',
        color: 'deepskyblue',
        label: 'info',
        logLevel: 'info',
    },
    star: { badge: '★', color: 'gold', label: 'star', logLevel: 'info' },
    success: {
        badge: '✔',
        color: 'mediumspringgreen',
        label: 'success',
        logLevel: 'info',
    },
    wait: {
        badge: '⏳',
        color: 'deepskyblue',
        label: 'waiting',
        logLevel: 'info',
    },
    warn: { badge: '△', color: 'coral', label: 'warning', logLevel: 'warn' },
    complete: {
        badge: '✔',
        color: 'cyan',
        label: 'complete',
        logLevel: 'info',
    },
    pending: {
        badge: '...',
        color: 'fuchsia',
        label: 'pending',
        logLevel: 'info',
    },
    note: { badge: '•', color: 'deepskyblue', label: 'note', logLevel: 'info' },
    start: {
        badge: '▶',
        color: 'mediumspringgreen',
        label: 'start',
        logLevel: 'info',
    },
    pause: { badge: '⏸', color: 'yellow', label: 'pause', logLevel: 'info' },
    finish: {
        badge: '⚑',
        color: 'deeppink',
        label: 'finish',
        logLevel: 'info',
    },
    debug: { badge: '⬤', color: 'red', label: 'debug', logLevel: 'debug' },
    await: {
        badge: '⏳',
        color: 'deepskyblue',
        label: 'awaiting',
        logLevel: 'info',
    },
    watch: {
        badge: '👀',
        color: 'yellow',
        label: 'watching',
        logLevel: 'info',
    },
    log: { badge: '▩', color: 'springgreen', label: 'log', logLevel: 'info' },
    time: {
        badge: '⚑',
        color: 'deepskyblue',
        label: 'time',
        logLevel: 'time',
    },
    timeEnd: {
        badge: '⚑',
        color: 'deepskyblue',
        label: 'time',
        logLevel: 'timeEnd',
    },
} as const satisfies Record<string, LogTypeConfig>;

type LogType = keyof typeof logTypes;
type LogMethod = (...args: unknown[]) => void;
type LoggerMethods = Record<LogType, LogMethod>;

interface LoggerOptions {
    scope?: string;
    disabled?: boolean;
}

/**
 * Formats arguments for logging.
 * Objects are stringified, others are left as-is.
 *
 * @param args Values to format.
 * @returns The formatted values.
 */
const formatArgs = (...args: unknown[]): string => {
    return args
        .map((arg) => {
            return typeof arg === 'object' && arg !== null
                ? JSON.stringify(arg, null, 2)
                : String(arg);
        })
        .join(' ');
};

const isBrowser = () =>
    typeof window !== 'undefined' && typeof window.document !== 'undefined';

class Logger {
    private readonly _scopeName: string;
    private readonly _disabled: boolean;

    constructor(options: LoggerOptions = {}) {
        this._scopeName = options.scope ?? '';
        this._disabled = options.disabled ?? false;

        (Object.keys(logTypes) as LogType[]).forEach((type) => {
            (this as unknown as LoggerMethods)[type] = (...args: unknown[]) => {
                if (this._disabled) {
                    return;
                }

                const { badge, color, label } = logTypes[type];
                const scope = this._scopeName ? `[${this._scopeName}]` : '';
                const labelStr = label ? `[${label}]` : '';
                const badgeStr = badge || '';

                if (isBrowser()) {
                    let logString = '';
                    const styles = [];

                    if (scope) {
                        logString += '%c' + scope;
                        styles.push('color:deeppink;font-weight:bold');
                    }
                    if (badgeStr) {
                        logString += ' %c' + badgeStr;
                        styles.push(`color:${color};font-weight:bold`);
                    }
                    if (labelStr) {
                        logString += ' %c' + labelStr;
                        styles.push(`color:${color};font-weight:bold`);
                    }
                    // Reset style for the message
                    logString += ' %c';
                    styles.push(''); // Reset to default

                    const logArgs = [logString, ...styles, ...args];

                    if (type === 'error' || type === 'fatal') {
                        console.error(...logArgs);
                    } else if (type === 'warn') {
                        console.warn(...logArgs);
                    } else if (type === 'debug') {
                        console.debug(...logArgs);
                    } else if (type === 'time') {
                        const label = [scope, badgeStr, labelStr, ...args]
                            .filter(Boolean)
                            .join(' ');
                        console.time(label);
                    } else if (type === 'timeEnd') {
                        const label = [scope, badgeStr, labelStr, ...args]
                            .filter(Boolean)
                            .join(' ');
                        console.timeEnd(label);
                    } else {
                        console.log(...logArgs);
                    }
                } else {
                    const output = [scope, badgeStr, labelStr].filter(Boolean);
                    if (type === 'error' || type === 'fatal') {
                        console.error(...output, ...args);
                    } else if (type === 'warn') {
                        console.warn(...output, ...args);
                    } else if (type === 'debug') {
                        console.debug(...output, ...args);
                    } else if (type === 'time') {
                        console.time(formatArgs(...output, ...args));
                    } else if (type === 'timeEnd') {
                        console.timeEnd(formatArgs(...output, ...args));
                    } else {
                        console.log(...output, ...args);
                    }
                }
            };
        });
    }
}

/**
 * @module echo
 * @description
 * Exports a logger instance scoped to 'AVENUE'.
 * Logging is disabled in production environments.
 */
const echo = new Logger({
    scope: 'AVENUE',
    disabled: false,
}) as Logger & LoggerMethods;

export { echo, Logger };
