import express from "express";
import cors from "cors";
import Stripe from "stripe";
import dotenv from "dotenv";

// 1. Load environment variables
dotenv.config();

// 2. Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_your_key", {
  apiVersion: "2023-08-16",
});

// 3. Create Express app
const app = express();
// In your backend index.js
app.use(
  cors({
    origin: true, // Allow all origins
    methods: ["GET", "POST", "OPTIONS"], // Add OPTIONS for preflight
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json());

// 4. Root Route
app.get("/", (req, res) => {
  res.send("✅ Welcome! Express server is running.");
});

// 5. Test Endpoint
app.get("/test", (req, res) => {
  res.json({
    message: "✅ API is working!",
    tryThis: "GET /payment/create?total=1000",
  });
});

// 6. Payment Endpoint

app.post("/payment/create", async (req, res) => {
  // Get amount from request body instead of query
  const { amount } = req.body;

  // Validate amount
  if (!amount || isNaN(amount) || amount <= 0) {
    return res.status(400).json({ error: "Valid amount is required" });
  }

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: parseInt(amount),
      currency: "usd",
    });

    res.status(200).json({
      clientSecret: paymentIntent.client_secret,
      message: "✅ PaymentIntent created successfully",
    });
  } catch (error) {
    console.error("Stripe error:", error);
    res.status(500).json({
      error: error.message || "Failed to create PaymentIntent",
    });
  }
});

// 7. Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
