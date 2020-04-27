import { assert } from 'chai';
import { createLog } from '../../src/util/log';
import { tokenize, tokenizeString } from '../../src/query/tokenizer';
import * as Tokenizer from '../../src/query/tokenizer';
import { create as createQuery, SType, addWords, pushValues, QueryStack, StackValue, InstResult, AsyncInstResult, push, pop, peek, pushRaw, findV, assertStackValueType } from '../../src/query/stack';
import { VL, valueOf } from '../../src/query/insts/value';
import { stringify } from '../../src/util/json';
import { create as createComponentDef, isComponentDef } from '../../src/component_def';
import { create as createEntitySet, isEntitySet, createEntity, EntitySet } from '../../src/entity_set';
import { isString } from '../../src/util/is';
import { register, createComponent } from '../../src/component_registry';
import { Entity, create as createEntityInstance, isEntity,
    addComponent as addComponentToEntity } from '../../src/entity';
import { isComponent, Component } from '../../src/component';


const Log = createLog('TestQuery');

const parse = (data) => tokenizeString( data, {returnValues:true} );
const sv = (v):StackValue => [SType.Value,v];

describe('Query', () => {

    it('executes an async word', async () => {
        let stack = createQuery();
        let data = parse('100 doubleit');
        const onDoubleIt = async (stack:QueryStack, v:StackValue):AsyncInstResult => {
            [stack,v] = pop(stack);
            let result = sv( v[1] * 2 );
            return Promise.resolve([stack,result]);
        }

        stack = addWords(stack, [ ['doubleit', onDoubleIt] ]);

        // let values;
        [stack] = await pushValues( stack, data );

        assert.deepEqual( stack.items[0], sv(200) );
    })

    it('parses', async () => {

        const data = parse('1.0.0 version == assert');

        let stack = createQuery();
        stack = addWords( stack, [
            ['version', onVersion],
            ['==', onEquals],
            ['assert', onAssert]
        ]);

        [stack] = await pushValues( stack, data );

        // Log.debug('stack', stack);
    });

    it('swaps the top two elements of the stack', async () => {
        let data = parse(`1 2 3 4 swap`);

        let stack = createQuery();
        stack = addWords( stack, [
            ['swap', onSwap, SType.Any, SType.Any ]
        ]);

        [stack] = await pushValues( stack, data );

        // Log.debug('stack', stack.items );

        assert.deepEqual(stack.items, [sv(1),sv(2),sv(4), sv(3)] );

    })

    it('builds arrays', async () => {
        const data = parse(`[ hello, world ]`);
            
        let stack = createQuery();
        stack = addWords( stack, [
            ['[', onArrayOpen],
        ]);

        [stack] = await pushValues( stack, data );
        // stack = addWord(stack, ']', onArrayClose );
        // Log.debug('stack', stringify(stack.items) );
    });

    it('adds to an array', async () => {
        const data = parse( `[] hello +`);
        
        let stack = createQuery();
        stack = addWords(stack, [
            ['[', onArrayOpen],
            // pattern match stack args
            ['+', onAddArray, SType.Array, SType.Any ],
            // important that this is after more specific case
            ['+', onAdd, SType.Value, SType.Value ],
        ]);

        [stack] = await pushValues( stack, data );
        // Log.debug('stack', stringify(stack.items) );
    })

    it('builds maps', async () => {
        const data = parse(`{ name: alex, age: 45, isActive }`);
            
        let stack = createQuery();
        stack = addWords( stack, [
            ['{', onMapOpen],
        ]);

        [stack] = await pushValues( stack, data );
        // stack = addWord(stack, ']', onArrayClose );
        // Log.debug('stack', stringify(stack.items,1) );

        assert.deepEqual( stack.items, [ 
            [SType.Map, {
                name: [SType.Value, 'alex'],
                age: [SType.Value, 45],
                isActive: [SType.Value, undefined],
            }] 
        ]);
    });

    it('defines a word', async () => {
        let data = parse(`1974 year define year`);
        let stack = createQuery();
        stack = addWords(stack, [
            ['[', onArrayOpen],
            ['+', onAdd, SType.Value, SType.Value ],
            [ 'define', onDefine ],
            [ 'cls', onClear ],
        ]);

        [stack] = await pushValues( stack, data );

        assert.deepEqual( stack.items, [ [SType.Value, 1974] ]);
        // Log.debug('stack', stringify(stack.items) );

        data = parse( 'cls [100, +] plus1k define');

        // Log.debug('data', stringify(data));

        [stack] = await pushValues( stack, data );

        data = [
            13, 'plus1k'
        ];

        [stack] = await pushValues( stack, data );

        assert.deepEqual( stack.items, [ [SType.Value, 113] ]);
    });

    it('creates a ComponentDef', async () => {
        let data = parse(`[ /component/title, text ] !d`);
        // let data = parse(`/component/title !d`);
        // Log.debug('data', stringify(data));

        let stack = createQuery();
        stack = addWords(stack, [
            ['[', onArrayOpen],
            ['+', onAdd, SType.Value, SType.Value ],
            [ 'cls', onClear ],
            [ '!d', onComponentDef, SType.Array ],
            [ '!d', onComponentDef, SType.Value ],
        ]);

        [stack] = await pushValues( stack, data );
        // Log.debug('stack', stringify(stack.items,1) );

        assert.ok( isComponentDef(stack.items[0][1]));
    })

    it('creates an EntitySet', async () => {
        let data = parse(`{} !es`);
        // Log.debug('data', stringify(data));

        let stack = createQuery();
        stack = addWords(stack, [
            ['{', onMapOpen],
            ['+', onAdd, SType.Value, SType.Value ],
            [ 'cls', onClear ],
            [ '!es', onEntitySet, SType.Map ],
        ]);

        [stack] = await pushValues( stack, data );
        // Log.debug('stack', stringify(stack.items,1) );

        assert.ok( isEntitySet(stack.items[0][1]));
    })

    it('adds a def to an EntitySet', async () => {
        let data = parse(`{} !es /component/text !d +`);
        // Log.debug('data', stringify(data));

        let stack = createQuery();
        stack = addWords(stack, [
            ['{', onMapOpen],
            ['+', onAdd, SType.Value, SType.Value ],
            ['+', onAddDefToES, SType.EntitySet, SType.ComponentDef ],
            [ 'cls', onClear ],
            [ '!d', onComponentDef, SType.Value ],
            [ '!es', onEntitySet, SType.Map ],
        ]);

        [stack] = await pushValues( stack, data );
        // Log.debug('stack', stringify(stack.items,1) );
        let es = stack.items[0][1];
        // Log.debug('es', es );

        assert.ok( isEntitySet(es));
    })

    it('creates a component', async () => {
        let data = parse(`[ /component/title { text:introduction } ] !c` );

        let stack = createQuery();
        let es = createEntitySet();
        let def;
        [es,def] = register( es, {uri:"/component/title", properties:[ "text" ]} );

        [stack] = await push(stack, [SType.EntitySet, es]);

        // Log.debug('data', stringify(data));
        stack = addWords(stack, [
            ['[', onArrayOpen],
            ['{', onMapOpen],
            ['!c', onComponent, SType.Array ],
        ]);

        [stack] = await pushValues( stack, data );
        // Log.debug('stack', stringify(stack.items,1) );
        // Log.debug('stack', stack.items );

        assert.ok( isComponent(stack.items[1][1]) );
    });


    it('creates an entity', async () => {
        let insts = parse(`100 !e`);
        
        let stack = createQuery();
        stack = addWords(stack, [
            ['!e', onEntity, SType.Value]
        ]);

        [stack] = await pushValues(stack, insts);
        // Log.debug('stack', stringify(stack.items,2) );

        assert.ok( isEntity(stack.items[0][1]) );
    });

    it.only('adds a component to an entity', async () => {
        let insts = parse(`
            []
            [ "/component/title", { "text":"get out of bed"} ] !c +
            [ "/component/completed", {"isComplete":true}] !c +
            [ "/component/priority", {"priority":10}] !c +
            0 !e swap +
        `);
        
        // Log.debug( insts );
        
        let stack = createQuery();
        [stack] = await buildEntitySet(stack);
        stack = addWords(stack, [
            ['swap', onSwap],
            ['[', onArrayOpen],
            ['{', onMapOpen],
            ['!e', onEntity],
            ['!c', onComponent, SType.Array ],
            ['+', onAddArray, SType.Array, SType.Any ],
            ['+', onAddComponentToEntity, SType.Entity, SType.Component ],
            ['+', onAddComponentToEntity, SType.Entity, SType.Array ],
        ]);

        [stack] = await pushValues(stack, insts);
        Log.debug('stack', stringify(stack.items,2) );
        let e = unpackStackValue(stack.items[1], SType.Entity);
        // Log.debug( 'e', e );

        assert.ok( isEntity(e) );
        assert.lengthOf( e.components, 3 );
    });


});

async function buildEntitySet(stack:QueryStack):Promise<[QueryStack,EntitySet]>{
    let es = createEntitySet();
    let def;
    [es,def] = register( es, 
        {uri:"/component/title", properties:[ "text" ]} );
    [es,def] = register( es, 
        {uri:"/component/completed", properties:[ {"name":"isComplete", "type":"boolean", "default":false} ]} );
    [es,def] = register( es, 
        {uri:"/component/priority", properties:[ {"name":"priority", "type":"integer", "default": 0} ]} );
    [stack] = await push(stack, [SType.EntitySet, es] );
    return [stack,es];
}

const onEntity = ( stack:QueryStack, val:StackValue ):InstResult => {
    let data:StackValue;
    [stack, data] = pop(stack);

    let eid = unpackStackValue(data, SType.Value);
    let e = createEntityInstance(eid);

    return [stack, [SType.Entity, e]];
}


const onComponent = ( stack:QueryStack, val:StackValue ):InstResult => {
    let data:StackValue;

    [stack,data] = pop(stack);
    let es = findV(stack, SType.EntitySet);

    if( es === undefined ){
        throw new Error('EntitySet not found on stack');
    }

    let raw = unpackStackValue(data, SType.Array);
    let [uri, attrs] = raw;

    // Log.debug('[onComponent]', uri, attrs );

    let com = createComponent(es, uri, attrs );
    // let def = createComponentDef( undefined, ...raw );

    return [stack, [SType.Component, com] ];
}

function unpackStackValue( val:StackValue, assertType:SType = SType.Any ){
    let [type,value] = val;
    if( assertType !== SType.Any && type !== assertType ){
        throw new Error(`expected type ${assertType}, got ${type}`);
    }
    if( type === SType.Array ){
        return value.map( av => unpackStackValue(av) );
    }
    if( type === SType.Map ){
        return Object.keys(value).reduce( (res,key) => {
            return {...res, [key]:unpackStackValue(value[key]) }
        },{});
    } else {
        return value;
    }
}

const onAddComponentToEntity = ( stack:QueryStack, val:StackValue ):InstResult => {
    let ev:StackValue, cv:StackValue;

    [stack, cv] = pop(stack);
    [stack, ev] = pop(stack);

    let e:Entity = unpackStackValue(ev, SType.Entity);
    let c:Component = unpackStackValue(cv, SType.Any);

    if( Array.isArray(c) ){
        e = c.reduce( (e,c) => addComponentToEntity(e,c), e );
    } else {
        e = addComponentToEntity( e, c);
    }
    // Log.debug('[onAddComponentToEntity]', c );

    return [stack, [SType.Entity, e]];
}



const onAddDefToES = ( stack:QueryStack, val:StackValue ):InstResult => {
    let def, es;
    [stack,[,def]] = pop(stack);
    [stack,[,es]] = pop(stack);

    [es, def] = register( es, def )

    return [stack, [SType.EntitySet, es] ];
}

const onEntitySet = ( stack:QueryStack, val:StackValue ):InstResult => {
    let data:StackValue;

    [stack,data] = pop(stack);

    let es = createEntitySet( data[1] );

    return [stack, [SType.EntitySet,es]];
}

const onComponentDef = ( stack:QueryStack, val:StackValue ):InstResult => {
    let data:StackValue;

    [stack,data] = pop(stack);

    let raw;
    if( data[0] === SType.Array ){
        raw = data[1].map( vals => vals[1] );
    } else if( data[0] === SType.Value && isString(data[1]) ){
        raw = [data[1]];
    }

    let def = createComponentDef( undefined, ...raw );

    return [stack, [SType.ComponentDef, def] ];
}


const onDefine = ( stack:QueryStack, val:StackValue ):InstResult => {
    let word:StackValue, value:StackValue;
    [stack,word] = pop(stack);
    [stack,value] = pop(stack);

    let wordFn = async (stack:QueryStack, val:StackValue):AsyncInstResult => {
        let wordVal = value[0] === SType.Array ? value[1] : [value];
        [stack] = await pushValues( stack, wordVal );
        return [stack];
    }

    stack = addWords(stack, [
        [ word[1], wordFn  ]
    ])

    return [stack];
};


const onAddArray = ( stack:QueryStack, val:StackValue ):InstResult => {
    let left,right;
    [stack,left] = pop(stack);
    [stack,right] = pop(stack);
    // left = peek(stack,1);
    // right = peek(stack,0);
    let [type,arr] = right;
    arr = [...arr, left];

    // Log.debug('[+Array]', left, right);
    return [stack, [type,arr] ];
}

const onAdd = ( stack:QueryStack, val:StackValue ):InstResult => {
    let lv,rv;

    [stack,lv] = pop(stack);
    [stack,rv] = pop(stack);

    let left = unpackStackValue(lv, SType.Value);
    let right = unpackStackValue(rv, SType.Value);

    let value = left + right;

    return [stack, [SType.Value, value]];
}

const onMapOpen = ( stack:QueryStack, val:StackValue ):InstResult => {
    let sub = createQuery();
    // add something which will interpret each push
    sub = addWords( sub, [
        ['{', onMapOpen],
        ['[', onArrayOpen],
        ['}', onMapClose],
    ]);
    (sub as any).stack = stack;
    return [sub];
}

const onMapClose = ( stack:QueryStack, val:StackValue ):InstResult => {
    let map = stack.items.reduce( (result,val,idx,array) => {
        if( idx % 2 === 0 ){
            let key = valueOf(val);
            let mval = array[idx+1];
            // console.log('key!', key, array);
            result[key] = mval === undefined ? [VL,undefined] : mval;
        }
        return result;
    }, {});
    val = [ SType.Map, map ];
    stack = (stack as any).stack;
    return [stack,val];
}

const onArrayOpen = ( stack:QueryStack, val:StackValue ):InstResult => {
    let sub = createQuery();
    sub.words = {...stack.words};
    sub = addWords( sub, [
        [']', onArrayClose],
    ]);
    (sub as any).stack = stack;
    return [sub];
}

const onArrayClose = ( stack:QueryStack, val:StackValue ):InstResult => {
    // Log.debug('[onArrayClose]', stack);
    val = [ SType.Array, stack.items ];
    stack = (stack as any).stack;
    return [stack,val];
}


const onSwap = ( stack:QueryStack, val:StackValue ):InstResult => {
    let left, right;
    [stack,left] = pop(stack); 
    [stack,right] = pop(stack);

    stack = pushRaw(stack, left);
    stack = pushRaw(stack, right);

    return [stack];
}

const onDrop = ( stack:QueryStack, val:StackValue ):InstResult => {
    [stack] = pop(stack);
    return [stack];
}


const onClear = (stack:QueryStack, val:StackValue):InstResult => {
    stack = {...stack, items:[]};
    // [stack,val] = push( stack, [SType.Value, '1.0.0'] );
    return [stack];
};

const onVersion = async (stack:QueryStack, val:StackValue):AsyncInstResult => {
    [stack,val] = await push( stack, [SType.Value, '1.0.0'] );
    return [stack, val, false];
};

const onEquals = (stack:QueryStack, val:StackValue):InstResult => {
    let left,right;
    [stack,left] = pop(stack);
    [stack,right] = pop(stack);

    let equal = compareValues( left, right );
    // Log.debug('[==]', left, right );

    return [stack,[VL,equal] ];
}

const onAssert = ( stack:QueryStack, val:StackValue ):InstResult => {
    // Log.debug('[assert]', val);
    [stack,val] = pop(stack);
    assert( val[1], `failed to assert value ${val}` );
    return [stack];
}


function compareValues( left:StackValue, right:StackValue ):boolean {
    if( !Array.isArray(left) || !Array.isArray(right) ){
        return false;
    }
    if( left[0] !== right[0] ){
        return false;
    }
    if( left[1] !== right[1] ){
        return false;
    }
    return true;
}
