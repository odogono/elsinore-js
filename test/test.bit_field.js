var Common = require('./common');
var BitField = Elsinore.BitField;

describe('BitField', function(){

    it('should', function(){
        var bf = BitField.create();
        bf.set( 2, true );
        bf.set( 31, true );
        bf.get(0).should.be.false;
        bf.get(2).should.be.true;
        bf.get(31).should.be.true;
    });

    it('should return the number of values set to true', function(){
        var bf = BitField.create();
        bf.count().should.equal( 0 );
        bf.set( 2, true );
        bf.set( 12, true );
        bf.set( 31, true );
        bf.count().should.equal( 3 );
    });

    it('should and with another instance', function(){
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
        c.toHexString().should.equal('400');
    });

    it('should and and return a value indicating difference', function(){
        var a = new BitField(),
            b = new BitField();

        a.set(4, true);
        a.set(6, true);
        a.set(8, true);

        b.set(3, true);
        b.set(4, true);
        b.set(5, true);

        a.and(null,b).should.equal(16);

        b.set(4,false);
        a.and(null,b).should.equal(0);
    });

    it('should return a value indicating difference for and', function(){
        var a = new BitField(),
            b = new BitField();

        a.set(10, true);
        a.set(12, true);

        b.set(10, true);
        b.set(11, true);
        b.set(12, true);
        
        a.and(null,b).should.equal( a.value );
    });

    it('should return a hex string', function(){
        var bf = BitField.create(32);

        bf.set(5, true);
        bf.set(6, true);

        bf.toHexString().should.equal('60');
        bf.toBinaryString().should.equal('0000000000000000000000001100000');
    })
});