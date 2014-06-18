var test = require('blue-tape');
// var test = require('tape');
// var Common = require('./common');
var BitField = require('../lib/bit_field');


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