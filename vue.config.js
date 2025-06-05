module.exports = {
  pluginOptions: {
    electronBuilder: {
      nodeIntegration: true,
      contextIsolation: false,
      builderOptions: {
        // 解决 alpha 版本可能存在的构建问题
        npmRebuild: false
      }
    }
  }
}