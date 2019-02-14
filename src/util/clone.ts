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


export interface Options {
    
    // remove components from dstEntity which are not present on the srcEntity
    delete?:boolean;

    returnChanged?:boolean;

    full?:boolean,

    debug?:boolean
}

export function copyEntity( srcEntity, dstEntity, options:Options = {}){

}

