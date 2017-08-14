
/**
 * A collection stores a set of objects keyed by the id attribute
 */
export default function Collection() {
    this.reset();
}

Object.assign(Collection.prototype, {

    /**
     * Adds an object to the collection. If an object with the same id
     * already exists in the collection, it is replaced.
     * 
     * @param {*} obj 
     */
    add(obj) {
        const existing = this._objectsById[obj.id];

        this._objectsById[obj.id] = obj;

        if (existing !== undefined) {
            // replace the existing object
            const index = this._indexOfObject[obj.id];
            this.models[index] = obj;
            return this;
        }

        this._indexOfObject[obj.id] = this.models.length;

        this.models.push(obj);

        return this;
    },

    /**
     * Removes an object from the collection
     * @param {*} obj 
     */
    remove(obj) {
        if (this._objectsById[obj.id] !== undefined) {
            const index = this._indexOfObject[obj.id];

            this.models.splice(index, 1);

            delete this._objectsById[obj.id];
            delete this._indexOfObject[obj.id];
        }

        this._reindex();

        return this;
    },

    _reindex() {
        let ii = 0;
        let len = this.models.length;
        for (ii = 0; ii < len; ii++) {
            let obj = this.models[ii];
            this._indexOfObject[obj.id] = ii;
        }
    },

    size() {
        return this.models.length;
    },

    reset() {
        this.models = [];
        this._objectsById = {};
        this._indexOfObject = [];
    }
});
