// backend/server.js
const express  = require("express");
const mongoose = require("mongoose");
const cors     = require("cors");
const bcrypt   = require("bcrypt");

const app = express();
app.use(cors());
app.use(express.json());

// REPLACE the URI with your own Atlas string
mongoose.connect("mongodb+srv://sachinmahato1389:JJLkkcVZZRMTrD2h@cluster0.djknzyu.mongodb.net/Web3", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

/* ---------- SCHEMA ---------- */
const walletSchema = new mongoose.Schema({
  name: { type: String, unique: true },
  address: String,
  privateKey: String,
  mnemonic: String,
  passwordHash: String,
});

const Wallet = mongoose.model("Wallet", walletSchema);

/* ---------- CREATE ---------- */
app.post("/api/wallet", async (req, res) => {
  try {
    const { name, address, privateKey, mnemonic, password } = req.body;

    if (!name?.trim() || !password?.trim())
      return res.status(400).json({ error: "Name & password required" });

    console.log("CREATE: received password =", JSON.stringify(password));

    const passwordHash = await bcrypt.hash(password, 12);
    const newWallet = new Wallet({
      name,
      address,
      privateKey,
      mnemonic,
      passwordHash,
    });

    await newWallet.save();
    res.json({ message: "Wallet saved!" });
  } catch (err) {
    if (err.code === 11000)
      return res.status(409).json({ error: "Name already exists" });
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

/* ---------- FETCH ---------- */
app.post("/api/wallet/:name", async (req, res) => {
  try {
    const { name } = req.params;
    const { password } = req.body;

    console.log("FETCH: received password =", JSON.stringify(password));

    const wallet = await Wallet.findOne({ name });
    if (!wallet) return res.status(404).json({ error: "Wallet not found" });

    const ok = await bcrypt.compare(password, wallet.passwordHash);
    if (!ok) return res.status(401).json({ error: "Invalid password" });

    const { passwordHash, ...safeWallet } = wallet.toObject();
    res.json(safeWallet);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

/* ---------- START ---------- */
app.listen(5000, () => console.log("Server running on http://localhost:5000"));