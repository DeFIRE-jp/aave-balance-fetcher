
import { ethers } from 'ethers';

export interface ChainConfig {
	rpc: string;
	poolAddress: string;
};

export const CHAINS: { [chain: string]: ChainConfig } = {
	optimism: {
		rpc: 'https://mainnet.optimism.io',
		poolAddress: '0x794a61358D6845594F94dc1DB02A252b5b4814aD'
	},
	arbitrum: {
		rpc: 'https://arb1.arbitrum.io/rpc',
		poolAddress: '0x794a61358D6845594F94dc1DB02A252b5b4814aD'
	},
	polygon: {
		rpc: 'https://polygon-rpc.com/',
		poolAddress: '0x794a61358D6845594F94dc1DB02A252b5b4814aD'
	},
	fantom: {
		rpc: 'https://rpc.ftm.tools/',
		poolAddress: '0x794a61358D6845594F94dc1DB02A252b5b4814aD'
	},
	avalanche: {
		rpc: 'https://api.avax.network/ext/bc/C/rpc',
		poolAddress: '0x794a61358D6845594F94dc1DB02A252b5b4814aD'
	},
	harmony: {
		rpc: 'https://api.harmony.one',
		poolAddress: '0x794a61358D6845594F94dc1DB02A252b5b4814aD'
	},
};

export const ABIS = {
	Pool: require('@aave/core-v3/artifacts/contracts/protocol/pool/Pool.sol/Pool.json').abi,
	AToken: require('@aave/core-v3/artifacts/contracts/protocol/tokenization/AToken.sol/AToken.json').abi,
	StableDebtToken: require('@aave/core-v3/artifacts/contracts/protocol/tokenization/StableDebtToken.sol/StableDebtToken.json').abi,
	VariableDebtToken: require('@aave/core-v3/artifacts/contracts/protocol/tokenization/VariableDebtToken.sol/VariableDebtToken.json').abi,
	ERC20: require('@aave/core-v3/artifacts/contracts/dependencies/openzeppelin/contracts/ERC20.sol/ERC20.json').abi,
};

export interface ReserveInfo {
	symbol: string;
	decimals: number;
}

export const getReserveInfo = async (provider: ethers.providers.BaseProvider, tokenAddress: string): Promise<ReserveInfo> => {
	const contractERC20 = new ethers.Contract(tokenAddress, ABIS.ERC20, provider);
	return {
		symbol: await contractERC20.symbol(),
		decimals: await contractERC20.decimals(),
	};
};

export const getDeposit = async (
	provider: ethers.providers.BaseProvider,
	aTokenAddress: string,
	address: string,
) => {
	const contractAToken = new ethers.Contract(aTokenAddress, ABIS.AToken, provider);
	return await contractAToken.balanceOf(address);
};

export const getBorrow = async (
	provider: ethers.providers.BaseProvider,
	stableDebtTokenAddress: string,
	variableDebtTokenAddress: string,
	address: string,
) => {
	const contractStableDebtToken = new ethers.Contract(stableDebtTokenAddress, ABIS.StableDebtToken, provider);
	const contractVariableDebtToken = new ethers.Contract(variableDebtTokenAddress, ABIS.VariableDebtToken, provider);
	const stableDebt = await contractStableDebtToken.balanceOf(address);
	const variableDebt = await contractVariableDebtToken.balanceOf(address);
	return stableDebt.add(variableDebt);
};

export const getBalances = async (poolAddress: string, provider: ethers.providers.BaseProvider, address: string) => {
	const contractPool = new ethers.Contract(poolAddress, ABIS.Pool, provider);
	const reservesList: string[] = await contractPool.getReservesList();
	const result: { [symbol: string]: number } = {};
	for(const reserve of reservesList) {
		const reserveInfo = await getReserveInfo(provider, reserve);
		const reserveData = await contractPool.getReserveData(reserve);
		const deposit = await getDeposit(provider, reserveData.aTokenAddress, address);
		const borrow = await getBorrow(provider, reserveData.stableDebtTokenAddress, reserveData.variableDebtTokenAddress, address);
		const balance = deposit.sub(borrow);
		result[reserveInfo.symbol] = Number(balance.toString()) / (10 ** reserveInfo.decimals);
	}
	return result;
};

export const main = async () => {
	if(process.argv.length < 3) {
		console.log('Usage: ts-node ./index.ts ADDRESS');
		return;
	}
	const address = process.argv[2];
	for(const chain in CHAINS) {
		const poolConfig = CHAINS[chain];
		const provider = new ethers.providers.JsonRpcProvider(poolConfig.rpc);
		const balances = await getBalances(poolConfig.poolAddress, provider, address);
		console.log(chain, balances);
	}
};

main();

