const path = require('path');
const CleanWebpackPlugin = require('clean-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const WebpackPwaManifest = require('webpack-pwa-manifest');
const { InjectManifest } = require('workbox-webpack-plugin');

module.exports = {
  mode: 'production',
  entry: {
    app: './src/index.js',
  },
  output: {
    filename: '[name].bundle.js',
    path: path.resolve(__dirname, 'dist')
  },
  plugins: [
    new CleanWebpackPlugin({
      cleanOnceBeforeBuildPatterns: ['**/*', '!.gitkeep'],
    }),
    new HtmlWebpackPlugin({
      title: 'Agenda',
      favicon: path.resolve('./src/favicon.png'),
      template: './src/index.html'
    }),
    new WebpackPwaManifest({
      name: 'Tournament Agenda',
      short_name: 'Agenda',
      start_url: '/agenda/',
      scope: '/agenda/',
      display: 'standalone',
      background_color: '#ececec',
      theme_color: '#c32b3e',
      icons: [
        {
          src: path.resolve('./src/assets/agenda_logo_192.png'),
          size: '192x192',
        },
        {
          src: path.resolve('./src/assets/agenda_logo_512.png'),
          size: '512x512',
        }
      ]
    }),
    new InjectManifest({
      swSrc: path.resolve('./src/service-worker.js'),
      swDest: 'service-worker.js',
    })
  ],
  module: {
    rules: [
      {
        test: /\.css$/,
        use: [
          'style-loader',
          'css-loader'
        ]
      },
      {
        test: /\.(png|svg|jpg|gif|webp|json)$/,
        use: [
          'file-loader'
        ]
      },
      { test: /\.js$/, exclude: /node_modules/, loader: "babel-loader" }
    ]
  }
};
