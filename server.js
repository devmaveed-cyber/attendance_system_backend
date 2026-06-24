require('dotenv').config();

const app = require('./src/app');
const connectDB = require('./src/config/db');
const env = require('./src/config/env');

const startServer = async () => {
  await connectDB();

  app.listen(env.port, () => {
    console.log(`Server running on port ${env.port} [${env.nodeEnv}]`);
  });
};

startServer().catch((error) => {
  console.error('Failed to start server:', error.message);
  process.exit(1);
});
