let out, fetch

const isBrowser = new Function("try {return this===window}catch(e){ return false}")
if (!isBrowser()) {
    out = process.stdout
    fetch = require("node-fetch")
}
else {
    out = console.log
    fetch = window.fetch
}

const nodeIps = [
    '116.203.75.72:7070',
    '178.128.113.97:7070',
    '165.227.45.119:7070',
    '206.189.137.112:7070',
    '157.245.160.201:7070',
    '95.217.6.171:7070',
    '88.99.190.191:7070',
    '94.130.78.183:7070',
    '94.130.24.163:7070',
    '94.130.110.127:7070',
    '94.130.110.95:7070',
    '94.130.58.63:7070',
    '88.99.86.166:7070',
    '88.198.78.106:7070',
    '88.198.78.141:7070',
    '88.99.126.144:7070',
    '88.99.87.58:7070',
    '95.217.6.234:7070',
    '95.217.12.226:7070',
    '95.217.14.117:7070',
    '95.217.17.248:7070',
    '95.217.12.230:7070',
]

// const nodeIps = [
//     '127.0.0.1:7071',
//     '127.0.0.1:7072',
//     '127.0.0.1:7073',
//     '127.0.0.1:7074',
// ]

;(async () => {
    start()
})()

let state

const columns = {
    connections: 'connections',
    status: 'status',
    block: 'block',
    address: 'address',
}

async function start(removeLinesCount) {
  let nodes = []
  try {
    const { getPeers, getConsensusPublicKeys } = requester()
    let promises = nodeIps.map(x => getPeers(x))
    promises = await Promise.all(promises.map(x => x.catch(e => e)))
    promises = promises.map(x => x && x['json'] ? x.json() : {})
    const results = await Promise.all(promises)

    let maxBlock = 0
    let maxBlockNodeId

    results.forEach((res, i) => {
      const node = {
        ip: nodeIps[i],
        connections: res && res[0] && res[1].result ? res[0].result.length : 'X',
        status: res && res[1] && res[1].result ? res[1].result.state : 'X',
        // pubKeys: res.result.map(x => x.publicKey),
      }
      if (res && res[0] && res[0].result && res[1] && res[1].result) {
        node[columns.connections] = res[0].result.length
        node[columns.status] = res[1].result.state
        node[columns.address] = res[1].result.address
        node.publicKey = res[1].result.publicKey
        node[columns.block] = Number(res[2].result)
        if (node[columns.block] > maxBlock) {
          maxBlock = node[columns.block]
          maxBlockNodeId = i
        }
      } else {
        Object.values(columns).forEach(x => {
          node[x] = 'X'
        })
      }
      nodes.push(node)
    })

    const maxHeightValidators = (await (await getConsensusPublicKeys(nodeIps[maxBlockNodeId])).json())[0].result
    const consensusParticipants = maxHeightValidators.length
    let validatorsOnline = 0
    let synced = 0

    nodes = nodes.map(x => {
        x.validatorAtMaxHeight = maxHeightValidators.includes(x.publicKey) ? true : '-'
        delete x['publicKey']
        if (x.address && x.validatorAtMaxHeight === true) validatorsOnline++
        if (maxBlock - x.block <= 100) synced ++
        return x
    })

    if (JSON.stringify(state) !== JSON.stringify(nodes)) {
        if (removeLinesCount && !isBrowser()) {
            clearPreviousOut(removeLinesCount + 1)
        }
        console.table(nodes)
        console.log(`Current block: ${maxBlock}; online validators: ${validatorsOnline}/${consensusParticipants}; online nodes : ${synced}/${nodes.length}`)
        state = nodes
    }
  } catch (e) {
    console.error(e);
  } finally {
    setTimeout(() => {
        start(nodes.length + 4)
    }, 2000)
  }
}

function clearPreviousOut(linesToRemove) {
    out.moveCursor(0, -linesToRemove)
    for (let i = -linesToRemove; i < 0; i++) {
        out.clearLine()         // moves the cursor at the beginning of line
        out.write("\n")
    }
    out.moveCursor(0, -linesToRemove)
}

function requester() {
    let requestId = 0
    return {
        getPeers: async function(nodeUrl) {
            const data = [
                {
                    jsonrpc: "2.0",
                    method: "net_peers",
                    params: [],
                    id: requestId++
                }, {
                    jsonrpc: "2.0",
                    method: "fe_account",
                    params: [],
                    id: requestId++
                }, {
                    jsonrpc: "2.0",
                    method: "eth_blockNumber",
                    params: [],
                    id: requestId++
                }
            ]

            return r(nodeUrl, data).catch(e => undefined)
        },
        getConsensusPublicKeys: async function(nodeUrl) {
            const request = [
                {
                    jsonrpc: "2.0",
                    method: "bcn_validators",
                    params: [],
                    id: requestId++
                }
            ]

            return r(nodeUrl, request).catch(e => undefined)
        },
    }
}

function r(nodeUrl, data) {
    const url = `http://${nodeUrl}`
    return timedFetch(url, {
        method: "POST",
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    })
}

function timedFetch(url, options, timeout = 2000) {
    return Promise.race([
        fetch(url, options),
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), timeout)
        )
    ])
}
