import { pipe } from 'it-pipe'
import { logger, enable } from '@libp2p/logger'
import { KeyValueIndexed } from '@orbitdb/core'
import { voyagerProtocol } from './protocol.js'
import { handleRequest } from './handle-request.js'
import Authorization, { Access } from './authorization.js'

export default async ({ orbitdb, defaultAccess, verbose } = {}) => {
  const log = logger('voyager:host')

  if (verbose > 0) {
    enable('voyager:host' + (verbose > 1 ? '*' : ':error'))
  }

  log('start voyager')

  defaultAccess = defaultAccess || Access.DENY

  log('default access:', defaultAccess === Access.ALLOW ? 'allow all' : 'deny all')

  const databases = await orbitdb.open('databases', { Database: KeyValueIndexed() })

  const auth = await Authorization({ orbitdb, defaultAccess })

  const handleMessages = async ({ stream }) => {
    try {
      await pipe(stream, handleRequest({ log, orbitdb, databases, auth }), stream)
    } catch (err) {
      if (err.message.includes('ended pushable')) {
        log('Stream ended by peer')
      } else {
        log('Stream error:', err)
      }
    }
  }

  await orbitdb.ipfs.libp2p.handle(voyagerProtocol, handleMessages, { runOnLimitedConnection: true })

  log('open replicated databases')

  let count = 0
  let failedDbs = []
  for await (const db of databases.iterator()) {
    log('open', db.key)
    try {
      const _db = await orbitdb.open(db.key)
      count++
    } catch (err) {
      log.error(`Failed to open database ${db.key}:`, err.message)
      failedDbs.push({
        address: db.key,
        error: err.message
      })
    }
  }
  log(count, 'databases opened successfully')
  if (failedDbs.length > 0) {
    log.error(`Failed to open ${failedDbs.length} databases:`)
    for (const failed of failedDbs) {
      log.error(`- ${failed.address}: ${failed.error}`)
    }
  }

  const stop = async () => {
    await orbitdb.ipfs.libp2p.unhandle(voyagerProtocol)
  }

  return {
    databases,
    orbitdb,
    auth,
    stop,
    log
  }
}
