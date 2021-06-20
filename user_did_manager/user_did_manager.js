const indy = require('indy-sdk')
const util = require('./util')
const colors = require('./colors')
const axios = require('axios')

const baseURL_Indy_Node = 'http://localhost:3000'
const baseURL_School = 'http://localhost:3002'
const baseURL_Lab = 'http://localhost:3003'
const baseURL_Enterance = 'http://localhost:3004'

const log = console.log
const wsLog = (io, topic, msg)=>{
    io.emit(topic, msg)
}

let poolHandle = ''

let schemaId = ''
let schema = ''
let credDef = ''
let credDefId = ''
let userDid = ''

let userWalletHandle = ''
let userMasterSecret = ''

function logValue() {
    log(colors.CYAN, ...arguments, colors.NONE)
}

function getDID(io){
    return new Promise(async (resolve, reject)=>{
    const topic = 'getDID'
        
    log('steward did, verkey 불러오기')
    wsLog(io, topic, 'steward did, verkey 불러오기')
    
    const response = await axios.get(baseURL_Indy_Node)
    const {poolName, stewardDid, stewardVerkey} = response.data
    log(stewardDid)
    
    log('Indy Node 1.4 버전을 사용하기 위해 indy protocol을 2로 설정')
    await indy.setProtocolVersion(2)
    
    log('2. Open pool ledger and get handle from libindy')
    poolHandle = await indy.openPoolLedger(poolName, undefined)

    // 3.
    log('3. Creating new secure wallet')
    const walletName = {"id": "user_did_manager"}
    const walletCredentials = {"key": "user_did_manager_key"}

    await indy.createWallet(walletName, walletCredentials).catch(()=>{})

    // 4.
    log('4. Open wallet and get handle from libindy')
    userWalletHandle = await indy.openWallet(walletName, walletCredentials)

    log('5. DID, Verkey를 생성합니다...')
    let [_userDid, userVerkey] = await indy.createAndStoreMyDid(userWalletHandle, {})
    userDid = _userDid
    
    log('6. DID를 블록체인 노드에 등록합니다')
    const data = {userDid, userVerkey}
    result = await axios.post(`${baseURL_Indy_Node}/request_NYM`,  data)
    resolve([userDid, userVerkey])
    })
}

function makeEnteranceVC_USER(type){
    return new Promise(async(resolve, reject)=>{
        log('사용자 쪽의 enterance VC 생성...')
        
        log('학교쪽에 VC 정보 요청하기...')
        let url = type === 'school' ? baseURL_School : baseURL_Lab
        const credOfferRequest = await axios.get(`${url}/make_cred_offer`)
        
        log('학교쪽에서 준 VC 정보에서 Credential Definition id 추출...')
        const {cred_def_id} = credOfferRequest.data
        
        log('Credential Definition Request 생성...')
        const getCredDefRequest = await indy.buildGetCredDefRequest(userDid, cred_def_id)
        
        log('Credential Definition Request 실행...')
        const getCredDefResponse = await indy.submitRequest(poolHandle, getCredDefRequest)

        log('Credential Definition Response 확인 후 CredDef 꺼내기...')
        const [_credDefId, _credDef] = await indy.parseGetCredDefResponse(getCredDefResponse)
        
        log('사용자의 MasterSecret 생성...')
        userMasterSecret = await indy.proverCreateMasterSecret(userWalletHandle, undefined)

        log('VC 발급 요청 생성...')
        const [credReq, credReqMetaData] = await indy.proverCreateCredentialReq(userWalletHandle, userDid, credOfferRequest.data, _credDef, userMasterSecret)
        
        log('VC 발급 요청...')
        const credOffer = credOfferRequest.data
        const credReqData = await axios.post(`${url}/make_cred`, {'credReq': credReq, 'credOffer': credOffer})
        
        log('사용자가 발급받은 VC를 자신의 지갑에 저장하는 중...')
        const outCreDID = await indy.proverStoreCredential(userWalletHandle, null, credReqMetaData, credReqData.data, _credDef, null)
        
        log('VC 발급 완료')
        resolve(credReqData.data)
    })
}

function makeEnteranceVP_USER(type){
    return new Promise(async (resolve, reject)=>{
        log('VP 생성에 필요한 속성을 생성합니다...')
        const proofRequestReponse = await axios.get(`${baseURL_Enterance}/get_proof_req/${type}`)
        const EnteranceProofRequest = proofRequestReponse.data

        const schemaSchoolRequest = await axios.get(`${baseURL_School}/get_schema`)
        const schemaLabRequest = await axios.get(`${baseURL_Lab}/get_schema`)

        const schemaSchool = schemaSchoolRequest.data
        const schemaLab = schemaLabRequest.data

        const credDefSchoolRequest = await axios.get(`${baseURL_School}/get_cred_def`)
        const credDefLabRequest = await axios.get(`${baseURL_Lab}/get_cred_def`)
        
        const credDefSchool = credDefSchoolRequest.data
        const credDefLab = credDefLabRequest.data
        
        log('출입관리소에서 요구한 속성을 자신이 가지고 있는지 확인합니다')
        if(type==='library'){
            let requisites = await indy.proverSearchCredentialsForProofReq(userWalletHandle, EnteranceProofRequest, null)
            let credentials = await indy.proverFetchCredentialsForProofReq(requisites, 'attr1_referent', 100)
            let credForAttr1 = credentials[0]['cred_info']
            
            let EnteranceRequestedCredsJson = {
                "self_attested_attributes": {},
                'requested_attributes': {
                    'attr1_referent': {'cred_id': credForAttr1['referent'], 'revealed': true},
                },
                "requested_predicates": {}
            }
            const schemasJson = schemaSchool
            const credDefsJson = credDefSchool
        
            let revocStatesJson = {}
            let revocRefDefsJson = {}
            let revocRegsJson = {}
            
            let userMasterSecretId = await indy.proverCreateMasterSecret(userWalletHandle, null);

            let EnteranceProofJson = await indy.proverCreateProof(userWalletHandle, EnteranceProofRequest, EnteranceRequestedCredsJson, userMasterSecretId, schemasJson, credDefsJson, revocStatesJson)
            resolve(EnteranceProofJson)
        } else {
            let requisites = await indy.proverSearchCredentialsForProofReq(userWalletHandle, EnteranceProofRequest, null)
            let credentials = await indy.proverFetchCredentialsForProofReq(requisites, 'attr1_referent', 100)
            let credForAttr1 = credentials[0]['cred_info']
            
            credentials = await indy.proverFetchCredentialsForProofReq(requisites, 'attr2_referent', 100)
            let credForAttr2 = credentials[0]['cred_info']

            let EnteranceRequestedCredsJson = {
                "self_attested_attributes": {},
                'requested_attributes': {
                    'attr1_referent': {'cred_id': credForAttr1['referent'], 'revealed': true},
                    'attr2_referent': {'cred_id': credForAttr2['referent'], 'revealed': true},
                },
                "requested_predicates": {}
            }
            let schemasJson = Object.assign({}, schemaSchool, schemaLab)
            let credDefsJson = Object.assign({}, credDefSchool, credDefLab)
            
            let revocStatesJson = {}
            let revocRefDefsJson = {}
            let revocRegsJson = {}

            let userMasterSecretId = await indy.proverCreateMasterSecret(userWalletHandle, null);

            let EnteranceProofJson = await indy.proverCreateProof(userWalletHandle, EnteranceProofRequest, EnteranceRequestedCredsJson, userMasterSecretId, schemasJson, credDefsJson, revocStatesJson)
            resolve(EnteranceProofJson)
        }
    })
}

module.exports = {
    makeEnteranceVP_USER,
    makeEnteranceVC_USER,
    getDID,
}