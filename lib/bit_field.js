

var BitField = function (size){
    this.value = 0;
    this.length = 31;
};

BitField.prototype.size = function(){
    return this.length;
}

BitField.prototype.count = function(){
    if( this.value == 0 )
        return 0;
    // See: http://bits.stephan-brumme.com/countBits.html for an explanation
    var x = this.value;
    x  = x - ((x >> 1) & 0x55555555);
    x  = (x & 0x33333333) + ((x >> 2) & 0x33333333);
    x  = x + (x >> 4);
    x &= 0xF0F0F0F;

    return (x * 0x01010101) >> 24;
}

BitField.prototype.set = function(index, value) {
    if( value )
        this.value |= (1<<index);
    else
        this.value &= ~(1<<index);
    return this;
};

BitField.prototype.get = function(index){
    return !!(this.value & (1<<index));
}

BitField.prototype.and = function( result, other ){
    var r = this.value & other.value;
    if( result )
        result.value = r;
    return (r !== 0);
}

BitField.prototype.or = function( result, other ){
    var r = this.value | other.value;
    if( result )
        result.value = r;
    return r == this.value;
}

BitField.prototype.toArray = function (){
    var result = [];
    for (var i = 0; i < this.length; i++ ) {
        result.push(this.get(i));
    }
    return result;
}

BitField.prototype.toHexString = function(){   
    return this.value.toString(16,true);
}

BitField.prototype.toBinaryString = function(){   
    return this.toArray().map(function (value) {
        return value ? '1' : '0';
    }).reverse().join('');
}

BitField.prototype.toString = function(){   
}

BitField.create = function(){
    var result = new BitField();
    return result;
}

module.exports = BitField;