import { FastifyInstance } from "fastify";
import {z} from "zod";

const createDepositSchema = z.object({
    amount: z.number().int().positive()
});


export default async function depositRoutes(fastify: FastifyInstance){
    fastify.post('/deposits',async(request,reply)=>{
        const data = createDepositSchema.parse(request.body);
        const user = request.user!;

        //Use idempotency to ensure deposit intent is only created once
        const depositIntent = await fastify.withIdempotency(request, async()=>{
            return await fastify.prisma.depositIntent.create({
                data:{
                    userId: user.id,
                    amount: data.amount,
                    status:'PENDING'

                }
            });
        });
        return depositIntent;
    })
}