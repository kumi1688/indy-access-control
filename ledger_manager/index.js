const express = require('express')
const app = express()
const port = 3000

const {run, enrollUser, enrollEndorser} = require('./legder_manager.js')

let stewardDid = ''
let stewardVerkey = ''
let poolName = ''

app.use(express.json())
app.use(express.urlencoded())

app.get('/', async (req,res)=>{
    res.send({
        poolName, stewardDid, stewardVerkey
    })
})

app.post('/request_endorser', async (req,res)=>{
    console.log('request_endorser 요청이 들어옴')
    console.log(req.body)
    // res.status(200).send('OK')

    const {trustAnchorDid, trustAnchorVerkey} = req.body
    params = {trustAnchorDid, trustAnchorVerkey}
    result = enrollEndorser(params)
    console.log(result)
    if(result) res.status(200).send('Ok')
    else res.status(400).send('not enlisted')
})


app.post('/request_NYM', async (req,res)=>{
    console.log('request_NYM 요청이 들어옴')
    console.log(req.body)
    
    const {userDid, userVerkey} = req.body
    params = {userDid, userVerkey}
    result = enrollUser(params)
    console.log(result)
    if(result) res.status(200).send('Ok')
    else res.status(400).send('not enlisted')
})

app.listen(port, async ()=>{
    console.log(`ledger manager server is running at http://localhost:${port}`)
    const [_poolName, _stewardDid, _stewardVerkey] = await run()
    poolName = _poolName
    stewardDid = _stewardDid
    stewardVerkey = _stewardVerkey
    
    console.log(poolName)
    console.log(stewardDid)
    console.log(stewardVerkey)
})