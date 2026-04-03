# PeerMLS

**An open listing network. Run by brokers and agents, for brokers and agents.**

PeerMLS is an open-source listing network where brokerages and agents share listings directly with each other. No central authority. No dues. No middleman controlling your data.

## Why This Exists

Real estate professionals pay hundreds to over a thousand dollars per year in MLS dues to access a shared listing database. In return, the MLS controls when and how listings are marketed, licenses the data it collects to vendors and portals, and offers limited flexibility for how brokers manage their own listings.

After the NAR settlement and the introduction of delayed marketing exemptions under the new MLOS policy, listings are increasingly moving off traditional MLS syndication into office exclusives and private networks. The industry needs a way to share listings cooperatively — one that gives brokers and agents more control over their own data.

PeerMLS is a working proof of concept exploring what that could look like.

## How It Works

Each brokerage or agent runs their own listing server (a "node"). Nodes share listings with each other automatically, the same way email works — you don't run your own mail server, but you can email anyone on any provider. Small brokerages and individual agents can use a low-cost hosted provider or enter listings through another brokerage's portal.

**You control your listings.** Want to keep a listing office-exclusive for a week before going wide? Your call. Ready to share with the network? Flip a switch. The person the client hired makes the marketing decision. Not a committee.

**The data is yours.** Every listing you enter is your data. You originated it. You can export it anytime. If you switch providers, your listings go with you.

**Low cost.** The software is open source. Running a node costs as little as $5/month on a basic server. There are no membership dues, no per-agent fees, no data licensing costs.

## Who Can Join

Anyone with an active state real estate license — broker or agent. PeerMLS verifies your license against your state's licensing database in real time. If the state says you're licensed, you're in. No application, no committee approval, no waiting period.

## Does This Replace the MLS?

Not necessarily, and not overnight. PeerMLS is designed to run alongside the MLS. Your listings go into the MLS per your current requirements, and the same listings go into your PeerMLS node. There is no need to choose one or the other.

Over time, as the network grows, each brokerage and agent decides for themselves what combination of systems serves them best.

## How Is This Different from Previous Attempts?

Several efforts to build alternatives to the MLS have been tried before. NAR spent over $50M on Upstream. Blockchain-based listing platforms came and went. None achieved meaningful adoption.

PeerMLS is different in a few key ways:

- **It uses existing standards.** PeerMLS is built on the RESO Data Dictionary, the same data standard that 90% of MLS listings already flow through. There is no new data format to learn. Existing tools and integrations work with minimal changes.
- **It doesn't ask anyone to jump.** PeerMLS runs alongside the MLS during any transition period. There is no all-or-nothing switch.
- **It's open source.** No company owns the protocol. No vendor controls the roadmap. The code is public and auditable.
- **The timing is different.** Post-NAR settlement, post-MLOS, with listings already fragmenting off the MLS and states legislating public marketing requirements, the market conditions are different from any previous attempt.

## For Consumers

Public listing data — address, price, beds, baths, photos, description — is open by default. Anyone can build a consumer search app on top of PeerMLS. No single company controls access to the data. Consumer access is built into how the network works, not a policy that can be reversed by a committee vote.

## For Portals and Technology Companies

PeerMLS uses the RESO Data Dictionary. If your software reads MLS data today, it can read PeerMLS data with minimal changes. Aggregator nodes provide a single query point for the entire network.

No data licensing agreement, no vendor procurement process, no board approval. If you can call an API, you can build on PeerMLS.

This means better tools, faster. Showing schedulers, CMA platforms, offer management, transaction coordination, AI assistants, consumer search — all built by competing companies on an open data layer, instead of gated behind vendor agreements.

## For Agents

The same listing data you access through the MLS today — active listings, pending, sold comps — would be available through PeerMLS as the network grows. Your brokerage or a hosted provider handles the infrastructure. You search listings, pull comps, and coordinate with other agents the same way you do now.

Compensation offers between brokers can be logged with timestamps across the network, creating a system of record for cooperative compensation in the post-settlement landscape.

## How We Verify Identity

Every node on the network is verified against state licensing databases. PeerMLS checks your license number directly with your state's real estate commission. The verification is logged in a public transparency log that anyone can audit.

Multiple independent verification services can operate, preventing any one organization from becoming a gatekeeper. The protocol is designed so that no single company, foundation, or trade group can control access to the network.

## Governance

PeerMLS is designed to be owned by a nonprofit foundation with a legal asset lock. This means:

- No company can acquire the protocol or trademark
- No corporate board seats — governance is by individual contributors
- No single sponsor can fund more than 20% of operations
- The protocol spec is separate from any single implementation

Changes to the protocol require community consensus and at least two independent working implementations. This follows the same governance model used by internet standards like HTTP and email.

## Current Status

PeerMLS is a working proof of concept being shared for industry feedback. The reference implementation includes:

- Federated listing nodes that sync with each other in real time
- Full RESO Data Dictionary fields: active listings, sold comps (close price, concessions, buyer agent, financing), photos, and geo coordinates
- Live license verification against state databases (Alabama operational, more states coming)
- API key authentication on write endpoints, attestation verification during federation sync
- Data accuracy flagging with one-step resolution (correct or dismiss, no back-and-forth)
- Search and filtering: city, state, zip, price range, beds, baths, property type, agent, office, free text
- A web dashboard for browsing listings, verifying licenses, and monitoring federation
- Import tools for migrating existing MLS data (RESO Web API and CSV)
- An aggregator node that provides a single query point for the full network

This is early-stage software. The protocol spec and governance model are published and open for review and discussion.

## Get Involved

We're looking for:

- **Brokers and agents** who want to pilot PeerMLS alongside their existing MLS
- **Technology companies** interested in building tools on an open listing network
- **Industry leaders** who want to help shape the protocol spec and governance
- **Developers** who want to contribute to the open-source implementation

Reach out to Trey McMeans on [LinkedIn](https://www.linkedin.com/in/treymcmeans) or open an issue on this repo.

## Links

- [Protocol Spec](SPEC.md) — technical specification for the federation protocol
- [Governance](GOVERNANCE.md) — foundation structure, decision-making process, anti-capture mechanisms
- [Developer Guide](DEVELOPER.md) — technical setup, API docs, import CLI, and integration guide
