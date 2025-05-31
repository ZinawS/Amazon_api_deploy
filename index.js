const express = require("express");
const cors = require("cors");
const Stripe = require("stripe");
const dotenv = require("dotenv");

dotenv.config();

// 1. Initialize Stripe with error handling
let stripe;
try {
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2023-08-16",
  });
} catch (err) {
  console.error("Failed to initialize Stripe:", err.message);
  process.exit(1);
}

// 2. Create Express app
const app = express();

// 3. Enhanced CORS configuration
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

// 4. Request logger middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// 5. Health check
app.get("/health", (req, res) => {
  res.status(200).json({ status: "healthy" });
});

// 6. Payment route
app.post("/payment/create", async (req, res) => {
  if (!req.is("application/json")) {
    return res.status(415).json({ error: "Unsupported Media Type" });
  }

  const { amount, currency = "usd" } = req.body;

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
        app_version: process.env.npm_package_version || "1.0.0",
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

// 7. Error handler
app.use((err, req, res, next) => {
  console.error("Server Error:", err);
  res.status(500).json({ error: "Internal Server Error" });
});

// 8. Start server
const PORT = parseInt(process.env.PORT || "3000", 10);
const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

// 9. Graceful shutdown
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
