var Common = require('./common');
var BitField = Elsinore.BitField;

describe('BitField', function(){

    it('should', function(){
        var bf = BitField.create();
        bf.set( 2, true );
        bf.set( 128, true );
        bf.get(0).should.be.false;
        bf.get(2).should.be.true;
        bf.get(128).should.be.true;
        bf.get(9456).should.be.false;
    });

    it('should print a binary string', function(){
        var bf = BitField.create();
        bf.set(0,true);
        bf.set(5,true);
        bf.toString().should.equal('100001')
    });

    it('should return the number of values set to true', function(){
        var bf = BitField.create();
        bf.count().should.equal( 0 );
        bf.set( 2, true );
        bf.set( 12, true );
        bf.set( 125, true );
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
        c.toString().should.equal('10000000000');
    });

    it('should and and return a value indicating difference', function(){
        var a = new BitField(),
            b = new BitField();

        a.set(4, true);
        a.set(6, true);
        
        b.set(4, true);
        b.set(6, true);
        b.set(8, true);

        a.and(null,b,a).should.be.true;

        b.set(4,false);
        a.and(null,b,a).should.be.false;
    });

    it('should return equality', function(){
        var a = new BitField(),
            b = new BitField();

        a.set(2000,true);
        a.set(16,true);
        
        b.set(16,true);

        a.equals(b).should.equal(false);
        a.set(2000,false);
        a.equals(b).should.equal(true);
    })

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
    })
});