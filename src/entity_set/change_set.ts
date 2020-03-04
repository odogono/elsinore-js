export class ChangeSet<T> {
    added: Set<T>;
    updated: Set<T>;
    deleted: Set<T>;


    constructor(){
        this.added = new Set<T>();
        this.updated = new Set<T>();
        this.deleted = new Set<T>();
    }

    add( id:T ){
        this.added.add( id );
        this.updated.delete(id);
        this.deleted.delete(id);
    }

    update( id:T ){
        if( this.added.has(id) ){
            return;
        }
        this.added.delete( id );
        this.updated.add(id);
        this.deleted.delete(id);
    }

    delete( id:T ){
        this.added.delete( id );
        this.updated.delete(id);
        this.deleted.add(id);
    }
}