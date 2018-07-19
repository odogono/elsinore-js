import { arrayDifference } from './array/difference';


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


/**
 * 
 * @param {*} srcEntity 
 * @param {*} dstEntity 
 * @param {*} options 
 */
export function cloneEntity(srcEntity, dstEntity, options = {}) {
    // const registry = srcEntity.getRegistry();
    let ii, len, component, srcComponent;
    const deleteMissing = options.delete;
    const returnChanged = options.returnChanged;
    const fullCopy = options.full;
    const debug = !!options.debug;
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

        // if( debug ) console.log('[cloneEntity]', 'removeDefIds', removeDefIds, dstBitfield.toJSON(), srcBitfield.toJSON() );

        for (ii = 0, len = removeDefIds.length; ii < len; ii++) {
            dstEntity.removeComponent(dstEntity.components[removeDefIds[ii]]);
            dstHasChanged = true;
        }
    }

    const srcComponents = srcEntity.getComponents();

    for (ii = 0, len = srcComponents.length; ii < len; ii++) {
        srcComponent = srcComponents[ii];
        component = dstEntity.components[srcComponent.getDefId()];

        // if( debug ) console.log('[cloneEntity]', srcComponent.toJSON(), component.toJSON(), srcComponent.hash(),component.hash() );
        if (component) {
            // the dst entity already has this component
            if (srcComponent.hash() == component.hash()) {
                continue;
            }
        }

        dstHasChanged = true;
        const cloned = cloneComponent(srcComponent);
        // if( debug ) console.log('[cloneEntity]', 'add comp', cloned.toJSON() );
        dstEntity.addComponent( cloned, {debug:true} );
        // if( debug ) console.log('[cloneEntity]', 'dst', dstEntity.toJSON() );
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
    const result = srcComponent.clone();
    
    if (attrs) {
        result.set(attrs, options);
    }
    
    return result;
}
