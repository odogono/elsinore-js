import { EntitySet } from "../entity_set";
import { QueryStack } from "./stack";

export enum SType {
    Value = '%v',
    List = '%[]',
    Map = '%{}',
    Function = '%()',
    Bitfield = '%bf',
    Entity = '%e',
    EntitySet = '%es',
    Component = '%c',
    ComponentDef = '%d',
    ComponentAttr = '%ca',
    Regex = '%r',
    DateTime = '%dt',
    Any = '%*',
    Filter = '%|'
    // Undefined = '%un'
};



export interface InstDefMeta {
    op: string | string[];
}

export type InstResult = StackValue | undefined;

export type AsyncInstResult = Promise<InstResult>;

// export type Result = InstResult<QS>;
// export type AsyncResult = Promise<InstResult<QS>>;

export type StackValue = [SType] | [SType, any];

export type WordFn = SyncWordFn | AsyncWordFn;
export type SyncWordFn = (stack: QueryStack, val: StackValue) => InstResult;
export type AsyncWordFn = (stack: QueryStack, val: StackValue) => Promise<InstResult>;

export type WordSpec = [ string, WordFn|StackValue, ...(SType|string)[] ];
// export type WordSpec = [ (string|string[]), WordFn|StackValue, ...(SType|string)[] ];

export type WordEntry = [ WordFn, SType[] ];

export interface Words {
    [name: string]: WordEntry[]
}


export interface QueryStackDefs {
    [def: string]: StackValue;
}



export interface StackError {
    original?: any;
}
export class StackError extends Error {
    constructor(...args) {
        super(...args)
        Object.setPrototypeOf(this, StackError.prototype);
        // Log.debug('StackError!', args, this);
        // Maintains proper stack trace for where our error was thrown (only available on V8)
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, StackError)
        }
        this.name = 'StackError';
    }
}
