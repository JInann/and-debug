// 命令行执行
let log = true
const {execSync} = require('child_process')
const CMD = (cmd)=>{
  log&&console.log(cmd)
  let result = execSync(cmd).toString()
  log&&console.log(result)
  return result
}


// web服务
const path = require('path')
const handler = require('serve-handler');
const http = require('http');
const server = http.createServer((request, response) => {
  return handler(request, response,{
    public:path.join(__dirname,'./devtools')
  });
});
server.listen(3030, () => {
  console.log('Running at http://localhost:3030');
});



const CDP = require('chrome-remote-interface');
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
const _targets =[]
async function main() {
    try {
        // 获取进程信息
        let pidStr = CMD('adb shell grep -a webview_devtools_remote /proc/net/unix')
        // 可能是多个webview进程
        const pids = getPidsFromStr(pidStr)
        log&&console.log(pids)
        pids.forEach(pidInfo=>{
          // 绑定端口与进程
          CMD(`adb forward tcp:${pidInfo.port} localabstract:${pidInfo.v}`)
        })
        Promise.all(pids.map(v=>{
          // 获取webview中的所有页面信息
          return CDP.List({port:v.port})
        })).then(res=>{
          let targets = res.reduce((p,c)=>{
            p.push(...c)
            return p
          },[])
          targets.forEach(item=>{
            if(_targets.findIndex(v=>v.webSocketDebuggerUrl==item.webSocketDebuggerUrl)<0){
              // 拼接调试地址
              const debuggerUrl = `http://localhost:3030/page/serve_rev/index/?ws=`+item.webSocketDebuggerUrl.replace('ws://','')
              console.log(item.title)
              console.log(item.url)
              console.log(debuggerUrl)
              console.log('\n')
              _targets.push(item)
            }
          })
        })
    } catch (err) {
        console.error(err);
    }
}
main();
setInterval(()=>{
  log = false
  main();
},5000)