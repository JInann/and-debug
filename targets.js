const CDP = require('chrome-remote-interface');

async function example() {
    try {
      // 9305换成自己的端口号
      CDP.List({port:9305}).then(res=>{
          console.log(res)
        })
    } catch (err) {
        console.error(err);
    }
}

example();