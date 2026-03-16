module.exports = {
  apps: [{
    name: 'next',
    script: 'server.js',
    kill_timeout: 120000,
    env: {
      PORT: 40005,
    },
  }]
};
