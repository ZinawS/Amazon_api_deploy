import express from "express";
import cors from "cors";
import Stripe from "stripe";
import dotenv from "dotenv";

// 1. Load environment variables
dotenv.config();

// 2. Initialize Stripe with proper error handling
let stripe;
try {
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2023-08-16",
  });
} catch (err) {
  console.error("Failed to initialize Stripe:", err.message);
  process.exit(1);
}

// 3. Create Express app with enhanced configuration
const app = express();

// Enhanced CORS configuration
const corsOptions = {
  origin:
    process.env.NODE_ENV === "production"
      ? process.env.ALLOWED_ORIGINS.split(",")
      : true,
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json({ limit: "10kb" }));

// Add request logging middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// 4. Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "healthy" });
});

// 5. Payment endpoint with enhanced validation
app.post("/payment/create", async (req, res) => {
  // Validate request content type
  if (!req.is("application/json")) {
    return res.status(415).json({ error: "Unsupported Media Type" });
  }

  const { amount, currency = "usd" } = req.body;

  // Enhanced validation
  if (typeof amount !== "number" || amount < 50) {
    return res.status(400).json({
      error: "Amount must be a number of at least 50 cents",
    });
  }

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount),
      currency,
      metadata: {
        integration_check: "accept_a_payment",
        app_version: process.env.npm_package_version,
      },
    });

    return res.status(201).json({
      clientSecret: paymentIntent.client_secret,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      id: paymentIntent.id,
    });
  } catch (err) {
    console.error("Stripe Error:", err);

    const statusCode = err.type === "StripeInvalidRequestError" ? 400 : 500;
    return res.status(statusCode).json({
      error: err.message,
      code: err.code,
      type: err.type,
    });
  }
});

// 6. Error handling middleware
app.use((err, req, res, next) => {
  console.error("Server Error:", err);
  res.status(500).json({ error: "Internal Server Error" });
});

// 7. Start server with proper shutdown handling
const PORT = parseInt(process.env.PORT || "3000", 10);
const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received. Shutting down gracefully...");
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});
