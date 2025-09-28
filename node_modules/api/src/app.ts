import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import redis from 'ioredis'
import {PrismaClient} from '@prisma/client'
import betRoutes from './routes/bets.js'
import eventRoutes from './routes/events.js'
import authPlugin from './plugins/auth.js'
import healthRoutes from './routes/health.js'
import idempotencyPlugin from './plugins/idempotency.js'

export function buildApp(){
    const fastify = Fastify({logger: true});
    const prisma = new PrismaClient();
    fastify.decorate('prisma',prisma);

    //security plugins
    fastify.register(cors);
    fastify.register(helmet, {global:true});


    //Regitser authentication/authorization and idempotency plugins
    fastify.register(authPlugin);
    fastify.register(idempotencyPlugin);

    //Register application routes
    fastify.register(betRoutes);
    fastify.register(eventRoutes);
    fastify.register(healthRoutes);
    

    return fastify
}