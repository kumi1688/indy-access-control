const path = require('path')
const express = require('express')
const app = express()
const util = require('./util.js')

const server = require('http').createServer(app)
const io = require('socket.io')(server)
app.set('io', io)

const ejs = require('ejs')
const port = 3004

// 1. ledger에 등록된 did를 verinym 이라고 한다
// 2. legder에 등록된 did를 확인하기 위한 과정을 verinym transaction이라고 한다

app.use(express.json())
app.use(express.urlencoded())
app.set('views', path.join(__dirname, 'views'))
app.set('view engine', 'ejs')
app.engine('html', require('ejs').renderFile);

const didManager = require('./enterance_did_manager.js')

app.get('/page', (req,res)=>{
    res.render('index.html')
})

app.get('/', (req,res)=>{
    res.send('ok')
})

app.get('/connect_indy', async(req,res)=>{
    const [trustAnchorDid, trustAnchorVerkey] = await didManager.getDID(io)
    const data = {
        msg: 'DID 생성 및 TrustAnchor 등록이 완료되었습니다',
        trustAnchorDid: trustAnchorDid,
        trustAnchorVerkey: trustAnchorVerkey
    }
    console.log(data)
    res.json(data)
})

app.get('/get_proof_req/:type', (req,res)=>{
    const proof = didManager.getProofRequisites(req.params.type)
    res.json(proof)
})

app.get('/make_enterance_VP', async(req, res)=>{
    let data = await didManager.makeEnteranceVP()
    data = {msg: 'VP 발급에 성공하였습니다', ...data}
    res.json(data)
})

app.get('/requsites/:type', async(req,res)=>{
    const type = req.params.type
    const data = await didManager.showRequites(type)
    res.json(data)
})

app.get('/make_VP/:type', async(req,res)=>{
    const type = req.params.type
    let data = await didManager.makeEnteranceVP(type)
    data = {msg: `${type === 'library' ? '학교도서관' : '연구실'} VP 발급에 성공하였습니다`, ...data}
    res.json(data)
})

io.on('connection', (socket)=>{
    console.log('소켓이 연결되었습니다')
    // val = 0
    // setInterval(()=>{
    //     socket.emit('msg', val++)
    // }, 1000)
})

server.listen(port, async ()=>{
    console.log(`did manager server is running at http://localhost:${port}`)
    await didManager.getDID(io)
})
