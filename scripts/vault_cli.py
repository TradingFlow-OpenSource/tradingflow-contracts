#!/usr/bin/env python3

import argparse
import json
import sys
from pathlib import Path
from web3 import Web3
import os



def normalize_address(address):
    """Convert address to standard format"""
    if address.startswith("0x"):
        return Web3.to_checksum_address(address)
    else:
        return Web3.to_checksum_address("0x" + address)
# --- Configuration Area ---
BASE_PATH = Path(__file__).parent.parent
DEFAULT_RPC = "http://127.0.0.1:8545"
DEFAULT_VAULT_ADDRESS = None  # Set your vault address
DEFAULT_ACCOUNT = None  # Set your default account address

# --- Helper Functions ---
def load_abi(path):
    with open(path) as f:
        return json.load(f)["abi"]

def to_wei(amount, decimals=18):
    return int(float(amount) * 10**decimals)

def from_wei(amount, decimals=18):
    return amount / 10**decimals

def connect_web3(rpc_url):
    w3 = Web3(Web3.HTTPProvider(rpc_url))
    print(f"Connection status: {'Connected' if w3.is_connected() else 'Not Connected'}")
    if not w3.is_connected():
        print(f"Error: Unable to connect to RPC {rpc_url}")
        sys.exit(1)
    return w3
# Ensure normalization is added wherever addresses are used

def get_account(w3, key_or_account):
    if key_or_account and key_or_account.startswith("0x") and len(key_or_account) == 42:
        # Is an address
        return normalize_address(key_or_account)  # Add normalization
    elif key_or_account:
        # Is a private key
        account = w3.eth.account.from_key(key_or_account)
        return normalize_address(account.address)  # Add normalization
    elif w3.eth.accounts:
        # Use the first account
        return normalize_address(w3.eth.accounts[0])  # Add normalization
    else:
        print("Error: No account provided and unable to get accounts from node")
        sys.exit(1)

def load_contracts(w3, vault_address):
    try:
        # Load vault ABI
        vault_abi = load_abi(BASE_PATH / "artifacts/contracts/UniswapVault.sol/OracleGuidedVault.json")
        vault = w3.eth.contract(address=normalize_address(vault_address), abi=vault_abi)
        
        # Get base asset address
        asset_address = vault.functions.asset().call()
        
        # Load token ABI
        token_abi = load_abi(BASE_PATH / "artifacts/contracts/MyToken.sol/MyToken.json")
        asset = w3.eth.contract(address=normalize_address(asset_address), abi=token_abi)
        
        # Load oracle address
        oracle_address = vault.functions.priceOracle().call()
        oracle_abi = load_abi(BASE_PATH / "artifacts/contracts/PriceOracle.sol/PriceOracle.json")
        oracle = w3.eth.contract(address=normalize_address(oracle_address), abi=oracle_abi)
        
        return {
            'vault': vault,
            'asset': asset,
            'oracle': oracle
        }
    except Exception as e:
        print(f"Error: Failed to load contracts - {str(e)}")
        sys.exit(1)

def send_transaction(w3, account, contract_func, gas=5000000):
    if isinstance(account, str) and account.startswith("0x") and len(account) == 42:
        # Use existing account (assumed to be a local node account)
        tx_hash = contract_func.transact({'from': normalize_address(account), 'gas': gas})  # Add normalization
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
        return receipt
    else:
        # Use private key signing
        address = w3.eth.account.from_key(account).address
        normalized_address = normalize_address(address)  # Add normalization
        tx = contract_func.build_transaction({
            'from': normalized_address,
            'gas': gas,
            'nonce': w3.eth.get_transaction_count(normalized_address)
        })
        signed_tx = w3.eth.account.sign_transaction(tx, account)
        tx_hash = w3.eth.send_raw_transaction(signed_tx.rawTransaction)
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
        return receipt
# --- Vault Operation Functions ---

def get_info(w3, vault, account):
    """Get basic information about vault and account"""
    try:
        account = normalize_address(account)  # Add normalization
        asset_address = vault.functions.asset().call()
        asset_contract = w3.eth.contract(address=asset_address, abi=load_abi(BASE_PATH / "artifacts/contracts/MyToken.sol/MyToken.json"))
        
        asset_symbol = asset_contract.functions.symbol().call()
        asset_decimals = asset_contract.functions.decimals().call()
        
        total_assets = vault.functions.totalAssets().call()
        total_supply = vault.functions.totalSupply().call()
        
        user_shares = vault.functions.balanceOf(account).call()
        user_assets = 0
        if total_supply > 0:
            user_assets = (user_shares * total_assets) // total_supply
        
        asset_balance = asset_contract.functions.balanceOf(account).call()
        
        strategy_enabled = vault.functions.strategyEnabled().call()
        
        print("\n=== Vault Information ===")
        print(f"Vault Address: {vault.address}")
        print(f"Base Asset: {asset_symbol} ({asset_address})")
        print(f"Total Assets: {from_wei(total_assets, asset_decimals)} {asset_symbol}")
        print(f"Total Supply: {from_wei(total_supply)}")
        print(f"Strategy Status: {'Enabled' if strategy_enabled else 'Disabled'}")
        
        print("\n=== User Information ===")
        print(f"Account Address: {account}")
        print(f"Shares Held: {from_wei(user_shares)}")
        print(f"Share Value: {from_wei(user_assets, asset_decimals)} {asset_symbol}")
        print(f"Wallet Balance: {from_wei(asset_balance, asset_decimals)} {asset_symbol}")
        
        return True
    except Exception as e:
        print(f"Error: Failed to get information - {str(e)}")
        return False

def get_portfolio(w3, vault):
    """Get current vault portfolio"""
    try:
        portfolio = vault.functions.getPortfolioComposition().call()
        base_asset_amount, token_addresses, token_amounts = portfolio
        
        asset_address = vault.functions.asset().call()
        asset_contract = w3.eth.contract(address=asset_address, abi=load_abi(BASE_PATH / "artifacts/contracts/MyToken.sol/MyToken.json"))
        asset_symbol = asset_contract.functions.symbol().call()
        asset_decimals = asset_contract.functions.decimals().call()
        
        print("\n=== Current Portfolio ===")
        print(f"{asset_symbol}: {from_wei(base_asset_amount, asset_decimals)}")
        
        for i in range(len(token_addresses)):
            try:
                token_contract = w3.eth.contract(address=token_addresses[i], abi=load_abi(BASE_PATH / "artifacts/contracts/MyToken.sol/MyToken.json"))
                token_symbol = token_contract.functions.symbol().call()
                token_decimals = token_contract.functions.decimals().call()
                print(f"{token_symbol}: {from_wei(token_amounts[i], token_decimals)} (Address: {token_addresses[i]})")
            except:
                print(f"Unknown Token: {from_wei(token_amounts[i])} (Address: {token_addresses[i]})")
        
        return True
    except Exception as e:
        print(f"Error: Failed to get portfolio - {str(e)}")
        return False

def deposit_asset(w3, vault, asset, account, amount):
    """Deposit assets into the vault"""
    try:
        asset_address = vault.functions.asset().call()
        asset_contract = w3.eth.contract(address=asset_address, abi=load_abi(BASE_PATH / "artifacts/contracts/MyToken.sol/MyToken.json"))
        asset_symbol = asset_contract.functions.symbol().call()
        asset_decimals = asset_contract.functions.decimals().call()
        
        amount_wei = to_wei(amount, asset_decimals)
        
        # Check balance
        balance = asset_contract.functions.balanceOf(account).call()
        if balance < amount_wei:
            print(f"Error: Insufficient balance. Need {amount} {asset_symbol}, but only have {from_wei(balance, asset_decimals)} {asset_symbol}")
            return False
        
        # Approve
        print(f"Approving vault to spend {amount} {asset_symbol}...")
        approve_func = asset_contract.functions.approve(vault.address, amount_wei)
        send_transaction(w3, account, approve_func)
        
        # Deposit
        print(f"Depositing {amount} {asset_symbol} into vault...")
        deposit_func = vault.functions.deposit(amount_wei, account)
        receipt = send_transaction(w3, account, deposit_func)
        
        if receipt.status == 1:
            print(f"Successfully deposited {amount} {asset_symbol} into the vault")
            return True
        else:
            print("Deposit transaction failed")
            return False
    except Exception as e:
        print(f"Error: Deposit failed - {str(e)}")
        return False

def withdraw_asset(w3, vault, account, amount=None, percentage=None, all_shares=False):
    """Withdraw assets from the vault"""
    try:
        asset_address = vault.functions.asset().call()
        asset_contract = w3.eth.contract(address=asset_address, abi=load_abi(BASE_PATH / "artifacts/contracts/MyToken.sol/MyToken.json"))
        asset_symbol = asset_contract.functions.symbol().call()
        asset_decimals = asset_contract.functions.decimals().call()
        
        user_shares = vault.functions.balanceOf(account).call()
        if user_shares == 0:
            print("Error: You don't have any shares to redeem")
            return False
        
        if all_shares:
            # Redeem all
            print(f"Redeeming all shares...")
            redeem_func = vault.functions.redeem(user_shares, account, account)
            receipt = send_transaction(w3, account, redeem_func)
        elif percentage is not None:
            # Redeem by percentage
            pct = min(10000, max(1, int(float(percentage) * 100)))  # Convert to basis points (1-10000)
            print(f"Redeeming {percentage}% of shares...")
            withdraw_func = vault.functions.percentageWithdraw(pct, account)
            receipt = send_transaction(w3, account, withdraw_func)
        elif amount is not None:
            # Redeem by amount
            amount_wei = to_wei(amount, asset_decimals)
            print(f"Redeeming shares worth {amount} {asset_symbol}...")
            withdraw_func = vault.functions.withdraw(amount_wei, account, account)
            receipt = send_transaction(w3, account, withdraw_func)
        else:
            print("Error: Must specify redemption amount or percentage")
            return False
        
        if receipt.status == 1:
            print("Redemption successful")
            # Show balance after redemption
            new_balance = asset_contract.functions.balanceOf(account).call()
            new_shares = vault.functions.balanceOf(account).call()
            print(f"Current wallet balance: {from_wei(new_balance, asset_decimals)} {asset_symbol}")
            print(f"Remaining shares: {from_wei(new_shares)}")
            return True
        else:
            print("Redemption transaction failed")
            return False
    except Exception as e:
        print(f"Error: Redemption failed - {str(e)}")
        return False

def execute_buy_signal(w3, vault, account, token_address, amount_or_percentage, min_amount_out=0):
    """Execute buy signal"""
    try:
        asset_address = vault.functions.asset().call()
        asset_contract = w3.eth.contract(address=asset_address, abi=load_abi(BASE_PATH / "artifacts/contracts/MyToken.sol/MyToken.json"))
        asset_symbol = asset_contract.functions.symbol().call()
        asset_decimals = asset_contract.functions.decimals().call()
        
        # Check if account has ORACLE_ROLE permission
        oracle_role = vault.functions.ORACLE_ROLE().call()
        has_role = vault.functions.hasRole(oracle_role, account).call()
        if not has_role:
            print("Error: Account doesn't have ORACLE_ROLE permission, cannot execute trade signals")
            return False
        
        # Check if trading pair is active
        if not vault.functions.tradingPairs(token_address).call()[1]:  # isActive
            print("Error: Token trading pair is not activated")
            return False
        
        # Get vault asset balance
        vault_asset_balance = asset_contract.functions.balanceOf(vault.address).call()
        
        # Determine buy amount
        amount_wei = 0
        max_allocation = 0
        
        if amount_or_percentage.endswith("%"):
            # Buy by percentage
            percentage = float(amount_or_percentage[:-1])
            amount_wei = int(vault_asset_balance * percentage / 100)
            max_allocation = int(percentage * 100)  # Convert to basis points
        else:
            # Buy by amount
            amount_wei = to_wei(amount_or_percentage, asset_decimals)
            if vault_asset_balance > 0:
                max_allocation = int((amount_wei / vault_asset_balance) * 10000)
            else:
                max_allocation = 10000
        
        # Get token info
        try:
            token_contract = w3.eth.contract(address=token_address, abi=load_abi(BASE_PATH / "artifacts/contracts/MyToken.sol/MyToken.json"))
            token_symbol = token_contract.functions.symbol().call()
        except:
            token_symbol = "Unknown Token"
        
        print(f"Executing buy signal: Using {from_wei(amount_wei, asset_decimals)} {asset_symbol} to buy {token_symbol}...")
        buy_func = vault.functions.executeBuySignal(
            token_address,
            amount_wei,
            min_amount_out,
            max_allocation
        )
        
        receipt = send_transaction(w3, account, buy_func)
        
        if receipt.status == 1:
            print(f"Successfully executed buy signal: {from_wei(amount_wei, asset_decimals)} {asset_symbol} -> {token_symbol}")
            return True
        else:
            print("Buy signal execution failed")
            return False
    except Exception as e:
        print(f"Error: Buy signal execution failed - {str(e)}")
        return False

def execute_sell_signal(w3, vault, account, token_address, amount_or_percentage=None, min_amount_out=0):
    """Execute sell signal"""
    try:
        # Check if account has ORACLE_ROLE permission
        oracle_role = vault.functions.ORACLE_ROLE().call()
        has_role = vault.functions.hasRole(oracle_role, account).call()
        if not has_role:
            print("Error: Account doesn't have ORACLE_ROLE permission, cannot execute trade signals")
            return False
        
        # Check if trading pair is active
        if not vault.functions.tradingPairs(token_address).call()[1]:  # isActive
            print("Error: Token trading pair is not activated")
            return False
        
        # Get token info
        try:
            token_contract = w3.eth.contract(address=token_address, abi=load_abi(BASE_PATH / "artifacts/contracts/MyToken.sol/MyToken.json"))
            token_symbol = token_contract.functions.symbol().call()
            token_decimals = token_contract.functions.decimals().call()
        except:
            token_symbol = "Unknown Token"
            token_decimals = 18
        
        # Get token balance in vault
        token_balance = token_contract.functions.balanceOf(vault.address).call()
        if token_balance == 0:
            print(f"Error: Vault has no {token_symbol} balance")
            return False
        
        # Determine sell amount
        amount_wei = 0
        if amount_or_percentage is None or amount_or_percentage == "all":
            # Sell all
            amount_wei = 0  # In contract, 0 means sell all
            print(f"Executing sell signal: Selling all {token_symbol} ({from_wei(token_balance, token_decimals)} {token_symbol})...")
        elif amount_or_percentage.endswith("%"):
            # Sell by percentage
            percentage = float(amount_or_percentage[:-1])
            amount_wei = int(token_balance * percentage / 100)
            print(f"Executing sell signal: Selling {percentage}% of {token_symbol} ({from_wei(amount_wei, token_decimals)} {token_symbol})...")
        else:
            # Sell by amount
            amount_wei = to_wei(amount_or_percentage, token_decimals)
            if amount_wei > token_balance:
                print(f"Warning: Specified sell amount {amount_or_percentage} exceeds vault's {from_wei(token_balance, token_decimals)} {token_symbol}, will sell all")
                amount_wei = token_balance
            print(f"Executing sell signal: Selling {from_wei(amount_wei, token_decimals)} {token_symbol}...")
        
        sell_func = vault.functions.executeSellSignal(
            token_address,
            amount_wei,
            min_amount_out
        )
        
        receipt = send_transaction(w3, account, sell_func)
        
        if receipt.status == 1:
            print(f"Successfully executed sell signal: {token_symbol} -> base asset")
            return True
        else:
            print("Sell signal execution failed")
            return False
    except Exception as e:
        print(f"Error: Sell signal execution failed - {str(e)}")
        return False

def manage_trading_pair(w3, vault, account, token_address, max_allocation, min_exit_amount=0, disable=False):
    """Add/update/disable trading pair"""
    try:
        # Check if account has STRATEGY_MANAGER_ROLE permission
        strategy_role = vault.functions.STRATEGY_MANAGER_ROLE().call()
        has_role = vault.functions.hasRole(strategy_role, account).call()
        if not has_role:
            print("Error: Account doesn't have STRATEGY_MANAGER_ROLE permission, cannot manage trading pairs")
            return False
        
        if disable:
            print(f"Disabling trading pair: {token_address}")
            disable_func = vault.functions.disableTradingPair(token_address)
            receipt = send_transaction(w3, account, disable_func)
        else:
            # Convert percentage to basis points
            if isinstance(max_allocation, str) and max_allocation.endswith("%"):
                max_allocation_bps = int(float(max_allocation[:-1]) * 100)
            else:
                max_allocation_bps = int(float(max_allocation) * 100)
            
            print(f"Setting trading pair: {token_address}, Max allocation: {max_allocation_bps/100}%, Min exit amount: {min_exit_amount}")
            set_pair_func = vault.functions.setTradingPair(token_address, max_allocation_bps, min_exit_amount)
            receipt = send_transaction(w3, account, set_pair_func)
        
        if receipt.status == 1:
            print("Trading pair setup successful")
            return True
        else:
            print("Trading pair setup failed")
            return False
    except Exception as e:
        print(f"Error: Trading pair management failed - {str(e)}")
        return False

def update_price(w3, oracle, account, token_a, token_b, price):
    """Update oracle price"""
    try:
        # Check if account has ORACLE_ROLE permission
        oracle_role = oracle.functions.ORACLE_ROLE().call()
        has_role = oracle.functions.hasRole(oracle_role, account).call()
        if not has_role:
            print("Error: Account doesn't have ORACLE_ROLE permission, cannot update prices")
            return False
        
        # Price should be in base of 10^18
        price_wei = to_wei(price)
        
        print(f"Updating price: 1 {token_a} = {price} {token_b}")
        update_func = oracle.functions.updatePrice(token_a, token_b, price_wei)
        receipt = send_transaction(w3, account, update_func)
        
        if receipt.status == 1:
            print("Price update successful")
            return True
        else:
            print("Price update failed")
            return False
    except Exception as e:
        print(f"Error: Price update failed - {str(e)}")
        return False


# Add these functions to the vault operation functions section
def mint_tokens(w3, account, token_address, amount, recipient=None):
    """Mint tokens to specified address"""
    try:
        if recipient is None:
            recipient = account
        
        # Load token contract
        token_abi = load_abi(BASE_PATH / "artifacts/contracts/MyToken.sol/MyToken.json")
        token = w3.eth.contract(address=normalize_address(token_address), abi=token_abi)
        
        # Get token info
        token_symbol = token.functions.symbol().call()
        token_decimals = token.functions.decimals().call()
        
        # Convert amount to wei
        amount_wei = to_wei(amount, token_decimals)
        
        print(f"Attempting to mint {amount} {token_symbol} to address {recipient}...")
        
        # Check if account has minting permission
        try:
            # Check if is owner
            owner = token.functions.owner().call()
            if normalize_address(account) != normalize_address(owner):
                print(f"Warning: Account {account} is not the owner of token {token_symbol}, may not be able to mint")
        except Exception:
            print("Unable to check ownership, continuing with mint attempt")
        
        # Execute mint
        mint_func = token.functions.mint(normalize_address(recipient), amount_wei)
        receipt = send_transaction(w3, account, mint_func)
        
        if receipt.status == 1:
            print(f"Successfully minted {amount} {token_symbol} to address {recipient}")
            
            # Show new balance
            balance = token.functions.balanceOf(normalize_address(recipient)).call()
            print(f"{recipient}'s {token_symbol} balance: {from_wei(balance, token_decimals)}")
            return True
        else:
            print("Minting failed")
            return False
        
    except Exception as e:
        print(f"Error: Token minting failed - {str(e)}")
        return False


# Add these functions to the vault operation functions section
def transfer_tokens(w3, account, token_address, recipient, amount):
    """Transfer tokens from current account to specified address"""
    try:
        # Load token contract
        token_abi = load_abi(BASE_PATH / "artifacts/contracts/MyToken.sol/MyToken.json")
        token = w3.eth.contract(address=normalize_address(token_address), abi=token_abi)
        
        # Get token info
        token_symbol = token.functions.symbol().call()
        token_decimals = token.functions.decimals().call()
        
        # Convert amount to wei
        amount_wei = to_wei(amount, token_decimals)
        
        # Check balance
        balance = token.functions.balanceOf(account).call()
        if balance < amount_wei:
            print(f"Error: Insufficient balance. Need {amount} {token_symbol}, but only have {from_wei(balance, token_decimals)} {token_symbol}")
            return False
        
        recipient_addr = normalize_address(recipient)
        print(f"Transferring {amount} {token_symbol} to address {recipient_addr}...")
        
        # Execute transfer
        transfer_func = token.functions.transfer(recipient_addr, amount_wei)
        receipt = send_transaction(w3, account, transfer_func)
        
        if receipt.status == 1:
            print(f"Successfully transferred {amount} {token_symbol} to address {recipient_addr}")
            
            # Show new balances
            sender_balance = token.functions.balanceOf(account).call()
            recipient_balance = token.functions.balanceOf(recipient_addr).call()
            print(f"Sender {account} balance: {from_wei(sender_balance, token_decimals)} {token_symbol}")
            print(f"Recipient {recipient_addr} balance: {from_wei(recipient_balance, token_decimals)} {token_symbol}")
            return True
        else:
            print("Transfer failed")
            return False
        
    except Exception as e:
        print(f"Error: Token transfer failed - {str(e)}")
        return False


def manage_role(w3, vault, account, role_name, target_address, revoke=False):
    """Grant or revoke role permissions"""
    try:
        # Get the bytes32 value corresponding to the role name
        if role_name.upper() == "ORACLE":
            role = vault.functions.ORACLE_ROLE().call()
        elif role_name.upper() == "STRATEGY_MANAGER":
            role = vault.functions.STRATEGY_MANAGER_ROLE().call()
        elif role_name.upper() == "ADMIN":
            role = vault.functions.DEFAULT_ADMIN_ROLE().call()
        else:
            print(f"Error: Unknown role '{role_name}', please use ORACLE, STRATEGY_MANAGER, or ADMIN")
            return False
        
        target = normalize_address(target_address)
        
        # Check if current caller has admin permission
        admin_role = vault.functions.DEFAULT_ADMIN_ROLE().call()
        has_admin = vault.functions.hasRole(admin_role, account).call()
        if not has_admin:
            print("Error: Account doesn't have ADMIN permission, cannot manage roles")
            return False
        
        if revoke:
            print(f"Revoking {role_name} role from {target_address}...")
            role_func = vault.functions.revokeRole(role, target)
        else:
            print(f"Granting {role_name} role to {target_address}...")
            role_func = vault.functions.grantRole(role, target)
            
        receipt = send_transaction(w3, account, role_func)
        
        if receipt.status == 1:
            action = "revoked" if revoke else "granted"
            print(f"Successfully {action} {role_name} role")
            return True
        else:
            print("Role management operation failed")
            return False
    except Exception as e:
        print(f"Error: Role management failed - {str(e)}")
        return False


def update_strategy_settings(w3, vault, account, enabled):
    """Update strategy settings"""
    try:
        # Check if account has STRATEGY_MANAGER_ROLE permission
        strategy_role = vault.functions.STRATEGY_MANAGER_ROLE().call()
        has_role = vault.functions.hasRole(strategy_role, account).call()
        if not has_role:
            print("Error: Account doesn't have STRATEGY_MANAGER_ROLE permission, cannot update strategy settings")
            return False
        
        print(f"Updating strategy settings: Enabled = {enabled}")
        settings_func = vault.functions.setStrategyEnabled(enabled)
        receipt = send_transaction(w3, account, settings_func)
        
        if receipt.status == 1:
            print("Strategy settings updated successfully")
            return True
        else:
            print("Strategy settings update failed")
            return False
    except Exception as e:
        print(f"Error: Strategy settings update failed - {str(e)}")
        return False

# --- Main Function and Command Line Parsing ---
def main():
    parser = argparse.ArgumentParser(description="Vault Operation Command Line Tool")
    
    # Global parameters
    parser.add_argument("--rpc", default=DEFAULT_RPC, help=f"RPC URL (default: {DEFAULT_RPC})")
    parser.add_argument("--vault", default=DEFAULT_VAULT_ADDRESS, help="Vault contract address")
    parser.add_argument("--account", default=DEFAULT_ACCOUNT, help="Account address or private key")
    
    subparsers = parser.add_subparsers(dest="command", help="Subcommands")
    
    # info subcommand
    info_parser = subparsers.add_parser("info", help="Display vault information")
    
    # portfolio subcommand
    portfolio_parser = subparsers.add_parser("portfolio", help="Display current portfolio")
    
    # deposit subcommand
    deposit_parser = subparsers.add_parser("deposit", help="Deposit assets into the vault")
    deposit_parser.add_argument("amount", help="Deposit amount")
    
    # withdraw subcommand
    withdraw_parser = subparsers.add_parser("withdraw", help="Withdraw assets from the vault")
    withdraw_group = withdraw_parser.add_mutually_exclusive_group(required=True)
    withdraw_group.add_argument("--amount", help="Withdrawal amount")
    withdraw_group.add_argument("--percentage", help="Withdraw by percentage (e.g. '50' means 50%)")
    withdraw_group.add_argument("--all", action="store_true", help="Withdraw all")
    
    # buy subcommand
    buy_parser = subparsers.add_parser("buy", help="Execute buy signal")
    buy_parser.add_argument("token", help="Target token address")
    buy_parser.add_argument("amount", help="Buy amount or percentage (e.g. '100' or '30%')")
    buy_parser.add_argument("--min", default="0", help="Minimum amount out (default: 0)")
    
    # sell subcommand
    sell_parser = subparsers.add_parser("sell", help="Execute sell signal")
    sell_parser.add_argument("token", help="Token address to sell")
    sell_parser.add_argument("--amount", default="all", help="Sell amount or percentage (e.g. '100', '30%', or 'all')")
    sell_parser.add_argument("--min", default="0", help="Minimum amount out (default: 0)")
    
    # pair subcommand
    pair_parser = subparsers.add_parser("pair", help="Manage trading pairs")
    pair_parser.add_argument("token", help="Token address")
    pair_parser.add_argument("--max", default="30%", help="Maximum allocation percentage (e.g. '30%' or '0.3')")
    pair_parser.add_argument("--min-exit", default="0", help="Minimum exit amount (default: 0)")
    pair_parser.add_argument("--disable", action="store_true", help="Disable trading pair")
    
    # role management subcommand
    role_parser = subparsers.add_parser("role", help="Manage vault roles")
    role_parser.add_argument("role", choices=["oracle", "strategy_manager", "admin"], help="Role name")
    role_parser.add_argument("address", help="Target address")
    role_parser.add_argument("--revoke", action="store_true", help="Revoke role instead of granting")

    # strategy settings subcommand
    strategy_parser = subparsers.add_parser("strategy", help="Update strategy settings")
    strategy_parser.add_argument("--enabled", type=bool, default=True, help="Whether strategy is enabled")
    
    # price subcommand
    price_parser = subparsers.add_parser("price", help="Update oracle price")
    price_parser.add_argument("token_a", help="Token A address")
    price_parser.add_argument("token_b", help="Token B address")
    price_parser.add_argument("price", help="Price (1 tokenA = ? tokenB)")
    # mint subcommand
    mint_parser = subparsers.add_parser("mint", help="Mint tokens")
    mint_parser.add_argument("token", help="Token address")
    mint_parser.add_argument("amount", help="Amount to mint")
    mint_parser.add_argument("--to", default=None, help="Recipient address (default: operating account)")

    # Add transfer subcommand
    transfer_parser = subparsers.add_parser("transfer", help="Transfer tokens")
    transfer_parser.add_argument("token", help="Token address")
    transfer_parser.add_argument("recipient", help="Recipient address")
    transfer_parser.add_argument("amount", help="Transfer amount")


    
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return
    
    
    # Connect to Web3
    w3 = connect_web3(args.rpc)
    print(f"Connected to network: {args.rpc}")
    
    # Get account
    account = get_account(w3, args.account)  # get_account internally includes normalization

    # Handle commands that don't need vault
    if args.command == "mint":
        token = normalize_address(args.token)
        recipient = args.to if args.to is None else normalize_address(args.to)
        mint_tokens(w3, account, token, args.amount, recipient)
        return
        
    elif args.command == "transfer":
        token = normalize_address(args.token)
        recipient = normalize_address(args.recipient)
        transfer_tokens(w3, account, token, recipient, args.amount)
        return

    # Check if vault address is provided (only for commands that require vault)
    if not args.vault:
        print("Error: Vault address not specified. Use --vault parameter or set DEFAULT_VAULT_ADDRESS")
        return
    # Load contracts
    contracts = load_contracts(w3, args.vault)  # load_contracts internally includes normalization    
    vault = contracts['vault']
    asset = contracts['asset']
    oracle = contracts['oracle']
    
    # Execute subcommand
    if args.command == "info":
        get_info(w3, vault, account)
    
    elif args.command == "portfolio":
        get_portfolio(w3, vault)
    
    elif args.command == "deposit":
        deposit_asset(w3, vault, asset, account, args.amount)
    
    elif args.command == "withdraw":
        if args.all:
            withdraw_asset(w3, vault, account, all_shares=True)
        elif args.percentage:
            withdraw_asset(w3, vault, account, percentage=args.percentage)
        elif args.amount:
            withdraw_asset(w3, vault, account, amount=args.amount)
    
    elif args.command == "buy":
        token = normalize_address(args.token)  # Add normalization
        execute_buy_signal(w3, vault, account, token, args.amount, int(args.min))
    
    elif args.command == "sell":
        token = normalize_address(args.token)  # Add normalization
        execute_sell_signal(w3, vault, account, token, args.amount, int(args.min))
    
    elif args.command == "pair":
        token = normalize_address(args.token)  # Add normalization
        manage_trading_pair(w3, vault, account, token, args.max, int(args.min_exit), args.disable)
    
    elif args.command == "price":
        token_a = normalize_address(args.token_a)  # Add normalization
        token_b = normalize_address(args.token_b)  # Add normalization
        update_price(w3, oracle, account, token_a, token_b, args.price)
    # In the execute subcommand section add
    elif args.command == "role":
        role_name = args.role
        target = normalize_address(args.address)
        manage_role(w3, vault, account, role_name, target, args.revoke)

    elif args.command == "strategy":
        update_strategy_settings(w3, vault, account, args.enabled)
    else:
        print("Error: Unknown command")
        parser.print_help()
        return

if __name__ == "__main__":
    main()