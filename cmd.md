adb shell grep -a webview_devtools_remote /proc/net/unix
adb forward tcp:9222 localabstract:webview_devtools_remote_12050
https://chrome-devtools-frontend.appspot.com/serve_rev/@015deec36d00c1f36b96fed01b8e913faf2b1e6c/inspector.html?ws=127.0.0.1:9222/devtools/page/239EFCF1572CD1EB719E39D1EFD166B5
