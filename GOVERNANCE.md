# PeerMLS Governance

## Principles

PeerMLS is a protocol, not a product. The protocol spec, reference implementation, and verification infrastructure are community-owned and cannot be captured by any single entity.

1. **The protocol is dumb pipes.** It moves RESO-compliant data between nodes. It does not govern, score, rank, or adjudicate.
2. **State licensing boards are the source of truth.** The network does not decide who is a legitimate broker. States do.
3. **Openness is architectural, not political.** Public access is a property of how the system works, not a policy that can be reversed.

## Structure

```
PeerMLS Foundation (nonprofit, asset-locked)
  ├── Protocol Spec (separate repo, spec change process)
  ├── Interoperability Test Suite
  ├── Reference Implementation (this repo)
  ├── Verification Service (open source, anyone can run)
  └── Transparency Log (public, append-only, auditable)
```

The Foundation holds the spec and trademark under a legal asset lock (Community Interest Company or 501(c)(3)). This prevents acquisition, hostile takeover, or capture by a single corporate interest, even if the founding team disappears.

## Decision-Making

### Day-to-Day: Lazy Consensus

A proposal (PR, design doc, configuration change) passes unless someone objects within 72 hours. If no objection is raised, the proposal is accepted. Explicit votes happen only when lazy consensus fails.

### Protocol Changes: Rough Consensus + Running Code

Spec changes follow the IETF model:

1. **Proposal** — anyone opens an issue or PR against the spec repo
2. **Discussion** — community evaluates technical merit, not politics
3. **Two implementations** — the change does not become final until at least two independent implementations prove it works and interoperate
4. **Merge** — spec maintainers merge when rough consensus is reached (technical objections addressed, not necessarily unanimous)

A single well-reasoned technical objection with a proposed alternative can block consensus. Counting votes is not consensus.

### Committers: Individual Merit

Committer status is earned by individuals through sustained contribution. Corporate affiliation is irrelevant. No company can buy governance seats, board positions, or committer rights. Sponsorship buys gratitude, not influence.

## Funding

The Foundation accepts sponsorships from multiple sources. No single sponsor may account for more than 20% of operational revenue. This ensures no funder has leverage over technical direction.

Operational costs are kept deliberately low. The protocol is the product, not an organization.

## Anti-Capture Mechanisms

- **Asset lock**: the Foundation's legal structure prevents the spec, trademark, or infrastructure from being sold or transferred to a private entity
- **Individual governance**: no corporate seats on any decision-making body
- **Diverse funding**: no single sponsor exceeds 20% of revenue
- **Spec/implementation separation**: the protocol spec lives in its own repo with its own governance. Controlling the reference implementation does not mean controlling the protocol
- **Interop test suite**: any implementation that passes the test suite is a valid PeerMLS node. No single implementation is privileged
- **Open transparency logs**: all verification attestations are publicly auditable. Verifier misbehavior is visible to everyone

## Verification Services

Anyone can run a verification service. Getting on the network's default trusted issuer list requires:

1. Open source codebase (auditable verification logic)
2. Logging all attestations to a public transparency log
3. Community review via PR to the trusted issuer list
4. Demonstrated accuracy against state licensing databases

A verification service has no power beyond confirming what state licensing boards already publish. It cannot deny a licensed broker access. It cannot set policy. It reads public data and signs attestations.

Multiple verifiers exist so no single entity controls network access. If one is compromised, nodes remove it from their trusted list. The network continues.
