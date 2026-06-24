# TxGuardian — Data Flow Diagram (trust boundaries)

> Trust-boundary view of TxGuardian's data flows — the input to its STRIDE
> threat model (maintained as an internal document).
> A DFD names the *processes*, *data stores*, *external entities*, and the
> *flows* between them, and draws the **trust boundaries** those flows cross.
> Each numbered boundary (TB-n) is where STRIDE analysis is applied.

## Trust boundaries

| ID | Boundary | Crossed by |
|----|----------|------------|
| **TB-1** | Untrusted web origin ↔ extension | the intercepted signing request from any dApp |
| **TB-2** | Device ↔ user's Solana RPC | simulation + registry reads |
| **TB-3** | Deterministic engine ↔ attacker-submittable on-chain bytes | confirmed attestations folded into the rules |
| **TB-4** | Device ↔ Google Gemini | decoded summaries (BYO-key path), prose only |
| **TB-5** | Client ↔ TxGuardian server | **only** in the opt-in hosted fallback / `/scan` demo |
| **TB-6** | Tx signer ↔ Solana runtime | `submit` / admin `attest`/`revoke`/`update_admin` |

## Default path — extension (engine runs on-device)

```mermaid
flowchart TB
    subgraph webpage["Untrusted web origin (dApp page)"]
        dapp["dApp / wallet adapter<br/>calls signTransaction"]
    end

    subgraph device["User's device (browser) — TRUSTED"]
        page["page.ts (MAIN world)<br/>intercepts signTransaction"]
        content["content.ts<br/>(ns=TXG, type, event.source checks)"]
        subgraph sw["Service worker (extension)"]
            engine["@txguardian/sdk engine<br/>parse · decode · simulate · rules · score"]
        end
        modal["Shadow-DOM modal<br/>(user decides)"]
        keystore[("chrome.storage.session<br/>Gemini key — RAM, cleared on close")]
    end

    subgraph rpc["User's Solana RPC — THIRD PARTY"]
        sim["simulateTransaction"]
        reg[("Registry program accounts<br/>confirmed attestations")]
    end

    subgraph google["Google Gemini — THIRD PARTY (BYO key)"]
        llm["generativelanguage.googleapis.com"]
    end

    dapp -->|"signing request"| page
    page -->|postMessage| content
    content -->|chrome.runtime| engine
    engine -->|"tx (full mode)"| sim
    engine -->|"getProgramAccounts"| reg
    engine -.->|"decoded summary + user key"| llm
    keystore -.->|"key (if enabled)"| engine
    engine -->|verdict| modal
    modal -->|"approve / reject"| dapp

    %% Trust boundaries
    page -.->|TB-1| content
    engine -.->|TB-2| sim
    reg -.->|TB-3| engine
    engine -.->|TB-4| llm
```

In the default path the **TxGuardian server is never contacted** (no TB-5
crossing). The transaction is disclosed only to the user's own RPC, and decoded
summaries reach Google only if the user enabled the translator with their own
key.

## Opt-in path — hosted fallback / `/scan` web demo (engine runs server-side)

```mermaid
flowchart TB
    subgraph client["Browser (web demo or extension hosted mode)"]
        ui["/scan UI or extension<br/>posts tx/signature"]
    end

    subgraph txg["TxGuardian server (Vercel serverless) — TB-5"]
        api["/api/analyze<br/>rate-limit · input cap · no-store"]
        sdk["@txguardian/sdk engine<br/>(same engine, server-side)"]
        note["NO retention:<br/>no log of tx bytes · no DB · no fs write"]
    end

    subgraph rpc2["TxGuardian's Solana RPC"]
        sim2["simulate / getTransaction"]
        reg2[("Registry accounts")]
    end

    subgraph google2["Google Gemini (server key, full mode only)"]
        llm2["Gemini API"]
    end

    ui -->|"TB-5: tx/signature"| api
    api --> sdk
    sdk --> sim2
    sdk --> reg2
    sdk -.->|"full mode only"| llm2
    sdk -->|"verdict JSON (no-store)"| ui
    api -.-> note
```

The opt-in path crosses **TB-5**: the full transaction reaches TxGuardian's
server. Confirmed behavior is a **stateless pass-through** — the tx is analyzed
in the function's memory and discarded; nothing is persisted server-side. In
`full` mode, decoded summaries also reach Google via TxGuardian's key.

## On-chain registry (TB-6)

```mermaid
flowchart LR
    submitter["Anyone<br/>(submitter)"] -->|"submit / submit_verified<br/>(pending, rent-paid)"| program
    admin["Curator admin keypair<br/>(single key in v1 → multisig target)"] -->|"attest / revoke / update_admin<br/>has_one = admin"| program
    subgraph chain["Solana devnet — TB-6"]
        program["txguardian-registry program"]
        store[("Attestation / VerifiedAttestation<br/>+ Registry singleton PDAs")]
        program --> store
    end
    store -->|"confirmed only"| engineRead["SDK getProgramAccounts<br/>(folds into rules)"]
```

Pending submissions never reach the engine — only `status === confirmed`
accounts are read, and confirmation requires the admin signature. The admin key
is the single irreducible trust point (custody + rotation are covered in the
internal threat model).
