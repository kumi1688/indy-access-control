const path = require('path')
const express = require('express')
const app = express()
const util = require('./util.js')

const server = require('http').createServer(app)
const io = require('socket.io')(server)
app.set('io', io)

const ejs = require('ejs')
const port = 3001

// 1. ledger에 등록된 did를 verinym 이라고 한다
// 2. legder에 등록된 did를 확인하기 위한 과정을 verinym transaction이라고 한다

app.use(express.json())
app.use(express.urlencoded())
app.set('views', path.join(__dirname, 'views'))
app.set('view engine', 'ejs')
app.engine('html', require('ejs').renderFile);

const didManager = require('./user_did_manager.js')


app.get('/page', (req,res)=>{
    res.render('index.html')
})

app.get('/', (req,res)=>{
    res.send('ok')
})

app.get('/connect_indy', async(req,res)=>{
    const [userDid, userVerkey] = await didManager.getDID(io)
    const data = {
        msg: '블록체인 연결이 완료되었습니다',
        userDid: userDid,
        userVerkey: userVerkey
    }
    res.json(data)
})

app.get('/make_school_VC', async(req, res)=>{
    let data = await didManager.makeEnteranceVC_USER('school')
    data = {msg: '대학교 학생증 VC 발급에 성공하였습니다', ...data}
    res.json(data)
})

app.get('/make_lab_VC', async(req, res)=>{
    let data = await didManager.makeEnteranceVC_USER('lab')
    data = {msg: '연구실 VC 발급에 성공하였습니다', ...data}
    res.json(data)
})

app.get('/make_enterance_VP/:type', async(req, res)=> {
    let data = await didManager.makeEnteranceVP_USER(req.params.type)
    const typeKorea = req.params.type === 'library' ? '학교 도서관 출입' : '연구실 출입'
    data = {msg: `${typeKorea} VP 발급에 성공하였습니다`, ...data}
    res.json(data)
})

io.on('connection', (socket)=>{
    console.log('소켓이 연결되었습니다')
    // val = 0
    // setInterval(()=>{
    //     socket.emit('msg', val++)
    // }, 1000)
})

server.listen(port, ()=>{
    console.log(`did manager server is running at http://localhost:${port}`)
})