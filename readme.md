解决Chrome调试手机H5调试工具打不开的问题



在调试手机H5的时候，Chrome提供了非常强大的的远程调试工具。使用起来非常方便，和调试电脑网页的体验几乎一致。但美中不足的是，调试手机页面的时候，chrome需要从网络上下载需要的文件。由于众所周知的原因，需要下载的文件一般上加载不到。就算使用的网路环境可以下载到的话，加载起来也比较慢，体验不是很好。



解决思路：

1. 把需要的文件，下载到本地（此步骤需要可以访问外网），并在本地启动一个web服务。
2. 使用adb工具，建立电脑与手机间的调试通道。
3. 使用`chrome-remote-interface`，获取手机上已打开的所有webview地址，及对应的远程调试接口地址。
4. 根据第3步获取到的调试地址，把调试地址的域名换成自己web服务的ip地址。
5. 大功告成，访问速度贼快



### 具体步骤

##### 1.连接设备 

先获取安卓设备内webview 的进程信息，`webview_devtools_remote_29842`就是我们需要的进程信息。

```bash
#输入
adb shell grep -a webview_devtools_remote /proc/net/unix 
#输出
0000000000000000: 00000002 00000000 00010000 0001 01 24956052 @webview_devtools_remote_29842 
```

绑定端口（例：9222）和进程

```bash
#输入
adb forward tcp:9222 localabstract:webview_devtools_remote_29842
#输出
9222
```

> [android SDK下载地址(adb)](https://developer.android.com/studio/releases/platform-tools?hl=zh-cn)


##### 2.获取原调试地址

执行代码

```javascript
const CDP = require('chrome-remote-interface');

async function example() {
    try {
      // 9222换成自己的端口号
      CDP.List({port:9222}).then(res=>{
          console.log(res)
        })
    } catch (err) {
        console.error(err);
    }
}

example();
```

输出：

```json
[
  {
    description: '{"attached":true,"empty":false,"height":2150,"screenX":0,"screenY":0,"visible":true,"width":1080}',
    devtoolsFrontendUrl: 'http://chrome-devtools-frontend.appspot.com/serve_rev/@015deec36d00c1f36b96fed01b8e913faf2b1e6c/inspector.html?ws=127.0.0.1:9305/devtools/page/AB7CDF58CB81ABD88120BDB3E6DA4F82',
    faviconUrl: 'https://打个码.com/favicon.ico',
    id: 'AB7CDF58CB81ABD88120BDB3E6DA4F82',
    title: '公告',
    type: 'page',
    url: 'https://打个码.com/index.html',
    webSocketDebuggerUrl: 'ws://127.0.0.1:9305/devtools/page/AB7CDF58CB81ABD88120BDB3E6DA4F82'
  },
]
```

`devtoolsFrontendUrl` 可以直接在浏览器中打开，每个人的路径可能也不一样。

##### 3.下载资源

获取到`devtoolsFrontendUrl`后就可以使用工具保存网站资源了，由于各个tab是按需加载的，所以几个tab都需要打开下。我使用的是chrome插件。

> [chrome插件地址](https://github.com/up209d/ResourcesSaverExt)

##### 4.编写脚本

以上步骤完成后，通过替换`devtoolsFrontendUrl`中的路径为本地服务器路径（保留参数，参数`?ws=webSocketDebuggerUrl`），本地页面就可以跑起来了。但是这样操作每次都很麻烦。编写脚本，解放双手

```javascript
// 命令行执行
const {execSync} = require('child_process')
const CMD = (cmd)=>{
  console.log(cmd)
  let result = execSync(cmd).toString()
  console.log(result)
  return result
}


// web服务
const handler = require('serve-handler');
const http = require('http');
const server = http.createServer((request, response) => {
  return handler(request, response,{
    public:'./devtools' //填下载文件的路径
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
    resut.push({
      id:temp[2],
      v:temp[1],
      port:port++
    })
  }
  return resut
}
async function main() {
    try {
        // 获取进程信息
        let pidStr = CMD('adb shell grep -a webview_devtools_remote /proc/net/unix')
        // 可能是多个webview进程
        const pids = getPidsFromStr(pidStr)
        console.log(pids)
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
            console.log(item.title)
            console.log(item.url)
            // 拼接调试地址
            console.log(`http://localhost:3030/page/serve_rev/index/?ws=`+item.webSocketDebuggerUrl.replace('ws://',''))
            console.log('\n')
          })
        })
    } catch (err) {
        console.error(err);
    }
}

main();
```

执行结果如下：

```javascript
....

页面标题
https://xxx/x.html#/
http://localhost:3030/page/serve_rev/index/?ws=127.0.0.1:9301/devtools/page/740978DFC1ECBDE15D582BA138CEEA65

...
```

点击调试地址，在浏览器中打开直接调试。









