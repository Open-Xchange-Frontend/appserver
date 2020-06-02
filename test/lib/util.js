const fs = require('fs')
const path = require('path')

function traverse (root, subDir) {
  const dirname = path.join(root, subDir || '')

  return fs.readdirSync(dirname).map(function (basename) {
    const filename = path.join(dirname, basename)
    const stat = fs.statSync(filename)

    if (stat.isDirectory()) {
      return {
        name: basename,
        content: traverse(dirname, basename)
      }
    }
    return {
      name: basename,
      content: fs.readFileSync(filename, 'utf-8')
    }
  }).reduce(function (acc, file) {
    acc[file.name] = file.content
    return acc
  }, {})
}

module.exports = {
  load: traverse
}
