import {
    argCounts,
    precendenceValues,
    ALL_FILTER,
    ANY_FILTER,
    NONE_FILTER,
    INCLUDE_FILTER,
    LEFT_PAREN,
    RIGHT_PAREN,
    AND,
    ALL,
    ANY,
    NONE,
    NOT,
    OR,
    ROOT,
    VALUE,
    EQUALS,
} from './index';
import { arrayFlatten } from '../util';

function precendence(operator) {
    let result;

    result = precendenceValues[operator];
    // console.log('precendence of', operator,'is', result);
    if (result !== undefined) {
        return result;
    }

    switch (operator) {
        case AND:
        case ALL:
        case ANY:
        case NOT:
        case OR:
            return 1;
        case VALUE:
            return 2;
        case EQUALS:
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
        case ALL:
        case ANY:
        case NONE:
            return 1;
        case ROOT:
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

        if (op === LEFT_PAREN) {
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
                if (slice[0] === VALUE) {
                    // note only happens with ALIAS_GET
                    // log.debug('overly flat ' + JSON.stringify([op].concat(slice)));
                    slice = [ slice ];
                }
                stack.push([ op ].concat(slice));
            }
        }
    }

    return stack;
}

function findMatchingRightParam(values, startIndex) {
    let ii, len, parenCount = 0;
    let result = [];

    for (ii = 0, len = values.length; ii < len; ii++) {
        if (values[ii] === LEFT_PAREN) {
            parenCount++;
        } else if (values[ii] === RIGHT_PAREN) {
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
    constructor(query) {
        this.query = query;
        this.valStack = [];
        this.opStack = [];
    }

    /**
     * takes the specified context and returns a new instance
     * of a DslContext if the passed context is not already a DslContext.
     */
    readContext(context) {
        // the context has to be a new instance of a DslContext,
        // so that it is possible to compose a query using subqueries
        if (context instanceof QueryBuilder) {
            let result = new DslContext(context.query);
            return result;
        }
        return context;
    }

    /**
     * 
     */
    value(val) {
        const context = this.readContext(this);
        context.pushVal(val, true);
        return context;
    }

    /**
     * 
     */
    root() {
        const context = this.readContext(this);
        context.pushOp(ROOT);
        return context;
    }

    and(val) {
        const context = this.readContext(this);
        context.pushVal(val, true, 'fromAnd');
        context.pushOp(AND);
        return context;
    }

    or(val) {
        this.pushVal(val, true);
        this.pushOp(OR);
        return this;
    }

    where(...clauses) {
        const context = this.readContext(this);

        if (clauses.length <= 0) {
            return context;
        }
        if (clauses.length === 1) {
            context.pushVal(clauses[0]);
        } else {
            clauses = _.reduce(clauses, (res, clause, i) => {
                res.push(clause.toArray());
                if (res.length > 1) {
                    res.push(AND);
                }
                return res;
            }, []);

            context.valStack = context.valStack.concat(_.flatten(clauses, true));
        }
        return context;
    }

    equals(val) {
        this.pushVal(val, true);
        this.pushOp(EQUALS);
        return this;
    }

    lessThan(val) {
        this.pushVal(val, true);
        this.pushOp(LESS_THAN);
        return this;
    }

    lessThanOrEqual(val) {
        this.pushVal(val, true);
        this.pushOp(LESS_THAN_OR_EQUAL);
        return this;
    }

    greaterThan(val) {
        this.pushVal(val, true);
        this.pushOp(GREATER_THAN);
        return this;
    }

    greaterThanOrEqual(val) {
        this.pushVal(val, true);
        this.pushOp(GREATER_THAN_OR_EQUAL);
        return this;
    }

    //
    // Filter Functions
    //
    /**
    *   The entities must have ALL of the specified components
    */
    all(componentIds, filterFn) {
        const context = this.readContext(this);
        context.pushOp(ALL_FILTER);
        context.pushVal(componentIds, true);
        if (filterFn) {
            context.pushVal(filterFn, true);
        }

        return context;
    }

    include(componentIds, filterFn) {
        const context = this.readContext(this);
        // context.pushOp( filterFn ? INCLUDE_FILTER : INCLUDE );
        context.pushOp(INCLUDE_FILTER);
        context.pushVal(componentIds, true);
        if (filterFn) {
            context.pushVal(filterFn, true);
        }
        return context;
    }

    /**
    *   Entities should have at least one of the specified components
    */
    any(componentIds, filterFn) {
        const context = this.readContext(this);
        // context.pushOp( filterFn ? ANY_FILTER : ANY );
        context.pushOp(ANY_FILTER);
        context.pushVal(componentIds, true);
        if (filterFn) {
            context.pushVal(filterFn, true);
        }
        return context;
    }

    /**
    *   entities will be excluded if the have any of the componentIds
    */
    none(componentIds, filterFn) {
        const context = this.readContext(this);
        context.pushOp(NONE_FILTER);
        context.pushVal(componentIds, true);
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

    pushVal(val, wrapInValueTuple, label = '') {
        const isQuery = val instanceof DslContext;

        if (wrapInValueTuple) {
            if (!isQuery) {
                val = [ VALUE, val ];
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
            return this.commands = rpnToTree(result);
        }

        return result;
    }
}

export default class QueryBuilder extends DslContext {
    constructor(query) {
        super(query);
    }

    and() {
        throw new Error('invalid function and');
    }
    or() {
        throw new Error('invalid function or');
    }
    where() {
        throw new Error('invalid function where');
    }
}
