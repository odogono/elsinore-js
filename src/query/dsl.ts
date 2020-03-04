import {
    EntityFilterType,
    QueryOp,
} from '../types';

import { EntityFilter } from '../entity_filter';
// import { argCounts, precendenceValues } from './dsl';
import { Query } from './index';
import { arrayFlatten } from '../util/array/flatten';

export let argCounts = {};
export let precendenceValues = {};
export let compileCommands = {};
export let commandFunctions = {};
// export let compileHooks = [];



function precendence(operator) {
    let result;

    result = precendenceValues[operator];
    // console.log('precendence of', operator,'is', result);
    if (result !== undefined) {
        return result;
    }

    switch (operator) {
        case QueryOp.And:
        case EntityFilterType.All:
        case EntityFilterType.Any:
        case QueryOp.Not:
        case QueryOp.Or:
            return 1;
        case QueryOp.Value:
            return 2;
        case QueryOp.Equals:
        default:
            return -1;
    }
}

/**
 *
 */
function argCount(operator) {
    let result;

    result = argCounts[operator];
    if (result !== undefined) {
        return result;
    }

    switch (operator) {
        case EntityFilterType.All:
        return 2;
        case EntityFilterType.Any:
        case EntityFilterType.None:
            return 1;
        case QueryOp.Root:
        default:
            return 2;
    }
}

/**
 *   Converts an RPN expression into an AST
 */
function rpnToTree(values) {
    let ii, len, op, stack, slice, count;

    stack = [];
    // result = [];
    for (ii = 0, len = values.length; ii < len; ii++) {
        op = values[ii];

        if (op === QueryOp.LeftParen) {
            // cut out this sub and convert it to a tree
            slice = findMatchingRightParam(values, ii);

            if (!slice || slice.length === 0) {
                throw new Error('mismatch parentheses');
            }

            ii += slice.length + 1;

            // evaluate this sub command before pushing it to the stack
            slice = rpnToTree(slice);

            stack.push(slice);
        } else {
            if (Array.isArray(op)) {
                stack.push(op);
            } else {
                // figure out how many arguments to take from the stack
                count = argCount(op);

                slice = stack.splice(stack.length - count, count);

                if (Array.isArray(slice) && slice.length === 1) {
                    slice = arrayFlatten(slice, true);
                }

                // TODO: ugh, occasionally args will get flattened too much
                if (slice[0] === QueryOp.Value) {
                    // note only happens with ALIAS_GET
                    // log.debug('overly flat ' + JSON.stringify([op].concat(slice)));
                    slice = [slice];
                }
                stack.push([op].concat(slice));
            }
        }
    }

    return stack;
}

function findMatchingRightParam(values, startIndex) {
    let ii,
        len,
        parenCount = 0;
    let result = [];

    for (ii = 0, len = values.length; ii < len; ii++) {
        if (values[ii] === QueryOp.LeftParen) {
            parenCount++;
        } else if (values[ii] === QueryOp.RightParen) {
            parenCount--;
            if (parenCount === 0) {
                return result;
            }
        }
        if (ii > 0 && parenCount > 0) {
            result.push(values[ii]);
        }
    }
    return result;
}


export class DslContext {

    // query:Query;
    valStack: Array<any> = [];
    opStack: Array<any> = [];
    commands;

    constructor(query?){
        // this.query = query;
    }

    /**
     * takes the specified context and returns a new instance
     * of a DslContext if the passed context is not already a DslContext.
     */
    readContext(context: any) : DslContext{
        // the context has to be a new instance of a DslContext,
        // so that it is possible to compose a query using subqueries
        if (context instanceof QueryBuilder) {
            let result = new DslContext();
            return result;
        }
        return context;
    }

    /**
     *
     */
    value(val) : DslContext {
        const context = this.readContext(this);
        context.pushVal(val, true);
        return context;
    }

    attr(attr) {
        const context = this.readContext(this);
        context.pushVal(['AT', attr]);
        console.log('[attr]', JSON.stringify(context) )
        return context;
    }

    /**
     *
     */
    root() : DslContext {
        const context = this.readContext(this);
        context.pushOp(QueryOp.Root);
        return context;
    }

    and(val) : DslContext {
        const context = this.readContext(this);
        context.pushVal(val, true, 'fromAnd');
        context.pushOp(QueryOp.And);
        return context;
    }

    or(val) : DslContext {
        this.pushVal(val, true);
        this.pushOp(QueryOp.Or);
        return this;
    }

    where(...clauses) : DslContext {
        const context = this.readContext(this);
        // console.log('[where]', JSON.stringify(clauses) )

        if (clauses.length <= 0) {
            
        }
        if (clauses.length === 1) {
            context.pushVal(clauses[0]);
        } else {
            clauses = clauses.reduce(
                (res, clause, i) => {
                    res.push(clause.toArray());
                    if (res.length > 1) {
                        res.push(QueryOp.And);
                    }
                    return res;
                },
                []
            );

            
            context.valStack = context.valStack.concat( arrayFlatten(clauses, true) );
        }
        // console.log('[where]', JSON.stringify(context) )
        return context;
    }

    equals(val) : DslContext {
        this.pushVal(val, true);
        this.pushOp(QueryOp.Equals);
        // console.log('[equals]', JSON.stringify(this) )
        return this;
    }

    lessThan(val)  : DslContext {
        this.pushVal(val, true);
        this.pushOp( QueryOp.LessThan);
        return this;
    }

    lessThanOrEqual(val) : DslContext {
        this.pushVal(val, true);
        this.pushOp( QueryOp.LessThanOrEqual);
        return this;
    }

    greaterThan(val) : DslContext {
        this.pushVal(val, true);
        this.pushOp( QueryOp.GreaterThan );
        return this;
    }

    greaterThanOrEqual(val) : DslContext {
        this.pushVal(val, true);
        this.pushOp( QueryOp.GreaterThanOrEqual);
        return this;
    }

    //
    // Filter Functions
    //
    /**
     *   The entities must have ALL of the specified components
     */
    all(componentIDs, filterFn?) {
        const context = this.readContext(this);
        context.pushOp(EntityFilterType.All);
        context.pushVal(componentIDs, true);
        if (filterFn) {
            context.pushVal(filterFn, true);
        }

        // console.log('[all]', JSON.stringify(context) )
        return context;
    }

    include(componentIDs, filterFn) {
        const context = this.readContext(this);
        // context.pushOp( filterFn ? INCLUDE_FILTER : INCLUDE );
        context.pushOp(EntityFilterType.Include);
        context.pushVal(componentIDs, true);
        if (filterFn) {
            context.pushVal(filterFn, true);
        }
        return context;
    }

    /**
     *   Entities should have at least one of the specified components
     */
    any(componentIDs, filterFn) {
        const context = this.readContext(this);
        // context.pushOp( filterFn ? ANY_FILTER : ANY );
        context.pushOp(EntityFilterType.Any);
        context.pushVal(componentIDs, true);
        if (filterFn) {
            context.pushVal(filterFn, true);
        }
        return context;
    }

    /**
     *   entities will be excluded if the have any of the componentIDs
     */
    none(componentIDs, filterFn) {
        const context = this.readContext(this);
        context.pushOp(EntityFilterType.None);
        context.pushVal(componentIDs, true);
        if (filterFn) {
            context.pushVal(filterFn, true);
        }
        return context;
    }

    popVal() {
        let val = this.valStack.shift();
        if (val && val.isQuery) {
            return val.toArray();
        }
        return val;
    }

    peekVal() {
        return this.valStack[0];
    }

    lastOp() {
        return this.opStack[this.opStack.length - 1];
    }

    popOp() {
        return this.opStack.pop();
    }

    pushOp(op) {
        const lastOp = this.lastOp();
        while (this.opStack.length > 0 && precendence(op) <= precendence(lastOp)) {
            this.pushVal(this.popOp());
        }
        this.opStack.push(op);
    }


    pushVal(val, wrapInValueTuple?:boolean, label:string = '') {
        const isQuery = val instanceof DslContext;

        if (wrapInValueTuple) {
            if (!isQuery) {
                val = [QueryOp.Value, val];
            }
        }

        // log.debug(`>pushVal ${label} : ${JSON.stringify(val)}`);
        if (val && isQuery) {
            this.valStack = this.valStack.concat(val.toArray());
        } else {
            this.valStack.push(val);
        }
        return this;
    }

    /**
     *
     */
    toArray(toTree = false) {
        let result;

        // console.log('QB.toArray op', this.opStack, 'val', this.valStack );
        // move reminaing ops
        while (this.opStack.length > 0) {
            this.pushVal(this.popOp());
        }

        // console.log('QB.toArray B val', this.valStack );
        result = this.valStack;

        if (toTree) {
            return (this.commands = rpnToTree(result));
        }

        return result;
    }
}

// export function QueryBuilder(query) {
//     DslContext.call(this,query);
//     // DslContext.prototype.initialize.call(this, query);
// }

// Object.assign(QueryBuilder.prototype, DslContext.prototype, {
//     and() {
//         throw new Error('invalid function and');
//     },
//     or() {
//         throw new Error('invalid function or');
//     },
//     where() {
//         throw new Error('invalid function where');
//     }
// });

export class QueryBuilder extends DslContext {
    constructor(query?) {
        super();
    }

    and(val:any) : QueryBuilder {
        throw new Error('invalid function and');
    }

    or() : QueryBuilder {
        throw new Error('invalid function or');
    }
    
    where() : QueryBuilder {
        throw new Error('invalid function where');
    }
}



/**
 * Registers a query command extension
 */
export function register(token, command, dslObj, options:any = {}) {
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