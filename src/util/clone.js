

/**
 * 
 * @param {*} src 
 * @param {*} dst 
 * @param {*} options 
 */
export function cloneEntity( src, dst, options={} ){
    const registry = src.getRegistry();

    let ii,len;
    // const deleteMissing = options.delete;
    const fullCopy = options.full;

    if( !dstEntity ){
        dstEntity = srcEntity.clone();
        dstEntity.setRegistry(registry);
    }

    if( !dstEntity && !fullCopy ){
        return dstEntity;
    }

    const srcComponents = srcEntity.getComponents();

    for(ii=0,len=srcComponents.length;ii<len;ii++){
        dstEntity.addComponent( this.cloneComponent(srcComponents[ii]) );
    }

    return dstEntity;
}


/**
 * Produces a copy of a component
 */

/**
 * 
 */
export function cloneComponent( srcComponent, attrs, options ){
    const result = srcComponent.clone();
    // let result = new srcComponent.constructor(srcComponent.attributes);
    // result.setId( srcComponent.getId() );
    // result.id = srcComponent.id;
    result.name = srcComponent.name;
    result.setDefDetails(
        srcComponent.getDefId(),
        srcComponent.getUri(),
        srcComponent.getDefHash(),
        srcComponent.getDefName() );
    result.registry = this;
    if( attrs ){
        result.set( attrs, options );
    }
    return result;
}