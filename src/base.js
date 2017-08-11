import hash from './util/hash';
import stringify from './util/stringify';

export default function Base() {
    this.id = 0;
    this._registry = null;
}

Object.assign(Base.prototype, {
    getRegistry() {
        return this._registry;
    },

    setRegistry(r) {
        this._registry = r;
    },

    isEqual(other) {
        return this.hash() === other.hash();
    },

    hash(asString) {
        let result = this.toJSON();
        return hash(result, asString);
    },

    toJSON() {
        return {};
    },

    /**
     * Derived from https://github.com/allouis/minivents/blob/master/src/minivents.js
     * 
     * @param {*} type 
     * @param {*} func 
     * @param {*} ctx 
     */
    on(type, func, ctx) {
        if( this.events === undefined ){
            this.events = {};
            this.empty = [];
        }
        (this.events[type] = this.events[type] || []).push([func, ctx]);
        return this;
    },

    /**
     * 
     * @param {*} type 
     * @param {*} func 
     */
    off(type, func) {
        if( this.events === undefined ){ return this; }
        type || (this.events = {});
        let list = this.events[type] || this.empty,
            i = (list.length = func ? list.length : 0);
        while (i--) {
            func == list[i][0] && list.splice(i, 1);
        }
        return this;
    },

    /**
     * 
     * @param {*} type 
     */
    emit(type) {
        if( this.events === undefined ){ return this; }
        let e = this.events[type] || this.empty,
            list = e.length > 0 ? e.slice(0, e.length) : e,
            i = 0,
            j;
        while ((j = list[i++])) {
            j[0].apply(j[1], this.empty.slice.call(arguments, 1));
        }
        return this;
    }
});
