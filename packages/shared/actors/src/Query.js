
// we should probably make query engine an Actor
// the defualt is dum and returns this
export class Query {
    doQuery(actor,payload,...args){
        return actor; // doest do queries
    }
}

export const query = new Query();