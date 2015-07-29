function InvalidEntityError(msg){
    this.name = 'InvalidEntityError';
    this.message = msg;
}

function EntityNotFoundError(entityId){
    this.name = 'EntityNotFoundError';
    this.entityId = entityId;
    // this.stack = (new Error()).stack;
    Error.captureStackTrace(this, this.constructor);
    this.message = entityId;
}



function setup( errorFn ){
    errorFn.prototype = Object.create(Error.prototype);
    errorFn.prototype.constructor = errorFn;
    return errorFn;
}

module.exports = {
    InvalidEntityError: setup(InvalidEntityError),
    EntityNotFoundError: setup(EntityNotFoundError)
}