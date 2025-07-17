import React, { useState, useEffect } from "react";
import {
  Wallet,
  isAddress,
  parseEther,
  JsonRpcProvider,
  formatEther,
} from "ethers";

function App() {
  const [walletData, setWalletData] = useState(null);
  const [walletName, setWalletName] = useState("");
  const [searchName, setSearchName] = useState("");
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [balance, setBalance] = useState(null);

  const provider = new JsonRpcProvider("https://bsc-testnet-dataseed.bnbchain.org");

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
      } else {
        setWalletData(data);
        fetchBalance(data.privateKey);
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

  const sendTokens = async () => {
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
      alert(`✅ Transaction successful!\nHash: ${tx.hash}`);
      setAmount("");
      fetchBalance(walletData.privateKey); // Refresh balance
    } catch (error) {
      console.error("Transaction error:", error);
      alert("❌ Transaction failed.");
    }
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.heading}>🦊 Mini Web3 Wallet</h1>

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
          <h3>🔐 Wallet Details</h3>
          <p><strong>Name:</strong> {walletData.name}</p>
          <p><strong>Address:</strong> {walletData.address}</p>
          <p><strong>Private Key:</strong> {walletData.privateKey}</p>
          <p><strong>Mnemonic:</strong> {walletData.mnemonic}</p>
          <p><strong>Balance:</strong> {balance !== null ? `${balance} BNB` : "Loading..."}</p>

          <section style={{ marginTop: "20px" }}>
            <h4>🚀 Send BNB</h4>
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
            <button onClick={sendTokens} style={styles.button}>
              Send Tokens
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
};

export default App;
