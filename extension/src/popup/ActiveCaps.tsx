import React, { useEffect, useState, useMemo } from "react";
import { listCapabilities, revokeCapability, CapDoc } from "./api";

interface CapWithStatus extends CapDoc {
  is_revoked: boolean;
}

// Type narrowing for constraint union
interface SpendConstraints {
  currency: "USD";
  max_amount_cents: number;
  allowed_vendors: string[];
  blocked_categories: string[];
}

function isSpendConstraints(c: unknown): c is SpendConstraints {
  return typeof c === "object" && c !== null && "allowed_vendors" in c;
}

interface ActiveCapsProps {
  refreshTrigger: number;
}

// Safe date parsing helpers
const safeMs = (iso: string): number | null => {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
};

const isExpired = (expiresAt: string): boolean => {
  const t = safeMs(expiresAt);
  // Treat invalid as expired (safer for security UI)
  return t === null || t < Date.now();
};

const formatDate = (iso: string): string => {
  const t = safeMs(iso);
  if (t === null) return "—";
  const d = new Date(t);
  return (
    d.toLocaleDateString() +
    " " +
    d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  );
};

const formatRemaining = (expiresAt: string): string => {
  const t = safeMs(expiresAt);
  if (t === null) return "";
  const ms = t - Date.now();
  if (ms <= 0) return "expired";
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m`;
};

const formatBudget = (cents: number): string => {
  return "$" + (cents / 100).toFixed(2);
};

export function ActiveCaps({ refreshTrigger }: ActiveCapsProps) {
  const [caps, setCaps] = useState<CapWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    const fetchCaps = async () => {
      try {
        setLoading(true);
        const data = await listCapabilities();
        if (!alive) return;
        // Sort by issued_at descending (newest first) - avoid in-place mutation
        const sorted = [...data].sort(
          (a, b) => Date.parse(b.issued_at) - Date.parse(a.issued_at)
        );
        setCaps(sorted);
        setError(null);
      } catch (err) {
        if (!alive) return;
        setError(err instanceof Error ? err.message : "Failed to load capabilities");
      } finally {
        if (alive) setLoading(false);
      }
    };

    fetchCaps();

    return () => {
      alive = false;
    };
  }, [refreshTrigger]);

  // Clear toast after 4 seconds
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  const handleRevoke = async (capId: string) => {
    setRevoking(capId);
    setToast(null);
    try {
      await revokeCapability(capId);
      // Optimistic local update
      setCaps((prev) =>
        prev.map((c) => (c.cap_id === capId ? { ...c, is_revoked: true } : c))
      );
    } catch (err) {
      // Treat "already revoked" as success (idempotent)
      const msg = err instanceof Error ? err.message : "Unknown error";
      if (msg.includes("ALREADY_REVOKED")) {
        setCaps((prev) =>
          prev.map((c) => (c.cap_id === capId ? { ...c, is_revoked: true } : c))
        );
      } else {
        setToast(`Failed to revoke: ${msg}`);
      }
    } finally {
      setRevoking(null);
    }
  };

  // Memoized filtering
  const { activeCaps, inactiveCaps } = useMemo(() => {
    const active = caps.filter((c) => !c.is_revoked && !isExpired(c.expires_at));
    const inactive = caps.filter((c) => c.is_revoked || isExpired(c.expires_at));
    return { activeCaps: active, inactiveCaps: inactive };
  }, [caps]);

  if (loading) {
    return (
      <div className="active-caps">
        <h2 className="section-title">Active Capabilities</h2>
        <div className="loading">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="active-caps">
        <h2 className="section-title">Active Capabilities</h2>
        <div className="error-msg">{error}</div>
      </div>
    );
  }

  return (
    <div className="active-caps">
      <h2 className="section-title">Active Capabilities</h2>

      {toast && <div className="toast error-msg">{toast}</div>}

      {activeCaps.length === 0 && inactiveCaps.length === 0 && (
        <p className="empty-state">No capabilities issued yet. Create one from Templates.</p>
      )}

      {activeCaps.length > 0 && (
        <div className="cap-list">
          {activeCaps.map((cap) => (
            <div key={cap.cap_id} className="cap-card">
              <div className="cap-header">
                <span className="cap-agent">{cap.executor.agent_id}</span>
                <span className="cap-status cap-status--active">Active</span>
              </div>
              <div className="cap-details">
                {isSpendConstraints(cap.constraints) ? (
                  <>
                    <div className="cap-row">
                      <span className="cap-label">Budget:</span>
                      <span className="cap-value">{formatBudget(cap.constraints.max_amount_cents)}</span>
                    </div>
                    <div className="cap-row">
                      <span className="cap-label">Vendors:</span>
                      <span className="cap-value">{cap.constraints.allowed_vendors.join(", ")}</span>
                    </div>
                    <div className="cap-row">
                      <span className="cap-label">Blocked:</span>
                      <span className="cap-value">
                        {cap.constraints.blocked_categories.length > 0
                          ? cap.constraints.blocked_categories.join(", ")
                          : "none"}
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="cap-row">
                      <span className="cap-label">Type:</span>
                      <span className="cap-value">Tool Call</span>
                    </div>
                    <div className="cap-row">
                      <span className="cap-label">Tools:</span>
                      <span className="cap-value">
                        {"allowed_tools" in cap.constraints
                          ? (cap.constraints as { allowed_tools: string[] }).allowed_tools.join(", ")
                          : "n/a"}
                      </span>
                    </div>
                  </>
                )}
                <div className="cap-row">
                  <span className="cap-label">Expires:</span>
                  <span className="cap-value">
                    {formatDate(cap.expires_at)} ({formatRemaining(cap.expires_at)})
                  </span>
                </div>
              </div>
              <button
                className="revoke-btn"
                onClick={() => handleRevoke(cap.cap_id)}
                disabled={revoking === cap.cap_id}
              >
                {revoking === cap.cap_id ? "Revoking..." : "Revoke"}
              </button>
            </div>
          ))}
        </div>
      )}

      {inactiveCaps.length > 0 && (
        <>
          <h3 className="subsection-title">Revoked / Expired</h3>
          <div className="cap-list cap-list--inactive">
            {inactiveCaps.map((cap) => (
              <div key={cap.cap_id} className="cap-card cap-card--inactive">
                <div className="cap-header">
                  <span className="cap-agent">{cap.executor.agent_id}</span>
                  <span className={`cap-status ${cap.is_revoked ? "cap-status--revoked" : "cap-status--expired"}`}>
                    {cap.is_revoked ? "Revoked" : "Expired"}
                  </span>
                </div>
                <div className="cap-details">
                  <div className="cap-row">
                    <span className="cap-label">
                      {isSpendConstraints(cap.constraints) ? "Budget:" : "Type:"}
                    </span>
                    <span className="cap-value">
                      {isSpendConstraints(cap.constraints)
                        ? formatBudget(cap.constraints.max_amount_cents)
                        : "Tool Call"}
                    </span>
                  </div>
                  <div className="cap-row">
                    <span className="cap-label">Issued:</span>
                    <span className="cap-value">{formatDate(cap.issued_at)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
