import React, { useState } from "react";
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

/* ---------- GENERIC CARD HELPER ---------- */
const Card = ({ title, children }) => (
  <section className="card">
    {title && <h3>{title}</h3>}
    {children}
  </section>
);

export default function App() {
  /* ---------- UI STATE ---------- */
  const [mode, setMode] = useState("create");
  const [walletName, setWalletName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [revealInput, setRevealInput] = useState("");
  const [showSensitive, setShowSensitive] = useState(false);
  const [sending, setSending] = useState(false);

  /* ---------- WALLET STATE ---------- */
  const [walletData, setWalletData] = useState(null);
  const [balance, setBalance] = useState(null);
  const [usdtBalance, setUsdtBalance] = useState(null);

  /* ---------- SEND STATE ---------- */
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [sendToken, setSendToken] = useState("BNB");
  const [lastSentTx, setLastSentTx] = useState("");

  /* ---------- VERIFY STATE ---------- */
  const [txHash, setTxHash] = useState("");
  const [txReceipt, setTxReceipt] = useState(null);
  const [txAmount, setTxAmount] = useState("");

  const provider = new JsonRpcProvider(RPC_URL);

  /* ---------- BALANCE HELPERS ---------- */
  const fetchBalance = async (addr) => {
    const bal = await provider.getBalance(addr);
    setBalance(formatEther(bal));
  };
  const getUSDTBalance = async (addr) => {
    const usdt = new Contract(USDT_CONTRACT_ADDRESS, ERC20_ABI, provider);
    const bal = await usdt.balanceOf(addr);
    const dec = await usdt.decimals();
    setUsdtBalance(formatEther(bal, dec));
  };

  /* ---------- CREATE OR FETCH ---------- */
  const handleSubmit = async () => {
    if (!walletName.trim() || !password.trim())
      return alert("Fill all fields");

    if (mode === "create") {
      if (password !== confirmPw) return alert("Passwords don’t match");
      const wallet = Wallet.createRandom();
      const payload = {
        name: walletName,
        address: wallet.address,
        privateKey: wallet.privateKey,
        mnemonic: wallet.mnemonic.phrase,
        password,
      };
      const res = await fetch("http://localhost:5000/api/wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        alert("✅ Wallet created & saved");
        setWalletName("");
        setPassword("");
        setConfirmPw("");
      } else {
        const msg = await res.text();
        alert(msg || "❌ Save failed");
      }
    }

    if (mode === "fetch") {
      const res = await fetch(
        `http://localhost:5000/api/wallet/${walletName}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        }
      );
      const data = await res.json();
      if (data.error) return alert(data.error);
      setWalletData(data);
      fetchBalance(data.address);
      getUSDTBalance(data.address);
    }
  };

  /* ---------- SEND ---------- */
  const handleSend = async () => {
    if (!walletData) return alert("Load wallet first");
    if (!isAddress(recipient)) return alert("Invalid address");
    if (!amount || parseFloat(amount) <= 0) return alert("Invalid amount");

    setSending(true);
    try {
      const wallet = new Wallet(walletData.privateKey, provider);
      let tx;
      if (sendToken === "BNB") {
        tx = await wallet.sendTransaction({
          to: recipient,
          value: parseEther(amount),
        });
      } else {
        const usdt = new Contract(USDT_CONTRACT_ADDRESS, ERC20_ABI, wallet);
        tx = await usdt.transfer(recipient, parseEther(amount));
      }
      await tx.wait();
      alert(`✅ ${sendToken} sent: ${tx.hash}`);
      setLastSentTx(tx.hash);
      setAmount("");
      fetchBalance(wallet.address);
      getUSDTBalance(wallet.address);
    } catch (e) {
      alert("❌ Transaction failed");
    } finally {
      setSending(false);
    }
  };

  /* ---------- VERIFY ---------- */
  /* ---------- VERIFY HELPERS ---------- */
const fetchReceipt = async () => {
  const trimmed = txHash.trim();
  if (!/^0x([A-Fa-f0-9]{64})$/.test(trimmed)) {
    alert("Invalid transaction hash");
    return;
  }
  try {
    const receipt = await provider.getTransactionReceipt(trimmed);
    if (!receipt) {
      alert("Transaction not found (still pending or unknown)");
      return;
    }

    // --- Decode value / amount ---
    const tx = await provider.getTransaction(trimmed);
    let amountStr = "";

    // Native BNB transfer
    if (!tx.to || tx.to === receipt.to) {
      amountStr = formatEther(tx.value);
    } else {
      // Potential ERC-20 (USDT) transfer
      try {
        const usdt = new Contract(USDT_CONTRACT_ADDRESS, ERC20_ABI, provider);
        const iface = new Contract(USDT_CONTRACT_ADDRESS, ERC20_ABI, provider);
        const log = receipt.logs.find(
          (l) => l.topics[0] === iface.interface.getEvent("Transfer").topicHash
        );
        if (log) {
          const parsed = iface.interface.parseLog(log);
          amountStr = formatEther(parsed.args[2], 18); // USDT has 18 decimals
        }
      } catch {
        amountStr = "n/a";
      }
    }

    setTxReceipt(receipt);
    setTxAmount(amountStr);
  } catch (e) {
    alert("❌ Error fetching receipt");
  }
};

  return (
    <div className="app">
      <h1 className="title">🦊 Web3 Wallet (BNB + USDT)</h1>

      {/* ---------- GENERATE / FETCH CARD ---------- */}
      <section className="card">
        <div className="inputRow">
          <div className="pillToggle">
            <span
              className={mode === "create" ? "active" : ""}
              onClick={() => setMode("create")}
            >
              Create
            </span>
            <span
              className={mode === "fetch" ? "active" : ""}
              onClick={() => setMode("fetch")}
            >
              Fetch
            </span>
          </div>

          <input
            placeholder="Wallet Name"
            value={walletName}
            onChange={(e) => setWalletName(e.target.value)}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {mode === "create" && (
            <input
              type="password"
              placeholder="Confirm"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
            />
          )}
        </div>

        <button className="btn" onClick={handleSubmit}>
          {mode === "create" ? "Generate & Save" : "Fetch Wallet"}
        </button>
      </section>

      {walletData && (
        <>
          <Card title="🔐 Wallet Details">
            <p><strong>Name:</strong> {walletData.name}</p>
            <p><strong>Address:</strong> {walletData.address}</p>
            <p><strong>BNB Balance:</strong> {balance ?? "…"} BNB</p>
            <p><strong>USDT Balance:</strong> {usdtBalance ?? "…"} USDT</p>
          </Card>

          <Card title="👁 Reveal Private key and Mnemonic">
            <div className="inputRow">
              <input
                type="password"
                placeholder="Enter password"
                value={revealInput}
                onChange={(e) => setRevealInput(e.target.value)}
              />
              <button
                className="btn"
                onClick={() => {
                  if (revealInput !== password) {
                    alert("Wrong password");
                    return;
                  }
                  setShowSensitive((p) => !p);
                  setRevealInput("");
                }}
              >
                {showSensitive ? "Hide" : "Reveal"}
              </button>
            </div>

            {showSensitive && (
              <div className="secretsBox">
                <p><strong>Private Key:</strong></p>
                <textarea rows={2} readOnly value={walletData.privateKey} />
                <p style={{ marginTop: "0.8rem" }}><strong>Mnemonic:</strong></p>
                <textarea rows={2} readOnly value={walletData.mnemonic} />
              </div>
            )}
          </Card>

          <Card title="🚀 Send Tokens">
            <div className="inputRow">
              <input
                placeholder="Recipient Address"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
              />
            </div>
            <div className="inputRow">
              <input
                placeholder="Amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <select
                value={sendToken}
                onChange={(e) => setSendToken(e.target.value)}
              >
                <option value="BNB">BNB</option>
                <option value="USDT">USDT</option>
              </select>
            </div>
            <button className="btn" onClick={handleSend} disabled={sending}>
              {sending ? "Sending…" : `Send ${sendToken}`}
            </button>

            {lastSentTx && (
              <p style={{ marginTop: "0.5rem", fontSize: "0.9rem" }}>
                Last tx:{" "}
                <a
                  href={`https://testnet.bscscan.com/tx/${lastSentTx}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {lastSentTx}
                </a>
              </p>
            )}
          </Card>

          <Card title="🔍 Verify Any Transaction">
  <div className="inputRow">
    <input
      placeholder="Paste transaction hash"
      value={txHash}
      onChange={(e) => {
        setTxHash(e.target.value.trim());
        setTxReceipt(null);
        setTxAmount("");
      }}
    />
    <button className="btn" onClick={fetchReceipt}>
      Lookup
    </button>
  </div>

  {txReceipt && (
    <div style={{ marginTop: "0.8rem", fontSize: "0.9rem" }}>
      <p><strong>Hash:</strong> {txReceipt.hash}</p>
      <p><strong>Block:</strong> #{txReceipt.blockNumber}</p>
      <p>
        <strong>Status:</strong>{" "}
        {txReceipt.status === 1 ? "✅ Success" : "❌ Reverted"}
      </p>
      <p><strong>Gas used:</strong> {txReceipt.gasUsed.toString()}</p>
      <p><strong>From:</strong> {txReceipt.from}</p>
      <p><strong>To:</strong> {txReceipt.to}</p>
      <p><strong>Amount sent:</strong> {txAmount}</p>
    </div>
  )}
</Card>
        </>
      )}
    </div>
  );
}