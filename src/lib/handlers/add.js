import { logger } from '@libp2p/logger'
import { CID } from 'multiformats/cid'

const log = logger('voyager:add')

const waitForReplication = (db, timeout = 30000) => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup()
      reject(new Error('Replication timeout after ' + timeout + 'ms'))
    }, timeout)

    const onJoin = () => {
      cleanup()
      resolve()
    }

    const onError = (err) => {
      cleanup()
      reject(err)
    }

    const cleanup = () => {
      clearTimeout(timer)
      db.events.removeListener('join', onJoin)
      db.events.removeListener('error', onError)
      db.events.removeListener('peer.left', onError)
    }

    db.events.on('join', onJoin)
    db.events.on('error', onError)
    // Also listen for peer disconnection which might indicate issues
    db.events.on('peer.left', () => onError(new Error('Peer disconnected during replication')))
  })
}

export default async ({ orbitdb, databases, id, addresses, helia }) => {
  for (const address of addresses) {
    console.log('add database', address)

    let db
    try {
      db = await orbitdb.open(address)
      db.events.on('join', () => console.log('join'))
      db.events.on('error', (err) => console.log('error', err))
      db.events.on('peer.left', () => console.log('peer.left'))
      
      let identities = await databases.get(address)
      const hasDb = identities !== undefined

      if (identities) {
        identities.push(id)
      } else {
        identities = [id]
      }

      if (!hasDb) {
        console.log('waiting for replication', db.address)
        try {
          await waitForReplication(db)
          console.log('replication done')
        } catch (error) {
          log.error(`Replication failed for ${address}:`, error)
          await db.close()
          continue
        }
        // Iterate through records and check for CID/cid fields
        console.log('getting all records')
        try {
          const records = await db.all()
          records.forEach((record, index) => {
            const findAndPinCIDs = async (obj, path = '') => {
              for (const [key, value] of Object.entries(obj)) {
                if (key === 'CID' || key === 'cid') {
                  console.log(`Found CID in record ${index} at ${path}${key}:`, value)
                  try {
                    log.info(`Pinning content: ${value}`)
                    await orbitdb.ipfs.pins.add(CID.parse(value))
                  } catch (err) {
                    log.error(`Failed to pin CID ${value}:`, err)
                  }
                }
                if (value && typeof value === 'object' && !Array.isArray(value)) {
                  await findAndPinCIDs(value, `${path}${key}.`)
                }
              }
            }
            console.log('record', record)
            findAndPinCIDs(record)
          })
        } catch (error) {
          log.error(`Failed to fetch records from database ${address}:`, error)
          continue // Skip to next address if fetching records fails
        }
      }

      await databases.set(address, identities)
      log('database added', address)
    } catch (error) {
      log.error(`Failed to process database at address ${address}:`, error)
      if (db) {
        try {
          await db.close()
        } catch (closeError) {
          log.error('Error while closing database:', closeError)
        }
      }
      continue
    }
  }
}
