import _ from 'underscore';
import test from 'tape';
import {printE, printIns, initialiseRegistry, copyEntity} from '../common';

// import {copy as CopyEntity} from '../../src/util/uuid';


test('copies a blank entity', t => {
    return initialiseRegistry().then( registry => {
        
        // let src = registry.createEntity();
        let src = registry.createEntity([
            { '@c':'/component/position', x:2, y:-2 },
            { '@c':'/component/name', 'name':'alpha'}
        ]);

        let dst = copyEntity( registry, src );

        // change src to prove dst is independent
        src.Position.set({x:15});
        t.equals( dst.Position.get('x'), 2 );
    })
    .then( () => t.end() )
    .catch( err => log.error('test error: %s', err.stack) )
});

test('will retain dst components missing from the src by default', t => {
    return initialiseRegistry().then( registry => {
        
        let src = registry.createEntity([  {'@c':'/component/position', x:2, y:-2}  ]);
        let dst = registry.createEntity([  {'@c':'/component/name', 'name':'alpha'} ]);
        let copy = copyEntity( registry, src, dst );
        
        t.equals( copy.Position.get('y'), -2 );
        t.equals( copy.Name.get('name'), 'alpha');
    })
    .then( () => t.end() )
    .catch( err => log.error('test error: %s', err.stack) )
});

test('will remove components missing from the src', t => {
    return initialiseRegistry().then( registry => {
        
        let src = registry.createEntity([  {'@c':'/component/position', x:2, y:-2}  ]);
        let dst = registry.createEntity([  {'@c':'/component/name', 'name':'alpha'} ]);
        let copy = copyEntity( registry, src, dst, {delete:true} );
        
        t.equals( copy.Position.get('y'), -2 );
        t.ok( !copy.Name, 'the name component should be missing from the dst' );
    })
    .then( () => t.end() )
    .catch( err => log.error('test error: %s', err.stack) )
});



test('returns false if nothing changed', t => {
    return initialiseRegistry().then( registry => {
        
        // let src = registry.createEntity();
        let src = registry.createEntity([
            { '@c':'/component/position', x:2, y:-2 },
            { '@c':'/component/name', 'name':'alpha'}
        ]);

        let dst = registry.createEntity([
            { '@c':'/component/position', x:2, y:-2 },
            { '@c':'/component/name', 'name':'alpha'}
        ]);

        let [copy,hasChanged] = copyEntity( registry, src, dst, {returnChanged:true} );
        
        t.notOk( hasChanged, 'the src and dst entity were the same' );
        t.equals( copy.Name.get('name'), 'alpha' );
    })
    .then( () => t.end() )
    .catch( err => log.error('test error: %s', err.stack) )
});


test('returning whether anything was changed on the dst entity', t => {
    return initialiseRegistry().then( registry => {
        
        // let src = registry.createEntity();
        let src = registry.createEntity([
            { '@c':'/component/position', x:2, y:-2 },
            { '@c':'/component/name', 'name':'alpha'}
        ]);

        let dst = registry.createEntity([
            { '@c':'/component/position', x:2, y:-2 },
            { '@c':'/component/name', 'name':'beta'}
        ]);

        let [copy,hasChanged] = copyEntity( registry, src, dst, {returnChanged:true} );
        
        t.ok( hasChanged, 'the src and dst entity were different' );
        t.equals( copy.Name.get('name'), 'alpha' );
    })
    .then( () => t.end() )
    .catch( err => log.error('test error: %s', err.stack) )
});


test('a missing dst component counts as a change', t => {
    return initialiseRegistry().then( registry => {
        
        // let src = registry.createEntity();
        let src = registry.createEntity([
            { '@c':'/component/position', x:2, y:-2 },
        ]);

        let dst = registry.createEntity([
            { '@c':'/component/position', x:2, y:-2 },
            { '@c':'/component/name', 'name':'alpha'}
        ]);

        let [copy,hasChanged] = copyEntity( registry, src, dst, {delete:true,returnChanged:true} );
        t.ok( hasChanged, 'the src and dst entity were different' );
        // t.equals( copy.Name.get('name'), 'alpha' );
    })
    .then( () => t.end() )
    .catch( err => log.error('test error: %s', err.stack) )
});
