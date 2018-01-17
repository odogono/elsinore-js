import arrayDifference from './array/difference';

/**
 * 
 * @param {*} src 
 * @param {*} dst 
 * @param {*} options 
 */
// export function cloneEntity( src, dst, options={} ){
//     const registry = src.getRegistry();

//     let ii,len;
//     // const deleteMissing = options.delete;
//     const fullCopy = options.full;

//     if( !dstEntity ){
//         dstEntity = srcEntity.clone();
//         dstEntity.setRegistry(registry);
//     }

//     if( !dstEntity && !fullCopy ){
//         return dstEntity;
//     }

//     const srcComponents = srcEntity.getComponents();

//     for(ii=0,len=srcComponents.length;ii<len;ii++){
//         dstEntity.addComponent( this.cloneComponent(srcComponents[ii]) );
//     }

//     return dstEntity;
// }



export function cloneEntity(srcEntity, dstEntity, options = {}) {
    const registry = srcEntity.getRegistry();
    let ii, len, component, srcComponent;
    const deleteMissing = options.delete;
    const returnChanged = options.returnChanged;
    const fullCopy = options.full;
    let dstHasChanged = false;

    if (!srcEntity) {
        return returnChanged ? [false, null] : null;
    }

    if (!dstEntity) {
        dstEntity = srcEntity.clone();
    }

    if (!dstEntity && !fullCopy) {
        return dstEntity;
    }

    if (deleteMissing) {
        const srcBitfield = srcEntity.getComponentBitfield();
        const dstBitfield = dstEntity.getComponentBitfield();
        const removeDefIds = arrayDifference(dstBitfield.toJSON(), srcBitfield.toJSON());
        for (ii = 0, len = removeDefIds.length; ii < len; ii++) {
            dstEntity.removeComponent(dstEntity.components[removeDefIds[ii]]);
            dstHasChanged = true;
        }
    }

    const srcComponents = srcEntity.getComponents();

    for (ii = 0, len = srcComponents.length; ii < len; ii++) {
        srcComponent = srcComponents[ii];
        component = dstEntity.components[srcComponent.getDefId()];

        if (component) {
            // the dst entity already has this component
            if (srcComponent.hash() == component.hash()) {
                continue;
            } else {
                dstHasChanged = true;
            }
        } else {
            dstHasChanged = true;
        }
        dstEntity.addComponent( cloneComponent(srcComponents[ii]) );
    }

    return returnChanged ? [dstEntity, dstHasChanged] : dstEntity;
}

/**
 * Produces a copy of a component
 */

/**
 * 
 */
export function cloneComponent(srcComponent, attrs, options) {
    const registry = srcComponent.getRegistry();
    // const result = srcComponent.clone();
    let result = Object.assign( Object.getPrototypeOf(srcComponent), srcComponent.toJSON() )
    // let result = new srcComponent.constructor(srcComponent.attributes);
    // result.setId( srcComponent.getId() );
    // result.id = srcComponent.id;
    result.name = srcComponent.name;
    result.setDefDetails(
        srcComponent.getDefId(),
        srcComponent.getUri(),
        srcComponent.getDefHash(),
        srcComponent.getDefName()
    );
    result.registry = registry;
    if (attrs) {
        result.set(attrs, options);
    }
    return result;
}
