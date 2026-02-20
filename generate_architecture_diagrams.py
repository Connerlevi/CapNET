#!/usr/bin/env python3
"""
CapNet Architecture Diagrams — Full-color PDF
Generates a multi-page PDF with system architecture, flows, and decision trees.
"""

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch
from matplotlib.backends.backend_pdf import PdfPages
import numpy as np

# ── Color palette ──────────────────────────────────────────────────
COLORS = {
    'trust_bg':     '#E8F5E9',   # light green - trusted zone
    'untrust_bg':   '#FFEBEE',   # light red - untrusted zone
    'user':         '#1565C0',   # deep blue
    'extension':    '#2E7D32',   # green
    'proxy':        '#6A1B9A',   # purple
    'agent':        '#E65100',   # orange
    'resource':     '#00838F',   # teal
    'allow':        '#2E7D32',   # green
    'deny':         '#C62828',   # red
    'receipt':      '#F9A825',   # amber
    'revoke':       '#C62828',   # red
    'check_yes':    '#2E7D32',   # green
    'check_no':     '#C62828',   # red
    'header':       '#1A237E',   # dark blue
    'light_gray':   '#F5F5F5',
    'text':         '#212121',
    'white':        '#FFFFFF',
    'black':        '#000000',
}


def draw_box(ax, x, y, w, h, label, color, text_color='white', fontsize=11,
             sublabel=None, sublabel_size=8, alpha=1.0, style='round,pad=0.02'):
    """Draw a rounded box with label."""
    box = FancyBboxPatch((x, y), w, h, boxstyle=style,
                          facecolor=color, edgecolor='#333333', linewidth=1.5,
                          alpha=alpha, zorder=2)
    ax.add_patch(box)
    if sublabel:
        ax.text(x + w/2, y + h * 0.62, label, ha='center', va='center',
                fontsize=fontsize, fontweight='bold', color=text_color, zorder=3)
        ax.text(x + w/2, y + h * 0.30, sublabel, ha='center', va='center',
                fontsize=sublabel_size, color=text_color, alpha=0.9, zorder=3,
                style='italic')
    else:
        ax.text(x + w/2, y + h/2, label, ha='center', va='center',
                fontsize=fontsize, fontweight='bold', color=text_color, zorder=3)


def draw_arrow(ax, x1, y1, x2, y2, color='#333333', style='->', lw=2, label=None, label_offset=(0, 0.02)):
    """Draw an arrow between two points."""
    ax.annotate('', xy=(x2, y2), xytext=(x1, y1),
                arrowprops=dict(arrowstyle=style, color=color, lw=lw, shrinkA=2, shrinkB=2),
                zorder=4)
    if label:
        mx, my = (x1 + x2) / 2 + label_offset[0], (y1 + y2) / 2 + label_offset[1]
        ax.text(mx, my, label, ha='center', va='center', fontsize=8,
                color=color, fontweight='bold', zorder=5,
                bbox=dict(boxstyle='round,pad=0.15', facecolor='white', edgecolor=color, alpha=0.9))


def setup_page(fig, title, subtitle=None):
    """Set up a page with title and branding."""
    ax = fig.add_subplot(111)
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.axis('off')
    ax.set_facecolor('#FAFAFA')

    # Title bar
    title_bar = FancyBboxPatch((0, 0.92), 1, 0.08, boxstyle='square,pad=0',
                                facecolor=COLORS['header'], edgecolor='none', zorder=1)
    ax.add_patch(title_bar)
    ax.text(0.5, 0.96, title, ha='center', va='center',
            fontsize=18, fontweight='bold', color='white', zorder=2)
    if subtitle:
        ax.text(0.5, 0.925, subtitle, ha='center', va='center',
                fontsize=10, color='#B0BEC5', zorder=2)

    # Footer
    ax.text(0.5, 0.01, 'CapNet — The Capability Layer for AI Agents  |  capnet.dev',
            ha='center', va='center', fontsize=7, color='#9E9E9E', style='italic')

    return ax


# ═══════════════════════════════════════════════════════════════════
# PAGE 1: System Architecture Overview
# ═══════════════════════════════════════════════════════════════════
def page_system_architecture(pdf):
    fig = plt.figure(figsize=(11, 8.5))
    ax = setup_page(fig, 'CAPNET SYSTEM ARCHITECTURE', 'Trust Boundaries & Component Roles')

    # ── Trusted zone background ──
    trust_zone = FancyBboxPatch((0.03, 0.35), 0.94, 0.55, boxstyle='round,pad=0.01',
                                 facecolor=COLORS['trust_bg'], edgecolor='#4CAF50',
                                 linewidth=2.5, linestyle='--', alpha=0.5, zorder=0)
    ax.add_patch(trust_zone)
    ax.text(0.07, 0.87, 'TRUSTED ZONE', fontsize=10, fontweight='bold',
            color='#2E7D32', zorder=1)

    # ── Untrusted zone background ──
    untrust_zone = FancyBboxPatch((0.03, 0.04), 0.94, 0.28, boxstyle='round,pad=0.01',
                                   facecolor=COLORS['untrust_bg'], edgecolor='#E53935',
                                   linewidth=2.5, linestyle='--', alpha=0.5, zorder=0)
    ax.add_patch(untrust_zone)
    ax.text(0.07, 0.295, 'UNTRUSTED ZONE', fontsize=10, fontweight='bold',
            color='#C62828', zorder=1)

    # ── USER box ──
    draw_box(ax, 0.05, 0.58, 0.18, 0.22, 'USER', COLORS['user'],
             sublabel='Sets policy\nControls revocation\nViews receipts')

    # ── EXTENSION box ──
    draw_box(ax, 0.30, 0.58, 0.18, 0.22, 'EXTENSION', COLORS['extension'],
             sublabel='Wallet UI\nAgent keypair\nTemplate config')

    # ── PROXY box ──
    draw_box(ax, 0.55, 0.42, 0.20, 0.38, 'PROXY', COLORS['proxy'],
             sublabel='Issuer keys\nCapDoc storage\nRevocation list\nReceipt log\nEnforcement gate\nCredential vault')

    # ── Key custody callout ──
    draw_box(ax, 0.78, 0.58, 0.18, 0.22, 'KEY CUSTODY', '#37474F',
             sublabel='Ed25519 issuer keypair\nMerchant credentials\nNEVER exposed\nto agents', sublabel_size=7)

    # ── AGENT box ──
    draw_box(ax, 0.12, 0.08, 0.22, 0.18, 'AGENT (AI)', COLORS['agent'],
             sublabel='Own keypair only\nNo credentials\nPropose-only access')

    # ── RESOURCE box ──
    draw_box(ax, 0.60, 0.08, 0.22, 0.18, 'RESOURCE', COLORS['resource'],
             sublabel='Merchant / API\nOnly reachable\nthrough proxy')

    # ── Arrows ──
    draw_arrow(ax, 0.23, 0.69, 0.30, 0.69, COLORS['user'], label='Config')
    draw_arrow(ax, 0.48, 0.69, 0.55, 0.69, COLORS['extension'], label='Issue/Revoke')
    draw_arrow(ax, 0.75, 0.69, 0.78, 0.69, COLORS['proxy'], lw=1.5)

    # Agent to proxy
    draw_arrow(ax, 0.34, 0.17, 0.55, 0.50, COLORS['agent'],
               label='Action\nRequest', label_offset=(-0.04, 0.02))

    # Proxy to resource
    draw_arrow(ax, 0.75, 0.50, 0.71, 0.26, COLORS['proxy'],
               label='Execute\n(if allowed)', label_offset=(0.06, 0.02))

    # Agent CANNOT reach resource (X mark)
    ax.annotate('', xy=(0.60, 0.17), xytext=(0.34, 0.17),
                arrowprops=dict(arrowstyle='->', color='#E53935', lw=2,
                               linestyle='dashed', shrinkA=2, shrinkB=2),
                zorder=4)
    ax.text(0.47, 0.20, 'BLOCKED', ha='center', va='center',
            fontsize=9, fontweight='bold', color='#C62828',
            bbox=dict(boxstyle='round,pad=0.15', facecolor='#FFCDD2', edgecolor='#C62828'))

    pdf.savefig(fig, bbox_inches='tight')
    plt.close()


# ═══════════════════════════════════════════════════════════════════
# PAGE 2: Capability Issuance Flow
# ═══════════════════════════════════════════════════════════════════
def page_issuance_flow(pdf):
    fig = plt.figure(figsize=(11, 8.5))
    ax = setup_page(fig, 'CAPABILITY ISSUANCE FLOW', 'How a capability is created and bound to an agent')

    # Column headers
    cols = [
        (0.10, 'USER', COLORS['user']),
        (0.32, 'EXTENSION', COLORS['extension']),
        (0.55, 'PROXY', COLORS['proxy']),
        (0.78, 'AGENT', COLORS['agent']),
    ]

    for cx, label, color in cols:
        draw_box(ax, cx - 0.07, 0.84, 0.14, 0.05, label, color, fontsize=10)
        ax.plot([cx, cx], [0.10, 0.84], color=color, lw=1.5, alpha=0.3, linestyle='--', zorder=0)

    # Steps (y positions going down)
    steps = [
        (0.78, '1', 'User sets policy template:\n"$200, groceries, no alcohol, 7 days"',
         0.10, 0.10, None),
        (0.70, '2', 'Extension sends\nPOST /capability/issue\nwith policy + agent pubkey',
         0.32, 0.55, '#4CAF50'),
        (0.58, '3', 'Proxy creates CapDoc:\n• Generates cap_id\n• Sets constraints from policy\n• Binds to agent pubkey\n• Signs with issuer key\n• Stores locally\n• Emits CAP_ISSUED receipt',
         0.55, 0.55, None),
        (0.42, '4', 'Returns signed CapDoc',
         0.55, 0.32, '#6A1B9A'),
        (0.36, '5', 'Shows "Capability Active"\nwith details + revoke button',
         0.32, 0.10, '#2E7D32'),
        (0.24, '6', 'Agent knows:\n✓ A capability exists for it\n✓ Its own keypair\n✗ Merchant credentials\n✗ Issuer signing key',
         0.78, 0.78, None),
    ]

    for sy, num, text, src_x, dst_x, arrow_color in steps:
        # Step number
        ax.add_patch(plt.Circle((0.03, sy), 0.015, color=COLORS['header'], zorder=5))
        ax.text(0.03, sy, num, ha='center', va='center', fontsize=8,
                fontweight='bold', color='white', zorder=6)

        # Text at the source column
        text_x = src_x if src_x == dst_x else (src_x + dst_x) / 2
        ax.text(text_x, sy, text, ha='center', va='center', fontsize=8,
                color=COLORS['text'], zorder=3,
                bbox=dict(boxstyle='round,pad=0.3', facecolor='white',
                         edgecolor='#BDBDBD', alpha=0.95))

        # Arrow if src != dst
        if arrow_color and src_x != dst_x:
            draw_arrow(ax, src_x, sy - 0.02, dst_x, sy - 0.02, arrow_color, lw=2.5)

    # Key insight callout
    draw_box(ax, 0.15, 0.10, 0.70, 0.08, '', '#FFF8E1', text_color=COLORS['text'],
             alpha=0.95, style='round,pad=0.01')
    ax.text(0.50, 0.14, 'KEY INSIGHT: The agent receives authority (capability), NOT credentials.',
            ha='center', va='center', fontsize=10, fontweight='bold', color='#E65100', zorder=5)
    ax.text(0.50, 0.115, 'Even if the agent is fully compromised, it cannot exceed the capability\'s constraints.',
            ha='center', va='center', fontsize=8, color='#795548', zorder=5)

    pdf.savefig(fig, bbox_inches='tight')
    plt.close()


# ═══════════════════════════════════════════════════════════════════
# PAGE 3: Enforcement Decision Tree
# ═══════════════════════════════════════════════════════════════════
def page_enforcement_pipeline(pdf):
    fig = plt.figure(figsize=(11, 8.5))
    ax = setup_page(fig, 'ENFORCEMENT DECISION TREE', 'Every action request passes through this pipeline — no exceptions')

    checks = [
        (0.82, 'VERIFY\nSIGNATURE', 'Is the request\ncryptographically authentic?', 'INVALID_SIGNATURE'),
        (0.70, 'VERIFY\nEXECUTOR', 'Does agent pubkey match\nthe capability binding?', 'EXECUTOR_MISMATCH'),
        (0.58, 'CHECK\nTIME WINDOW', 'Is capability within\nnot_before / expires_at?', 'TIME_EXPIRED'),
        (0.46, 'CHECK\nREVOCATION', 'Has the user\nrevoked this capability?', 'REVOKED'),
        (0.34, 'CHECK\nVENDOR', 'Is the target vendor\non the allow-list?', 'VENDOR_NOT_ALLOWED'),
        (0.22, 'CHECK\nCATEGORIES', 'Are all cart items in\nallowed categories?', 'CATEGORY_BLOCKED'),
        (0.10, 'CHECK\nBUDGET', 'Is total amount ≤\nmax_amount_cents?', 'AMOUNT_EXCEEDS_MAX'),
    ]

    # Incoming request arrow
    ax.annotate('', xy=(0.22, 0.88), xytext=(0.22, 0.91),
                arrowprops=dict(arrowstyle='->', color=COLORS['agent'], lw=3))
    ax.text(0.22, 0.915, 'INCOMING ACTION REQUEST', ha='center', va='center',
            fontsize=10, fontweight='bold', color=COLORS['agent'],
            bbox=dict(boxstyle='round,pad=0.2', facecolor='#FFF3E0', edgecolor=COLORS['agent']))

    for i, (y, check_name, question, deny_reason) in enumerate(checks):
        # Check box (diamond-like rounded box)
        draw_box(ax, 0.12, y - 0.04, 0.20, 0.08, check_name, COLORS['proxy'],
                 fontsize=8, sublabel=None)

        # Question text
        ax.text(0.45, y, question, ha='center', va='center', fontsize=8,
                color=COLORS['text'],
                bbox=dict(boxstyle='round,pad=0.2', facecolor='white', edgecolor='#BDBDBD'))

        # YES arrow down (if not last)
        if i < len(checks) - 1:
            next_y = checks[i + 1][0]
            draw_arrow(ax, 0.22, y - 0.04, 0.22, next_y + 0.04, COLORS['check_yes'], lw=2.5)
            ax.text(0.19, (y - 0.04 + next_y + 0.04) / 2, 'PASS', ha='center', va='center',
                    fontsize=7, fontweight='bold', color=COLORS['check_yes'],
                    bbox=dict(boxstyle='round,pad=0.1', facecolor='#E8F5E9', edgecolor=COLORS['check_yes']))

        # NO arrow right → DENY box
        deny_x = 0.70
        draw_arrow(ax, 0.32, y, deny_x, y, COLORS['check_no'], lw=2)
        ax.text(0.51, y + 0.015, 'FAIL', ha='center', va='center',
                fontsize=7, fontweight='bold', color=COLORS['check_no'],
                bbox=dict(boxstyle='round,pad=0.1', facecolor='#FFEBEE', edgecolor=COLORS['check_no']))

        # Deny box
        draw_box(ax, deny_x, y - 0.025, 0.24, 0.05, f'DENIED: {deny_reason}',
                 COLORS['deny'], fontsize=7)

        # Receipt indicator
        ax.text(deny_x + 0.12, y - 0.035, '+ receipt emitted',
                ha='center', va='top', fontsize=6, color='#F57F17', style='italic')

    # ALLOWED box at bottom
    draw_box(ax, 0.10, 0.02, 0.24, 0.05, 'ALLOWED', COLORS['allow'], fontsize=12)
    draw_arrow(ax, 0.22, 0.06, 0.22, 0.07, COLORS['check_yes'], lw=2.5)
    ax.text(0.22, 0.005, 'Execute action + emit receipt', ha='center', va='center',
            fontsize=8, color=COLORS['allow'], fontweight='bold')

    # Side callout
    draw_box(ax, 0.70, 0.02, 0.24, 0.05, '', COLORS['receipt'], text_color=COLORS['text'],
             alpha=0.3, style='round,pad=0.01')
    ax.text(0.82, 0.045, 'EVERY PATH EMITS A RECEIPT', ha='center', va='center',
            fontsize=8, fontweight='bold', color='#E65100', zorder=5)
    ax.text(0.82, 0.025, 'Allow or deny — full audit trail', ha='center', va='center',
            fontsize=7, color='#795548', zorder=5)

    pdf.savefig(fig, bbox_inches='tight')
    plt.close()


# ═══════════════════════════════════════════════════════════════════
# PAGE 4: Agent Action Flow (sequence)
# ═══════════════════════════════════════════════════════════════════
def page_action_flow(pdf):
    fig = plt.figure(figsize=(11, 8.5))
    ax = setup_page(fig, 'AGENT ACTION FLOW', 'What happens when an agent tries to take an action')

    # Actors
    actors = [
        (0.15, 'AGENT', COLORS['agent']),
        (0.45, 'PROXY', COLORS['proxy']),
        (0.75, 'RESOURCE', COLORS['resource']),
    ]

    for cx, label, color in actors:
        draw_box(ax, cx - 0.08, 0.84, 0.16, 0.05, label, color, fontsize=11)
        ax.plot([cx, cx], [0.06, 0.84], color=color, lw=2, alpha=0.3, linestyle='--', zorder=0)

    # Flow steps
    flow = [
        # (y, from_x, to_x, label, color, note_x, note)
        (0.78, 0.15, 0.45, 'POST /action/request\n{cart, agent_id, pubkey, signature}', COLORS['agent'], None, None),
        (0.68, None, None, None, None, 0.45,
         'ENFORCEMENT PIPELINE\n1. Verify signature\n2. Verify executor binding\n3. Check time window\n4. Check revocation\n5. Check vendor\n6. Check categories\n7. Check budget'),
        (0.50, 0.45, 0.75, 'Execute action\n(credentials held by proxy)', COLORS['allow'], None, None),
        (0.44, 0.75, 0.45, 'Result', COLORS['resource'], None, None),
        (0.38, 0.45, 0.15, 'ALLOWED + receipt_id', COLORS['allow'], None, None),
    ]

    for item in flow:
        y = item[0]
        from_x, to_x, label, color = item[1], item[2], item[3], item[4]
        note_x, note = item[5], item[6]

        if note:
            # This is a processing step, not an arrow
            ax.text(note_x, y, note, ha='center', va='center', fontsize=8,
                    color=COLORS['proxy'], fontweight='bold',
                    bbox=dict(boxstyle='round,pad=0.4', facecolor='#F3E5F5',
                             edgecolor=COLORS['proxy'], linewidth=2))
        elif from_x and to_x:
            draw_arrow(ax, from_x, y, to_x, y, color, lw=2.5, label=label)

    # Denied path
    ax.plot([0.45, 0.45], [0.55, 0.58], color=COLORS['deny'], lw=2, zorder=4)
    draw_arrow(ax, 0.45, 0.30, 0.15, 0.30, COLORS['deny'], lw=2.5,
               label='DENIED + reason + receipt_id')
    ax.text(0.45, 0.275, 'OR', ha='center', va='center', fontsize=10,
            fontweight='bold', color=COLORS['deny'],
            bbox=dict(boxstyle='round,pad=0.15', facecolor='#FFEBEE', edgecolor=COLORS['deny']))

    ax.text(0.75, 0.30, 'Resource NEVER\ncontacted', ha='center', va='center',
            fontsize=9, fontweight='bold', color=COLORS['deny'],
            bbox=dict(boxstyle='round,pad=0.2', facecolor='#FFEBEE', edgecolor=COLORS['deny']))

    # Receipt callout at bottom
    draw_box(ax, 0.10, 0.06, 0.80, 0.10, '', '#FFF8E1', text_color=COLORS['text'],
             alpha=0.95, style='round,pad=0.01')
    ax.text(0.50, 0.13, 'AUDIT TRAIL', ha='center', va='center',
            fontsize=12, fontweight='bold', color='#E65100', zorder=5)
    ax.text(0.50, 0.10, 'Every request generates a signed receipt: ACTION_ATTEMPT → ACTION_ALLOWED or ACTION_DENIED',
            ha='center', va='center', fontsize=9, color='#795548', zorder=5)
    ax.text(0.50, 0.075, '"Why did this happen?" is always answerable.',
            ha='center', va='center', fontsize=8, color='#795548', style='italic', zorder=5)

    pdf.savefig(fig, bbox_inches='tight')
    plt.close()


# ═══════════════════════════════════════════════════════════════════
# PAGE 5: Revocation Flow (Kill Switch)
# ═══════════════════════════════════════════════════════════════════
def page_revocation_flow(pdf):
    fig = plt.figure(figsize=(11, 8.5))
    ax = setup_page(fig, 'REVOCATION FLOW — KILL SWITCH', 'Instant capability termination')

    # Actors
    actors = [
        (0.12, 'USER', COLORS['user']),
        (0.32, 'EXTENSION', COLORS['extension']),
        (0.55, 'PROXY', COLORS['proxy']),
        (0.80, 'AGENT', COLORS['agent']),
    ]

    for cx, label, color in actors:
        draw_box(ax, cx - 0.07, 0.84, 0.14, 0.05, label, color, fontsize=10)
        ax.plot([cx, cx], [0.08, 0.84], color=color, lw=1.5, alpha=0.3, linestyle='--', zorder=0)

    # Revocation steps
    steps_y = [0.76, 0.68, 0.56, 0.48, 0.40]

    # Step 1: User clicks revoke
    ax.text(0.12, steps_y[0], 'Clicks\n"Revoke"', ha='center', va='center', fontsize=9,
            fontweight='bold', color=COLORS['user'],
            bbox=dict(boxstyle='round,pad=0.2', facecolor='#E3F2FD', edgecolor=COLORS['user']))
    draw_arrow(ax, 0.19, steps_y[0], 0.25, steps_y[0], COLORS['user'], lw=2.5)

    # Step 2: Extension calls proxy
    draw_arrow(ax, 0.32, steps_y[0] - 0.02, 0.32, steps_y[1] + 0.02, COLORS['extension'], lw=1.5)
    draw_arrow(ax, 0.39, steps_y[1], 0.48, steps_y[1], COLORS['extension'], lw=2.5,
               label='POST /capability/revoke')

    # Step 3: Proxy processes
    ax.text(0.55, steps_y[2], 'Proxy:\n• Marks cap REVOKED\n• Persists to disk\n  (survives restart)\n• Emits CAP_REVOKED\n  receipt',
            ha='center', va='center', fontsize=9, color=COLORS['proxy'], fontweight='bold',
            bbox=dict(boxstyle='round,pad=0.3', facecolor='#F3E5F5', edgecolor=COLORS['proxy'], lw=2))

    # Step 4: Confirmed
    draw_arrow(ax, 0.48, steps_y[3], 0.39, steps_y[3], COLORS['proxy'], lw=2, label='Confirmed')
    draw_arrow(ax, 0.25, steps_y[3], 0.19, steps_y[3], COLORS['extension'], lw=2, label='"Revoked"')

    # Time break
    ax.text(0.50, 0.34, '· · ·  LATER  · · ·', ha='center', va='center',
            fontsize=12, color='#9E9E9E', fontweight='bold')

    # Step 5: Agent tries action
    ax.text(0.80, 0.28, 'Agent tries\nany action', ha='center', va='center', fontsize=9,
            fontweight='bold', color=COLORS['agent'],
            bbox=dict(boxstyle='round,pad=0.2', facecolor='#FFF3E0', edgecolor=COLORS['agent']))
    draw_arrow(ax, 0.73, 0.28, 0.62, 0.28, COLORS['agent'], lw=2.5,
               label='POST /action/request')

    # Step 6: Proxy checks revocation → DENIED
    ax.text(0.55, 0.20, 'Step 4 in pipeline:\nCHECK REVOCATION\n→ REVOKED', ha='center', va='center',
            fontsize=9, fontweight='bold', color=COLORS['deny'],
            bbox=dict(boxstyle='round,pad=0.3', facecolor='#FFEBEE', edgecolor=COLORS['deny'], lw=2))

    # Step 7: Denied response
    draw_arrow(ax, 0.62, 0.14, 0.73, 0.14, COLORS['deny'], lw=2.5,
               label='DENIED: REVOKED')

    # Agent state
    draw_box(ax, 0.68, 0.06, 0.24, 0.05, 'AGENT IS DONE', COLORS['deny'],
             sublabel='No action possible. Period.', sublabel_size=8)

    # Key insight
    draw_box(ax, 0.05, 0.06, 0.55, 0.05, '', '#FFF8E1', text_color=COLORS['text'],
             alpha=0.95, style='round,pad=0.01')
    ax.text(0.325, 0.085, 'Revocation is instant, persistent, and absolute.',
            ha='center', va='center', fontsize=10, fontweight='bold', color='#E65100', zorder=5)
    ax.text(0.325, 0.065, 'No matter what the agent tries — it\'s over.',
            ha='center', va='center', fontsize=8, color='#795548', style='italic', zorder=5)

    pdf.savefig(fig, bbox_inches='tight')
    plt.close()


# ═══════════════════════════════════════════════════════════════════
# PAGE 6: Hijacker Blast Radius
# ═══════════════════════════════════════════════════════════════════
def page_blast_radius(pdf):
    fig = plt.figure(figsize=(11, 8.5))
    ax = setup_page(fig, 'HIJACKER BLAST RADIUS', 'What happens when an agent is fully compromised')

    # Left column: What hijacker HAS
    draw_box(ax, 0.05, 0.72, 0.40, 0.08, 'HIJACKER TAKES OVER AGENT', COLORS['agent'], fontsize=11)

    has_items = [
        ('Agent\'s Ed25519 keypair', True),
        ('Knowledge of proxy API address', True),
        ('Knowledge of capability ID', True),
    ]

    no_items = [
        ('Merchant / service credentials', False),
        ('Issuer signing key', False),
        ('Other agents\' keys', False),
        ('Direct access to merchant API', False),
        ('Proxy internal state', False),
        ('Revocation controls', False),
    ]

    # HAS ACCESS box
    draw_box(ax, 0.05, 0.38, 0.40, 0.32, '', '#E8F5E9', text_color=COLORS['text'],
             alpha=0.8, style='round,pad=0.01')
    ax.text(0.25, 0.685, 'HAS ACCESS TO:', ha='center', va='center',
            fontsize=11, fontweight='bold', color=COLORS['allow'])
    for i, (item, _) in enumerate(has_items):
        y = 0.63 - i * 0.06
        ax.text(0.08, y, f'✓  {item}', ha='left', va='center',
                fontsize=10, color=COLORS['allow'], fontweight='bold')

    # CAN DO
    ax.text(0.25, 0.44, 'CAN DO:', ha='center', va='center',
            fontsize=10, fontweight='bold', color=COLORS['allow'])
    ax.text(0.08, 0.40, '✓  Send requests to proxy', ha='left', va='center',
            fontsize=9, color=COLORS['allow'])

    # NO ACCESS box
    draw_box(ax, 0.52, 0.38, 0.43, 0.32, '', '#FFEBEE', text_color=COLORS['text'],
             alpha=0.8, style='round,pad=0.01')
    ax.text(0.735, 0.685, 'CANNOT ACCESS:', ha='center', va='center',
            fontsize=11, fontweight='bold', color=COLORS['deny'])
    for i, (item, _) in enumerate(no_items):
        y = 0.63 - i * 0.05
        ax.text(0.55, y, f'✗  {item}', ha='left', va='center',
                fontsize=9, color=COLORS['deny'], fontweight='bold')

    # CANNOT DO
    ax.text(0.735, 0.44, 'CANNOT DO:', ha='center', va='center',
            fontsize=10, fontweight='bold', color=COLORS['deny'])
    cannot_do = [
        'Buy blocked categories',
        'Exceed budget limit',
        'Use unauthorized vendors',
        'Act after revocation',
        'Forge new capabilities',
        'Escalate privileges',
    ]
    for i, item in enumerate(cannot_do):
        y = 0.40 - i * 0.04
        ax.text(0.55, y, f'✗  {item}', ha='left', va='center',
                fontsize=8, color=COLORS['deny'])

    # Worst case scenario box
    draw_box(ax, 0.10, 0.08, 0.80, 0.14, '', '#FFF8E1', text_color=COLORS['text'],
             alpha=0.95, style='round,pad=0.01')
    ax.text(0.50, 0.19, 'WORST CASE SCENARIO', ha='center', va='center',
            fontsize=14, fontweight='bold', color='#E65100', zorder=5)
    ax.text(0.50, 0.15, 'Hijacker can spend the remaining budget on allowed items at allowed vendors.',
            ha='center', va='center', fontsize=11, color='#795548', zorder=5)
    ax.text(0.50, 0.115, 'That\'s it. The blast radius IS the capability. User hits revoke → game over.',
            ha='center', va='center', fontsize=11, fontweight='bold', color='#E65100', zorder=5)
    ax.text(0.50, 0.085, 'Compare: Traditional approach (shared credentials) → hijacker has FULL ACCESS to everything.',
            ha='center', va='center', fontsize=9, color='#9E9E9E', style='italic', zorder=5)

    pdf.savefig(fig, bbox_inches='tight')
    plt.close()


# ═══════════════════════════════════════════════════════════════════
# PAGE 7: CapNet vs Traditional — Comparison
# ═══════════════════════════════════════════════════════════════════
def page_comparison(pdf):
    fig = plt.figure(figsize=(11, 8.5))
    ax = setup_page(fig, 'CAPNET vs TRADITIONAL APPROACHES', 'Why existing solutions don\'t solve the agent authorization problem')

    headers = ['', 'API Keys /\nCredentials', 'OAuth\nScopes', 'IAM /\nRBAC', 'CAPNET']
    col_x = [0.05, 0.18, 0.35, 0.52, 0.72]
    col_w = [0.12, 0.15, 0.15, 0.15, 0.22]
    col_colors = ['#607D8B', '#E53935', '#FF8F00', '#FF8F00', COLORS['allow']]

    # Headers
    for i, (header, cx, cw, cc) in enumerate(zip(headers, col_x, col_w, col_colors)):
        if i > 0:
            draw_box(ax, cx, 0.82, cw, 0.06, header, cc, fontsize=8)

    rows = [
        ('Scoped authority', '✗', '~', '~', '✓'),
        ('Time-bounded', '✗', '~', '✗', '✓'),
        ('Instant revocation', '✗', '~', '~', '✓'),
        ('Agent-specific binding', '✗', '✗', '✗', '✓'),
        ('Budget enforcement', '✗', '✗', '✗', '✓'),
        ('Category blocking', '✗', '✗', '✗', '✓'),
        ('Vendor allow-listing', '✗', '✗', '✗', '✓'),
        ('Delegation / attenuation', '✗', '✗', '✗', '✓'),
        ('Audit trail (receipts)', '✗', '~', '~', '✓'),
        ('Agent never sees creds', '✗', '✗', '✗', '✓'),
        ('Survives agent compromise', '✗', '✗', '✗', '✓'),
    ]

    for i, (feature, *values) in enumerate(rows):
        y = 0.76 - i * 0.055
        bg = '#F5F5F5' if i % 2 == 0 else 'white'

        # Row background
        row_bg = FancyBboxPatch((0.04, y - 0.02), 0.92, 0.05,
                                 boxstyle='square,pad=0', facecolor=bg,
                                 edgecolor='#E0E0E0', linewidth=0.5, zorder=0)
        ax.add_patch(row_bg)

        # Feature name
        ax.text(0.05, y + 0.005, feature, ha='left', va='center',
                fontsize=9, fontweight='bold', color=COLORS['text'])

        # Values
        for j, val in enumerate(values):
            vx = col_x[j + 1] + col_w[j + 1] / 2
            if val == '✓':
                color = COLORS['allow']
                fsize = 14
            elif val == '✗':
                color = COLORS['deny']
                fsize = 14
            else:
                color = '#FF8F00'
                fsize = 12
            ax.text(vx, y + 0.005, val, ha='center', va='center',
                    fontsize=fsize, fontweight='bold', color=color)

    # Legend
    ax.text(0.10, 0.135, '✓ = Full support', fontsize=9, color=COLORS['allow'], fontweight='bold')
    ax.text(0.35, 0.135, '~ = Partial / limited', fontsize=9, color='#FF8F00', fontweight='bold')
    ax.text(0.60, 0.135, '✗ = Not supported', fontsize=9, color=COLORS['deny'], fontweight='bold')

    # Bottom insight
    draw_box(ax, 0.10, 0.04, 0.80, 0.07, '', '#E8F5E9', text_color=COLORS['text'],
             alpha=0.95, style='round,pad=0.01')
    ax.text(0.50, 0.085, 'CapNet is purpose-built for the agent era.',
            ha='center', va='center', fontsize=12, fontweight='bold', color=COLORS['allow'], zorder=5)
    ax.text(0.50, 0.055, 'OAuth answers "who is this?" — CapNet answers "what can this agent do right now, and can I stop it?"',
            ha='center', va='center', fontsize=9, color='#795548', style='italic', zorder=5)

    pdf.savefig(fig, bbox_inches='tight')
    plt.close()


# ═══════════════════════════════════════════════════════════════════
# GENERATE PDF
# ═══════════════════════════════════════════════════════════════════
def main():
    output_path = '/mnt/c/Users/levic/CapNET/CapNet_Architecture_Diagrams.pdf'

    with PdfPages(output_path) as pdf:
        page_system_architecture(pdf)
        page_issuance_flow(pdf)
        page_enforcement_pipeline(pdf)
        page_action_flow(pdf)
        page_revocation_flow(pdf)
        page_blast_radius(pdf)
        page_comparison(pdf)

    print(f'Generated: {output_path}')
    print(f'Pages: 7')


if __name__ == '__main__':
    main()
