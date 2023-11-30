// Import required libraries and modules
const express = require('express');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const mongoose = require('mongoose');
const { Server } = require('http'); 
const socketIo = require('socket.io');

// Create an Express application
const app = express();
// Set the port for the server to either the environment variable or default to 3005
const PORT = process.env.PORT || 3005;
// Set the MongoDB URI to either the environment variable or default to a local database
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';

mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });

const ClientInfo = require('./clientincomemodel');

// Create an HTTP server with socket.io
const server = Server(app);
const io = handleSocketConnections(server); 

// Function to handle socket connections
function handleSocketConnections(server) {
  const io = socketIo(server);

  io.on('connection', (socket) => {
    console.log('Socket connected:', socket.id);

    // Handle socket disconnections
    socket.on('disconnect', () => {
      console.log('Socket disconnected:', socket.id);
    });
  });

  return io;
}

// Function to send socket events
const sendSocketEvent = (io, eventName, data) => {
  io.emit(eventName, data);
};
// Endpoint to retrieve data and export it to a CSV file
const getDataSheet = async (req, res) => {
  try {
    const clientData = await ClientInfo.find({});

    // Validate data before exporting to CSV
    if (!clientData || clientData.length === 0) {
      sendSocketEvent(io, 'export_failed', { status: 'Failed', issue: 'No data found' });
      return res.status(404).json({ status: 'Failed', issue: 'No data found' });
    }
	// Create a CSV writer to export data to a CSV file
    const csvWriter = createCsvWriter({
      path: 'clients.csv',
      header: [
        { id: '_id', title: '_id' },
        { id: 'clientName', title: 'clientName' },
        { id: 'clientEmail', title: 'clientEmail' },
        { id: 'clientIncomePerMonth', title: 'clientIncomePerMonth' },
        { id: 'clientSavingsPerMonth', title: 'clientSavingsPerMonth' },
        { id: 'clientMobileNum', title: 'clientMobileNum' },
        { id: 'clientAddress', title: 'clientAddress' },
      ],
    });

    await csvWriter.writeRecords(clientData);

    // Send a success socket event
    sendSocketEvent(io, 'export_successful', {
      status: 'Success',
      message: 'Data inserted into the CSV file successfully!',
      clientData,
    });

    return res.status(200).json({
      status: 'Success',
      message: 'Data inserted into the CSV file successfully!',
      clientData,
    });
  } catch (error) {
    console.error('Error:', error);
    sendSocketEvent(io, 'export_failed', {
      status: 'Failed',
      issue: 'An error occurred',
      error: error.message,
    });
    return res.status(500).json({
      status: 'Failed',
      issue: 'An error occurred',
      error: error.message,
    });
  }
};

// Basic authentication middleware
const authenticate = (req, res, next) => {
  const username = req.headers['username'];
  const password = req.headers['password'];

  if (username === 'your_username' && password === 'your_password') {
    next();
  } else {
    res.status(401).json({ status: 'Failed', issue: 'Unauthorized' });
  }
};

// Route to trigger the export middleware with authentication
app.get('/export', authenticate, getDataSheet);

// Start the server
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
