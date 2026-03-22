const path = require('path');
const webpack = require('webpack');

const TerserJSPlugin = require('terser-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const banner = require('./src/banner.js');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  mode: 'development',
  entry: {
    qrpay_sdk: ['./src/index.js'],
    'qrpay_sdk.min': ['./src/index.js'],
  },
  output: {
    path: path.resolve(__dirname, 'dist/local'),
    filename: '[name].dev.js',
    libraryTarget: 'umd',
    umdNamedDefine: true,
  },
  optimization: {
    minimize: true,
    minimizer: [
      new TerserJSPlugin({
        include: /\.min\./,
      }),
    ],
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /(node_modules)/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              [
                '@babel/preset-env', //@bable/preset-env은 실행환경에 대한 정보를 설정해 주면 자동으로 필요한 기능을 주입한다.
                {
                  targets: '>0.25%, not dead, not op_mini all',
                  useBuiltIns: 'entry',
                  corejs: { version: 3, proposals: true },
                },
              ],
            ],
          },
        },
      },
    ],
  },
  plugins: [
    new webpack.DefinePlugin({ PROFILE: JSON.stringify('local') }),
    new CleanWebpackPlugin(),
    new webpack.BannerPlugin({ banner }),
    new HtmlWebpackPlugin({
      template: './mer.html',
      filename: 'mer.html',
    }),
  ],
};
