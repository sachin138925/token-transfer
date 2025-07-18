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

// Constants
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
    <div className="app-container">
      <h1>🦊 Web3 Wallet (BNB + USDT)</h1>

      <div className="form-group">
        <input
          placeholder="Name to create wallet"
          value={walletName}
          onChange={(e) => setWalletName(e.target.value)}
        />
        <button onClick={generateAndSaveWallet}>Generate & Save</button>
      </div>

      <div className="form-group">
        <input
          placeholder="Name to fetch wallet"
          value={searchName}
          onChange={(e) => setSearchName(e.target.value)}
        />
        <button onClick={fetchWalletByName}>Fetch Wallet</button>
      </div>

      {walletData && (
        <div className="wallet-info">
          <h3>🔐 Wallet Details</h3>
          <p><strong>Name:</strong> {walletData.name}</p>
          <p><strong>Address:</strong> {walletData.address}</p>
          <p><strong>Private Key:</strong> {walletData.privateKey}</p>
          <p><strong>Mnemonic:</strong> {walletData.mnemonic}</p>
          <p><strong>BNB Balance:</strong> {balance !== null ? `${balance} BNB` : "Loading..."}</p>
          <p><strong>USDT Balance:</strong> {usdtBalance !== null ? `${usdtBalance} USDT` : "Loading..."}</p>

          <div className="transfer-section">
            <h4>🚀 Send BNB or USDT</h4>
            <input
              placeholder="Recipient Address"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
            />
            <input
              placeholder="Amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <button onClick={sendBNB}>Send BNB</button>
            <button onClick={transferUSDT}>Send USDT</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
