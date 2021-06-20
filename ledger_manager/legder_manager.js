const indy = require('indy-sdk')
const util = require('./util')
const colors = require('./colors')

const log = console.log

const poolName = 'pool'
let poolHandle = {}
let walletHandle = {}
let stewardDid = {}
let stewardVerkey = {}

function logValue() {
    log(colors.CYAN, ...arguments, colors.NONE)
}

async function enrollEndorser(params){
    const {trustAnchorDid, trustAnchorVerkey} = params

    console.log('7. Building NYM request to add Trust Anchor to the ledger')
    const nymRequest = await indy.buildNymRequest(/*submitter_did*/ stewardDid,
        /*target_did*/ trustAnchorDid,
        /*ver_key*/ trustAnchorVerkey,
        /*alias*/ undefined,
        /*role*/ 'TRUST_ANCHOR')

    // 8.
    console.log('8. Sending NYM request to the ledger')
    await indy.signAndSubmitRequest(/*pool_handle*/ poolHandle,
        /*wallet_handle*/ walletHandle,
        /*submitter_did*/ stewardDid,
        /*request_json*/ nymRequest)

    console.log('Endorser 등록을 성공했습니다')
    return true
}

async function enrollUser(params){
    const {userDid, userVerkey} = params

    console.log('7. Building NYM request to add User to the ledger')
    const nymRequest = await indy.buildNymRequest(/*submitter_did*/ stewardDid,
        /*target_did*/ userDid,
        /*ver_key*/ userVerkey,
        /*alias*/ undefined,
        /*role*/ null)

    // 8.
    console.log('8. Sending NYM request to the ledger')
    await indy.signAndSubmitRequest(/*pool_handle*/ poolHandle,
        /*wallet_handle*/ walletHandle,
        /*submitter_did*/ stewardDid,
        /*request_json*/ nymRequest)
    console.log('User 등록을 성공했습니다')
    return true
}

async function run(){
    console.log('Indy Node 1.4 버전을 사용하기 위해 indy protocol을 2로 설정')
    await indy.setProtocolVersion(2)

    log('1. Creates a new local pool ledger configuration that is used later when connecting to ledger.')
    const genesisFilePath = await util.getPoolGenesisTxnPath(poolName)
    const poolConfig = {'genesis_txn': genesisFilePath}
    await indy.createPoolLedgerConfig(poolName, poolConfig).catch(()=>{})
    
    log('2. Open pool ledger and get handle from libindy')
    poolHandle = await indy.openPoolLedger(poolName, undefined)

    // 3.
    log('3. Creating new secure wallet')
    const walletName = {"id": "wallet"}
    const walletCredentials = {"key": "wallet_key"}
    await indy.createWallet(walletName, walletCredentials).catch(()=>{})

    // 4.
    log('4. Open wallet and get handle from libindy')
    walletHandle = await indy.openWallet(walletName, walletCredentials)

    // 5.
    log('5. Generating and storing steward DID and verkey')
    const stewardSeed = '000000000000000000000000Steward1'
    const did = {'seed': stewardSeed}
    const [_stewardDid, _stewardVerkey] = await indy.createAndStoreMyDid(walletHandle, did)
    logValue('Steward DID: ', _stewardDid)
    logValue('Steward Verkey: ', _stewardVerkey)
    stewardDid = _stewardDid
    stewardVerkey = _stewardVerkey

    log('블록체인 노드 가동에 성공하였습니다')    
    
    return [poolName, stewardDid, stewardVerkey]
}

module.exports = {run, enrollEndorser, enrollUser}