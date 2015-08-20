'use strict';

var test = require('tape');
var BitField = require('./common').requireLib('bit_field');


test('bitfield', function(t){

    test('getting', function (t) {

        var bf = BitField.create();
        bf.set( 2, true );
        bf.set( 128, true );

        t.notOk( bf.get(0) );
        t.ok( bf.get(2) );

        t.ok( bf.get(128) );
        t.notOk( bf.get(9456) );

        t.end();
    });

    test('to binary string', function(t){
        var bf = BitField.create();
        bf.set(0,true);
        bf.set(5,true);
        t.isEqual( bf.toBinaryString(), '100001' );

        t.equals( BitField.create().toBinaryString(), '0' );
        t.end();
    });


    test('count the number of true values', function(t){
        var bf = BitField.create();
        
        t.equals( bf.count(), 0 );
        bf.set( 2, true );
        bf.set( 12, true );
        bf.set( 125, true );
        t.equals( bf.count(), 3 );

        t.end();
    });

    test('logicaly AND with another instance', function(t){
        var a = new BitField(),
            b = new BitField(),
            c = new BitField();

        a.set(10, true);
        a.set(11, false);
        a.set(12, true);
        a.set(13, false);

        b.set(10, true);
        b.set(11, true);
        b.set(12, false);
        b.set(13, false);

        a.and(c, b);
        t.equals( c.toString(), '10000000000');
        t.end();
    });

    test('AND', function(t){
        t.ok( BitField.and( 
            BitField.create(  '1000'),
            BitField.create(  '1000')
            ));
        t.ok( BitField.and( 
            BitField.create( '10000100000010000'),
            BitField.create( '10000100000010010')
            ));
        t.ok( BitField.and( 
            BitField.create(  '1001000'),
            BitField.create(  '1101011')
            ));
        t.notOk( BitField.and( 
            BitField.create(  '1101011'),
            BitField.create(  '1001000')
            ));
        t.notOk( BitField.and( 
            BitField.create( '01010'),
            BitField.create( '01100')
            ));
        t.notOk( BitField.and(
            BitField.create(      '11010'),
            BitField.create( '1000000010')
            ));
        t.end();
    });

    test('AND++', function(t){
        t.ok( BitField.and(
            BitField.create('10000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000'),
            BitField.create('10000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000000000000000000000010000000000000')
            // true
            ));
        t.end();
    });

    test('AAND', function(t){
        t.ok( BitField.aand( 
            BitField.create(  '1000'),
            BitField.create(  '1000')
            ));
        t.ok( BitField.aand( 
            BitField.create(  '1000'),
            BitField.create(  '1010')
            ));
        t.ok( BitField.aand( 
            BitField.create(  '1000'),
            BitField.create(  '1100')
            ));
        t.notOk( BitField.aand( 
            BitField.create(  '0110'),
            BitField.create(  '1001')
            ));
        t.notOk( BitField.aand( 
            BitField.create(  '0000'),
            BitField.create(  '0000')
            ));

        t.end();
    });

    test('AAND++', function(t){
        t.ok( BitField.aand(
            BitField.create('10000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000010000'),
            BitField.create(                                                                                                                                              '1000000000000000000000000000000010000')
            ));
        t.end();
    });

    test.skip('NOR', function(t){
        
        t.ok( BitField.nor( 
            BitField.create(  'all'),
            BitField.create(  '0')
            ));

        t.ok( BitField.nor( 
            BitField.create(  '1000'),
            BitField.create(  '0100')
            ));

        t.notOk( BitField.nor( 
            BitField.create(  '1000'),
            BitField.create(  '1000')
            ));

        t.notOk( BitField.nor( 
            BitField.create(  '1000'),
            BitField.create(  'all')
            ));

        t.end();
    })

    test('logically AND and return value indicating difference', function(t){
        var a = new BitField(),
            b = new BitField();

        a.set(4, true);
        a.set(6, true);

        t.notOk( a.and(null,b) );
        t.notOk( a.and(null,b,a) );
        

        b.set(4, true);
        b.set(6, true);
        b.set(8, true);
        // returns true because of a match
        t.ok( a.and(null,b) );
        b.set(4,false);
        // log.debug( a.toString() + ' ' + b.toString() );
        // 001010000
        // 101000000
        // true because a&b == 0
        t.ok( a.and(null,b) );
        // false because a&b != a
        t.notOk( a.and(null,b,a) );

        t.end();
    });

    test('equality', function(t){
        var a = new BitField(),
            b = new BitField();

        a.set(2000,true);
        a.set(16,true);
        b.set(16,true);

        t.notOk( a.equals(b) );
        a.set(2000,false);
        t.ok( a.equals(b) );
        t.end();
    });

    test('should set from a string',  function(t){
        var a = BitField.create(  '1000');
        var b = BitField.create('110100');
        t.notOk( a.and( null, b, a ) );
        t.end();
    });

    test('special mode all', function(t){
        var a = BitField.create('all');
        var b = BitField.create('all');

        t.ok( a.get(68434038716), 'will get true for all values' );

        t.equals( a.toString(), 'all' );

        // both are equal
        t.ok( a.equals(b), 'will equal another all bitfield' );

        // will AND fine
        b = BitField.create('0110010');
        t.ok( a.and(null,b), 'will always return true for an AN' );

        a.set( 23, true );
        t.equals( a.toString(), '100000000000000000000000', 'setting a value will revert it to normal' );

        // the countfield of an All bitfield will be max value
        a = BitField.create('all');
        t.equals( a.count(), Number.MAX_VALUE, 'will have a count of MAX_VALUE' );

        t.end();
    });

    test('setValues', function(t){
        var a = BitField.create();
        var values = [ 0, 22, 65, 129, 340, 1198 ];
        a.setValues( values, true );
        for( var ii=0;ii<values.length;ii++ ){
            t.ok( a.get(values[ii]) );
        }
        a.setValues( [22,129], false );
        t.notOk( a.get(22) );
        t.notOk( a.get(129) );
        t.end();
    });

    test('toValues', function(t){
        var a = BitField.create();
        var values = [ 1, 29, 96, 311, 432 ];
        for( var ii=0;ii<values.length;ii++ ){
            a.set( values[ii], true );
        }
        t.deepEqual( a.toValues(), values, 'should produce the same values' );
        t.end();
    });


    test('setting with another instance', t => {
        let a = BitField.create();
        a.setValues( [2, 6, 10], true );
        let b = BitField.create();
        b.setValues( [3,7,9], true );

        let c = BitField.create();
        c.set( a );
        c.set( b );

        t.deepEqual( c.toValues(), [2,3,6,7,9,10], 'equal');

        let d = BitField.create(c);
        t.deepEqual( d.toValues(), [2,3,6,7,9,10], 'equal');        

        t.end();
    });


    t.end();
});//*/

/*
describe('BitField', function(){

    it('should bibble', function(){
        var a = BitField.create('1110000');
        var b = BitField.create('0000000');
        a.and(null,b).should.be.false;
        a.and(null,b,a).should.be.false;
        // var c = BitField.create('010000');
    });

    var examples = [
        ['110100', 'and', '011000', '010000', true, false],
        ['110100', 'and', '011000', '010000', true, false]
    ]


    it('should pass the examples', function(){
        examples.forEach( function(ex){
            var t1, t2;
            var a = BitField.create(ex[0]);
            var b = BitField.create(ex[2]);
            var c = BitField.create(ex[3]);

            if( a[1] == 'and' ){
                t1 = a.and(c,b);
                t1.should.equal( ex[4] );
                t1 = a.and(c,b,a);
                t1.should.equal( ex[5] );
                c.toString().should.equal( ex[3] );
            }
        });
    });

    it('should wibble', function(){
        var a = BitField.create('110100');
        var b = BitField.create('011000');
        var c = BitField.create('010000');

        a.and(null,b).should.be.true;
        a.and(null,b,a).should.be.false;
    });

    it('should return a value indicating difference for and', function(){
        var a = new BitField(),
            b = new BitField(),
            r = new BitField();

        a.set(0, true);
        a.set(2, true);

        b.set(0, true);
        b.set(1, true);
        b.set(2, true);
        b.set(3, true);
        
        a.and(r,b).toString().should.equal('101');
        r.toString().should.equal('101');
    });

    it('should return a binary string', function(){
        var bf = BitField.create(32);

        bf.set(5, true);
        bf.set(6, true);
        bf.toBinaryString().should.equal('0000011');
    });

    
});//*/