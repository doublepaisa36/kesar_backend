import fp from "fastify-plugin"
import {FastifyInstance, FastifyReply, FastifyRequest} from "fastify";
import {PrismaClient, User} from "@prisma/client"


//Extend FastifyRequest to include authenticated user info


declare module 'fastify'{
    interface FastifyRequest{
        user?: User & {permissions?: string[]}

    }
    interface FastifyInstance{
        prisma : PrismaClient
    }
}

export default fp(async function authPlugin(fastify: FastifyInstance){
    fastify.addHook('onRequest',async (request: FastifyRequest, reply:FastifyReply)=>{
        // allow unauthenticated access to health and metrics endpoints
        const openpaths = ['/health', '/metrics'];
        if(openpaths.includes(request.url)){
            return;
        }

        const apiKeyHeader = request.headers['x-api-key'] ||request.headers['authorization'];
        const apiKey = Array.isArray(apiKeyHeader) ? apiKeyHeader[0] : apiKeyHeader;
        if(!apiKey || typeof apiKey !== 'string'){
            return reply.code(401).send({error: 'Unauthorized'});
        }

        const user = await fastify.prisma.user.findUnique({where:{apiKey:apiKey}});
        if(!user){
            return reply.code(401).send({error:"unauthorized"});
        }

        if(user.roleId){
            const rolePerms = await fastify.prisma.rolePermission.findMany({
                where:{roleId: user.roleId},
                include:{permission:true}
            });
            user['permissions'] = rolePerms.map(rp => rp.permission.name);
        }else{
            user['permissions'] = [];
        }
        request.user = user;
    });
});