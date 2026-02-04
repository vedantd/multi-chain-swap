# Quote validation (integration)

Real API runs against `getQuotes` to validate routing logic, quote selection, UI display math, and fee breakdown. Output is a CSV suitable for Excel.

## Run

From repo root:

```bash
npm run quote-validation
```

Or:

```bash
npx tsx -r tsconfig-paths/register quote-validation/run.ts
```

**Requirements:** `tsconfig-paths` and `tsx` (install with `npm install`; both are dev dependencies).

- **~150** quote requests (configurable in `config.ts`).
- **10 s** sleep between batches of 10 to avoid rate limits.
- Total runtime about **5–6 minutes**.

## Inputs

- **Seed log:** `logs/quotes-accounting.jsonl`  
  Each line is a JSON object with a `request` field (origin/destination chain/token, amount, user/deposit addresses). The script dedupes by route and amount, then adds variations (amounts, chain pairs, stablecoin vs non-stablecoin) to reach the target number of calls.
- **Wallets:** User and deposit-fee-payer addresses are taken from the same log so the same wallets you used in the UI are used here.

## Output

- **Directory:** `quote-validation/output/`
- **CSV per run:** `quote-validation-{runId}.csv` (one per run). Open in Excel for filtering and fee analysis.
- **Run summary:** `latest-run-summary.txt` — overwritten each run with run ID, timestamp, total rows, error count, routing check pass count, and price sanity FAIL count.

### Documented results

After each run you get:

1. **CSV** — Full detail for every test case (chains, tokens, amounts, best provider, effective receive, fee split, price sanity, errors). Use for audits and UI verification.
2. **Console summary** — e.g. `Errors: 71 | Best is max effective receive: 79 / 150 | Price sanity FAIL: 2`.
3. **`latest-run-summary.txt`** — Same stats plus runId and ISO timestamp so you can match the run to the CSV file.

Interpretation:

- **Errors** — Rows where `getQuotes` threw (e.g. no routes, provider API errors). Check the `error` column in the CSV.
- **Best is max effective receive** — Count of rows where the chosen best quote actually had the highest effective receive (routing logic check).
- **Price sanity FAIL** — Stablecoin rows where input vs output USD differed by more than the configured tolerance (see Configuration).

### CSV columns

| Column | Description |
|--------|-------------|
| runId | Unique run identifier |
| index | Test case index (0-based) |
| category | `stablecoin` or `non-stablecoin` (both tokens USDC/USDT vs not) |
| originChainId, destinationChainId | Chain IDs |
| originTokenAddress, destinationTokenAddress | Token contract addresses |
| originTokenSymbol, destinationTokenSymbol | Resolved symbols |
| amountRaw, amountHuman | Input amount (raw units, human) |
| bestProvider | `relay` or `debridge` |
| effectiveReceiveRaw | Best quote’s effective receive (raw) |
| effectiveReceiveFormattedUI | Value shown in UI (“You receive”) — same formula as SwapPanel |
| costToUser | User cost in output-token raw units |
| fees | Provider fee (raw) |
| sponsorCost | Sponsor cost (raw) |
| solanaCostToUser | Solana gas cost to user (lamports) if any |
| feeCurrency | Currency of fees (e.g. USDC) |
| userFee, userFeeCurrency | User-paid fee and its currency |
| reasonChosen | Why this quote was chosen (e.g. highest_effective_receive) |
| priceSanityStatus | For stablecoins: OK / WARN / FAIL / N/A |
| priceInputUSD, priceOutputUSD | Input/output value in USD (when price API used) |
| priceDiffPercent | Absolute input vs output USD difference (percent) |
| durationMs | Approximate duration of the batch (ms) |
| error | Error message if the quote request failed |
| bestInQuotes | Whether the chosen best is present in the quotes array |
| bestIsMaxEffectiveReceive | Whether the chosen best has the maximum effective receive (routing check) |

### Fee split (summary)

- **Total fee** (to the protocol/bridge): `fees` in `feeCurrency`.
- **Who pays:**  
  - **Sponsor:** `sponsorCost` (same currency as `feeCurrency`). Relay gasless routes use sponsor; deBridge is 0.  
  - **User:** `costToUser` in output units; plus `userFee` / `userFeeCurrency` when Relay charges a user fee; plus `solanaCostToUser` (lamports) when the user pays Solana gas (e.g. deBridge).
- **User total cost** in output terms: effectively `expectedOut - effectiveReceiveRaw` (plus SOL gas if `solanaCostToUser` set).

## Checks performed

1. **Routing:** `best` is in `quotes` and has the maximum `effectiveReceiveRaw` among eligible quotes (`bestIsMaxEffectiveReceive`).
2. **UI display:** `effectiveReceiveFormattedUI` is computed with the same ratio logic as the UI so “You receive” matches the quote.
3. **Price sanity (stablecoins):** If CoinGecko is available, input vs output USD are compared; within 5% is OK, up to 10% WARN, else FAIL. Non-stablecoin routes get N/A or optional future checks.

## Configuration

Edit `quote-validation/config.ts`:

- `BATCH_SIZE`, `SLEEP_BETWEEN_BATCHES_MS`, `TARGET_TOTAL_CALLS` — rate limiting and run size.
- `QUOTES_ACCOUNTING_PATH` — path to the JSONL seed log.
- `OUTPUT_DIR` — where to write the CSV.
- `MOCK_USER_SOL_BALANCE` — lamports passed to `getQuotes` so eligibility (e.g. SOL for gas) passes.
- `PRICE_SANITY_TOLERANCE_*` — thresholds for price checks.

Price fetching is best-effort (CoinGecko); if it fails, price columns are empty and `priceSanityStatus` is N/A.
