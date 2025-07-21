// backend/server.js
const express  = require("express");
const mongoose = require("mongoose");
const cors     = require("cors");
const bcrypt   = require("bcrypt");
const { JsonRpcProvider, Contract, Interface, formatEther, formatUnits } = require("ethers");

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

mongoose.connect(
  "mongodb+srv://sachinmahato1389:JJLkkcVZZRMTrD2h@cluster0.djknzyu.mongodb.net/Web3",
  { useNewUrlParser: true, useUnifiedTopology: true }
);

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

    const passwordHash = await bcrypt.hash(password, 12);
    await new Wallet({ name, address, privateKey, mnemonic, passwordHash }).save();
    res.json({ message: "Wallet saved!" });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: "Name already exists" });
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

/* ---------- FETCH ---------- */
app.post("/api/wallet/:name", async (req, res) => {
  try {
    const { name } = req.params;
    const { password } = req.body;

    const wallet = await Wallet.findOne({ name });
    if (!wallet) return res.status(404).json({ error: "Wallet not found" });

    const ok = await bcrypt.compare(password, wallet.passwordHash);
    if (!ok) return res.status(401).json({ error: "Invalid password" });

    const { passwordHash, ...safe } = wallet.toObject();
    res.json(safe);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

/* ---------- VERIFY TRANSACTION ---------- */
const provider = new JsonRpcProvider("https://bsc-testnet-dataseed.bnbchain.org");
const USDT = "0x787A697324dbA4AB965C58CD33c13ff5eeA6295F";
const USDC = "0x342e3aA1248AB77E319e3331C6fD3f1F2d4B36B1";
const ERC20_ABI = [
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "function decimals() view returns (uint8)",
];

app.get("/api/tx/:hash", async (req, res) => {
  try {
    const { hash } = req.params;
    if (!/^0x([A-Fa-f0-9]{64})$/i.test(hash))
      return res.status(400).json({ error: "Invalid hash format" });

    const receipt = await provider.getTransactionReceipt(hash);
    if (!receipt) return res.status(404).json({ error: "Transaction not found" });

    const tx = await provider.getTransaction(hash);
    let amountStr = "";

    if (!tx.data || tx.data === "0x") {
      amountStr = formatEther(tx.value); // native BNB
    } else {
      const iface = new Interface(ERC20_ABI);
      const topic = iface.getEvent("Transfer").topicHash;
      const log = receipt.logs.find(
        l =>
          l.topics[0] === topic &&
          [USDT, USDC].map(a => a.toLowerCase()).includes(l.address.toLowerCase())
      );

      if (log) {
        const { args } = iface.parseLog(log);
        const decimals = await new Contract(log.address, ERC20_ABI, provider).decimals();
        amountStr = formatUnits(args.value, decimals);
      } else {
        amountStr = "n/a";
      }
    }

    res.json({
      hash: receipt.hash,
      blockNumber: receipt.blockNumber,
      status: receipt.status,
      gasUsed: receipt.gasUsed.toString(),
      from: receipt.from,
      to: receipt.to,
      amountSent: amountStr,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

/* ---------- START ---------- */
app.listen(5000, () => console.log("Server running on http://localhost:5000"));