module.exports = {
    pluginOptions: {
        electronBuilder: {
            nodeIntegration: true,
            builderOptions: {
                appId: 'myyoutubeplayer.com',
                win: {
                  icon: 'icon/windows.png'
                }
            }
        }
    },

    transpileDependencies: [
      'vuetify'
    ],

    configureWebpack: {
        devtool: 'source-map'
    }
}
