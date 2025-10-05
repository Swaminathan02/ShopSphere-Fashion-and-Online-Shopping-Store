const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const app = express();
require("dotenv").config();

const PORT = process.env.PORT || 5050;
const uri = process.env.MONGO_URI;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from project root so files like index.html are reachable
app.use(express.static(path.join(__dirname)));

// User schema
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
});
const User = mongoose.model("User", userSchema);

// Cart schema
const cartSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  items: [
    {
      name: String,
      price: Number,
      img: String,
      qty: Number,
    },
  ],
});
const Cart = mongoose.model("Cart", cartSchema);

// Get cart for user
app.get("/api/cart", async (req, res) => {
  const { username } = req.query;
  if (!username) return res.status(400).json([]);
  try {
    const cart = await Cart.findOne({ username });
    res.json(cart ? cart.items : []);
  } catch (err) {
    res.status(500).json([]);
  }
});

// Save cart for user
app.post("/api/cart", async (req, res) => {
  const { username, cart } = req.body;
  if (!username || !Array.isArray(cart))
    return res.status(400).json({ message: "Invalid data" });
  try {
    let userCart = await Cart.findOne({ username });
    if (userCart) {
      userCart.items = cart;
      await userCart.save();
    } else {
      userCart = new Cart({ username, items: cart });
      await userCart.save();
    }
    res.json({ message: "Cart saved" });
  } catch (err) {
    res.status(500).json({ message: "Error saving cart" });
  }
});

// MongoDB connect
async function connectDB() {
  try {
    const conn = await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    if (conn) {
      console.log("MongoDB connected successfully");
    } else {
      console.error("MongoDB connection failed");
    }
  } catch (err) {
    console.error("MongoDB connection error:", err.message);
    if (err.stack) {
      console.error(err.stack);
    }
  }
}
if (uri) {
  connectDB();
} else {
  console.warn(
    "MONGO_URI not set — skipping MongoDB connection. Some features may be disabled."
  );
}

// Stripe integration
const stripeSecretKey = process.env.STRIPE_SECRET_KEY || null;
let stripe = null;
if (stripeSecretKey) {
  stripe = require("stripe")(stripeSecretKey);
} else {
  console.warn(
    "STRIPE_SECRET_KEY not set — Stripe payment route will be disabled."
  );
}

app.post("/create-payment-intent", async (req, res) => {
  if (!stripe) return res.status(500).json({ error: "Stripe not configured" });
  try {
    console.log("/create-payment-intent called with:", req.body);
    const { amount } = req.body;
    if (!amount || isNaN(amount)) {
      console.error("Invalid amount received:", amount);
      return res.status(400).json({ error: "Invalid amount" });
    }
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: "usd",
      automatic_payment_methods: { enabled: true },
    });
    console.log("Stripe paymentIntent created:", paymentIntent.id);
    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    console.error("Stripe error:", err);
    res.status(500).json({ error: err.message, details: err });
  }
});

// Signup route
app.post("/api/signup", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: "Username and password required" });
  }
  try {
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(409).json({ message: "Username already exists" });
    }
    const user = new User({ username, password });
    await user.save();
    res.status(201).json({ message: "Signup successful" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// Login route
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: "Username and password required" });
  }
  try {
    const user = await User.findOne({ username });
    if (!user || user.password !== password) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    res.status(200).json({ message: "Login successful" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});