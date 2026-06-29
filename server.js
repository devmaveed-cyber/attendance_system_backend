require('dotenv').config();

const http = require('http');
const app = require('./src/app');
const connectDB = require('./src/config/db');
const env = require('./src/config/env');
const attachSocketIo = require('./src/socket');

const startServer = async () => {
  await connectDB();

  const server = http.createServer(app);
  attachSocketIo(server, app);

  server.listen(env.port, () => {
    console.log(`Server running on port ${env.port} [${env.nodeEnv}]`);
  });
};

startServer().catch((error) => {
  console.error('Failed to start server:', error.message);
  process.exit(1);
});
