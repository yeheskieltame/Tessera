package data

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"math/big"
	"net/http"
	"strings"
	"sync"
	"time"
)

// ChainConfig defines a supported blockchain network.
type ChainConfig struct {
	Name        string
	ChainID     int
	RPCURL      string
	ExplorerAPI string // Etherscan-compatible API base (empty if none)
	NativeToken string
	IsTestnet   bool
}

// TokenDef defines an ERC-20 token to query on a specific chain.
type TokenDef struct {
	Symbol   string
	Contract string // contract address on this chain
	Decimals int    // 6 for USDC/USDT, 18 for DAI
}

// chainTokens maps chainID → list of tokens to query.
var chainTokens = map[int][]TokenDef{
	1: { // Ethereum
		{Symbol: "USDC", Contract: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", Decimals: 6},
		{Symbol: "USDT", Contract: "0xdAC17F958D2ee523a2206206994597C13D831ec7", Decimals: 6},
		{Symbol: "DAI", Contract: "0x6B175474E89094C44Da98b954EedeAC495271d0F", Decimals: 18},
	},
	8453: { // Base
		{Symbol: "USDC", Contract: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", Decimals: 6},
		{Symbol: "DAI", Contract: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb", Decimals: 18},
	},
	10: { // Optimism
		{Symbol: "USDC", Contract: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", Decimals: 6},
		{Symbol: "USDT", Contract: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58", Decimals: 6},
		{Symbol: "DAI", Contract: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1", Decimals: 18},
	},
	42161: { // Arbitrum
		{Symbol: "USDC", Contract: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", Decimals: 6},
		{Symbol: "USDT", Contract: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", Decimals: 6},
		{Symbol: "DAI", Contract: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1", Decimals: 18},
	},
	5000: { // Mantle
		{Symbol: "USDC", Contract: "0x09Bc4E0D864854c6aFB6eB9A9cdF58aC190D0dF9", Decimals: 6},
		{Symbol: "USDT", Contract: "0x201EBa5CC46D216Ce6DC03F6a759e8E766e956aE", Decimals: 6},
	},
	534352: { // Scroll
		{Symbol: "USDC", Contract: "0x06eFdBFf2a14a7c8E15944D1F4A48F9F95F663A4", Decimals: 6},
		{Symbol: "USDT", Contract: "0xf55BEC9cafDbE8730f096Aa55dad6D22d44099Df", Decimals: 6},
	},
	59144: { // Linea
		{Symbol: "USDC", Contract: "0x176211869cA2b568f2A7D4EE941E073a821EE1ff", Decimals: 6},
		{Symbol: "USDT", Contract: "0xA219439258ca9da29E9Cc4cE5596924745e12B93", Decimals: 6},
	},
	324: { // zkSync Era
		{Symbol: "USDC", Contract: "0x1d17CBcF0D6D143135aE902365D2E5e2A16538D4", Decimals: 6},
		{Symbol: "USDT", Contract: "0x493257fD37EDB34451f62EDf8D2a0C418852bA4C", Decimals: 6},
	},
}

// SupportedChains lists all chains Tessera can scan.
var SupportedChains = []ChainConfig{
	{Name: "Ethereum", ChainID: 1, RPCURL: "https://ethereum-rpc.publicnode.com", ExplorerAPI: "https://api.etherscan.io", NativeToken: "ETH"},
	{Name: "Base", ChainID: 8453, RPCURL: "https://mainnet.base.org", ExplorerAPI: "https://api.basescan.org", NativeToken: "ETH"},
	{Name: "Optimism", ChainID: 10, RPCURL: "https://mainnet.optimism.io", ExplorerAPI: "https://api-optimistic.etherscan.io", NativeToken: "ETH"},
	{Name: "Arbitrum", ChainID: 42161, RPCURL: "https://arb1.arbitrum.io/rpc", ExplorerAPI: "https://api.arbiscan.io", NativeToken: "ETH"},
	{Name: "Mantle", ChainID: 5000, RPCURL: "https://rpc.mantle.xyz", ExplorerAPI: "https://api.mantlescan.xyz", NativeToken: "MNT"},
	{Name: "Scroll", ChainID: 534352, RPCURL: "https://rpc.scroll.io", ExplorerAPI: "https://api.scrollscan.com", NativeToken: "ETH"},
	{Name: "Linea", ChainID: 59144, RPCURL: "https://rpc.linea.build", ExplorerAPI: "https://api.lineascan.build", NativeToken: "ETH"},
	{Name: "zkSync Era", ChainID: 324, RPCURL: "https://mainnet.era.zksync.io", ExplorerAPI: "https://api-era.zksync.network", NativeToken: "ETH"},
	{Name: "Monad Testnet", ChainID: 10143, RPCURL: "https://testnet-rpc.monad.xyz", ExplorerAPI: "", NativeToken: "MON", IsTestnet: true},
}

// TokenBalance holds the balance of a single ERC-20 token.
type TokenBalance struct {
	Symbol  string  `json:"symbol"`
	Balance float64 `json:"balance"`
}

// ChainActivity holds on-chain data for a single chain.
type ChainActivity struct {
	Chain            string         `json:"chain"`
	ChainID          int            `json:"chainId"`
	Balance          float64        `json:"balance"`
	NativeToken      string         `json:"nativeToken"`
	TxCount          int            `json:"txCount"`
	IsContract       bool           `json:"isContract"`
	ContractVerified bool           `json:"contractVerified"`
	BlockNumber      uint64         `json:"blockNumber"`
	RecentTxCount    int            `json:"recentTxCount"`
	TokenTransfers   int            `json:"tokenTransfers"`
	TokenBalances    []TokenBalance `json:"tokenBalances,omitempty"`
	IsTestnet        bool           `json:"isTestnet,omitempty"`
	Error            string         `json:"error,omitempty"`
}

// ChainSignals aggregates multi-chain blockchain data for an address.
type ChainSignals struct {
	Address           string            `json:"address"`
	Chains            []ChainActivity   `json:"chains"`
	TotalChainsActive int               `json:"totalChainsActive"`
	TotalBalance      float64           `json:"totalBalance"`
	TotalTxCount      int               `json:"totalTxCount"`
	TotalTokens       map[string]float64 `json:"totalTokens"` // symbol → total across chains
	IsMultichain      bool              `json:"isMultichain"`
	HasContracts      bool              `json:"hasContracts"`
	HasStablecoins    bool              `json:"hasStablecoins"`
	ScanDurationMs    int64             `json:"scanDurationMs"`
}

// BlockchainClient queries multiple EVM chains via JSON-RPC and explorer APIs.
type BlockchainClient struct {
	client *http.Client
}

// NewBlockchainClient creates a client with sensible defaults.
func NewBlockchainClient() *BlockchainClient {
	return &BlockchainClient{
		client: &http.Client{Timeout: 12 * time.Second},
	}
}

// ScanAddress scans an address across all supported chains concurrently.
func (bc *BlockchainClient) ScanAddress(ctx context.Context, address string) *ChainSignals {
	start := time.Now()
	address = strings.ToLower(strings.TrimSpace(address))
	if !strings.HasPrefix(address, "0x") {
		address = "0x" + address
	}

	results := make([]ChainActivity, len(SupportedChains))
	var wg sync.WaitGroup

	for i, chain := range SupportedChains {
		wg.Add(1)
		go func(idx int, cfg ChainConfig) {
			defer wg.Done()
			results[idx] = bc.scanSingleChain(ctx, cfg, address)
		}(i, chain)
	}
	wg.Wait()

	// Aggregate
	sig := &ChainSignals{
		Address:        address,
		Chains:         results,
		TotalTokens:    make(map[string]float64),
		ScanDurationMs: time.Since(start).Milliseconds(),
	}
	for _, ca := range results {
		if ca.Error != "" {
			continue
		}
		if ca.Balance > 0 || ca.TxCount > 0 || len(ca.TokenBalances) > 0 {
			sig.TotalChainsActive++
		}
		sig.TotalBalance += ca.Balance
		sig.TotalTxCount += ca.TxCount
		if ca.IsContract {
			sig.HasContracts = true
		}
		for _, tb := range ca.TokenBalances {
			sig.TotalTokens[tb.Symbol] += tb.Balance
			sig.HasStablecoins = true
		}
	}
	sig.IsMultichain = sig.TotalChainsActive >= 2
	return sig
}

// ScanSingleChain scans an address on one specific chain by name.
func (bc *BlockchainClient) ScanSingleChain(ctx context.Context, chainName, address string) *ChainActivity {
	for _, cfg := range SupportedChains {
		if strings.EqualFold(cfg.Name, chainName) {
			ca := bc.scanSingleChain(ctx, cfg, address)
			return &ca
		}
	}
	return &ChainActivity{Chain: chainName, Error: "unsupported chain"}
}

func (bc *BlockchainClient) scanSingleChain(ctx context.Context, cfg ChainConfig, address string) ChainActivity {
	ca := ChainActivity{
		Chain:       cfg.Name,
		ChainID:     cfg.ChainID,
		NativeToken: cfg.NativeToken,
		IsTestnet:   cfg.IsTestnet,
	}

	chainCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	// Parallel RPC calls for this chain
	var rpcWg sync.WaitGroup
	var mu sync.Mutex
	var rpcErr error

	rpcWg.Add(3)

	// Balance
	go func() {
		defer rpcWg.Done()
		bal, err := bc.getBalance(chainCtx, cfg.RPCURL, address)
		mu.Lock()
		defer mu.Unlock()
		if err != nil {
			rpcErr = err
			return
		}
		ca.Balance = bal
	}()

	// Tx count (nonce)
	go func() {
		defer rpcWg.Done()
		count, err := bc.getTxCount(chainCtx, cfg.RPCURL, address)
		mu.Lock()
		defer mu.Unlock()
		if err != nil {
			if rpcErr == nil {
				rpcErr = err
			}
			return
		}
		ca.TxCount = count
	}()

	// Contract check
	go func() {
		defer rpcWg.Done()
		code, err := bc.getCode(chainCtx, cfg.RPCURL, address)
		mu.Lock()
		defer mu.Unlock()
		if err != nil {
			return
		}
		ca.IsContract = len(code) > 2 // "0x" means no code
	}()

	rpcWg.Wait()

	if rpcErr != nil {
		ca.Error = rpcErr.Error()
		return ca
	}

	// Block number (chain liveness indicator)
	if bn, err := bc.getBlockNumber(chainCtx, cfg.RPCURL); err == nil {
		ca.BlockNumber = bn
	}

	// ERC-20 token balances (USDC, USDT, DAI)
	if tokens, ok := chainTokens[cfg.ChainID]; ok {
		for _, tok := range tokens {
			bal, err := bc.getTokenBalance(chainCtx, cfg.RPCURL, tok.Contract, address, tok.Decimals)
			if err == nil && bal > 0 {
				ca.TokenBalances = append(ca.TokenBalances, TokenBalance{Symbol: tok.Symbol, Balance: bal})
			}
		}
	}

	// Explorer API calls (sequential to avoid rate limits)
	if cfg.ExplorerAPI != "" && (ca.Balance > 0 || ca.TxCount > 0 || ca.IsContract) {
		explorerCtx, explorerCancel := context.WithTimeout(ctx, 8*time.Second)
		defer explorerCancel()

		if count, err := bc.getExplorerTxCount(explorerCtx, cfg.ExplorerAPI, address); err == nil {
			ca.RecentTxCount = count
		}
		if count, err := bc.getExplorerTokenTransfers(explorerCtx, cfg.ExplorerAPI, address); err == nil {
			ca.TokenTransfers = count
		}
		if ca.IsContract {
			if verified, err := bc.getContractVerified(explorerCtx, cfg.ExplorerAPI, address); err == nil {
				ca.ContractVerified = verified
			}
		}
	}

	return ca
}

// CheckConnectivity tests if we can reach at least one chain.
func (bc *BlockchainClient) CheckConnectivity(ctx context.Context) (int, int) {
	reachable := 0
	total := len(SupportedChains)

	var wg sync.WaitGroup
	var mu sync.Mutex

	for _, chain := range SupportedChains {
		wg.Add(1)
		go func(cfg ChainConfig) {
			defer wg.Done()
			checkCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
			defer cancel()
			if _, err := bc.getBlockNumber(checkCtx, cfg.RPCURL); err == nil {
				mu.Lock()
				reachable++
				mu.Unlock()
			}
		}(chain)
	}
	wg.Wait()
	return reachable, total
}

// ── JSON-RPC Helpers ──

type rpcRequest struct {
	JSONRPC string `json:"jsonrpc"`
	Method  string `json:"method"`
	Params  []any  `json:"params"`
	ID      int    `json:"id"`
}

type rpcResponse struct {
	Result json.RawMessage `json:"result"`
	Error  *struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
	} `json:"error"`
}

func (bc *BlockchainClient) rpcCall(ctx context.Context, rpcURL, method string, params []any) (json.RawMessage, error) {
	body, err := json.Marshal(rpcRequest{JSONRPC: "2.0", Method: method, Params: params, ID: 1})
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, "POST", rpcURL, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := bc.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var rpcResp rpcResponse
	if err := json.NewDecoder(resp.Body).Decode(&rpcResp); err != nil {
		return nil, fmt.Errorf("decode rpc: %w", err)
	}
	if rpcResp.Error != nil {
		return nil, fmt.Errorf("rpc error %d: %s", rpcResp.Error.Code, rpcResp.Error.Message)
	}
	return rpcResp.Result, nil
}

func (bc *BlockchainClient) getBalance(ctx context.Context, rpcURL, address string) (float64, error) {
	result, err := bc.rpcCall(ctx, rpcURL, "eth_getBalance", []any{address, "latest"})
	if err != nil {
		return 0, err
	}
	var hex string
	if err := json.Unmarshal(result, &hex); err != nil {
		return 0, err
	}
	return weiHexToEth(hex), nil
}

func (bc *BlockchainClient) getTxCount(ctx context.Context, rpcURL, address string) (int, error) {
	result, err := bc.rpcCall(ctx, rpcURL, "eth_getTransactionCount", []any{address, "latest"})
	if err != nil {
		return 0, err
	}
	var hex string
	if err := json.Unmarshal(result, &hex); err != nil {
		return 0, err
	}
	return int(hexToUint64(hex)), nil
}

func (bc *BlockchainClient) getCode(ctx context.Context, rpcURL, address string) (string, error) {
	result, err := bc.rpcCall(ctx, rpcURL, "eth_getCode", []any{address, "latest"})
	if err != nil {
		return "", err
	}
	var hex string
	if err := json.Unmarshal(result, &hex); err != nil {
		return "", err
	}
	return hex, nil
}

// getTokenBalance calls ERC-20 balanceOf(address) via eth_call.
func (bc *BlockchainClient) getTokenBalance(ctx context.Context, rpcURL, tokenContract, holder string, decimals int) (float64, error) {
	// balanceOf(address) selector = 0x70a08231 + address padded to 32 bytes
	paddedAddr := strings.TrimPrefix(strings.ToLower(holder), "0x")
	for len(paddedAddr) < 64 {
		paddedAddr = "0" + paddedAddr
	}
	callData := "0x70a08231" + paddedAddr

	result, err := bc.rpcCall(ctx, rpcURL, "eth_call", []any{
		map[string]string{"to": tokenContract, "data": callData},
		"latest",
	})
	if err != nil {
		return 0, err
	}
	var hex string
	if err := json.Unmarshal(result, &hex); err != nil {
		return 0, err
	}
	return hexToTokenAmount(hex, decimals), nil
}

func (bc *BlockchainClient) getBlockNumber(ctx context.Context, rpcURL string) (uint64, error) {
	result, err := bc.rpcCall(ctx, rpcURL, "eth_blockNumber", []any{})
	if err != nil {
		return 0, err
	}
	var hex string
	if err := json.Unmarshal(result, &hex); err != nil {
		return 0, err
	}
	return hexToUint64(hex), nil
}

// ── Explorer API Helpers (Etherscan-compatible) ──

type explorerResponse struct {
	Status  string          `json:"status"`
	Message string          `json:"message"`
	Result  json.RawMessage `json:"result"`
}

func (bc *BlockchainClient) explorerGet(ctx context.Context, baseURL, params string) (*explorerResponse, error) {
	url := fmt.Sprintf("%s/api?%s", baseURL, params)
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}

	resp, err := bc.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var er explorerResponse
	if err := json.NewDecoder(resp.Body).Decode(&er); err != nil {
		return nil, err
	}
	return &er, nil
}

func (bc *BlockchainClient) getExplorerTxCount(ctx context.Context, explorerBase, address string) (int, error) {
	er, err := bc.explorerGet(ctx, explorerBase,
		fmt.Sprintf("module=account&action=txlist&address=%s&startblock=0&endblock=99999999&page=1&offset=100&sort=desc", address))
	if err != nil {
		return 0, err
	}
	var txs []json.RawMessage
	if err := json.Unmarshal(er.Result, &txs); err != nil {
		return 0, nil // not an array = no txs
	}
	return len(txs), nil
}

func (bc *BlockchainClient) getExplorerTokenTransfers(ctx context.Context, explorerBase, address string) (int, error) {
	er, err := bc.explorerGet(ctx, explorerBase,
		fmt.Sprintf("module=account&action=tokentx&address=%s&page=1&offset=100&sort=desc", address))
	if err != nil {
		return 0, err
	}
	var txs []json.RawMessage
	if err := json.Unmarshal(er.Result, &txs); err != nil {
		return 0, nil
	}
	return len(txs), nil
}

func (bc *BlockchainClient) getContractVerified(ctx context.Context, explorerBase, address string) (bool, error) {
	er, err := bc.explorerGet(ctx, explorerBase,
		fmt.Sprintf("module=contract&action=getabi&address=%s", address))
	if err != nil {
		return false, err
	}
	return er.Status == "1", nil
}

// ── Hex Conversion ──

func hexToUint64(hex string) uint64 {
	hex = strings.TrimPrefix(hex, "0x")
	if hex == "" {
		return 0
	}
	n := new(big.Int)
	n.SetString(hex, 16)
	return n.Uint64()
}

func hexToTokenAmount(hex string, decimals int) float64 {
	hex = strings.TrimPrefix(hex, "0x")
	if hex == "" || hex == "0" {
		return 0
	}
	raw := new(big.Int)
	raw.SetString(hex, 16)
	amount := new(big.Float).SetInt(raw)
	divisor := new(big.Float).SetFloat64(1)
	for i := 0; i < decimals; i++ {
		divisor.Mul(divisor, new(big.Float).SetFloat64(10))
	}
	amount.Quo(amount, divisor)
	f, _ := amount.Float64()
	return f
}

func weiHexToEth(hex string) float64 {
	hex = strings.TrimPrefix(hex, "0x")
	if hex == "" {
		return 0
	}
	wei := new(big.Int)
	wei.SetString(hex, 16)
	eth := new(big.Float).SetInt(wei)
	divisor := new(big.Float).SetFloat64(1e18)
	eth.Quo(eth, divisor)
	f, _ := eth.Float64()
	return f
}

// ── Formatting ──

// FormatSignals returns a markdown-formatted summary for LLM context.
func (s *ChainSignals) FormatSignals() string {
	var b strings.Builder
	fmt.Fprintf(&b, "### Multi-Chain Blockchain Activity (%s)\n", s.Address)
	fmt.Fprintf(&b, "- Chains active: %d/%d | Multi-chain: %s\n", s.TotalChainsActive, len(s.Chains), boolYesNo(s.IsMultichain))
	fmt.Fprintf(&b, "- Total native balance: %.6f ETH-equivalent | Total transactions: %d\n", s.TotalBalance, s.TotalTxCount)
	fmt.Fprintf(&b, "- Has deployed contracts: %s | Has stablecoins: %s\n", boolYesNo(s.HasContracts), boolYesNo(s.HasStablecoins))

	// Token totals
	if len(s.TotalTokens) > 0 {
		fmt.Fprintf(&b, "- Stablecoin holdings:")
		for symbol, total := range s.TotalTokens {
			fmt.Fprintf(&b, " %s: $%.2f", symbol, total)
		}
		fmt.Fprintf(&b, "\n")
	}
	fmt.Fprintf(&b, "- Scan duration: %dms\n\n", s.ScanDurationMs)

	fmt.Fprintf(&b, "Per-chain breakdown:\n")
	for _, ca := range s.Chains {
		if ca.Error != "" {
			fmt.Fprintf(&b, "- %s: unreachable (%s)\n", ca.Chain, ca.Error)
			continue
		}
		if ca.Balance == 0 && ca.TxCount == 0 && !ca.IsContract && len(ca.TokenBalances) == 0 {
			fmt.Fprintf(&b, "- %s: inactive\n", ca.Chain)
			continue
		}

		parts := []string{fmt.Sprintf("%.6f %s", ca.Balance, ca.NativeToken)}
		parts = append(parts, fmt.Sprintf("%d txs", ca.TxCount))

		if ca.IsContract {
			if ca.ContractVerified {
				parts = append(parts, "contract (verified)")
			} else {
				parts = append(parts, "contract (unverified)")
			}
		} else {
			parts = append(parts, "EOA")
		}

		// Token balances
		for _, tb := range ca.TokenBalances {
			parts = append(parts, fmt.Sprintf("%.2f %s", tb.Balance, tb.Symbol))
		}

		if ca.RecentTxCount > 0 {
			parts = append(parts, fmt.Sprintf("%d recent txs", ca.RecentTxCount))
		}
		if ca.TokenTransfers > 0 {
			parts = append(parts, fmt.Sprintf("%d token transfers", ca.TokenTransfers))
		}
		if ca.IsTestnet {
			parts = append(parts, "TESTNET")
		}

		fmt.Fprintf(&b, "- %s: %s\n", ca.Chain, strings.Join(parts, ", "))
	}
	return b.String()
}

func boolYesNo(v bool) string {
	if v {
		return "Yes"
	}
	return "No"
}
