import { logger } from '@libp2p/logger'
import { CID } from 'multiformats/cid'

const log = logger('voyager:remove')

export default async ({ orbitdb, databases, id, addresses }) => {
  for (const address of addresses) {
    log('remove database', address)

    const identities = await databases.get(address)

    if (identities && identities.length > 1) {
      const index = identities.indexOf(id)

      if (index > -1) {
        identities.splice(index, 1)
      }

      await databases.set(address, identities)
    } else {
      // Before deleting, we need to unpin any CIDs
      const db = await orbitdb.open(address)
      
      // Iterate through records and check for CID/cid fields
      const records = await db.all()
      for (const record of records) {
        const findAndUnpinCIDs = async (obj, path = '') => {
          for (const [key, value] of Object.entries(obj)) {
            if (key === 'CID' || key === 'cid') {
              log(`Found CID to unpin in record at ${path}${key}:`, value)
              try {
                log.info(`Unpinning content: ${value}`)
                await orbitdb.ipfs.pins.rm(CID.parse(value))
              } catch (err) {
                log.error(`Failed to unpin CID ${value}:`, err)
              }
            }
            if (value && typeof value === 'object' && !Array.isArray(value)) {
              await findAndUnpinCIDs(value, `${path}${key}.`)
            }
          }
        }
        
        await findAndUnpinCIDs(record)
      }
      
      await db.close()
      await databases.del(address)
    }

    if (!await databases.get(address)) {
      const db = await orbitdb.open(address)
      await db.close()
    }

    log('database removed', address)
  }
}
