import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import redis from 'ioredis'
import {PrismaClient} from '@prisma/client'

export function buildApp(){
    const fastify = Fastify({logger: true});
    const prisma = new PrismaClient();
    fastify.decorate('prisma',prisma);

    //security plugins
    fastify.register(cors);
    fastify.register(helmet, {global:true});
    const redisClient = process.env.REDIS_URL ? new redis(process.env.REDIS_URL) : null;
    fastify.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    allowList: ['127.0.0.1'],
    redis: redisClient
  });


    return fastify
}