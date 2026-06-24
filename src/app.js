const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const routes = require('./routes');
const { errorHandler, notFound } = require('./middleware/errorHandler');

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10kb' }));
app.use(morgan('dev'));

app.get('/health', (_req, res) => {
  res.status(200).json({ success: true, message: 'API is healthy' });
});

app.use('/api', routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
