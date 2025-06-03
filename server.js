const express = require("express");
const { OAuth2Client } = require("google-auth-library");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const cors = require("cors");
const csurf = require("csurf");
const bcrypt = require("bcryptjs");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.urlencoded({ extended: true }));

const csrfProtection = csurf({ cookie: true });
app.use(csrfProtection);

mongoose
  .connect("mongodb://localhost:27017/chargefinder", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("MongoDB-yə qoşuldu"))
  .catch((err) => {
    console.error("MongoDB bağlantı xətası:", err);
    process.exit(1);
  });

const userSchema = new mongoose.Schema({
  googleId: { type: String, required: true, unique: true },
  name: String,
  email: { type: String, required: true, unique: true },
  isPremium: { type: Boolean, default: false },
  apiKey: String,
});
const User = mongoose.model("User", userSchema);

const GOOGLE_CLIENT_ID = "332899016010-1jqlrmo7ngj8mj9733atmpffn8rmeit8.apps.googleusercontent.com";
const client = new OAuth2Client(GOOGLE_CLIENT_ID);
const REDIRECT_URI = "http://localhost:3000";
const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret_key";

app.get("/", (req, res) => {
  res.send("Server işləyir");
});

app.get("/callback", async (req, res) => {
  const { code } = req.query;
  try {
    const { tokens } = await client.getToken({ code, redirect_uri: REDIRECT_URI });
    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    res.redirect(`/?code=${code}`);
  } catch (error) {
    res.status(400).json({ success: false, message: "Authentication failed", error: error.message });
  }
});

app.post("/api/google-signin", async (req, res) => {
  const { code } = req.body;
  try {
    const { tokens } = await client.getToken({ code, redirect_uri: REDIRECT_URI });
    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();

    let user = await User.findOne({ googleId: payload.sub });
    if (!user) {
      user = new User({
        googleId: payload.sub,
        name: payload.name,
        email: payload.email,
        isPremium: false,
        apiKey: "cf_" + Math.random().toString(36).substr(2, 16),
      });
      await user.save();
    }

    const jwtToken = jwt.sign(
      { id: payload.sub, email: payload.email, name: payload.name },
      JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.json({
      success: true,
      token: jwtToken,
      user: {
        id: user.googleId,
        name: user.name,
        email: user.email,
        isPremium: user.isPremium,
        apiKey: user.apiKey,
      },
    });
  } catch (error) {
    res.status(400).json({ success: false, message: "Authentication failed", error: error.message });
  }
});

app.get("/api/user/status", async (req, res) => {
  const token = req.headers.authorization?.split("Bearer ")[1];
  if (!token) {
    return res.status(401).json({ success: false, message: "Unauthorized: No token provided" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findOne({ googleId: decoded.id });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.json({
      success: true,
      user: {
        id: user.googleId,
        name: user.name,
        email: user.email,
        isPremium: user.isPremium,
        apiKey: user.apiKey,
      },
    });
  } catch (error) {
    res.status(401).json({ success: false, message: "Unauthorized: Invalid token", error: error.message });
  }
});

app.post("/api/verify-paddle", async (req, res) => {
  const { userId } = req.body;
  try {
    const user = await User.findOne({ googleId: userId });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    user.isPremium = true;
    await user.save();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to verify payment", error: error.message });
  }
});

app.listen(3000, () => console.log("Server 3000 portunda işləyir"));