import { FastifyInstance } from "fastify";
export default function healthRoutes(fastify: FastifyInstance){
    fastify.get('/health',async(request,reply)=>{
        return {status: 'ok'};
    })
}