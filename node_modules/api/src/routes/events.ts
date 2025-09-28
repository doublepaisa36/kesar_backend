import { FastifyInstance } from "fastify";

export default async function eventRoutes(fastify: FastifyInstance){
    fastify.get('/events',async(request, reply)=>{
        //Return all events with their markets and outcomes
        return await fastify.prisma.event.findMany({
            include:{
                markets:{
                    include:{outcomes: true}
                }
            }
        });
    });
}