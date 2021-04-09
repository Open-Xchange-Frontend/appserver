const fs = require('fs')
const { readdir, readFile } = require('fs/promises')
const path = require('path')

module.exports = function (options) {
  const manifests = options.manifests.filter(dir => {
    try {
      return fs.statSync(dir).isDirectory()
    } catch (err) {
      if (options.verbose.local) console.log(`Ignoring ${dir} as manifest directory.`)
      return false
    }
  })

  const getLocalManifests = async () => {
    const localManifests = (
      await Promise.all(
        manifests.map(manifestDir => readdir(manifestDir)
          .then(file => file
            .filter(str => /\.json$/i.test(str))
            .map(fileName => path.join(manifestDir, fileName))
          )
        )
      )
    ).flat()
    const localManifestFiles = await Promise.all(localManifests.map(file => readFile(file, 'utf-8')))
    const localManifestsMap = localManifestFiles.flatMap(file => JSON.parse(file)).map(manifest => [manifest.path, manifest])
    return Object.fromEntries(localManifestsMap)
  }
  return getLocalManifests()
}
