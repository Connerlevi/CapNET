import React, { useState, useEffect, useCallback } from "react";
import { issueCapability, CapDoc } from "./api";
import { loadOrCreateAgentIdentity, setAgentId, resetAgentIdentity, isValidAgentId, AgentIdentity } from "./agentIdentity";

// Predefined templates for Phase 0
interface Template {
  id: string;
  name: string;
  description: string;
  icon: string;
  defaults: {
    max_amount_cents: number;
    allowed_vendors: string[];
    blocked_categories: string[];
  };
}

const TEMPLATES: Template[] = [
  {
    id: "groceries",
    name: "Groceries",
    description: "Allow grocery purchases with configurable budget and store restrictions",
    icon: "🛒",
    defaults: {
      max_amount_cents: 20000, // $200
      allowed_vendors: ["sandboxmart"],
      blocked_categories: ["alcohol", "tobacco", "gift_cards"],
    },
  },
];

interface TemplatesProps {
  onCapabilityIssued: (cap: CapDoc) => void;
}

type ViewState = "list" | "configure";

// Truncate pubkey for display
const truncatePubkey = (pubkey: string, len = 16): string => {
  if (pubkey.length <= len) return pubkey;
  return pubkey.slice(0, len) + "...";
};

// Format created_at for display
const formatCreatedAt = (iso: string | undefined): string => {
  if (!iso) return "Unknown";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "Unknown";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};

export function Templates({ onCapabilityIssued }: TemplatesProps) {
  const [view, setView] = useState<ViewState>("list");
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [budget, setBudget] = useState(200);
  const [blockAlcohol, setBlockAlcohol] = useState(true);
  const [blockTobacco, setBlockTobacco] = useState(true);
  const [blockGiftCards, setBlockGiftCards] = useState(true);
  const [isIssuing, setIsIssuing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Agent identity state
  const [identity, setIdentity] = useState<AgentIdentity | null>(null);
  const [identityLoading, setIdentityLoading] = useState(true);
  const [editingAgentId, setEditingAgentId] = useState(false);
  const [agentIdInput, setAgentIdInput] = useState("");
  const [copied, setCopied] = useState<"yes" | "failed" | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [agentIdError, setAgentIdError] = useState<string | null>(null);

  // Load agent identity on mount
  useEffect(() => {
    let alive = true;
    loadOrCreateAgentIdentity("agent:demo-grocerybot")
      .then((ident) => {
        if (alive) {
          setIdentity(ident);
          setAgentIdInput(ident.agent_id);
        }
      })
      .catch((err) => {
        console.error("Failed to load agent identity:", err);
      })
      .finally(() => {
        if (alive) setIdentityLoading(false);
      });
    return () => { alive = false; };
  }, []);

  const handleCopyPubkey = useCallback(() => {
    if (!identity) return;
    navigator.clipboard.writeText(identity.pubkey_b64)
      .then(() => {
        setCopied("yes");
        setTimeout(() => setCopied(null), 1500);
      })
      .catch(() => {
        setCopied("failed");
        setTimeout(() => setCopied(null), 2000);
      });
  }, [identity]);

  const handleSaveAgentId = useCallback(async () => {
    const trimmed = agentIdInput.trim();
    if (!trimmed || trimmed === identity?.agent_id) {
      setEditingAgentId(false);
      setAgentIdError(null);
      return;
    }
    if (!isValidAgentId(trimmed)) {
      setAgentIdError("Format: agent:[a-z0-9._:-]{3,64}");
      return;
    }
    try {
      const updated = await setAgentId(trimmed);
      setIdentity(updated);
      setEditingAgentId(false);
      setAgentIdError(null);
    } catch (err) {
      console.error("Failed to update agent ID:", err);
    }
  }, [agentIdInput, identity]);

  const handleResetIdentity = useCallback(async () => {
    if (!confirm("Generate new keypair? Existing capabilities will no longer work with this identity.")) {
      return;
    }
    setResetting(true);
    try {
      const newIdent = await resetAgentIdentity();
      setIdentity(newIdent);
      setAgentIdInput(newIdent.agent_id);
    } catch (err) {
      console.error("Failed to reset identity:", err);
    } finally {
      setResetting(false);
    }
  }, []);

  const handleSelectTemplate = (template: Template) => {
    setSelectedTemplate(template);
    setBudget(template.defaults.max_amount_cents / 100);
    setBlockAlcohol(template.defaults.blocked_categories.includes("alcohol"));
    setBlockTobacco(template.defaults.blocked_categories.includes("tobacco"));
    setBlockGiftCards(template.defaults.blocked_categories.includes("gift_cards"));
    setError(null);
    setView("configure");
  };

  const handleBack = () => {
    setView("list");
    setSelectedTemplate(null);
    setError(null);
  };

  const handleIssue = async () => {
    if (!selectedTemplate || !identity) return;

    setIsIssuing(true);
    setError(null);

    try {
      // Build blocked categories from toggles
      const blocked: string[] = [];
      if (blockAlcohol) blocked.push("alcohol");
      if (blockTobacco) blocked.push("tobacco");
      if (blockGiftCards) blocked.push("gift_cards");

      const cap = await issueCapability({
        template: selectedTemplate.id,
        agent_id: identity.agent_id,
        agent_pubkey: identity.pubkey_b64,
        constraints: {
          max_amount_cents: Math.round(budget * 100),
          allowed_vendors: selectedTemplate.defaults.allowed_vendors,
          blocked_categories: blocked,
        },
      });

      onCapabilityIssued(cap);
      handleBack();
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to issue capability");
      }
    } finally {
      setIsIssuing(false);
    }
  };

  // Agent identity panel (shown on list view)
  const AgentPanel = () => {
    if (identityLoading) {
      return (
        <div className="agent-panel">
          <div className="agent-panel-loading">Loading agent identity...</div>
        </div>
      );
    }

    if (!identity) {
      return (
        <div className="agent-panel agent-panel--error">
          <div className="agent-panel-error">Failed to load agent identity</div>
        </div>
      );
    }

    return (
      <div className="agent-panel">
        <div className="agent-panel-header">Agent Identity</div>
        <div className="agent-panel-row">
          <span className="agent-label">ID:</span>
          {editingAgentId ? (
            <div className="agent-id-edit-wrapper">
              <div className="agent-id-edit">
                <input
                  type="text"
                  value={agentIdInput}
                  onChange={(e) => {
                    setAgentIdInput(e.target.value);
                    setAgentIdError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveAgentId();
                    if (e.key === "Escape") {
                      setAgentIdInput(identity.agent_id);
                      setEditingAgentId(false);
                      setAgentIdError(null);
                    }
                  }}
                  autoFocus
                />
                <button className="agent-btn" onClick={handleSaveAgentId}>Save</button>
              </div>
              {agentIdError && <div className="agent-id-error">{agentIdError}</div>}
            </div>
          ) : (
            <div className="agent-id-display">
              <span className="agent-value">{identity.agent_id}</span>
              <button
                className="agent-btn agent-btn--edit"
                onClick={() => setEditingAgentId(true)}
                title="Edit agent ID"
              >
                Edit
              </button>
            </div>
          )}
        </div>
        <div className="agent-panel-row">
          <span className="agent-label">Pubkey:</span>
          <div className="agent-pubkey-display">
            <code className="agent-pubkey">{truncatePubkey(identity.pubkey_b64)}</code>
            <button
              className="agent-btn agent-btn--copy"
              onClick={handleCopyPubkey}
              title="Copy full pubkey"
            >
              {copied === "yes" ? "Copied!" : copied === "failed" ? "Failed" : "Copy"}
            </button>
          </div>
        </div>
        <div className="agent-panel-row">
          <span className="agent-label">Created:</span>
          <span className="agent-value agent-value--muted">
            {formatCreatedAt(identity.created_at)}
          </span>
        </div>
        <div className="agent-advanced">
          <button
            className="agent-advanced-toggle"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            {showAdvanced ? "▼ Advanced" : "▶ Advanced"}
          </button>
          {showAdvanced && (
            <div className="agent-advanced-content">
              <button
                className="agent-btn agent-btn--danger"
                onClick={handleResetIdentity}
                disabled={resetting}
                title="Generate new keypair (breaks existing capabilities)"
              >
                {resetting ? "Generating..." : "Generate New Keypair"}
              </button>
              <span className="agent-advanced-hint">
                For testing executor mismatch
              </span>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (view === "list") {
    return (
      <div className="templates">
        <AgentPanel />
        <h2 className="section-title">Templates</h2>
        <p className="section-desc">Create a capability from a predefined template</p>
        <div className="template-list">
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              className="template-card"
              onClick={() => handleSelectTemplate(t)}
              disabled={!identity}
            >
              <span className="template-icon">{t.icon}</span>
              <div className="template-info">
                <span className="template-name">{t.name}</span>
                <span className="template-desc">{t.description}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Configure view
  return (
    <div className="template-config">
      <button className="back-btn" onClick={handleBack}>
        ← Back
      </button>
      <h2 className="section-title">
        {selectedTemplate?.icon} {selectedTemplate?.name}
      </h2>

      {identity && (
        <div className="config-agent-info">
          Issuing to: <strong>{identity.agent_id}</strong>
        </div>
      )}

      <div className="config-form">
        <div className="form-group">
          <label htmlFor="budget">Budget (USD)</label>
          <div className="budget-input">
            <span className="currency">$</span>
            <input
              id="budget"
              type="number"
              min="1"
              max="10000"
              value={budget}
              onChange={(e) => setBudget(Number(e.target.value))}
            />
          </div>
          <span className="form-hint">Maximum amount agent can spend</span>
        </div>

        <div className="form-group">
          <label>Blocked Categories</label>
          <div className="checkbox-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={blockAlcohol}
                onChange={(e) => setBlockAlcohol(e.target.checked)}
              />
              <span>Block alcohol</span>
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={blockTobacco}
                onChange={(e) => setBlockTobacco(e.target.checked)}
              />
              <span>Block tobacco</span>
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={blockGiftCards}
                onChange={(e) => setBlockGiftCards(e.target.checked)}
              />
              <span>Block gift cards</span>
            </label>
          </div>
        </div>

        <div className="form-group">
          <label>Allowed Vendors</label>
          <div className="vendor-tags">
            {selectedTemplate?.defaults.allowed_vendors.map((v) => (
              <span key={v} className="vendor-tag">{v}</span>
            ))}
          </div>
          <span className="form-hint">Vendor restrictions (Phase 0: SandboxMart only)</span>
        </div>

        {error && <div className="form-error">{error}</div>}

        <button
          className="issue-btn"
          onClick={handleIssue}
          disabled={isIssuing || budget <= 0 || !identity}
        >
          {isIssuing ? "Issuing..." : "Issue Capability"}
        </button>
      </div>
    </div>
  );
}
