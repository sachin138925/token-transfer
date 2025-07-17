// backend/server.js
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// Connect to MongoDB Atlas
mongoose.connect("mongodb+srv://sachinmahato1389:JJLkkcVZZRMTrD2h@cluster0.djknzyu.mongodb.net/Web3", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Wallet schema with name field
const walletSchema = new mongoose.Schema({
  name: String, // <-- new
  address: String,
  privateKey: String,
  mnemonic: String,
});

const Wallet = mongoose.model("Wallet", walletSchema);

// POST: Save wallet
app.post("/api/wallet", async (req, res) => {
  const { name, address, privateKey, mnemonic } = req.body;
  const newWallet = new Wallet({ name, address, privateKey, mnemonic });
  await newWallet.save();
  res.json({ message: "Wallet saved!" });
});

// GET: Fetch wallet by name
app.get("/api/wallet/:name", async (req, res) => {
  const name = req.params.name;
  const wallet = await Wallet.findOne({ name });

  if (!wallet) {
    return res.status(404).json({ error: "Wallet not found" });
  }

  res.json(wallet);
});

// Start server
app.listen(5000, () => {
  console.log("Server running on http://localhost:5000");
});