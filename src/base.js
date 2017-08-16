import hash from './util/hash';
import stringify from './util/stringify';
import uniqueId from './util/unique_id';
import Events from './util/events';

export default function Base() {
    this.id = 0;
    this._registry = null;
}

Object.assign(Base.prototype, Events, {
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
    }
});
