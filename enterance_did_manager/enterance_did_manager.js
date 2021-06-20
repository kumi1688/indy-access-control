const indy = require('indy-sdk')
const util = require('./util')
const colors = require('./colors')
const axios = require('axios')

const log = console.log
const wsLog = (io, topic, msg)=>{
    io.emit(topic, msg)
}

const baseURL_Indy_Node = 'http://52.231.165.205:3000'
const baseURL_User = 'http://52.231.165.205:3001'
const baseURL_School = 'http://52.231.165.205:3002'
const baseURL_Lab = 'http://52.231.165.205:3003'
const baseURL_Enterance = 'http://52.231.165.205:3004'

let trustAnchorDid = ''
let trustAnchorVerkey = ''
let poolHandle = ''
let walletHandle = ''

let EnteranceProofRequest_library = {}
let EnteranceProofRequest_lab = {}

function logValue() {
    log(colors.CYAN, ...arguments, colors.NONE)
}

function getDID(io){
    return new Promise(async (resolve, reject)=>{
    const topic = 'getDID'

    log('steward did, verkey 불러오기')
    wsLog(io, topic, 'steward did, verkey 불러오기')
    
    const response = await axios.get('http://localhost:3000')
    const {poolName, stewardDid, stewardVerkey} = response.data
    logValue(poolName, stewardDid, stewardVerkey)
    
    log('Indy Node 1.4 버전을 사용하기 위해 indy protocol을 2로 설정')
    await indy.setProtocolVersion(2)
    
    log('2. Open pool ledger and get handle from libindy')
    poolHandle = await indy.openPoolLedger(poolName, undefined)

    // 3.
    log('3. Creating new secure wallet')
    const walletName = {"id": "lab_did_manager"}
    const walletCredentials = {"key": "lab_did_manager_key"}

    await indy.createWallet(walletName, walletCredentials).catch(()=>{})

    // 4.
    log('4. Open wallet and get handle from libindy')
    walletHandle = await indy.openWallet(walletName, walletCredentials)

    log('6. Generating and storing trust anchor DID and verkey')
    // const didManagerSeed = 'DidManager'
    // const did = {'seed': didManagerSeed}
    const [_trustAnchorDid, _trustAnchorVerkey] = await indy.createAndStoreMyDid(walletHandle, "{}")
    trustAnchorDid = _trustAnchorDid
    trustAnchorVerkey = _trustAnchorVerkey

    logValue('Trust anchor DID: ', trustAnchorDid)
    logValue('Trust anchor Verkey: ', trustAnchorVerkey)
    
    // steward에게 trust anchor(endorser)로 등록해줄 것을 요청
    const data = {trustAnchorDid, trustAnchorVerkey}
    
    result = await axios.post('http://localhost:3000/request_endorser',  data)
    console.log(result.status)
    resolve([trustAnchorDid, trustAnchorVerkey])
    })
}

function showRequites(type){
    return new Promise(async(resolve,reject)=>{

        log('학교와 연구실의 Credential Definition ID 가져오기...')
        const credOfferRequest_School = await axios.get(`${baseURL_School}/make_cred_offer`)
        const credOfferRequest_Lab = await axios.get(`${baseURL_Lab}/make_cred_offer`)
        
        log('학교, 연구실쪽에서 준 VC 정보에서 Credential Definition id 추출...')
        const credDefIdSchool = credOfferRequest_School.data.cred_def_id
        const credDefIdLab  = credOfferRequest_Lab.data.cred_def_id

        const nonce = await indy.generateNonce()
        EnteranceProofRequest_library = {
            'nonce': nonce,
                'name': 'School Enterance Proof Request',
                'version': '1.0',
                'requested_attributes': {
                    'attr1_referent': {
                        'name': 'education_degree',
                        'restrictions': [{'cred_def_id': credDefIdSchool}]
                    },
            }
        }
        EnteranceProofRequest_lab = {
            'nonce': nonce,
            'name': 'Lab Enterance Proof Request',
            'version': '1.0',
            'requested_attributes': {
                'attr1_referent': {
                    'name': 'education_degree',
                    'restrictions': [{'cred_def_id': credDefIdSchool}]
                },
                'attr2_referent': {
                    'name': 'role',
                    'restrictions': [{'cred_def_id': credDefIdLab}]
                }
            }
        }
        
        if(type==='library')
            resolve(EnteranceProofRequest_library)        
        else
            resolve(EnteranceProofRequest_lab)
    })
}

function getProofRequisites(type){
    if(type==='library')
            return (EnteranceProofRequest_library)        
        else
            return (EnteranceProofRequest_lab)
}

function makeEnteranceVP(type){
    return new Promise(async (resolve, reject)=>{
        log('VP 생성에 필요한 속성을 생성합니다...')
        const EnteranceProofRequest = await showRequites(type)

        log('학교 Schema와 Cred Def 정보를 불러옵니다...')
        const schoolSchema = await axios.get(`${baseURL_School}/get_schema`)
        const schoolCredDef = await axios.get(`${baseURL_School}/get_cred_def`)

        log('연구실 Schema와 Cred Def 정보를 불러옵니다...')
        const labSchema = await axios.get(`${baseURL_Lab}/get_schema`)
        const labCredDef = await axios.get(`${baseURL_Lab}/get_cred_def`)
        
        log('출입관리소에서 요구한 속성을 자신이 가지고 있는지 확인합니다')
        let requisites = await indy.proverSearchCredentialsForProofReq(aliceWalletHandle, EnteranceProofRequest, null)
        let credentials = await indy.proverFetchCredentialsForProofReq(requisites, 'attr1_referent', 100)
        let credForAttr1 = credentials[0]['cred_info']
        
        credentials = await indy.proverFetchCredentialsForProofReq(requisites, 'attr2_referent', 100)
        let credForAttr2 = credentials[0]['cred_info']

        // log('야호')
        // credentials = await indy.proverFetchCredentialsForProofReq(requisites, 'predicate1_referent', 100)
        // log('누구')
        // let credForAttr3 = credentials[0]['cred_info']

        let EnteranceRequestedCredsJson = {
            "self_attested_attributes": {},
            'requested_attributes': {
                'attr1_referent': {'cred_id': credForAttr1['referent'], 'revealed': true},
                'attr2_referent': {'cred_id': credForAttr2['referent'], 'revealed': true},
            },
            "requested_predicates": {
                'pre1_referent': {'cred_id': credForAttr3['referent']}
            }
        }
        let schemasJson = {}
        schemasJson[schemaId] = schema 
        let credDefsJson = {}
        credDefsJson[credDefId] = credDef
        
        let revocStatesJson = {}
        let revocRefDefsJson = {}
        let revocRegsJson = {}

        log(schemasJson)
        log('===================')
        log(credDefsJson)
        
        let aliceMasterSecretId = await indy.proverCreateMasterSecret(aliceWalletHandle, null);

        let EnteranceProofJson = await indy.proverCreateProof(aliceWalletHandle, EnteranceProofRequest, EnteranceRequestedCredsJson, aliceMasterSecretId, schemasJson, credDefsJson, revocStatesJson)
        // is_valid = await indy.verifierVerifyProof(EnteranceProofRequest, EnteranceRequestedCredsJson, schemasJson, credDefsJson, revocRefDefsJson, revocRegsJson)
        // log(is_valid)

        resolve(EnteranceProofJson)
    })
}

module.exports = {
    makeEnteranceVP,
    showRequites,
    makeEnteranceVP,
    getProofRequisites,
    getDID,
}