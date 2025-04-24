import { gossipsub } from '@chainsafe/libp2p-gossipsub'
import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { identify } from '@libp2p/identify'
import { tcp } from '@libp2p/tcp'
import { webSockets } from '@libp2p/websockets'
// import { mdns } from '@libp2p/mdns'
import { bootstrap } from '@libp2p/bootstrap'

export const config = ({ privateKey, port, websocketPort, ip4, ip6 } = {}) => {
  const conf = {
    addresses: {
      listen: [
        `/ip4/0.0.0.0/tcp/${port || 0}`,
        `/ip4/0.0.0.0/tcp/${websocketPort || 0}/ws`,
        `/ip6/::/tcp/${port || 0}`,
        `/ip6/::/tcp/${websocketPort || 0}/ws`
      ]
    },
    transports: [
      tcp(),
      webSockets()
    ],
    connectionEncrypters: [
      noise()
    ],
    streamMuxers: [
      yamux()
    ],
    connectionGater: {
      denyDialMultiaddr: () => false // allow dialling of private addresses.
    },
    peerDiscovery: [
      bootstrap({
        list: [
          // IPFS_OFFICIAL_BOOTSTRAPS: Amino DHT Bootstrappers
          // https://docs.ipfs.tech/concepts/public-utilities/#amino-dht-bootstrappers
          '/dnsaddr/sg1.bootstrap.libp2p.io/p2p/QmcZf59bWwK5XFi76CZX8cbJ4BhTzzA3gU1ZjYZcYW3dwt',
          '/dnsaddr/sv15.bootstrap.libp2p.io/p2p/QmNnooDu7bfjPFoTZYxMNLWUQJyrVwtbZg5gBMjTezGAJN',
          '/dnsaddr/am6.bootstrap.libp2p.io/p2p/QmbLHAnMoJPWSCR5Zhtx6BHJX9KiKNN6tpvbUcqanj75Nb',
          '/dnsaddr/ny5.bootstrap.libp2p.io/p2p/QmQCU2EcMqAqQPR2i9bChDtGNJchTbq5TbXJJ16u19uLTa',
          // js-libp2p-amino-dht-bootstrapper
          '/dnsaddr/va1.bootstrap.libp2p.io/p2p/12D3KooWKnDdG3iXw9eTFijk3EWSunZcFi54Zka4wmtqtt6rPxc8',

          // LIBP2P_BOOTSTRAP: https://github.com/ipfs/kubo/blob/master/config/bootstrap_peers.go
          '/dnsaddr/bootstrap.libp2p.io/p2p/QmNnooDu7bfjPFoTZYxMNLWUQJyrVwtbZg5gBMjTezGAJN',
          '/dnsaddr/bootstrap.libp2p.io/p2p/QmQCU2EcMqAqQPR2i9bChDtGNJchTbq5TbXJJ16u19uLTa', // rust-libp2p-server
          '/dnsaddr/bootstrap.libp2p.io/p2p/QmbLHAnMoJPWSCR5Zhtx6BHJX9KiKNN6tpvbUcqanj75Nb',
          '/dnsaddr/bootstrap.libp2p.io/p2p/QmcZf59bWwK5XFi76CZX8cbJ4BhTzzA3gU1ZjYZcYW3dwt',

          // PUBLIC_BOOTSTRAP: mars.i.ipfs.io
          '/ip4/104.131.131.82/tcp/4001/p2p/QmaCpDMGvV2BGHeYERUEnRQAwe3N8SzbUtfsmvsqQLuvuJ',
          '/ip4/104.131.131.82/udp/4001/quic-v1/p2p/QmaCpDMGvV2BGHeYERUEnRQAwe3N8SzbUtfsmvsqQLuvuJ',

          // Other public IPFS nodes
          '/ip4/35.220.212.56/tcp/4001/p2p/12D3KooWJ6MTkNM8Bu8DzNiRm1GY3Wqh8U8Pp1zRWap6xY3MvsNw',

          // Only used for testing
          '/ip4/127.0.0.1/tcp/54321/p2p/16Uiu2HAmBzKcgCfpJ4j4wJSLkKLbCVvnNBWPnhexrnJWJf1fDu5y'
        ]
      })
      /* mdns() */
    ],
    services: {
      identify: identify(),
      pubsub: gossipsub({
        emitSelf: true,
        scoreThresholds: {
          graylistThreshold: -80000000000
        }
      })
    }
  }

  // Add announce addresses if provided
  const announce = []
  if (ip4) {
    announce.push(`/ip4/${ip4}/tcp/${port || 0}`)
    announce.push(`/ip4/${ip4}/tcp/${websocketPort || 0}/ws`)
  }
  if (ip6) {
    announce.push(`/ip6/${ip6}/tcp/${port || 0}`)
    announce.push(`/ip6/${ip6}/tcp/${websocketPort || 0}/ws`)
  }
  if (announce.length > 0) {
    // https://github.com/libp2p/js-libp2p/blob/7b4fa537cb78ad1b373/packages/libp2p/src/address-manager/index.ts#L48-L51
    conf.addresses.appendAnnounce = announce
  }

  if (privateKey) {
    conf.privateKey = privateKey
  }

  return conf
}
