

var BitField = function (){
    this.values = [];
};

BitField.prototype.size = function(){
    return this.values.length * 32;
}

BitField.prototype.count = function(){
    var i,l,count,x;
    if( this.values.length == 0 )
        return 0;
    count = 0;
    for (i=0,l=this.values.length;i<l; i++) {
        // See: http://bits.stephan-brumme.com/countBits.html for an explanation
        x = this.values[i];
        x  = x - ((x >> 1) & 0x55555555);
        x  = (x & 0x33333333) + ((x >> 2) & 0x33333333);
        x  = x + (x >> 4);
        x &= 0xF0F0F0F;

        count += (x * 0x01010101) >> 24;
    }
    return count;
}


BitField.prototype.equals = function(other){
    var i,l,count,x,a,b;
    for (i=0,l=this.values.length;i<l; i++) {
        a = this.values[i];
        b = other.values[i];
        a = a === undefined ? 0 : a;
        b = b === undefined ? 0 : b;
        if( a != b )
            return false;
    }
    return true;
};

BitField.prototype.set = function(i, value) {
    var index = (i / 32) | 0;
    var bit = i % 32;
    if( value )
        this.values[index] |= 1 << bit;
    else
        this.values[index] &= ~(1 << bit);
    return this;
};

BitField.prototype.get = function(i){
    var index = (i / 32) | 0; // | 0 converts to an int. Math.floor works too.
    var bit = i % 32;
    return (this.values[index] & (1 << bit)) !== 0;
}

BitField.prototype.and = function( result, other, equals ){
    var i,l;
    var out = result ? result.values : [];
    var eq = equals ? true : false;
    for (i=0,l=this.values.length;i<l; i++) {
        out[i] = (this.values[i] & other.values[i]);
        if( eq ) eq = (out[i] == equals.values[i]);
    }
    if( equals )
        return eq;
    if( result )
        return result;
    return result;
}

BitField.prototype.or = function( result, other, equals ){
    var i,l;
    var out = result ? result.values : [];
    var eq = equals ? true : false;
    for (i=0,l=this.values.length;i<l; i++) {
        out[i] = (this.values[i] | other.values[i]);
        if( eq ) eq = (out[i] == equals.values[i]);
    }
    if( equals )
        return eq;
    if( result )
        return result;
    return result;
}


BitField.prototype.toArray = function (){
    var i,l,v,found = false,result = [];
    for (i=(this.values.length*32)-1;i>=0; i--) {
        v = this.get(i);
        if( !found )
            found = v;
        if( found )
            result.push( v );
    }
    return result;
}

BitField.prototype.toJSON = function () {
    return JSON.stringify(this.values);
};

BitField.prototype.toString = function(){   
    return this.toArray().map(function (value) {
        return value ? '1' : '0';
    }).join('');
}

BitField.prototype.toBinaryString = function(){   
    return this.toArray().map(function (value) {
        return value ? '1' : '0';
    }).reverse().join('');
}

BitField.create = function(){
    var result = new BitField();
    return result;
}

module.exports = BitField;