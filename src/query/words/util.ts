

export function compareDates( op:string, dateA:Date, dateB:Date ){
    const timeA = dateA.getTime();
    const timeB = dateB.getTime();
    switch(op){
        case '==': return timeA === timeB;
        case '!=': return timeA !== timeB;
        case '>': return timeA > timeB;
        case '>=': return timeA >= timeB;
        case '<': return timeA < timeB;
        case '<=': return timeA <= timeB;
        default:
            return false;
    }
}