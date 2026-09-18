/**
 * pm2 config for Runkaro (production).
 *
 * Edit the credentials below BEFORE making the site public, then clear the
 * database so it re-seeds with your values and restart:
 *
 *   pm2 delete runkaro
 *   rm -f /opt/runkaro/data/db.json
 *   pm2 start /opt/runkaro/deploy/ecosystem.config.js
 */
module.exports = {
  apps: [
    {
      name: 'runkaro',
      script: 'server.js',
      cwd: '/opt/runkaro',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        ADMIN_EMAIL: 'admin@runkaro.com', // ← change before going public
        ADMIN_PASSWORD: 'Admin@123', // ← change before going public
        STUDENT_EMAIL: 'student@runkaro.com', // ← change (or leave)
        STUDENT_PASSWORD: 'Student@123', // ← change before going public
      },
    },
  ],
};
