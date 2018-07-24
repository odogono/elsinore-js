export const TYPE_ERROR = 'err';

export function ElsinoreError(message, type = TYPE_ERROR, params) {
    this.name = 'ElsinoreError';
    this.params = params;
    this.type = type;

    captureStackTrace(this, this.constructor);
    if (message instanceof Error) {
        this.message = message.message;
    } else {
        this.message = message;
    }
}
ElsinoreError.prototype = Object.create(Error.prototype);
ElsinoreError.prototype.constructor = ElsinoreError;

export function InvalidEntityError(msg) {
    this.name = 'InvalidEntityError';
    this.message = msg;
}
InvalidEntityError.prototype = Object.create(ElsinoreError.prototype);
InvalidEntityError.prototype.constructor = InvalidEntityError;

export function EntityNotFoundError(entityID, message) {
    this.name = 'EntityNotFoundError';
    this.entityID = entityID;

    captureStackTrace(this, this.constructor);
    this.message = message || `entity ${entityID} not found`;
}
EntityNotFoundError.prototype = Object.create(ElsinoreError.prototype);
EntityNotFoundError.prototype.constructor = EntityNotFoundError;

export function ComponentDefNotFoundError(id, message) {
    this.name = 'ComponentDefNotFoundError';
    this.id = id;
    // this.stack = (new Error()).stack;
    captureStackTrace(this, this.constructor);
    this.message = message || `component def ${id} not found`;
}
ComponentDefNotFoundError.prototype = Object.create(ElsinoreError.prototype);
ComponentDefNotFoundError.prototype.constructor = ComponentDefNotFoundError;

export function ComponentNotFoundError(entityID, componentDefID, message) {
    this.name = 'ComponentNotFoundError';
    this.entityID = entityID;
    this.componentDefID = componentDefID;
    captureStackTrace(this, this.constructor);
    this.message =
        message || `component ${entityID}/${componentDefID} not found`;
}
ComponentNotFoundError.prototype = Object.create(ElsinoreError.prototype);
ComponentNotFoundError.prototype.constructor = ComponentNotFoundError;

/**
 * Error.captureStackTrace is not available in all
 * environments, so this function wraps an alternative
 *
 * @param {*} error
 * @param {*} constructor
 */
function captureStackTrace(error, constructor) {
    if (Error.captureStackTrace) {
        Error.captureStackTrace(error, constructor);
    } else {
        error.stack = new Error().stack;
    }
}
