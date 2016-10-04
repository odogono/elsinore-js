export const TYPE_ERROR = 'err';

export function ElsinoreError( message, type=TYPE_ERROR, params ){
    if( message instanceof Error ){
        this.message = message.message;
        this.stack = message.stack || message.stackTrace || '';
    } else {
        this.message = message;
        this.stack = (new Error().stack);
    }
    this.name = 'ElsinoreError';
    this.params = params;
    this.type = type;
};
ElsinoreError.prototype = Object.create(Error.prototype);
ElsinoreError.prototype.constructor = ElsinoreError;



export function InvalidEntityError(msg){
    this.name = 'InvalidEntityError';
    this.message = msg;
}
InvalidEntityError.prototype = Object.create(ElsinoreError.prototype);
InvalidEntityError.prototype.constructor = InvalidEntityError;


export function EntityNotFoundError(entityId){
    this.name = 'EntityNotFoundError';
    this.entityId = entityId;
    // this.stack = (new Error()).stack;
    Error.captureStackTrace(this, this.constructor);
    this.message = `entity ${entityId} not found`;
}
EntityNotFoundError.prototype = Object.create(ElsinoreError.prototype);
EntityNotFoundError.prototype.constructor = EntityNotFoundError;


export function ComponentDefNotFoundError(id){
    this.name = 'ComponentDefNotFoundError';
    this.id = id;
    // this.stack = (new Error()).stack;
    Error.captureStackTrace(this, this.constructor);
    this.message = `component def ${id} not found`;
}
ComponentDefNotFoundError.prototype = Object.create(ElsinoreError.prototype);
ComponentDefNotFoundError.prototype.constructor = ComponentDefNotFoundError;