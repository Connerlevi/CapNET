import React, { useEffect, useState, useCallback } from "react";
import { health, CapDoc } from "./api";
import { Templates } from "./Templates";
import { ActiveCaps } from "./ActiveCaps";
import { Receipts } from "./Receipts";

type ConnectionState = "checking" | "connected" | "error";
type Tab = "templates" | "capabilities" | "receipts";

export function Popup() {
  const [connectionState, setConnectionState] = useState<ConnectionState>("checking");
  const [statusText, setStatusText] = useState("Checking proxy...");
  const [activeTab, setActiveTab] = useState<Tab>("templates");
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Extracted health check for retry support
  const checkProxy = useCallback(async () => {
    let alive = true;
    setConnectionState("checking");
    setStatusText("Checking proxy...");

    try {
      const data = await health();
      if (!alive) return;

      const status = data?.status ?? "unknown";
      const version = data?.version ?? "?";
      setStatusText(`Proxy: ${status} (v${version}) @ 3100`);
      setConnectionState("connected");
    } catch (err) {
      if (!alive) return;

      // Robust error detection: treat TypeError as network unreachable
      if (err instanceof TypeError) {
        setStatusText("Proxy unreachable - is it running?");
      } else if (err instanceof Error) {
        if (err.name === "AbortError") {
          setStatusText("Proxy timeout - is it running?");
        } else {
          setStatusText(`Proxy error: ${err.message}`);
        }
      } else {
        setStatusText("Proxy unreachable");
      }
      setConnectionState("error");
    }

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    checkProxy();
  }, [checkProxy]);

  // Callback when a capability is issued - refresh lists and switch to capabilities tab
  const handleCapabilityIssued = useCallback((_cap: CapDoc) => {
    setRefreshTrigger((n) => n + 1);
    setActiveTab("capabilities");
  }, []);

  // Only refresh when tab actually changes, and only for data-fetching tabs
  const handleTabChange = (tab: Tab) => {
    setActiveTab((prev) => {
      if (prev !== tab) {
        // Only trigger refresh for tabs that fetch data
        if (tab === "capabilities" || tab === "receipts") {
          setRefreshTrigger((n) => n + 1);
        }
      }
      return tab;
    });
  };

  return (
    <div className="popup">
      <header className="popup-header">
        <h1>CapNet Wallet</h1>
        <p className="tagline">Capability-based authorization</p>
      </header>

      <div className={`status status--${connectionState}`}>
        <span className="status-indicator" />
        <span className="status-text">{statusText}</span>
      </div>

      {connectionState === "connected" && (
        <>
          <nav className="tabs">
            <button
              className={`tab ${activeTab === "templates" ? "tab--active" : ""}`}
              onClick={() => handleTabChange("templates")}
            >
              Templates
            </button>
            <button
              className={`tab ${activeTab === "capabilities" ? "tab--active" : ""}`}
              onClick={() => handleTabChange("capabilities")}
            >
              Active
            </button>
            <button
              className={`tab ${activeTab === "receipts" ? "tab--active" : ""}`}
              onClick={() => handleTabChange("receipts")}
            >
              Receipts
            </button>
          </nav>

          <main className="tab-content">
            {activeTab === "templates" && (
              <Templates onCapabilityIssued={handleCapabilityIssued} />
            )}
            {activeTab === "capabilities" && (
              <ActiveCaps refreshTrigger={refreshTrigger} />
            )}
            {activeTab === "receipts" && (
              <Receipts refreshTrigger={refreshTrigger} />
            )}
          </main>
        </>
      )}

      {connectionState === "error" && (
        <div className="help-text">
          <p>Start the proxy with:</p>
          <code>npm run dev</code>
          <button className="retry-btn" onClick={checkProxy}>
            Retry Connection
          </button>
        </div>
      )}

      {connectionState === "checking" && (
        <div className="checking-text">
          <p>Connecting to proxy...</p>
        </div>
      )}
    </div>
  );
}
