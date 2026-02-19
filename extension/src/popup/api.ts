/**
 * CapNet Proxy API client for extension
 *
 * All proxy network calls go through this module.
 * Centralized error handling, timeouts, and schema validation.
 */

import { z } from "zod";

// Import types AND schemas from shared to prevent drift
import type {
  CapDoc,
  ActionRequest,
  ActionResult,
  Receipt,
} from "@capnet/shared";

import {
  CapDocSchema,
  ReceiptSchema,
  ActionResultSchema,
} from "@capnet/shared";

// Re-export for consumers
export type { CapDoc, ActionRequest, ActionResult, Receipt };

// Default proxy URL - uses 127.0.0.1 (more reliable than localhost in some environments)
const DEFAULT_PROXY_BASE = "http://127.0.0.1:3100";

// Request timeout in milliseconds
const DEFAULT_TIMEOUT_MS = 3000;

/**
 * Get the proxy base URL.
 * Future: read from chrome.storage.sync for user-configurable proxy.
 */
export function getProxyBaseUrl(): string {
  // TODO: Read from chrome.storage.sync when settings UI is implemented
  return DEFAULT_PROXY_BASE;
}

/**
 * Fetch JSON with timeout, proper error handling, and empty body safety.
 * Prevents hung popup in MV3 environment.
 */
export async function fetchJsonWithTimeout<T = unknown>(
  url: string,
  options: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        Accept: "application/json",
        ...(options.headers || {}),
      },
      signal: controller.signal,
    });

    // Read body as text first (handles empty responses safely)
    const text = await res.text();

    if (!res.ok) {
      const method = options.method ?? "GET";
      // Include response body in error for debugging
      throw new Error(
        `HTTP ${res.status} ${method} ${url}: ${text.slice(0, 200) || res.statusText}`
      );
    }

    // Parse JSON only if there's content
    return (text ? JSON.parse(text) : undefined) as T;
  } catch (e) {
    // Convert abort to user-friendly timeout message
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new Error(`Request timed out after ${timeoutMs}ms`);
    }
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }
}

// -----------------------------------------------------------------------------
// API Types (extension-specific, not in shared)
// -----------------------------------------------------------------------------

export interface HealthResponse {
  status: string;
  service: string;
  version: string;
  timestamp: string;
}

export interface IssueCapabilityRequest {
  template: string;
  agent_id: string;
  agent_pubkey: string;
  constraints: {
    max_amount_cents: number;
    allowed_vendors: string[];
    blocked_categories: string[];
  };
}

export interface RevokeResponse {
  success: boolean;
  cap_id: string;
  message: string;
}

// -----------------------------------------------------------------------------
// API Methods
// -----------------------------------------------------------------------------

/**
 * Check proxy health.
 */
export async function health(): Promise<HealthResponse> {
  const base = getProxyBaseUrl();
  return fetchJsonWithTimeout<HealthResponse>(`${base}/health`);
}

/**
 * Issue a new capability.
 */
export async function issueCapability(
  request: IssueCapabilityRequest
): Promise<CapDoc> {
  const base = getProxyBaseUrl();
  const raw = await fetchJsonWithTimeout<unknown>(`${base}/capability/issue`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  return CapDocSchema.parse(raw);
}

// Schema for capability with revocation status
// Note: CapDocSchema uses superRefine, so we use transform to add is_revoked validation
const CapDocWithRevokedSchema = z.object({ is_revoked: z.boolean() }).passthrough()
  .transform((obj) => {
    // Validate the CapDoc portion
    const { is_revoked, ...rest } = obj;
    const cap = CapDocSchema.parse(rest);
    return { ...cap, is_revoked };
  });

/**
 * List all capabilities (with revocation status).
 */
export async function listCapabilities(): Promise<(CapDoc & { is_revoked: boolean })[]> {
  const base = getProxyBaseUrl();
  const raw = await fetchJsonWithTimeout<unknown>(`${base}/capabilities`);
  return z.array(CapDocWithRevokedSchema).parse(raw);
}

/**
 * List receipts with optional filtering.
 */
export async function listReceipts(options?: {
  limit?: number;
  since?: string;
}): Promise<Receipt[]> {
  const base = getProxyBaseUrl();
  const params = new URLSearchParams();

  // Use !== undefined to handle limit: 0 correctly
  if (options?.limit !== undefined) params.set("limit", String(options.limit));
  if (options?.since !== undefined) params.set("since", options.since);

  const url = params.toString()
    ? `${base}/receipts?${params.toString()}`
    : `${base}/receipts`;

  const raw = await fetchJsonWithTimeout<unknown>(url);
  return z.array(ReceiptSchema).parse(raw);
}

/**
 * Revoke a capability by ID.
 */
export async function revokeCapability(capId: string): Promise<RevokeResponse> {
  const base = getProxyBaseUrl();
  return fetchJsonWithTimeout<RevokeResponse>(`${base}/capability/revoke`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cap_id: capId }),
  });
}

/**
 * Submit an action request for enforcement.
 */
export async function submitAction(actionRequest: ActionRequest): Promise<ActionResult> {
  const base = getProxyBaseUrl();
  const raw = await fetchJsonWithTimeout<unknown>(`${base}/action/request`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(actionRequest),
  });
  return ActionResultSchema.parse(raw);
}
