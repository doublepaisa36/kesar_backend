import {PrismaClient} from "@prisma/client"
const prisma = new PrismaClient();

async function main(){
    console.log("seeding database...");

    //Create a default tenant
    const tenant = await prisma.tenant.create({data: {name:"Default tenant"}});

    //Create roles
    const superAdminRole = await prisma.role.create({data:{name: 'super-admin'}});
    const playerRole = await prisma.role.create({data:{name:'player'}});

    //Create permissions
    const createEventPerm = await prisma.permission.create({data:{name:"CREATE_EVENT"}});
    const confirmDepositPerm = await prisma.permission.create({data:{name:'CONFIRM_DEPOSIT'}});

    //Assign permission to roles
    await prisma.rolePermission.createMany({
        data:[
            {roleId: superAdminRole.id, permissionId: createEventPerm.id},
            {roleId: superAdminRole.id, permissionId: confirmDepositPerm.id},        ]
    });

    //create users
    const superAdminUser = await prisma.user.create({
        data:{
            tenantId: tenant.id,
            roleId: superAdminRole.id,
            name:'Super Admin',
            email:'admin@example.com',
            passwordHash: null,
            apiKey: 'superadmin123'

        }
    });
    const playerUser = await prisma.user.create({
        data:{
            tenantId: tenant.id,
            roleId: playerRole.id,
            name:"Player one",
            email:"player@example.com",
            passwordHash:null,
            apiKey:'player123'
        }
    })

    //Create system and user accounts
     const externalAccount = await prisma.account.create({ data: { name: 'External', category: 'EXTERNAL' } });
  const wagerAccount = await prisma.account.create({ data: { name: 'Wager Pool', category: 'WAGER' } });
  const profitAccount = await prisma.account.create({ data: { name: 'House Profit', category: 'PROFIT' } });
  const superAdminAccount = await prisma.account.create({
    data: { name: 'SuperAdmin Account', category: 'USER', userId: superAdminUser.id }
  });
  const playerAccount = await prisma.account.create({
    data: { name: 'Player One Account', category: 'USER', userId: playerUser.id }
  });


    //Create sample events, markets, outcomes

    const event1 = await prisma.event.create({ data: { name: 'Match 1: Team A vs Team B', startsAt: new Date() } });
  const market1 = await prisma.market.create({ data: { eventId: event1.id, name: 'Winner' } });
  const outcome1A = await prisma.outcome.create({ data: { marketId: market1.id, name: 'Team A wins', odds: 1.5 } });
  const outcome1B = await prisma.outcome.create({ data: { marketId: market1.id, name: 'Team B wins', odds: 2.5 } });
  const event2 = await prisma.event.create({ data: { name: 'Match 2: Team C vs Team D', startsAt: new Date() } });
  const market2 = await prisma.market.create({ data: { eventId: event2.id, name: 'Winner' } });
  const outcome2A = await prisma.outcome.create({ data: { marketId: market2.id, name: 'Team C wins', odds: 1.8 } });
  const outcome2B = await prisma.outcome.create({ data: { marketId: market2.id, name: 'Team D wins', odds: 2.0 } });

  //Simulate a completed $100 deposit for the player(credit user, debit external)
  const depositAmount = 10000;
  await prisma.$transaction(async (tx) => {
    const journal = await tx.journal.create({ data: {} });
    await tx.ledgerEntry.create({ data: { journalId: journal.id, accountId: externalAccount.id, amount: -depositAmount } });
    await tx.ledgerEntry.create({ data: { journalId: journal.id, accountId: playerAccount.id, amount: depositAmount } });
    await tx.depositIntent.create({
      data: {
        userId: playerUser.id,
        amount: depositAmount,
        status: 'COMPLETED',
        completedAt: new Date(),
        depositJournalId: journal.id
      }
    });
  });


  //Simulate a placed bet (2-leg parlay) by player with $10 stake on outcome1A and outcome2A
   const betStake = 1000; // cents ($10.00)
  await prisma.$transaction(async (tx) => {
    const journal = await tx.journal.create({ data: {} });
    await tx.ledgerEntry.create({ data: { journalId: journal.id, accountId: playerAccount.id, amount: -betStake } });
    await tx.ledgerEntry.create({ data: { journalId: journal.id, accountId: wagerAccount.id, amount: betStake } });
    const bet = await tx.bet.create({
      data: {
        userId: playerUser.id,
        stake: betStake,
        stakeJournalId: journal.id,
        status: 'PENDING'
      }
    });
    await tx.betLeg.createMany({
      data: [
        { betId: bet.id, outcomeId: outcome1A.id, odds: outcome1A.odds, result: 'PENDING' },
        { betId: bet.id, outcomeId: outcome2A.id, odds: outcome2A.odds, result: 'PENDING' }
      ]
    });
    // (No outbox entry for this seed bet, since it's a historical record)
  });

  console.log('Seeding complete.')

}

main().catch(e =>{
    console.error(e);
    process.exit(1);
}).finally(async ()=>{
    await prisma.$disconnect();
})