#!/bin/bash
set -euo pipefail

# =========================
# Config (override via env)
# =========================
# -- Anvil / RPC
RPC_URL="${RPC_URL:-http://127.0.0.1:8545}"
CHAIN_ID="${CHAIN_ID:-31337}"
PORT="${PORT:-8545}"
ANVIL_BIN="${ANVIL_BIN:-anvil}"
ACCOUNTS="${ACCOUNTS:-10}"
MNEMONIC="${MNEMONIC:-}"  # prefer to load from sc/.env.local
DERIVATION_PATH=${DERIVATION_PATH:-$'m/44\'/60\'/0\'/0/'}   # base path (MetaMask default)
DERIVATION_PATH_TX=${DERIVATION_PATH_TX:-$'m/44\'/60\'/0\'/0/0'} # tx path for deployer (account 0)
PK="${PK:-0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80}"  # anvil[0]
USE_MNEMONIC="${USE_MNEMONIC:-1}"  # 1=deploy with mnemonic, 0=deploy with PK
KEEP_ANVIL="${KEEP_ANVIL:-1}"     # 1=keep running after deploy

# -- Output behavior
FOREGROUND="${FOREGROUND:-logs}"   # legacy for anvil only (logs|none|tmux)

# -- Paths
root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
sc_dir="$root_dir/sc"
web_dir="$root_dir/web"
logfile="$root_dir/.anvil.log"
web_logfile="$root_dir/.web.log"

# Load secrets from sc/.env.local if present (exports variables)
if [[ -f "$sc_dir/.env.local" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$sc_dir/.env.local"
  set +a
fi

# Ensure MNEMONIC is set when using mnemonic flow
if [[ "$USE_MNEMONIC" = "1" && -z "${MNEMONIC:-}" ]]; then
  echo "[deploy] ERROR: MNEMONIC not set. Create sc/.env.local with MNEMONIC=\"word1 ... word12\"" >&2
  exit 1
fi

print_accounts() {
  # Parse addresses and privkeys from anvil banner
  local addrs=() pks=()
  while IFS= read -r line; do addrs+=("$line"); done \
    < <(awk '/Available Accounts/{f=1;next} /Private Keys/{f=0} f && /\)/ {gsub(/[()]/,""); print $2}' "$logfile")
  while IFS= read -r line; do pks+=("$line"); done \
    < <(awk '/Private Keys/{f=1;next} /Wallet/{f=0} f && /\)/ {gsub(/[()]/,""); print $2}' "$logfile")
  echo "== Anvil Accounts (${#addrs[@]}) =="
  for i in "${!addrs[@]}"; do printf "%2d) %s  %s\n" "$i" "${addrs[$i]}" "${pks[$i]}"; done
  echo "Mnemonic: $MNEMONIC"
  echo "Path:     ${DERIVATION_PATH}{index}"
}

start_anvil() {
  echo "[deploy] Checking RPC at $RPC_URL"
  ANVIL_MODE=""
  if ! curl -sSf -H 'content-type: application/json' \
    --data '{"jsonrpc":"2.0","method":"web3_clientVersion","params":[],"id":1}' \
    "$RPC_URL" >/dev/null 2>&1; then
    echo "[deploy] Anvil not running. Starting..."
    if [[ "$FOREGROUND" == "tmux" ]]; then
      tmux kill-session -t anvil >/dev/null 2>&1 || true
      tmux new-session -d -s anvil "$ANVIL_BIN --chain-id $CHAIN_ID --port $PORT --accounts $ACCOUNTS --mnemonic \"$MNEMONIC\" --derivation-path \"$DERIVATION_PATH\" --base-fee 1000000000 --gas-limit 30000000"
      ANVIL_MODE="tmux"
    else
      "$ANVIL_BIN" --chain-id "$CHAIN_ID" --port "$PORT" --accounts "$ACCOUNTS" \
        --mnemonic "$MNEMONIC" --derivation-path "$DERIVATION_PATH" \
        --base-fee 1000000000 --gas-limit 30000000 > "$logfile" 2>&1 &
      ANVIL_PID=$!
      ANVIL_MODE="bg"
    fi
    # Wait for JSON-RPC readiness
    for _ in {1..50}; do
      if curl -sSf -H 'content-type: application/json' \
        --data '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' \
        "$RPC_URL" >/dev/null 2>&1; then break; fi
      sleep 0.2
    done
    echo "[deploy] Anvil ready"
    [[ "$ANVIL_MODE" == "bg" ]] && print_accounts
  fi
}

cleanup() {
  # Stop tail first
  if [[ -n "${WEB_TAIL_PID:-}" ]]; then kill "${WEB_TAIL_PID}" >/dev/null 2>&1 || true; fi
  # Optionally stop frontend
  if [[ "${KEEP_WEB:-1}" = "0" && "${WEB_MODE_RUN:-}" == "bg" && -n "${WEB_PID:-}" ]]; then
    kill "${WEB_PID}" >/dev/null 2>&1 || true
  fi
  # Optionally stop anvil
  if [[ "${KEEP_ANVIL}" = "0" && "${ANVIL_MODE:-}" == "bg" && -n "${ANVIL_PID:-}" ]]; then
    kill "${ANVIL_PID}" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

# =========================
# Orchestration
# =========================
start_anvil

echo "[deploy] Building contracts…"
cd "$sc_dir"
forge build 1>/dev/null

# ---- choose wallet flags for forge script ----
if [[ "$USE_MNEMONIC" = "1" ]]; then
  echo "[deploy] Using MNEMONIC for deploy (${DERIVATION_PATH_TX})"
  FORGE_WALLET_FLAGS=(--mnemonics "$MNEMONIC" --mnemonic-derivation-paths "$DERIVATION_PATH_TX")
else
  echo "[deploy] Using PRIVATE KEY for deploy"
  FORGE_WALLET_FLAGS=(--private-key "$PK")
fi

echo "[deploy] Broadcasting Deploy.s.sol…"
forge script script/Deploy.s.sol --rpc-url "$RPC_URL" "${FORGE_WALLET_FLAGS[@]}" --broadcast 1>/dev/null

BROADCAST_FILE="$(ls -t "$sc_dir"/broadcast/Deploy.s.sol/"$CHAIN_ID"/run-*.json | head -n1)"
[[ -n "${BROADCAST_FILE:-}" ]] || { echo "[deploy] ERROR: broadcast file not found" >&2; exit 1; }

ADDR="$(jq -r '
  (.transactions[]? | select(.contractName=="SupplyChain") | .contractAddress),
  (.receipts[]? | .contractAddress)
  | select(.!=null) | select(length>0) | . ' "$BROADCAST_FILE" | head -n1)"
[[ -n "${ADDR:-}" && "$ADDR" != "null" ]] || { echo "[deploy] ERROR: contract address not found" >&2; exit 1; }

# Determine admin (prefer on-chain)
ADMIN="$(cast call "$ADDR" "admin()(address)" --rpc-url "$RPC_URL" 2>/dev/null || true)"
ADMIN="$(echo -n "$ADMIN" | tr -d '\r')"
if [[ -z "$ADMIN" || "$ADMIN" == "0x0000000000000000000000000000000000000000" || "$ADMIN" == "null" ]]; then
  if [[ "$USE_MNEMONIC" = "1" ]]; then
    # Use SRP account 0 address derived from DERIVATION_PATH base
    ADMIN="$(cast wallet address --mnemonic "$MNEMONIC" --derivation-path "$DERIVATION_PATH" --index 0 | tr -d '\r')"
  else
    ADMIN="$(cast wallet address --private-key "$PK" | tr -d '\r')"
  fi
fi
[[ -n "$ADMIN" && "$ADMIN" != "0x0000000000000000000000000000000000000000" ]] || { echo "[deploy] ERROR: cannot determine admin" >&2; exit 1; }

echo "[deploy] Sanity check on-chain…"
cast code "$ADDR" --rpc-url "$RPC_URL" | grep -qv '^0x$' || { echo "[deploy] ERROR: no code at $ADDR"; exit 1; }
cast call "$ADDR" "nextUserId()(uint256)" --rpc-url "$RPC_URL" >/dev/null

# Export ABI -> web
ABI_SRC="$sc_dir/out/SupplyChain.sol/SupplyChain.json"
[[ -f "$ABI_SRC" ]] || { echo "[deploy] ERROR: artifact not found: $ABI_SRC" >&2; exit 1; }
mkdir -p "$web_dir/src/contracts"
jq -r '.abi' "$ABI_SRC" > "$web_dir/src/contracts/SupplyChain.abi.json"

# Write frontend env
cat > "$web_dir/.env.local" <<EOF
NEXT_PUBLIC_RPC_URL=$RPC_URL
NEXT_PUBLIC_CHAIN_ID=$CHAIN_ID
NEXT_PUBLIC_CONTRACT_ADDRESS=$ADDR
NEXT_PUBLIC_ADMIN_ADDRESS=$ADMIN
EOF

# Update subgraph contract address
SUBGRAPH_YAML="$root_dir/subgraph/subgraph.yaml"
if [[ -f "$SUBGRAPH_YAML" ]]; then
  echo "[deploy] Updating subgraph contract address..."
  # Use sed to replace the address line in subgraph.yaml
  sed -i.bak "s/address: \"0x[a-fA-F0-9]*\"/address: \"$ADDR\"/" "$SUBGRAPH_YAML"
  rm -f "$SUBGRAPH_YAML.bak"
  echo "[deploy] Subgraph config updated with address: $ADDR"
fi

echo "[deploy] SupplyChain: $ADDR"
echo "[deploy] Admin:       $ADMIN"
echo "[deploy] ABI:         web/src/contracts/SupplyChain.abi.json"
echo "[deploy] Env:         web/.env.local"

# Optionally seed demo data on the local chain
if [[ "${SEED:-1}" = "1" ]]; then
  echo "[deploy] Seeding demo data…"
  (
    cd "$sc_dir"
    forge script script/Seed.s.sol --rpc-url "$RPC_URL" --broadcast --sig "run(address)" "$ADDR"
  )
fi

# Bring anvil logs or tmux if requested (frontend already started)
if [[ "$ANVIL_MODE" == "bg" && "$KEEP_ANVIL" = "1" && "$FOREGROUND" == "logs" ]]; then
  echo "[deploy] Streaming Anvil logs (Ctrl+C to stop tail)…"
  tail --pid="${ANVIL_PID:-999999}" -f "$logfile"
elif [[ "$ANVIL_MODE" == "tmux" && "$KEEP_ANVIL" = "1" ]]; then
  echo "[deploy] Attach tmux: 'anvil' session available."
  tmux ls || true
fi
