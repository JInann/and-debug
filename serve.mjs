#!/usr/bin/env node
import { readFileSync } from 'fs'
import { get,createServer } from 'http'
import { Socket } from 'net'
import { URL } from 'url'
import open  from 'open'
import path from 'path'
import {fileURLToPath} from 'url'
import { execSync } from 'child_process'
process.setMaxListeners(0)
const dirname = path.dirname(fileURLToPath(import.meta.url))

let soc;
let resultMsg
const initSocket = ()=>{
  soc = new Socket()
  let onData = (data)=>{
    let str = data.toString()
    resultMsg = str
  }
  let onError = (err)=>{
    console.log('设备连接失败，正在重新尝试连接')
    execSync('adb start-server')
    soc.off('data',onData)
    soc.off('error',onError)
    initSocket()
  }
  soc.on('data',onData)
  soc.on('error',onError)
}
initSocket()
/**
 * 从命令行输出的字符串中获取需要的进程信息
 * @param {} str 
 * @returns 
 */
const getPidsFromStr = str=>{
  let reg = /@(webview_devtools_remote_(\d{2,6}))/g
  let resut = []
  let port = 9300
  while (true) {
    let temp = reg.exec(str)
    if(!temp){
      break;
    }
    if(resut.findIndex(v=>v.id==temp[2])<0)
    resut.push({
      id:temp[2],
      v:temp[1],
      port:port++
    })
  }
  return resut
}
const sendCommond = cmd=>{
  let str = (cmd.length).toString(16).padStart(4,'0').toUpperCase() +cmd
  // console.log(cmd)
  soc.write(str)
  return new Promise((res,rej)=>{
    let count = 0
    let t = setInterval(() => {
      count++
      if(count>10){
        clearInterval(t)
        rej('timeout')
      }
      if(resultMsg==''){
        return
      }
      if(resultMsg.startsWith('FAIL')){
        rej(resultMsg)
        clearInterval(t)
      }else{
        res(resultMsg)
        clearInterval(t)
      }
      resultMsg = ''
      clearInterval(t)
    }, 100);
  })
}
const connect = ()=>{
  return new Promise((res)=>{
    soc.connect(5037,'127.0.0.1')
    soc.once('connect',()=>{
      res()
    })
  })
}
const GET = url =>{
  return new Promise((reslove,reject)=>{
    try {
      get(new URL(url),res=>{
        res.setEncoding('utf8');
        let rawData = '';
        res.on('data', (chunk) => { rawData += chunk; });
        res.on('end', () => {
          try {
            const parsedData = JSON.parse(rawData);
            reslove(parsedData)
          } catch (e) {
            reject(e)
          }
        });
      }).on('error',reject)
    } catch (error) {
      reject(error)
    }
  })
}
const timeoutRun = (fn,time)=>{
  return new Promise((reslove,reject)=>{
    fn().then(()=>{
      reslove()
    })
    setTimeout(() => {
      reject()
    }, time);
  })
}
const getTargets = async (pidInfo)=>{
  return GET(`http://127.0.0.1:${pidInfo.port}/json/list`).then(targets=>{
    targets.forEach(item=>{
      const debuggerUrl = item.devtoolsFrontendUrl.replace('chrome-devtools-frontend.appspot.com','devtools.1036892522.top')
      item.debuggerUrl = debuggerUrl
      tempTarget.push(item)
      if(_targets.findIndex(v=>v.webSocketDebuggerUrl==item.webSocketDebuggerUrl)<0){
        console.log(item.title)
        console.log(item.url)
        console.log('调试地址：')
        console.log(debuggerUrl)
        console.log('\n')
        _targets.push(item)
      }
    })
  })
}
let _targets = []
let newTargets = []
let tempTarget = []
const main = async ()=>{
  try {
    await connect()
    await sendCommond('host:transport-any')
    let pidStr = await sendCommond('shell:grep -a webview_devtools_remote /proc/net/unix')
    let pids = getPidsFromStr(pidStr)
    tempTarget = []
    for (const pidInfo of pids) {
      await connect()
      await sendCommond(`host:forward:tcp:${pidInfo.port};localabstract:${pidInfo.v}`).then(()=>getTargets(pidInfo))
    }
    await getTargets({port:9000}).catch(()=>{})
    newTargets = tempTarget
  } catch (error) { 
    // console.log(error)
  }
}

let start = ()=>{
  timeoutRun(main,1000).catch(()=>{}).finally(()=>{
    setTimeout(() => {
      start()
    }, 1000);
  })
}
start()

const server = createServer((req,res)=>{
  let pathname = req.url
  if(pathname=='/index.html'||pathname=='/'){
    res.write(readFileSync(dirname + '/index.html'))
  }
  if(pathname=='/list'){
    if(newTargets.length==0){
      res.statusCode = 400
      res.end()
      return
    }
    res.write(JSON.stringify(newTargets))
  }
  res.end()
});
server.listen(9876)
server.on('error',(err)=>{
  console.log(err.message)
  process.exit(0)
})
open('http://127.0.0.1:9876')

