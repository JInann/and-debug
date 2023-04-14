const { execSync } = require('child_process')
const { writeFileSync, readFileSync } = require('fs')
let current_version = require('./package.json').version
let temp = current_version.split('.')
temp[2]= parseInt(temp[2]) + 1
let next_version = temp.join('.')
let package_json_str = readFileSync('./package.json').toString()
package_json_str = package_json_str.replace(`"version": "${current_version}"`,`"version": "${next_version}"`)
writeFileSync('./package.json',package_json_str)
execSync('git add package.json && git commit -m release-' + next_version + ' && git push')