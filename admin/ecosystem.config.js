module.exports = {
  apps: [{
    name: 'ndg-admin-prod',
    script: 'server.js',
    cwd: '/var/www/nosdicengeeks-prod/admin',
    env: {
      PORT: 3000,
      NODE_ENV: 'production'
    }
  }]
}
