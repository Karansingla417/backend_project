// Import required libraries and modules
const express = require('express');
const bodyParser = require('body-parser');
const twilio = require('twilio');

const rateLimit = require('express-rate-limit');
const amqp = require('amqplib');
require('dotenv').config();
// Twilio credentials from environment variables
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
// MongoDB connection using Mongoose
const mongoose = require('mongoose');
const app = express();
const PORT = 3003;
// Function to send a message to the RabbitMQ queue
const sendMessageToQueue = async (message) => {
	const connection = await amqp.connect('amqp://localhost');
	const channel = await connection.createChannel();
	const queue = 'sms_queue';
  
	await channel.assertQueue(queue, { durable: true });
	channel.sendToQueue(queue, Buffer.from(JSON.stringify(message)), { persistent: true });
  };
// MongoDB connection URI from environment variable or default to a local database
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
// Parse incoming request data
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Require the client information model from an external module
const ClientInfo = require("./clientincomemodel");

// Middleware to send customer receipt via SMS
const SendSMStoCustomer = async (req, res) => {
	try {
		//accept the customer id from params
		const { id: UserId } = req.params;
		//serach in db for the customer..
		const reqClient = await ClientInfo.findOne({ _id: UserId });
		console.log("My data,", reqClient);
		// if the customer could not be found .
		if (!reqClient) {
			return res.status(404).json({
				status: "Failed",
				response: "The user with given ID does not exists!",
			});
		} else {
			//if the customer was found then the receipt in form of sms
			const client = new twilio(accountSid, authToken);
			var Customer_Reciept = ` Your Details :\n 
        email id :${reqClient.clientEmail}\n 
        name : ${reqClient.clientName}\n 
        Income per Month: ${reqClient.clientIncomePerMonth}\n
        Savings per Month: ${reqClient.clientSavingsPerMonth}\n
        contact Number : ${reqClient.clientMobileNum}\n
        Thanks for your response !Have a nice day!`;
		await sendMessageToQueue({
			body: Customer_Reciept,
			to: `+${91}${reqClient.clientMobileNum}`,
			from: twilioPhoneNumber,
		  });

			res.status(200).json({
				status: "Success",
				message: "Message Sent Successfully!",
			});
		}
	} catch (error) {
		return res.status(500).json({
			status: "Failed!",
			message: "Something Went Wrong!",
			issue: error.message,
		});
	}
};
// Rate limiting middleware to limit requests to the '/register/:id' endpoint
const limiter = rateLimit({
	windowMs: 60 * 1000, 
	max: 5, 
  });
// Route to trigger the SMS sending middleware with rate limiting
app.post('/register/:id', limiter, SendSMStoCustomer, (req, res) => {
	res.json({ message: 'Registration successful' });
  });
// Start the server and listen on the specified port
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
