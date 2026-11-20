const webpack = require('webpack');
const path = require('path');

const config = {
  mode: 'production',
  target: 'webworker',
  entry: path.resolve(__dirname, '../server/teamHubRenderer.jsx'),
  resolve: { extensions: ['.js', '.jsx', '.mjs', '.json'] },
  experiments: { outputModule: true },
  output: {
    path: path.resolve(__dirname, '../functions/_generated'),
    filename: 'teamHub.mjs',
    library: { type: 'module' },
  },
  module: {
    rules: [
      {
        test: /\.[jt]sx?$/,
        exclude: /node_modules/,
        use: {
          loader: require.resolve('babel-loader'),
          options: {
            babelrc: false,
            configFile: false,
            presets: [[require.resolve('@babel/preset-react'), { runtime: 'automatic' }]],
          },
        },
      },
      { test: /\.css$/, type: 'asset/source' },
      { test: /\.(svg|png|jpg|woff2?|otf)$/, type: 'asset/inline' },
    ],
  },
  optimization: { minimize: false },
  plugins: [new webpack.DefinePlugin({
    'process.env.REACT_APP_API_BASE': JSON.stringify('https://virtuous-exploration-staging.up.railway.app'),
    'process.env.REACT_APP_GA_TRACKING_ID': 'undefined',
    'process.env.REACT_APP_FB_PIXEL_ID': 'undefined',
    'process.env.REACT_APP_ADSENSE_TEST_MODE': 'undefined',
  })],
  performance: { hints: false },
};

webpack(config, (error, stats) => {
  if (error || stats.hasErrors()) {
    console.error(error || stats.toString({ all: false, errors: true }));
    process.exitCode = 1;
    return;
  }
  console.log(stats.toString({ all: false, assets: true, warnings: true }));
});
