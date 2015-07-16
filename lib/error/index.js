function InvalidEntityError(msg){
    this.name = 'InvalidEntityError';
    this.message = msg;
}


module.exports = {
    InvalidEntityError: InvalidEntityError    
}