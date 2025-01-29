const express = require('express');
const Stripe = require('stripe');
require('dotenv').config(); // Load the environment variables from the .env file

const stripe = Stripe(process.env.STRIPE_SECRET_KEY); // Access Stripe key from .env
const bodyParser = require('body-parser');
const app = express();



// Middleware to parse JSON bodies
app.use(bodyParser.json());



const paypal = require('@paypal/checkout-server-sdk');

// Use body parser middleware to parse JSON bodies
app.use(bodyParser.json());

// PayPal environment setup (Sandbox mode)
const paypalClientId = process.env.PAYPAL_CLIENT_ID; // PayPal client ID from .env
const paypalSecret = process.env.PAYPAL_SECRET; // PayPal secret key from .env

// Your PayPal environment configuration can now use these values
const environment = new paypal.core.SandboxEnvironment(paypalClientId, paypalSecret);
const paypalClient = new paypal.core.PayPalHttpClient(environment);

// PayPal Payment Capture Route (POST)
app.post('/paypal-payment-success', async (req, res) => {
    const { orderId, payerId } = req.body;

    // Validate incoming data
    if (!orderId || !payerId) {
        return res.status(400).send('Missing orderId or payerId');
    }

    // Create the PayPal OrdersCaptureRequest to capture payment
    const request = new paypal.orders.OrdersCaptureRequest(orderId);
    request.requestBody({});

    try {
        // Execute the capture request with PayPal
        const capture = await paypalClient.execute(request);  // Use paypalClient instead of client
        console.log('Capture successful:', capture.result);
        
        // Send capture result back to frontend
        res.json(capture.result);
    } catch (err) {
        console.error('Error capturing PayPal payment:', err);
        console.error('Error details:', err.details);  // Log detailed error if available

        // Handle specific errors from PayPal API
        if (err.statusCode === 400) {
            return res.status(400).send('Bad Request: ' + err.message);
        }

        // Catch any other errors
        res.status(500).send('Payment capture failed');
    }
});






app.post('/create-checkout-session', async (req, res) => {
  try {
    const { items } = req.body;

    // Log received items for debugging
    console.log('Received items:', items);

    // Create a map to accumulate quantities for each item, including images
    const itemMap = items.reduce((acc, item) => {
      if (acc[item.name]) {
        acc[item.name].quantity += item.quantity; // Add to the existing quantity
      } else {
        acc[item.name] = { ...item }; // Create a new entry if it doesn't exist
      }
      return acc;
    }, {});

    // Convert the item map back to an array of line items, including images
    const line_items = Object.values(itemMap).map(item => {
      console.log('Line item:', item); // Debugging to check image
      return {
        price_data: {
          currency: 'usd',
          product_data: {
            name: item.name, // Product name
            images: [item.image], // Add image URL(s) for the product
          },
          unit_amount: Math.round(item.price * 100), // Price in cents (Stripe requires prices in cents)
        },
        quantity: item.quantity, // Correct quantity for each item
      };
    });

    // Create a checkout session with shipping address collection and billing address collection
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: line_items,
      mode: 'payment',
      success_url: 'https://jjservice.github.io/L-Su-Ca/success.html', // Redirect to your desired success URL
      cancel_url: 'https://jjservice.github.io/L-Su-Ca/cancel.html',  // Redirect to your desired cancel URL
      shipping_address_collection: {
        allowed_countries: ['US', 'CA'], // Specify which countries are allowed for shipping
      },
      billing_address_collection: 'required', // Collect billing address
    });

    // Send the session ID to the frontend
    res.json({ id: session.id });
  } catch (err) {
    console.error('Error creating session:', err);
    res.status(500).send('Internal Server Error');
  }
});


// Serve static files (for success/cancel pages)
app.use(express.static('public'));

// Start the server
app.listen(4242, () => {
  console.log('Server running on http://localhost:4242');
});
