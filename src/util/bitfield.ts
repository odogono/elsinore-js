import { isObject } from "./is";


type ValueType = BitField | number | number[] | string;

export const TYPE_AND = 0;
export const TYPE_OR = 1;
export const TYPE_NOT = 2;


export interface BitField {
    isAllSet: boolean;
    type: number;
    values: number[];
}


export function create( values?:ValueType ){
    let result:BitField = {
        isAllSet: false,
        type: TYPE_AND,
        values: []
    }
    if( values !== undefined ){
        result = set( result, values, true );
    }
    return result;
}

export function isBitField(value:any):boolean { 
    return isObject(value) && 'values' in value;
}

/**
 * Returns a binary string representation of the BitField
 */
export function toString(bf:BitField): string {
    if (bf.isAllSet) {
        return 'all';
    }
    if (bf.values.length === 0) {
        return '0';
    }

    return toArray(bf)
        .map(val => (val ? '1' : '0'))
        .join('');
}

/**
 * Returns an array representation of each bit represented as a boolean
 */
export function toArray(bf:BitField) : boolean[] {
    if (bf.isAllSet) {
        return [];
    }
    const {values} = bf;
    let found: boolean = false;
    let result: boolean[] = [];

    for (let ii = values.length * 32 - 1; ii >= 0; ii--) {
        let v: boolean = get(bf, ii);

        // found ? result.push(v) : found = v;

        if (!found) {
            found = v;
        }
        if (found) {
            result.push(v);
        }
    }
    return result;
}

/**
 * Returns the number of bits set to true
 */
export function count(bf:BitField): number {
    if (bf.isAllSet) {
        return Number.MAX_VALUE;
    }
    if (bf.values.length === 0) {
        return 0;
    }

    let count: number = 0;
    const values = bf.values;

    for (let ii = 0, len = values.length; ii < len; ii++) {
        // See: http://bits.stephan-brumme.com/countBits.html for an explanation
        let x = values[ii];

        if (x === 0) {
            continue;
        }
        x = x - ((x >> 1) & 0x55555555);
        x = (x & 0x33333333) + ((x >> 2) & 0x33333333);
        x = x + (x >> 4);
        x &= 0xf0f0f0f;

        count += (x * 0x01010101) >> 24;
    }
    return count;
}

export function typeFn( a:BitField|number ){
    // todo - TYPE_NOT
    const type = isBitField(a) ? (a as BitField).type : a as number;
    return type === TYPE_AND ? and : or;
}

/**
 * Bitwise AND - returns false if one bit is true when the other is false
 */
export function and(a : BitField, b : BitField ) : boolean {
    if (a.isAllSet && b.isAllSet) {
        return true;
    }
    if (a.values.length === 0 && b.values.length === 0) {
        return false;
    }

    let avalues = a.values;
    let bvalues = b.values;

    for (let ii = 0, len = avalues.length; ii < len; ii++) {
        if (avalues[ii] === undefined) {
            continue;
        }
        if ((avalues[ii] & bvalues[ii]) !== avalues[ii]) {
            return false;
        }
    }
    return true;
};

/**
 * Bitwise OR - returns true if any matching bits are true
 * (previously aand)
 */
export function or(a : BitField, b : BitField) : boolean {
    if (a.isAllSet && b.isAllSet) {
        return true;
    }
    if (a.values.length === 0 && b.values.length === 0) {
        return false;
    }

    let avalues = a.values;
    let bvalues = b.values;
    let result : boolean = false;

    for (let ii = 0, len = avalues.length; ii < len; ii++) {
        if ((avalues[ii] & bvalues[ii]) !== 0) {
            return true;
        }
    }

    return result;
};

export function get(bf:BitField, index: number): boolean {
    if (bf.isAllSet) {
        return true;
    }
    let ii: number = (index / 32) | 0; // | 0 converts to an int. Math.floor works too.
    let bit: number = index % 32;
    return (bf.values[ii] & (1 << bit)) !== 0;
}

export function set( bf:BitField, index:ValueType, value:boolean = true ) {
    // let { values } = bf;
    // this.isAllSet = false;

    if( typeof index === 'number' ){
        let values = bf.values.slice();
        let partIndex: number = (index / 32) | 0;
        let bit: number = index % 32;

        if (value) {
            values[partIndex] |= 1 << bit;
        } else {
            values[partIndex] &= ~(1 << bit);
        }

        return {...bf, isAllSet:false, values};
    }
    
    else if( typeof index === 'string' ){
        if (index === 'all') {
            return {...bf, isAllSet:true};
        } else {
            let parts: string[] = index.split('');
            for (
                let ii = parts.length - 1, len = parts.length - 1;
                ii >= 0;
                ii--
            ) {
                bf = set(bf, len - ii, parts[ii] === '1');
            }
        }

        return bf;
    }
    else if (isBitField(index)) {
        return setValues( bf, toValues(index as BitField), true );
    }

    else if( Array.isArray(index) ){
        return setValues( bf, index, value );
    }


    return this;
}

export function setValues(bf:BitField, values: number[], value: boolean = true) {
    if( values === undefined ){
        return {...bf, isAllSet:value};
    }
    for (let ii = 0, len = values.length; ii < len; ii++) {
        bf = set(bf, values[ii], value );
    }
    return bf;
}

export function toValues(bf:BitField): number[] {
    let result: number[] = [];
    if( bf === undefined ){
        return result;
    }
    
    for (let ii = 0, len = bf.values.length * 32; ii < len; ii++) {
        if (get(bf, ii)) {
            result.push(ii);
        }
    }
    return result;
}