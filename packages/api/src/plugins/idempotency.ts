import fp from 'fastify-plugin'
import {FastifyInstance, FastifyRequest} from 'fastify';

declare module 'fastify'{
    interface FastifyInstance{
        withIdempotency: <T>(request: FastifyRequest, handler:()=> Promise<T>) => Promise<T>;
    }
    interface FastifyRequest{
        routerPath?: string;
    }
}

export default fp(async function idempotencyPlugin(fastify: FastifyInstance){

    //Decorate Fastify with idempotency utility
    fastify.decorate('withIdempotency', async function <T>(request: FastifyRequest, handler: ()=>Promise<T>):Promise<T>{
        const keyHeader = request.headers['idempotency-key'] || request.headers['x-idempotency-key'];
        const idempotencyKey = Array.isArray(keyHeader) ? keyHeader[0] : keyHeader;

        if(!idempotencyKey){

            //No idempotency key provided
            return handler();
        }
        try{

            //Insert a new idempotency record
            await this.prisma.idempotencyKey.create({
                data:{
                    key: idempotencyKey,
                    requestPath: request.routerPath || request.url,
                    requestMethod: request.method,
                    userId: request.user ? request.user.id : undefined
                }
            })
        }catch(err: any){
            // If a record with this key already exists (unique constraint violation)
            if(err.code === 'P2002' || err.code === '23505'){
                const existing = await this.prisma.idempotencyKey.findUnique({where:{key: idempotencyKey}});
                if(existing && existing.responseBody !== null){

                    //If a previous response is stored return it
                    return existing.responseBody as T;
                }else{
                    throw new Error('IdempotentRequestInProgress');
                }
            }else{
                throw err;
            }
        }

        // Execute the handler and store its result
        let result : T;
        try{
            result = await handler();
            await this.prisma.idempotencyKey.update({
                where:{key: idempotencyKey},
                data:{responseStatus: 200, responseBody: result}
            })
        }catch(err){
            await this.prisma.idempotencyKey.delete({where: {key: idempotencyKey}})
            throw err;
        }
        return result;
    });

    //Global error handler for idempotency conflicts

    fastify.setErrorHandler((error, request, reply)=>{
        if(error && error.message === 'IdempotentRequestInProgress'){
            reply.code(409).send({error: 'Duplicate request is already in progress'});
        }else{
            reply.send(error);
        }
    })
})