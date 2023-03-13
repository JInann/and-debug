// 命令行执行
let log = true
const {execSync} = require('child_process')
const CMD = (cmd)=>{
  log&&console.log(cmd)
  let result = execSync(cmd).toString()
  log&&console.log(result)
  return result
}

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
        let pidStr
        try {
          pidStr = CMD('adb shell grep -a webview_devtools_remote /proc/net/unix')
        } catch (error) {
          if(/command not found/.test(error.message)){
            console.error('请先安装adb命令行工具')
          }else{
            console.log('没有找到运行中的webview')
          }
        }
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
              const debuggerUrl2 = item.devtoolsFrontendUrl.replace('chrome-devtools-frontend.appspot.com','devtools.1036892522.top')
              console.log(item.title)
              console.log(item.url)
              console.log('调试地址：')
              console.log(debuggerUrl2)
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