import {FastifyInstance} from 'fastify'
import {z} from 'zod'

const createEventSchema = z.object({
    name: z.string(),
    startsAt: z.string().datetime().optional()
})

export default async function adminRoutes(fastify: FastifyInstance){

    //Admin-only route: Create a new event (requires create-event permission)

    fastify.post('/admin/events', async(request,reply)=>{
        const user = request.user!;
        if(!user.permissions?.includes('CREATE_EVENT')){
            return reply.code(403).send({error: 'Forbidden'});
        }

        const data = createEventSchema.parse(request.body);

        const newEvent = await fastify.prisma.event.create({
            data:{
                name: data.name,
                startsAt:  data.startsAt ? new Date(data.startsAt):null

            }
        });
        return newEvent;
    });


    //Admin-only route: confirm a pending deposit(credit user account, debit external)
    fastify.post('/admin/deposits/:id/confirm',async(request,reply)=>{
        const user = request.user!;
        if(!user.permissions?.includes('CONFIRM_DEPOSIT')){
            return reply.code(403).send({error: 'Forbidden'});
        }

        const depositId  = request.params['id'];
        const depIntent = await fastify.prisma.depositIntent.findUnique({where:{id: depositId}});
        if(!depIntent){
            return reply.code(400).send({error: 'Deposit already completed'})
        }

        if(depIntent.status  === 'COMPLETED'){
            return reply.code(400).send({error:'Deposit already completed'});
        }

        //complete the deposit in one transaction
        await fastify.prisma.$transaction(async (tx)=>{
            const userAccount = await tx.account.findFirst({where: {userId: depIntent.userId, category:'USER'}});
            const externalAccount = await tx.account.findFirst({where: {category:'EXTERNAL'}})

            if(!userAccount || !externalAccount){
                throw new Error('Account not found');
            }

            const journal = await tx.journal.create({data: {}});
            await tx.ledgerEntry.create({
                data: {journalId: journal.id, accountId: externalAccount.id,amount: -depIntent.amount}          
            });
            await tx.ledgerEntry.create({
                data: {journalId: journal.id, accountId: externalAccount.id,amount:-depIntent.amount}
            });

            await tx.ledgerEntry.create({
                data: {journalId: journal.id, accountId: userAccount.id, amount: depIntent.amount}            
            });

            await tx.depositIntent.update({
                where: {id: depositId},
                data: {status: 'COMPLETED', completedAt: new Date(),depositJournalId:journal.id}
            });
            await tx.outbox.create({
                data:{
                    eventType: 'DepositCompleted',
                    payload: {depositId:depositId,userId: depIntent.userId, amount: depIntent.amount}
                }
            });
        });
        return {success: true};

    })
}