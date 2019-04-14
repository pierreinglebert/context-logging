'use strict'

const fs = require('fs')
const { Client } = require('pg')
const hyperid = require('hyperid')

const { clsProxify } = require('cls-proxify')
const { clsProxifyFastifyMiddleware } = require('cls-proxify/integration/fastify')
const logger = require('pino')({ level: 'info' })
const loggerCls = clsProxify('clsKeyLogger', logger)

const instance = hyperid()
const fastify = require('fastify')({
    logger: logger,
    genReqId: function (req) { return req.headers['request-id'] || instance() }
})
fastify.use(
    clsProxifyFastifyMiddleware('clsKeyLogger', (req) => {        
        return logger.child({ reqId: req.id })
    })
)

async function getMessage(id) {
    let res
    const client = new Client({
        user: 'local',
        host: 'postgres',
        database: 'local',
        password: 'local'
    })
    await client.connect()
    try {
        if(id == 1) {
            res = await client.query('SELECT $1::tet as message', ['Hello world!'])
        } else {
            res = await client.query('SELECT $1::text as message', ['Hello world!'])
        }
        res = res.rows[0].message
    } catch(err) {
        loggerCls.info(err)
        logger.info(err);
        loggerCls.info('Didnt get a message, returning default one')
        logger.info('Didnt get a message, returning default one')
        res = 'hello'
    } finally {
        await client.end()
    }
    return res
}

fastify.get('/foo/:id', async(request, reply) => {
    const res = await getMessage(request.params.id)
    reply.type('application/json').code(200)
    return {message: res}
})

fastify.listen(process.env.PORT || 80, '0.0.0.0', (err, address) => {
    if (err) throw err
})

new Array(3).fill(0).forEach((_, i) => fastify.inject({
    url: `/foo/${i}`,
    method: 'GET'
}))