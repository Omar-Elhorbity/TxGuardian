# Registry program — deploy notes

## Current state

Deployed to **devnet** at `Dt6ccUKifBKegcxKGvgiHfyCDrJFeRwMmhvi7eCbFVS7`.

The currently-running on-chain version exposes 5 instructions:

- `initialize` — bootstrap the singleton Registry PDA
- `submit` — anyone, creates a pending `Attestation` (drainer)
- `attest` — admin-only, pending → confirmed
- `revoke` — admin-only, any → revoked
- `update_admin` — admin-only, rotate the curator pubkey

## Pending redeploy — verified-program flow

The source in `src/` has been extended with a positive-attestation
("verified program") flow. It adds:

- A new `VerifiedAttestation` account type (PDA seed: `[b"verified", target]`)
- Three new instructions: `submit_verified`, `attest_verified`,
  `revoke_verified` (mirror of the existing drainer flow)
- Three new events: `VerifiedSubmitted`, `VerifiedConfirmed`, `VerifiedRevoked`

This is **additive** — the existing `Attestation` accounts and instructions
are unchanged, so the redeploy does not require any migration of on-chain
data. Existing drainer attestations stay valid; existing client code keeps
working.

## To make it live

```bash
# from repo root
anchor build
anchor deploy --provider.cluster devnet
# (use the same keypair that owns the existing program — same Program ID)
```

After deploy:

- The SDK's `fetchVerifiedAttestations()` will start returning entries
  (currently returns `[]` because no accounts exist yet).
- `detectUnknownPrograms` rule will skip programs with confirmed positive
  attestations.
- You can then run `pnpm tsx scripts/seed-registry.ts` (or write a similar
  script) to add the first batch of verified programs — e.g. the major
  Solana programs not yet in the static allowlist.

## Why this matters

Today, the registry is only a decentralized **blocklist** (drainers). After
this redeploy, it becomes a decentralized **both-list** — community can
positively attest programs as safe as well. This is the architectural
answer to the "UNKNOWN_PROGRAM false positives" problem: as the verified
feed grows, the static allowlist becomes a fallback rather than the
primary source of truth for "is this program OK?"

Long-term, the verified feed is what lets TxGuardian keep up with the
Solana ecosystem's growth without us maintaining a hand-curated allowlist
of every new dApp.
