import React, { useState, useEffect } from "react";
import {
  Wallet,
  isAddress,
  parseEther,
  formatEther,
  JsonRpcProvider,
  Contract,
} from "ethers";
import "./App.css";

const RPC_URL = "https://bsc-testnet-dataseed.bnbchain.org";
const USDT_CONTRACT_ADDRESS = "0x787A697324dbA4AB965C58CD33c13ff5eeA6295F";
const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
];

function App() {
  const [walletData, setWalletData] = useState(null);
  const [walletName, setWalletName] = useState("");
  const [searchName, setSearchName] = useState("");
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [balance, setBalance] = useState(null);
  const [usdtBalance, setUsdtBalance] = useState(null);

  const provider = new JsonRpcProvider(RPC_URL);

  const generateAndSaveWallet = async () => {
    if (!walletName.trim()) {
      alert("Please enter a name for the wallet.");
      return;
    }

    const wallet = Wallet.createRandom();

    const newWallet = {
      name: walletName,
      address: wallet.address,
      privateKey: wallet.privateKey,
      mnemonic: wallet.mnemonic.phrase,
    };

    try {
      const res = await fetch("http://localhost:5000/api/wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newWallet),
      });

      if (res.ok) {
        alert("✅ Wallet generated and saved!");
        setWalletName("");
      } else {
        alert("❌ Failed to save wallet.");
      }
    } catch (error) {
      console.error("Error saving wallet:", error);
      alert("❌ Something went wrong.");
    }
  };

  const fetchWalletByName = async () => {
    if (!searchName.trim()) {
      alert("Please enter a wallet name to fetch.");
      return;
    }

    try {
      const res = await fetch(`http://localhost:5000/api/wallet/${searchName}`);
      const data = await res.json();

      if (data.error) {
        alert("❌ Wallet not found.");
        setWalletData(null);
        setBalance(null);
        setUsdtBalance(null);
      } else {
        setWalletData(data);
        fetchBalance(data.privateKey);
        getUSDTBalance(data.address);
      }
    } catch (error) {
      console.error("Error fetching wallet:", error);
      alert("❌ Error fetching wallet.");
    }
  };

  const fetchBalance = async (privateKey) => {
    try {
      const wallet = new Wallet(privateKey, provider);
      const bal = await provider.getBalance(wallet.address);
      setBalance(formatEther(bal));
    } catch (error) {
      console.error("Error fetching balance:", error);
      setBalance(null);
    }
  };

  const getUSDTBalance = async (address) => {
    try {
      const usdt = new Contract(USDT_CONTRACT_ADDRESS, ERC20_ABI, provider);
      const balance = await usdt.balanceOf(address);
      const decimals = await usdt.decimals();
      setUsdtBalance(formatEther(balance, decimals));
    } catch (err) {
      console.error("USDT balance error:", err);
    }
  };

  const sendBNB = async () => {
    if (!walletData?.privateKey) {
      alert("Please load a wallet first.");
      return;
    }

    if (!isAddress(recipient)) {
      alert("Invalid recipient address.");
      return;
    }

    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
      alert("Invalid amount.");
      return;
    }

    try {
      const wallet = new Wallet(walletData.privateKey, provider);
      const tx = await wallet.sendTransaction({
        to: recipient,
        value: parseEther(amount),
      });

      await tx.wait();
      alert(`✅ BNB Transaction successful!\nHash: ${tx.hash}`);
      setAmount("");
      fetchBalance(walletData.privateKey);
    } catch (error) {
      console.error("BNB Transaction error:", error);
      alert("❌ BNB Transaction failed.");
    }
  };

  const transferUSDT = async () => {
    try {
      const wallet = new Wallet(walletData.privateKey, provider);
      const usdt = new Contract(USDT_CONTRACT_ADDRESS, ERC20_ABI, wallet);
      const decimals = await usdt.decimals();
      const tx = await usdt.transfer(recipient, parseEther(amount));
      await tx.wait();
      alert("✅ USDT Transfer Successful!");
      getUSDTBalance(wallet.address);
    } catch (err) {
      console.error("Transfer Error:", err);
      alert("❌ USDT Transfer Failed");
    }
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.heading}>🦊 Web3 Wallet (BNB + USDT)</h1>

      <section style={styles.section}>
        <input
          type="text"
          placeholder="Name to create wallet"
          value={walletName}
          onChange={(e) => setWalletName(e.target.value)}
          style={styles.input}
        />
        <button onClick={generateAndSaveWallet} style={styles.button}>
          Generate & Save
        </button>
      </section>

      <section style={styles.section}>
        <input
          type="text"
          placeholder="Name to fetch wallet"
          value={searchName}
          onChange={(e) => setSearchName(e.target.value)}
          style={styles.input}
        />
        <button onClick={fetchWalletByName} style={styles.button}>
          Fetch Wallet
        </button>
      </section>

      {walletData && (
        <div style={styles.walletBox}>
          <h3 style={styles.subheading}>🔐 Wallet Details</h3>
          <p><strong>Name:</strong> {walletData.name}</p>
          <p><strong>Address:</strong> {walletData.address}</p>
          <p><strong>Private Key:</strong> {walletData.privateKey}</p>
          <p><strong>Mnemonic:</strong> {walletData.mnemonic}</p>
          <p><strong>BNB Balance:</strong> {balance !== null ? `${balance} BNB` : "Loading..."}</p>
          <p><strong>USDT Balance:</strong> {usdtBalance !== null ? `${usdtBalance} USDT` : "Loading..."}</p>

          <section style={{ marginTop: "20px" }}>
            <h4 style={styles.subheading}>🚀 Send Tokens</h4>
            <input
              type="text"
              placeholder="Recipient Address"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              style={styles.input}
            />
            <input
              type="text"
              placeholder="Amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              style={styles.input}
            />
            <button onClick={sendBNB} style={{ ...styles.button, marginRight: "10px" }}>
              Send BNB
            </button>
            <button onClick={transferUSDT} style={styles.button}>
              Send USDT
            </button>
          </section>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    padding: "30px",
    fontFamily: "Arial, sans-serif",
    maxWidth: "700px",
    margin: "auto",
    textAlign: "center",
  },
  heading: {
    fontSize: "2rem",
    marginBottom: "20px",
    color: "#1f2937",
  },
  section: {
    marginBottom: "20px",
  },
  input: {
    padding: "10px",
    marginRight: "10px",
    width: "60%",
    border: "1px solid #ccc",
    borderRadius: "8px",
  },
  button: {
    padding: "10px 20px",
    backgroundColor: "#3b82f6",
    color: "white",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
  },
  walletBox: {
    marginTop: "30px",
    padding: "20px",
    border: "1px solid #e5e7eb",
    borderRadius: "10px",
    backgroundColor: "#f9fafb",
    textAlign: "left",
  },
  subheading: {
    marginBottom: "10px",
    color: "#111827",
  },
};

export default App;