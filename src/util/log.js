/* eslint no-console: "off" */

let logActive = true;

export function createLog(name, options = {}) {
    let fn = {};

    if (!logActive) {
        ['debug', 'info', 'log', 'warn', 'error'].forEach(l => (fn[l] = () => {}));
    } else {
        for (let m in console) {
            if (typeof console[m] == 'function') {
                fn[m] = (...args) => {
                    let format = '';

                    if (options.time) {
                        format += formatNow();
                    }

                    format += '[' + name + '] ';
                    console[m](`${format}[${m}]`, ...args);
                };
            }
        }
        // if (!fn.debug) {
        fn.debug = (...args) => {
            let format = '';

            if (options.time) {
                format += formatNow();
            }

            format += '[' + name + '] ';
            console.log(`${format}[debug]`, ...args);
        };
        // }
    }

    return fn;
}

export function setActive(isit = true) {
    logActive = isit;
}

function formatNow() {
    const date = new Date();
    return (
        '[' +
        date.getFullYear() +
        '-' +
        ('0' + (date.getMonth() + 1)).slice(-2) +
        '-' +
        ('0' + date.getDate()).slice(-2) +
        ' ' +
        ('0' + date.getHours()).slice(-2) +
        ':' +
        ('0' + date.getMinutes()).slice(-2) +
        ':' +
        ('0' + date.getSeconds()).slice(-2) +
        '] '
    );
}
