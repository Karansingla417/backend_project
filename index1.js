// Import required libraries and modules
const express = require('express');
const mongoose = require('mongoose');
const { check, validationResult } = require('express-validator');
const Client = require('./clientincomemodel');
const redis = require('redis');
const expressRedisCache = require('express-redis-cache');
require('dotenv').config();

// Create an Express application
const app = express();
// Set the port for the server to either the environment variable or default to 3010
const port = process.env.PORT || 3010;
// Connect to MongoDB using Mongoose
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log('Connected to MongoDB');
  })
  .catch((error) => {
    console.error('Error connecting to MongoDB:', error);
  });

// Enable JSON parsing for incoming requests
app.use(express.json());

const MOBILE_NUMBER_LENGTH = 10;

// Middleware for validating new client input
const validateNewClientMiddleware = [
  check('clientIncomePerMonth').custom((value, { req }) => {
    if (value <= req.body.clientSavingsPerMonth) {
      throw new Error('Client monthly savings exceed client monthly income.');
    }
    return true;
  }),
  check('clientMobileNum').isLength({ min: MOBILE_NUMBER_LENGTH, max: MOBILE_NUMBER_LENGTH })
    .withMessage(`Mobile number must be ${MOBILE_NUMBER_LENGTH} digits.`),
];
// Create a Redis client
const client = redis.createClient({
	host: process.env.REDIS_HOST || 'localhost',
	port: process.env.REDIS_PORT || 6379,
  });

// Create a Redis cache with a 60-second expiration time
const cache = expressRedisCache({
	client: client,
	expire: 60, 
  });
// Middleware for logging incoming requests
app.use((req, res, next) => {
  console.log(`Received request at ${new Date()}: ${req.method} ${req.url}`);
  next();
});

// Endpoint for validating and creating a new client
app.post(
  '/api/validateNewClient',
  validateNewClientMiddleware,
  async (req, res) => {
    try {
      // Validate input using express-validator
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          status: 'Failed',
          message: 'Validation error',
          errors: errors.array(),
        });
      }

      const cachedData = await client.get(req.originalUrl);
      if (cachedData) {
        const parsedData = JSON.parse(cachedData);
        return res.status(200).json(parsedData);
      }

      const newClient = await Client.create(req.body);

      // Cache the data
      client.setex(req.originalUrl, 60, JSON.stringify({
        status: 'Success',
        message: 'Client successfully created!',
        newClient,
      }));

      // Send response
      res.status(201).json({
        status: 'Success',
        message: 'Client successfully created!',
        newClient,
      });
    } catch (error) {
      console.error('Error in create client:', error);
      // Handle validation error
      if (error.name === 'ValidationError') {
        return res.status(500).json({
          status: 'Failed',
          message: 'Validation error',
          issue: Object.values(error.errors).map((val) => val.message),
        });
      }
      // Handle other errors
      return res.status(500).json({
        status: 'Failed',
        message: 'Something Went Wrong! (Either Email Or Mobile number is duplicate!)',
        issue: error.message,
      });
    }
  }
);

// Start the server and listen on the specified port
app.listen(port, async () => {
	console.log(`Server is running on port ${port}`);
  });
