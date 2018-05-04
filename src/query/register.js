
export let argCounts = {};
export let precendenceValues = {};
export let compileCommands = {};
export let commandFunctions = {};
export let compileHooks = [];

import { DslContext } from './dsl';

/**
 * Registers a query command extension
 */
export function register(token, command, dslObj, options = {}) {
    // if( commandFunctions[ name ] !== undefined ){
    //     throw new Error('already registered cmd ' + name );
    // }

    if (dslObj) {
        for (let name in dslObj) {
            DslContext.prototype[name] = dslObj[name];
        }
    }

    const argCount = options.argCount === void 0 ? 1 : options.argCount;

    if (!Array.isArray(token)) {
        token = [token];
    }

    token.forEach(name => {
        if (commandFunctions[name] !== undefined) {
            throw new Error('already registered cmd ' + name);
        }

        // if( options.debug ){ console.log('registering', name); }

        argCounts[name] = argCount;

        if (command) {
            commandFunctions[name] = command;
        }

        if (options.compile) {
            compileCommands[name] = options.compile;
        }
    });

    // return Query;
}