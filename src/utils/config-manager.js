const isBrowser = typeof window !== 'undefined' && typeof window.document !== 'undefined'

let fs, mkdir, join

// Initialize Node.js dependencies
async function initNodeDependencies() {
  if (!isBrowser && !fs) {
    const promises = await import('fs').then(module => module.promises)
    const fsPromises = await import('node:fs/promises')
    const path = await import('path')

    fs = promises
    mkdir = fsPromises.mkdir
    join = path.join
  }
}

const nodeConfigPath = (path) => join(path, 'config.json')

const nodeSaveConfig = async ({ path, config }) => {
  await initNodeDependencies()
  await mkdir(path, { recursive: true })
  const configFilePath = nodeConfigPath(path)
  const data = JSON.stringify(config)

  await fs.writeFile(configFilePath, data, { flags: 'w' })
}

const nodeLoadConfig = async ({ path }) => {
  await initNodeDependencies()
  const configFilePath = nodeConfigPath(path)
  const config = JSON.parse(await fs.readFile(configFilePath))
  return config
}

export const saveConfig = nodeSaveConfig
export const loadConfig = nodeLoadConfig
