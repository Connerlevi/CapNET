import React, { useEffect, useState, useMemo } from "react";
import { listReceipts, Receipt } from "./api";

interface ReceiptsProps {
  refreshTrigger: number;
}

// Safe date parsing
const safeMs = (iso: string): number | null => {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
};

// For sorting: invalid timestamps go to 0 (bottom when sorted desc)
const msOr0 = (iso: string): number => {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
};

const formatTime = (iso: string): string => {
  const t = safeMs(iso);
  if (t === null) return "—";
  const d = new Date(t);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
};

const formatDate = (iso: string): string => {
  const t = safeMs(iso);
  if (t === null) return "Unknown date";
  return new Date(t).toLocaleDateString();
};

// Event display mapping
const EVENT_CONFIG: Record<string, { icon: string; label: string; color: string }> = {
  CAP_ISSUED: { icon: "🎫", label: "Capability Issued", color: "blue" },
  CAP_REVOKED: { icon: "🚫", label: "Capability Revoked", color: "red" },
  ACTION_ATTEMPT: { icon: "🔄", label: "Action Attempted", color: "gray" },
  ACTION_ALLOWED: { icon: "✅", label: "Action Allowed", color: "green" },
  ACTION_DENIED: { icon: "❌", label: "Action Denied", color: "red" },
};

// Human-readable denial reasons (expanded for future-proofing)
const DENIAL_REASONS: Record<string, string> = {
  NO_CAPABILITY: "No matching capability found",
  REVOKED: "Capability has been revoked",
  CAP_EXPIRED: "Capability has expired",
  CAP_NOT_YET_VALID: "Capability not yet valid",
  BAD_SIGNATURE: "Invalid capability signature",
  BAD_CAPABILITY_TIME: "Invalid timestamp in capability",
  EXECUTOR_MISMATCH: "Agent identity mismatch",
  VENDOR_NOT_ALLOWED: "Vendor not in allow list",
  AMOUNT_EXCEEDS_MAX: "Amount exceeds budget",
  // Future-proofing
  BAD_REQUEST: "Malformed request",
  STORE_ERROR: "Storage error",
  AMOUNT_OVERFLOW: "Amount calculation overflow",
  VENDOR_MISSING: "Vendor not specified",
  CATEGORY_MISSING: "Category not specified",
};

const formatReason = (reason: string | undefined): string => {
  if (!reason) return "";
  // Handle CATEGORY_BLOCKED:xyz format
  if (reason.startsWith("CATEGORY_BLOCKED:")) {
    const cat = reason.split(":")[1];
    return `Category blocked: ${cat}`;
  }
  return DENIAL_REASONS[reason] || reason;
};

const formatAmount = (cents: number | undefined): string => {
  if (cents === undefined) return "";
  return "$" + (cents / 100).toFixed(2);
};

// Truncate IDs for display
const truncateId = (id: string, len = 12): string => {
  if (id.length <= len) return id;
  return id.slice(0, len) + "…";
};

export function Receipts({ refreshTrigger }: ReceiptsProps) {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    const fetchReceipts = async () => {
      try {
        setLoading(true);
        const data = await listReceipts({ limit: 50 });
        if (!alive) return;
        // Sort by timestamp descending (newest first) - stable sort with msOr0
        const sorted = [...data].sort((a, b) => msOr0(b.ts) - msOr0(a.ts));
        setReceipts(sorted);
        setError(null);
      } catch (err) {
        if (!alive) return;
        setError(err instanceof Error ? err.message : "Failed to load receipts");
      } finally {
        if (alive) setLoading(false);
      }
    };

    fetchReceipts();

    return () => {
      alive = false;
    };
  }, [refreshTrigger]);

  // Memoized grouping by date
  const { groupedByDate, dateKeys } = useMemo(() => {
    const grouped = receipts.reduce<Record<string, Receipt[]>>((acc, r) => {
      const dateKey = formatDate(r.ts);
      if (!acc[dateKey]) acc[dateKey] = [];
      acc[dateKey].push(r);
      return acc;
    }, {});

    // Sort date keys: newest first, "Unknown date" last
    const keys = Object.keys(grouped).sort((a, b) => {
      if (a === "Unknown date") return 1;
      if (b === "Unknown date") return -1;
      const ta = Date.parse(a);
      const tb = Date.parse(b);
      if (!Number.isFinite(ta) || !Number.isFinite(tb)) return 0;
      return tb - ta;
    });

    return { groupedByDate: grouped, dateKeys: keys };
  }, [receipts]);

  if (loading) {
    return (
      <div className="receipts">
        <h2 className="section-title">Receipts</h2>
        <div className="loading">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="receipts">
        <h2 className="section-title">Receipts</h2>
        <div className="error-msg">{error}</div>
      </div>
    );
  }

  return (
    <div className="receipts">
      <h2 className="section-title">Receipts</h2>
      <p className="section-desc">Audit trail of all capability events</p>

      {receipts.length === 0 && (
        <p className="empty-state">No events recorded yet.</p>
      )}

      {dateKeys.map((dateKey) => {
        const receiptsForDate = groupedByDate[dateKey];
        if (!receiptsForDate) return null;
        return (
          <div key={dateKey} className="receipt-group">
            <div className="receipt-date-header">{dateKey}</div>
            <div className="receipt-timeline">
              {receiptsForDate.map((r) => {
                const config = EVENT_CONFIG[r.event] || {
                  icon: "📄",
                  label: r.event,
                  color: "gray",
                };

                return (
                  <div key={r.receipt_id} className={`receipt-item receipt-item--${config.color}`}>
                    <div className="receipt-icon">{config.icon}</div>
                    <div className="receipt-content">
                      <div className="receipt-header">
                        <span className="receipt-event">{config.label}</span>
                        <span className="receipt-time">{formatTime(r.ts)}</span>
                      </div>
                      <div className="receipt-details">
                        {r.agent_id && (
                          <span className="receipt-detail">Agent: {r.agent_id}</span>
                        )}
                        {r.vendor && (
                          <span className="receipt-detail">Vendor: {r.vendor}</span>
                        )}
                        {r.summary?.amount_cents !== undefined && (
                          <span className="receipt-detail">
                            Amount: {formatAmount(r.summary.amount_cents)}
                          </span>
                        )}
                        {r.summary?.item_count !== undefined && (
                          <span className="receipt-detail">
                            Items: {r.summary.item_count}
                          </span>
                        )}
                        {r.cap_id && (
                          <span className="receipt-detail receipt-detail--id">
                            Cap: {truncateId(r.cap_id)}
                          </span>
                        )}
                        {r.request_id && (
                          <span className="receipt-detail receipt-detail--id">
                            Req: {truncateId(r.request_id)}
                          </span>
                        )}
                        {r.summary?.denied_reason && (
                          <span className="receipt-detail receipt-detail--reason">
                            {formatReason(r.summary.denied_reason)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
