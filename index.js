// Import required libraries and modules
const express = require('express');
const rateLimit = require('express-rate-limit');
const { translate } = require('@vitalets/google-translate-api');

// Create an Express application
const app = express();

// Set the port for the server to either the environment variable or default to 3000
const port = process.env.PORT || 3000;

// Enable JSON parsing for incoming requests
app.use(express.json());

// Configure rate limiting for the API endpoint
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Maximum 100 requests per window
});

// Define a route for handling slang translation requests
app.get('/api/slang', apiLimiter, async (req, res) => {
  // Extract word and language from the request query parameters
  const { word, lang } = req.query;

  try {
    // Check if required parameters are present
    if (!word || !lang) {
      return res.status(400).json({ error: 'Word and language are required parameters' });
    }

    // Translate the word to the specified language
    const translation = await translate(word, { to: lang });

    // Check if translation response is valid
    if (!translation || !translation.text) {
      return res.status(500).json({ error: 'Translation error', type: 'INVALID_TRANSLATION_RESPONSE' });
    }

    // Extract the translated slang
    const slang = translation.text;

    // Send the response with original word, slang, and language
    res.json({ originalWord: word, slang, language: lang });
  } catch (error) {
    // Handle translation errors
    console.error('Translation error:', error);

    // Check for rate limit exceeded error
    if (error.statusCode === 429) {
      res.status(429).json({ error: 'Too many requests', type: 'RATE_LIMIT_EXCEEDED' });
    } else {
      // Handle other internal server errors
      res.status(500).json({ error: 'Internal server error', type: 'TRANSLATION_ERROR' });
    }
  }
});

// Start the server and listen on the specified port
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
