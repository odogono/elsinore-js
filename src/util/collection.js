
/**
 * A collection stores a set of objects keyed by the id attribute
 */
export default function Collection(models, options={}) {
    this.idAttribute = options.idAttribute || 'id';
    this.reset();
    if( models !== undefined ){
        this.add(models);
    }
}

Object.assign(Collection.prototype, {

    /**
     * Adds an object to the collection. If an object with the same id
     * already exists in the collection, it is replaced.
     * 
     * @param {*} obj 
     */
    add(obj) {
        if( !obj ){ return; }
        const idAttr = this.idAttribute;
        if( Array.isArray(obj) && obj[0] !== undefined ){
            obj.forEach( item => this.add(item) );
            return this;
        }
        const existing = this._objectsById[ obj[idAttr] ];

        this._objectsById[obj[idAttr]] = obj;

        if (existing !== undefined) {
            // replace the existing object
            const index = this._indexOfObject[obj[idAttr]];
            this.models[index] = obj;
            return this;
        }

        this._indexOfObject[obj[idAttr]] = this.models.length;

        this.models.push(obj);

        return this;
    },

    /**
     * Removes an object from the collection
     * @param {*} obj 
     */
    remove(obj) {
        const idAttr = this.idAttribute;
        if( Array.isArray(obj) && obj[0] !== undefined ){
            obj.forEach( item => this.remove(item) );
            return this;
        }
        if (this._objectsById[obj[idAttr]] !== undefined) {
            const index = this._indexOfObject[obj[idAttr]];

            this.models.splice(index, 1);

            delete this._objectsById[obj[idAttr]];
            delete this._indexOfObject[obj[idAttr]];
        }

        this._reindex();

        return this;
    },

    at( index ){
        return this.models[ index ];
    },

    /**
     * Returns an object by its id
     *  
     * @param {*} id 
     */
    get( id ){
        return this._objectsById[String(id)];
    },

    /**
     * Returns true if the object is contained in this collection
     * 
     * @param {*} obj 
     */
    has( obj ){
        return this._objectsById[obj[this.idAttribute]] !== undefined;
    },

    _reindex() {
        let ii = 0;
        let len = this.models.length;
        for (ii = 0; ii < len; ii++) {
            let obj = this.models[ii];
            this._indexOfObject[obj[this.idAttribute]] = ii;
        }
    },

    size() {
        return this.models.length;
    },

    reset() {
        this.models = [];
        this._objectsById = {};
        this._indexOfObject = [];
    },

    /**
     * 
     * @param {*} fn 
     */
    map( fn ){
        return this.models.map(fn);
    },

    reduce( fn, initialValue ){
        return this.models.reduce( fn, initialValue );
    },

    toJSON(){
        return this.models;
    }
});

Collection.prototype.type = 'Collection';