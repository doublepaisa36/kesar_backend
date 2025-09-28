import {FastifyInstance} from "fastify";
import {z} from "zod"

const placeBetSchema = z.object({
   outcomes : z.array(z.string().uuid()).min(1),
   stake: z.number().int().positive()
});


export default async function betRoutes(fastify: FastifyInstance){
    fastify.post('/bets',async(request,reply)=>{
        const data = placeBetSchema.parse(request.body);
        const user  = request.user!;

        //Ensure user's account exists and has sufficient balance
        const userAccount = await fastify.prisma.account.findFirst({
            where: {userId: user.id, category:'USER'}
        });
        if(!userAccount){
            return reply.code(400).send({error: "User account not found"});
        }
        if(userAccount.balance < data.stake){
            return reply.code(400).send({error: 'Insufficient balance'});
        }


        //Use idempotency utility to handle duplicate bet submissions
        const betResult = await fastify.withIdempotency(request,async()=>{
            return await fastify.prisma.$transaction(async (tx)=>{
                const acct = await tx.account.findUnique({where:{id:userAccount.id}});
                if(!acct || acct.balance < data.stake){
                    throw new Error('Insufficient balance');
                }

                //Fetch all specified outcomes
                const outcomes = await tx.outcome.findMany({
                    where:{id:{in: data.outcomes}}
                });

                if(outcomes.length !== data.outcomes.length){
                    throw new Error('One or more outcomes not found');
                }


                //create a new ledger journal for this bet
                const journal = await tx.journal.create({data:{}});

                //Debit user account and credit the wager pool account
                const wagerAccount = await tx.account.findFirst({where:{category:'WAGER'}});  
                if(!wagerAccount)throw new Error('Wager account not found');
                await tx.ledgerEntry.create({
                    data:{journalId:journal.id, accountId:userAccount.id,amount:-data.stake}
                });
                
                
                //Create the bet record
                const bet = await tx.bet.create({
                    data:{
                        userId: user.id,
                        stake: data.stake,
                        stakeJournalId: journal.id,
                        status:'PENDING'
                    }
                });

                //create one BetLeg for each selected outcome
                for(const outcome of outcomes){
                    await tx.betLeg.create({
                        data:{
                            betId:bet.id,
                            outcomeId: outcome.id,
                            odds: outcome.odds,
                            result:'PENDING'
                        }
                    });
                }

                //Record an outbox event for the new bet
                await tx.outbox.create({
                    data:{
                        eventType:'BetPlaced',
                        payload:{
                            betId: bet.id,
                            userId: user.id,
                            stake: data.stake,
                            outcomes: outcomes.map(o=>({outcomeId: o.id, name:o.name}))
                        }
                    }
                });
                return bet;
            });
        });
        return betResult;
    })
}

