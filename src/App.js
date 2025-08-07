/* global BigInt, ethers */ // Tell ESLint that BigInt and ethers are global variables

import React, { useState, useEffect, useRef, useCallback } from 'react';

// Main App component
const App = () => {
  const [address, setAddress] = useState('');
  const [totalVolume, setTotalVolume] = useState(null);
  const [volumeDistribution, setVolumeDistribution] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  // New state for cached token prices
  const cachedTokenPrices = useRef({}); // Using useRef to avoid re-renders on every price update
  // New state for dynamic loading message
  const [currentProcessingChain, setCurrentProcessingChain] = useState('');
  // New state for dark mode
  const [isDarkMode, setIsDarkMode] = useState(false);
  // New state to track if ethers.js is loaded
  const [isEthersLoaded, setIsEthersLoaded] = useState(false);

  // API Base URLs - Moved to top-level scope for guaranteed accessibility
  // Corrected back to /v2/api as per user's requirement for 5 calls/sec rate limit
  const unifiedApiBaseUrl = 'https://api.etherscan.io/v2/api';
  // CoinGecko API endpoint
  const coingeckoApiBaseUrl = 'https://api.coingecko.com/api/v3';

  // --- ALL Configuration objects consolidated into a single object ---
  const appConfig = {
    // Router contracts are now arrays to support multiple addresses per chain
    lancaDexRouterContracts: {
      'base': ['0xE66F53C27Ebe29E85D8396563B35BF8915039796', '0x164c20A4E11cBE0d8B5e23F5EE35675890BE280d'], // Added new Base router
      'polygon': ['0x4B95b9b404BD69D5c9af00B7F43f327A376909F4', '0x164c20A4E11cBE0d8B5e23F5EE35675890BE280d'], // Added new Polygon router
      'optimism': ['0xCF93E045778dE481De87586b91BC7C4F09147502', '0xfE0433d0EBf38adD2E6FdC6D5d552eCe699014A7'], // Ensured array
      'arbitrum': ['0xe6BbA380D02BF8a4c8185cA95025206B6f1Cf8C7', '0x0AE1B2730066AD46481ab0a5fd2B5893f8aBa323'], // Ensured array
      // Corrected Avalanche router address and ensured it's an array
      'avalanche': ['0x4459d95b396c418B2144943910E2e68548fFE589', '0x0AE1B2730066AD46481ab0a5fd2B5893f8aBa323'],
    },
    // Your Etherscan V2 API key - using the one from previous working version
    etherscanV2ApiKey: '8Y7V44SM4SPGKWYUUUKCPJ6RJXUZYWXKM1',
    chainConfig: {
      'base': { chainId: 8453, coingeckoPlatformId: 'base' },
      'polygon': { chainId: 137, coingeckoPlatformId: 'polygon-pos' },
      'arbitrum': { chainId: 42161, coingeckoPlatformId: 'arbitrum-one' },
      'optimism': { chainId: 10, coingeckoPlatformId: 'optimistic-ethereum' },
      'avalanche': { chainId: 43114, coingeckoPlatformId: 'avalanche' },
    },
    // Native token CoinGecko IDs are still here for reference, but not used for live price fetching
    nativeTokenCoinGeckoIds: {
      'base': 'ethereum',
      'polygon': 'matic-network',
      'arbitrum': 'ethereum',
      'optimism': 'ethereum',
      'avalanche': 'avalanche-2',
    },
    // This list is no longer used for live CoinGecko fetching, but defines common tokens for hardcoding
    popularTokensForCaching: {
      'base': [
        '0x4200000000000000000000000000000000000006', // WETH
        '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', // USDC
        '0x50c5725949a6f0c72e6ce646f6d2a68dff4544dd', // DAI
        '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9', // USDT
        // Add other popular tokens if their prices are to be hardcoded or handled differently
      ],
      'polygon': [
        '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270', // WMATIC
        '0x2791bca1f2de4661ed88a30c99a7a922ae9dc765', // USDC
        '0x8f3cf7ad23cd3cadbd9735aff958023239c6a063', // DAI
        '0xc2132d05d31c914a87c6611c10748aeb04b58e8f', // USDT
      ],
      'optimism': [
        '0x4200000000000000000000000000000000000006', // WETH
        '0x7f5c764cbc14f9669b88837ca1490cca17c31607', // USDC
        '0xda10009cbd5d07dd0cecc66161fc93d7c9000da1', // DAI
        '0x94b008aa00579c1307b0ef2c499ad98a8ce58e58', // USDT
        '0x4200000000000000000000000000000000000042', // OP
      ],
      'arbitrum': [
        '0x82af49447d8a07e3bd95bd0d56f35241523fbab1', // WETH
        '0xaf88d065e77c8cc2239327c5d4acbce2ee228533', // USDC (original)
        '0xaf88d065e77c8cc2239327c5edb3a432268e5831', // USDC (newly identified)
        '0xda10009cbd5d07dd0cecc66161fc93d7c9000da1', // DAI
        '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9', // USDT
        '0x912ce59144191c1204e64559fe8253a0e49e6548', // ARB
      ],
      'avalanche': [
        '0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7', // WAVAX
        '0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e', // USDC.e (Corrected)
        '0xd586c7c8e53578a71c351aa21c9927e0a6176798', // USDT.e
        '0x8729438eb3f861076c2cbcc221ae4ed79d4dd268', // DAI.e
      ],
    },
    knownTokenAddresses: { // This needs to be part of the config object as well
      'base': {
        '0x4200000000000000000000000000000000000006': { type: 'WETH' },
        '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913': { type: 'USDC' },
        '0x0000000000000000000000000000000000000000': { type: 'NATIVE' }, // Represents native ETH on Base
      },
      'polygon': {
        '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270': { type: 'WETH' }, // WMATIC is often treated as native equivalent
        '0x2791bca1f2de4661ed88a30c99a7a922ae9dc765': { type: 'USDC' },
        '0x0000000000000000000000000000000000000000': { type: 'NATIVE' }, // Represents native MATIC on Polygon
      },
      'optimism': {
        '0x4200000000000000000000000000000000000006': { type: 'WETH' },
        '0x7f5c764cbc14f9669b88837ca1490cca17c31607': { type: 'USDC' },
        '0x0000000000000000000000000000000000000000': { type: 'NATIVE' }, // Represents native ETH on Optimism
      },
      'arbitrum': {
        '0x82af49447d8a07e3bd95bd0d56f35241523fbab1': { type: 'WETH' },
        '0xaf88d065e77c8cc2239327c5d4acbce2ee228533': { type: 'USDC' },
        '0x0000000000000000000000000000000000000000': { type: 'NATIVE' }, // Represents native ETH on Arbitrum
      },
      'avalanche': {
        '0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7': { type: 'WAVAX' },
        '0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e': { type: 'USDC' }, // USDC.e
        '0xd586c7c8e53578a71c351aa21c9927e0a6176798': { type: 'USDT' }, // Corrected: USDT.e
        '0x8729438eb3f861076c2cbcc221ae4ed79d4dd268': { type: 'DAI' }, // Corrected: DAI.e
        '0x49d5c2bdcdb0836572623d11b2446736709841f4': { type: 'WETH' }, // WETH.e on Avalanche
        '0x50b7545627a5162f82a992cf628aef2aedcd799f': { type: 'WBTC' }, // Corrected: WBTC.e (on Avalanche)
        '0x5947bb275c521040051d35f967daed3bbab2df79': { type: 'LINK' }, // Corrected: LINK.e (on Avalanche)
        '0x0000000000000000000000000000000000000000': { type: 'NATIVE' }, // Represents native AVAX on Avalanche
      }
    },
    // Your Infura Project ID - using the one explicitly provided by you
    infuraProjectId: 'c7f68d7a537a469b8eb09076a1355251',
  };


  // Utility function for introducing a delay
  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  // Function to show a custom modal message instead of alert()
  const showCustomModal = (message) => {
    setModalMessage(message);
    setShowModal(true);
  };

  // Helper to convert raw token amount (from API) to human-readable format
  // Now uses ethers.utils.formatUnits for precision
  const formatTokenAmount = (amount, decimals) => {
    if (!amount || isNaN(amount) || !decimals || isNaN(decimals)) return 0;
    if (typeof window.ethers === 'undefined' || !window.ethers.utils || !window.ethers.utils.formatUnits) {
      console.warn("ethers.js utility functions are not loaded. Falling back to BigInt division (may lose precision).");
      try {
        return parseFloat(String(BigInt(amount) / (BigInt(10) ** BigInt(decimals))));
      } catch (e) {
        return parseFloat(amount) / (10 ** decimals);
      }
    }
    try {
      return parseFloat(window.ethers.utils.formatUnits(amount, decimals));
    } catch (e) {
      console.error("Error formatting token amount with ethers.js:", e);
      return 0;
    }
  };

  // Retry mechanism for fetch calls
  const retryFetch = async (url, options = {}, retries = 3, delayMs = 1000) => {
    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch(url, options);
        if (response.ok) {
          return response;
        }
        // If not OK, but not a network error, log and retry if not last attempt
        console.warn(`Attempt ${i + 1} failed for ${url}: ${response.status} - ${response.statusText}`);
        if (i < retries - 1) {
          await delay(delayMs * (2 ** i)); // Exponential backoff
        }
      } catch (error) {
        console.error(`Network error on attempt ${i + 1} for ${url}:`, error);
        if (i < retries - 1) {
          await delay(delayMs * (2 ** i)); // Exponential backoff
        } else {
          throw error; // Re-throw if all retries fail
        }
      }
    }
    throw new Error(`Failed to fetch ${url} after ${retries} attempts.`);
  };


  // Function to fetch all pages from Etherscan-like APIs
  const fetchAllPages = async (baseUrl, params, apiKey) => {
      let allResults = [];
      let page = 1;
      const offset = 10000; // Etherscan max offset per page is usually 10000

      while (true) {
          const url = `${baseUrl}?${new URLSearchParams({ ...params, page, offset, apikey: apiKey }).toString()}`;
          console.log(`Fetching page ${page} from: ${url}`);
          const response = await retryFetch(url);
          const data = await response.json();

          if (data.status === '1' && data.result && data.result.length > 0) {
              allResults = allResults.concat(data.result);
              if (data.result.length < offset) {
                  break;
              }
              page++;
              await delay(2000); // 2-second delay between pages for Etherscan
          } else {
              if (data.message && data.message.includes('NOTOK')) {
                  console.error(`Etherscan API returned NOTOK on page ${page}: ${data.result}`);
                  throw new Error(`Data provider busy. Please try again in a moment. Etherscan message: ${data.result}`);
              }
              break; // Exit loop if no more data or error
          }
      }
      return allResults;
  };

  // Function to set error, always ensuring it's a string
  const setAppError = (err) => {
      if (typeof err === 'string') {
          setError(err);
      } else if (err && typeof err.message === 'string') {
          setError(err.message);
      } else {
          setError('An unknown error occurred.');
      }
  };

  // Helper to safely get token address for a given type (Moved to top level)
  const getTokenAddressByType = useCallback((chainName, type) => {
      if (appConfig.knownTokenAddresses && appConfig.knownTokenAddresses[chainName]) {
          return Object.keys(appConfig.knownTokenAddresses[chainName]).find(key =>
              appConfig.knownTokenAddresses[chainName][key].type === type
          );
      }
      console.warn(`[WARN] knownTokenAddresses for chain ${chainName} or its type ${type} is undefined in appConfig.`);
      return null;
  }, [appConfig.knownTokenAddresses]); // Dependency on appConfig.knownTokenAddresses


  // Function to hardcode and cache token prices
  const populateHardcodedTokenPrices = useCallback((config, cachedTokenPricesRef) => {
    console.log("[Cache] Populating hardcoded token prices...");
    console.log("[DEBUG] Config received by populateHardcodedTokenPrices:", config);

    const newCachedPrices = {};

    // Hardcode ETH/WETH price
    const ethPrice = 3500; // Hardcoded ETH price
    const polygonPrice = 0.25; // Hardcoded Polygon (MATIC) price
    const avalanchePrice = 25; // Hardcoded Avalanche (AVAX) price
    const arbPrice = 0.45; // Hardcoded Arbitrum (ARB) price
    const opPrice = 0.7; // Hardcoded Optimism (OP) price

    // Base, Optimism, Arbitrum (ETH-based)
    newCachedPrices['0x0000000000000000000000000000000000000000'] = ethPrice; // Native ETH
    newCachedPrices['0x4200000000000000000000000000000000000006'] = ethPrice; // WETH on Base/Optimism
    newCachedPrices['0x82af49447d8a07e3bd95bd0d56f35241523fbab1'] = ethPrice; // WETH on Arbitrum
    newCachedPrices['0x7ceb23fd6bc0add59e62ac25578270cff1b9f619'] = ethPrice; // WETH on Polygon (if bridged)
    newCachedPrices['0x49d5c2bdcdb0836572623d11b2446736709841f4'] = ethPrice; // WETH.e on Avalanche (if bridged)


    // Polygon (MATIC-based)
    newCachedPrices['0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270'] = polygonPrice; // WMATIC on Polygon
    const nativeMaticAddress = getTokenAddressByType('polygon', 'NATIVE');
    if (nativeMaticAddress) {
      newCachedPrices[nativeMaticAddress.toLowerCase()] = polygonPrice;
    } else {
        console.warn("[WARN] Native MATIC address not found or knownTokenAddresses.polygon is undefined.");
    }


    // Avalanche (AVAX-based)
    newCachedPrices['0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7'] = avalanchePrice; // WAVAX on Avalanche
    const nativeAvaxAddress = getTokenAddressByType('avalanche', 'NATIVE');
    if (nativeAvaxAddress) {
      newCachedPrices[nativeAvaxAddress.toLowerCase()] = avalanchePrice;
    } else {
        console.warn("[WARN] Native AVAX address not found or knownTokenAddresses.avalanche is undefined.");
    }

    // Arbitrum (ARB)
    newCachedPrices['0x912ce59144191c1204e64559fe8253a0e49e6548'] = arbPrice; // ARB token

    // Optimism (OP)
    newCachedPrices['0x4200000000000000000000000000000000000042'] = opPrice; // OP token


    // Hardcode stablecoin prices to $1
    newCachedPrices['0x833589fcd6edb6e08f4c7c32d4f71b54bda02913'] = 1; // USDC on Base
    newCachedPrices['0x2791bca1f2de4661ed88a30c99a7a922ae9dc765'] = 1; // USDC on Polygon
    newCachedPrices['0x7f5c764cbc14f9669b88837ca1490cca17c31607'] = 1; // USDC on Optimism
    newCachedPrices['0xaf88d065e77c8cc2239327c5d4acbce2ee228533'] = 1; // USDC on Arbitrum (original)
    newCachedPrices['0xaf88d065e77c8cc2239327c5edb3a432268e5831'] = 1; // USDC on Arbitrum (newly identified from logs)
    newCachedPrices['0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e'] = 1; // USDC.e on Avalanche (Corrected)

    newCachedPrices['0x50c5725949a6f0c72e6ce646f6d2a68dff4544dd'] = 1; // DAI on Base
    newCachedPrices['0x8f3cf7ad23cd3cadbd9735aff958023239c6a063'] = 1; // DAI on Polygon
    newCachedPrices['0xda10009cbd5d07dd0cecc66161fc93d7c9000da1'] = 1; // DAI on Optimism/Arbitrum
    newCachedPrices['0x8729438eb3f861076c2cbcc221ae4ed79d4dd268'] = 1; // DAI.e on Avalanche

    newCachedPrices['0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9'] = 1; // USDT on Base/Arbitrum
    newCachedPrices['0xc2132d05d31c914a87c6611c10748aeb04b58e8f'] = 1; // USDT on Polygon
    newCachedPrices['0x94b008aa00579c1307b0ef2c499ad98a8ce58e58'] = 1; // USDT on Optimism
    newCachedPrices['0xd586c7c8e53578a71c351aa21c9927e0a6176798'] = 1; // USDT.e on Avalanche

    // For other popular tokens, if they are not explicitly hardcoded here, their value will be 0
    // unless explicitly added with a hardcoded price.
    // Example: newCachedPrices['0x...someOtherTokenAddress...'] = 0.5;

    cachedTokenPricesRef.current = newCachedPrices;
    console.log("[Cache] Hardcoded token prices populated:", cachedTokenPricesRef.current);
  }, [getTokenAddressByType]); // Dependency on getTokenAddressByType


  // useEffect to populate hardcoded token prices on mount
  useEffect(() => {
    populateHardcodedTokenPrices(appConfig, cachedTokenPrices);
  }, [populateHardcodedTokenPrices, appConfig, cachedTokenPrices]);

  // useEffect to dynamically load ethers.js
  useEffect(() => {
    const scriptId = 'ethers-cdn-script';
    // Check if the script is already in the DOM (e.g., from a previous render or hard refresh)
    if (document.getElementById(scriptId)) {
      // If it exists, and window.ethers is available, set the state to true
      if (typeof window.ethers !== 'undefined') {
        setIsEthersLoaded(true);
      } else {
        // If script element exists but ethers is not on window, something went wrong.
        // Remove it and try to re-add.
        document.getElementById(scriptId).remove();
        setIsEthersLoaded(false); // Reset to false to trigger re-addition
      }
      return; // Exit if already handled or needs re-addition
    }

    const script = document.createElement('script');
    script.id = scriptId;
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/ethers/5.7.2/ethers.umd.min.js";
    script.async = true; // Load asynchronously
    script.onload = () => {
      console.log('ethers.js loaded successfully via dynamic script!');
      setIsEthersLoaded(true);
    };
    script.onerror = (e) => {
      console.error('Failed to load ethers.js script:', e);
      setIsEthersLoaded(false);
      setAppError('Failed to load necessary libraries for ENS resolution. Please check your network.'); // Use setAppError
    };

    document.body.appendChild(script);

    // Cleanup function: remove the script when the component unmounts
    return () => {
      const existingScript = document.getElementById(scriptId);
      if (existingScript) {
        existingScript.remove();
      }
    };
  }, []); // Empty dependency array means this runs once on mount and cleans up on unmount


  // Function to resolve ENS name to address
  const resolveEnsName = async (ensName, infuraProjectId) => {
    if (!ensName.endsWith('.eth')) {
      return null; // Not an ENS name
    }

    // Wait until ethers.js is confirmed loaded
    if (!isEthersLoaded) {
      console.warn("ENS resolution attempted before ethers.js was loaded. Waiting...");
      // This part might not be strictly necessary with the useEffect,
      // but acts as a final safeguard.
      let retries = 10; // Give it a bit more time if needed
      while (!isEthersLoaded && retries > 0) {
        await delay(200); // Wait 200ms
        retries--;
      }
      if (!isEthersLoaded) {
        console.error("Ethers.js library did not load in time for ENS resolution.");
        return null;
      }
    }

    // Now that we're sure ethers is loaded, proceed
    try {
      // Access ethers from the window object
      const provider = new window.ethers.providers.JsonRpcProvider(`https://mainnet.infura.io/v3/${infuraProjectId}`);
      const resolvedAddress = await provider.resolveName(ensName);
      console.log(`Resolved ENS ${ensName} to: ${resolvedAddress}`);
      return resolvedAddress;
    } catch (err) {
      console.error(`Error resolving ENS name ${ensName}:`, err);
      setAppError(err); // Use setAppError
      return null; // Let handleSearch set the user-facing error
    }
  };

  // Function to fetch data from blockchain explorer APIs
  const fetchLancaDexData = async (
    userAddress,
    config, // Single config object
    unifiedApiBaseUrl,
    coingeckoApiBaseUrl,
    cachedTokenPricesRef, // Pass the ref directly
    setCurrentProcessingChain // Pass the state setter
  ) => {
    setLoading(true);
    setAppError(''); // Use setAppError
    setTotalVolume(null);
    setVolumeDistribution([]);
    setCurrentProcessingChain(''); // Clear previous chain message

    if (!userAddress) {
      setAppError('Please enter an ENS name or wallet address.'); // Use setAppError
      setLoading(false);
      return;
    }

    const addressRegex = /^0x[a-fA-F0-9]{40}$/;
    if (!addressRegex.test(userAddress)) {
      setAppError('Invalid address format. Please enter a valid Ethereum-like address (e.g., 0x...).'); // Use setAppError
      setLoading(false);
      return;
    }

    if (!config.etherscanV2ApiKey || config.etherscanV2ApiKey.includes('YOUR_')) {
        setAppError('API Key not configured. Please add your Etherscan V2 API key.'); // Use setAppError
        setLoading(false);
        return;
    }

    let aggregatedTotalVolume = 0;
    const aggregatedDistribution = {};

    try {
      const chains = Object.keys(config.lancaDexRouterContracts);
      // Process chains in batches of 2 for Etherscan calls
      for (let i = 0; i < chains.length; i += 2) {
        const currentBatchChains = chains.slice(i, i + 2);
        const chainPromises = currentBatchChains.map(async (chain) => {
          // --- START: New Debugging Logs for Chain Processing ---
          console.log(`[DEBUG] Starting processing for chain: ${chain}`);
          // --- END: New Debugging Logs for Chain Processing ---

          // Update processing chain message and ensure it displays for a minimum time
          setCurrentProcessingChain(chain.charAt(0).toUpperCase() + chain.slice(1));
          const chainMessageDisplayPromise = delay(3000); // Minimum 3 seconds display for chain message

          const routerAddresses = config.lancaDexRouterContracts[chain]; // Now an array
          const chainConfigEntry = config.chainConfig[chain];
          // nativeTokenId is no longer directly used for price fetching, but kept for config consistency
          const nativeTokenId = config.nativeTokenCoinGeckoIds[chain];

          // --- START: New Debugging Logs for Router Addresses ---
          console.log(`[DEBUG] ${chain} router addresses:`, routerAddresses);
          // --- END: New Debugging Logs for Router Addresses ---

          if (!routerAddresses || routerAddresses.length === 0 || !chainConfigEntry || !nativeTokenId) {
            console.warn(`Skipping ${chain} in batch: Router address(es), Chain ID, or Native Token ID not configured.`);
            await chainMessageDisplayPromise; // Wait to ensure message displays
            return null;
          }

          let chainVolumeUsd = 0;
          const uniqueTokenAddressesForCoinGeckoFallback = new Set();


          // --- Fetch ALL Native Token Transactions (txlist) for the address ---
          let txlistDataResult = [];
          try {
              const txlistParams = {
                  module: 'account',
                  action: 'txlist',
                  address: userAddress,
                  startblock: 0,
                  endblock: 99999999,
                  sort: 'asc',
                  chainId: chainConfigEntry.chainId
              };
              txlistDataResult = await fetchAllPages(unifiedApiBaseUrl, txlistParams, config.etherscanV2ApiKey);
              console.log(`[${chain}] Successfully fetched ${txlistDataResult.length} native transactions.`);
          } catch (fetchError) {
              console.error(`[${chain}] Error fetching txlist:`, fetchError);
              setAppError(`Error fetching ${chain} native transactions: ${fetchError.message || String(fetchError)}`); // Use setAppError
              await chainMessageDisplayPromise;
              return null;
          }

          // --- Fetch ALL ERC20 Token Transfers (tokentx) for the address ---
          let tokentxDataResult = [];
          try {
              const tokentxParams = {
                  module: 'account',
                  action: 'tokentx',
                  address: userAddress,
                  startblock: 0,
                  endblock: 99999999,
                  sort: 'asc',
                  chainId: chainConfigEntry.chainId
              };
              tokentxDataResult = await fetchAllPages(unifiedApiBaseUrl, tokentxParams, config.etherscanV2ApiKey);
              console.log(`[${chain}] Successfully fetched ${tokentxDataResult.length} ERC20 token transfers.`);
          } catch (fetchError) {
              console.error(`[${chain}] Error fetching tokentx:`, fetchError);
              setAppError(`Error fetching ${chain} token transfers: ${fetchError.message || String(fetchError)}`); // Use setAppError
              await chainMessageDisplayPromise;
              return null;
          }

          const currentChainTokenPrices = cachedTokenPricesRef.current; // Use the globally populated hardcoded prices

          // Get native token price for the chain (e.g., AVAX for Avalanche, ETH for Base)
          let nativePriceForChain = 0;
          if (config.nativeTokenCoinGeckoIds[chain] && cachedTokenPricesRef.current[config.nativeTokenCoinGeckoIds[chain]]) {
              nativePriceForChain = cachedTokenPricesRef.current[config.nativeTokenCoinGeckoIds[chain]];
          }
          if (nativePriceForChain === 0) {
              console.warn(`[${chain}] Native token price (ID: ${nativeTokenId}) not found in cache. This will impact native token volume calculation.`);
          }

          // Process all transactions and filter for router interactions
          const transactionMaxUsdValues = {};

          // Filter native token transactions for router interactions
          if (txlistDataResult.length > 0) {
              txlistDataResult.forEach(tx => {
                  // Check if 'to' or 'from' address matches any of the router addresses
                  const isRouterInteraction = routerAddresses.some(routerAddr =>
                      (tx.to && tx.to.toLowerCase() === routerAddr.toLowerCase()) ||
                      (tx.from && tx.from.toLowerCase() === routerAddr.toLowerCase())
                  );

                  if (isRouterInteraction) {
                      const nativeValue = formatTokenAmount(tx.value, 18); // Native token always has 18 decimals
                      const usdValue = nativeValue * nativePriceForChain;
                      if (usdValue > 0) {
                          transactionMaxUsdValues[tx.hash] = Math.max(
                              transactionMaxUsdValues[tx.hash] || 0,
                              usdValue
                          );
                          console.log(`[${chain}] Native TX ${tx.hash.substring(0, 6)}...: Value=${tx.value}, Price=${nativePriceForChain}, USD=${usdValue.toFixed(2)}`);
                      } else {
                          console.warn(`[${chain}] Native TX ${tx.hash.substring(0, 6)}...: USD value is 0. Native Amount=${nativeValue.toFixed(6)}, Price=${nativePriceForChain.toFixed(4)} (Check if price is 0 or amount is too small)`);
                      }
                  }
              });
          }

          // Filter ERC20 token transfers for router interactions
          if (tokentxDataResult.length > 0) {
              tokentxDataResult.forEach(tx => {
                  // Check if 'to' or 'from' address matches any of the router addresses
                  const isRouterInteraction = routerAddresses.some(routerAddr =>
                      (tx.to && tx.to.toLowerCase() === routerAddr.toLowerCase()) ||
                      (tx.from && tx.from.toLowerCase() === routerAddr.toLowerCase())
                  );

                  if (isRouterInteraction) {
                      const tokenAmount = formatTokenAmount(tx.value, parseInt(tx.tokenDecimal));
                      const tokenContractAddress = tx.contractAddress.toLowerCase();
                      const tokenPrice = currentChainTokenPrices[tokenContractAddress] || 0; // Will be 0 if not hardcoded
                      const usdValue = tokenAmount * tokenPrice;
                      if (usdValue > 0) {
                          transactionMaxUsdValues[tx.hash] = Math.max(
                              transactionMaxUsdValues[tx.hash] || 0,
                              usdValue
                          );
                      }
                      console.log(`[${chain}] ERC20 TX ${tx.hash.substring(0, 6)}...: Token=${tokenContractAddress.substring(0, 6)}..., Decimals=${tx.tokenDecimal}, Amount=${tokenAmount.toFixed(6)}, Price=${tokenPrice.toFixed(4)}, USD=${usdValue.toFixed(2)}`);
                  }
              });
          }

          for (const hash in transactionMaxUsdValues) {
              chainVolumeUsd += transactionMaxUsdValues[hash];
          }

          console.log(`[${chain}] Calculated chain volume USD:`, chainVolumeUsd);
          await chainMessageDisplayPromise; // Ensure chain message displays for minimum time
          return { chain, volume: chainVolumeUsd };
        });

        const results = await Promise.allSettled(chainPromises);
        results.forEach(result => {
          if (result.status === 'fulfilled' && result.value && result.value.volume > 0) {
            aggregatedDistribution[result.value.chain] = (aggregatedDistribution[result.value.chain] || 0) + result.value.volume;
            aggregatedTotalVolume += result.value.volume;
          } else if (result.status === 'rejected') {
              console.error(`A chain data fetch promise was rejected:`, result.reason);
          }
        });

        // Introduce a delay after each batch of 2 chains (to give Etherscan a break)
        if (i + 2 < chains.length) {
          await delay(1000); // 1-second delay between batches
        }
      }

      // After all chains are processed, display "Summing up" message
      setCurrentProcessingChain('Summing up your transactions');
      await delay(5000); // Display "Summing up" for 5 seconds

      setTotalVolume(aggregatedTotalVolume.toFixed(2));
      setVolumeDistribution(
        Object.entries(aggregatedDistribution)
          .filter(([, volume]) => volume > 0)
          .map(([chain, volume]) => ({
            chain: chain.charAt(0).toUpperCase() + chain.slice(1),
            volume: volume.toFixed(2),
          }))
          .sort((a, b) => parseFloat(b.volume) - parseFloat(a.volume))
      );

      if (aggregatedTotalVolume === 0 && !error) { // Only set this error if no other error occurred
          setAppError('No Lanca Dex transactions with identifiable value found for this address on configured chains.'); // Use setAppError
      }

    } catch (err) {
      console.error("Error fetching Lanca Dex data:", err);
      // Only set a generic error if no specific API error was set already by individual chain promises
      if (error === '') {
        setAppError(`An unexpected error occurred: ${err.message || String(err)}. Please try again.`); // Use setAppError
      }
    } finally {
      setLoading(false);
      setCurrentProcessingChain(''); // Clear processing chain message on completion
    }
  };

  // Handle search button click
  const handleSearch = async () => {
    if (address.trim() === '') {
      showCustomModal('Please enter an ENS name or wallet address.');
      return;
    }

    setLoading(true);
    setAppError(''); // Use setAppError
    setTotalVolume(null);
    setVolumeDistribution([]);

    let finalAddress = address.trim();
    const addressRegex = /^0x[a-fA-F0-9]{40}$/;

    if (!addressRegex.test(finalAddress)) {
      if (finalAddress.endsWith('.eth')) {
        setCurrentProcessingChain('ENS Name Resolution');
        // Check if ethers is loaded before attempting resolution
        if (!isEthersLoaded) {
          setAppError('ENS resolution libraries are still loading. Please wait a moment and try again.'); // Use setAppError
          setLoading(false);
          setCurrentProcessingChain('');
          return;
        }
        const resolved = await resolveEnsName(finalAddress, appConfig.infuraProjectId);
        if (resolved) {
          finalAddress = resolved;
        } else {
          setLoading(false);
          setAppError('Could not resolve ENS name. Please check the name or ensure ethers.js is loaded.'); // Use setAppError
          setCurrentProcessingChain('');
          return;
        }
      } else {
        setLoading(false);
        setAppError('Invalid address or ENS name format. Please enter a valid 0x address or an ENS name (e.g., vitalik.eth).'); // Use setAppError
        setCurrentProcessingChain('');
        return;
      }
    }

    fetchLancaDexData(
      finalAddress,
      appConfig,
      unifiedApiBaseUrl,
      coingeckoApiBaseUrl,
      cachedTokenPrices,
      setCurrentProcessingChain
    );
  };

  // Handle Enter key press in the input field
  const handleKeyPress = (event) => {
    if (event.key === 'Enter') {
      handleSearch();
    }
  };

  // Toggle dark mode
  const toggleDarkMode = () => {
    setIsDarkMode(prevMode => !prevMode);
  };

  // Custom Modal Component
  const Modal = ({ message, onClose }) => {
    return (
      <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white p-6 rounded-lg shadow-xl max-w-sm w-full text-center">
          <p className="text-lg font-semibold mb-4">{message}</p>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-[#fe7f2d] text-white rounded-md hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-[#fe7f2d] focus:ring-opacity-50 transition duration-200 ease-in-out"
          >
            OK
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-gray-900 text-gray-100' : 'bg-gradient-to-br from-[#233d4d] to-gray-800 text-gray-900'} flex items-center justify-center p-4 font-sans antialiased transition-colors duration-300`}>
      <div className={`rounded-xl shadow-2xl p-8 md:p-10 w-full max-w-2xl transform transition-all duration-300 hover:scale-[1.01] relative ${isDarkMode ? 'bg-gray-800 text-gray-100' : 'bg-white text-gray-900'}`}>
        <button
          onClick={toggleDarkMode}
          className={`absolute top-4 right-4 p-2 rounded-full ${isDarkMode ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'} transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-[#fe7f2d]`}
          aria-label="Toggle dark mode"
        >
          {isDarkMode ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h1M3 12H2m8.003-9.997l-.707.707M15.707 3.293l.707.707m-4.997 0l-.707-.707M8.293 15.707l-.707.707M12 18a6 6 0 100-12 6 6 0 000 12z" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9 9 0 008.354-5.646z" />
            </svg>
          )}
        </button>

        <h1 className={`text-3xl md::text-4xl font-extrabold text-center ${isDarkMode ? 'text-gray-100' : 'text-[#233d4d]'} mb-8 leading-tight`}>
          Lanca Dex Volume Checker
        </h1>

        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Enter ENS name or wallet address (e.g., vitalik.eth or 0x...)"
            className={`flex-grow p-3 border rounded-lg focus:ring-2 focus:ring-[#fe7f2d] transition duration-200 ease-in-out shadow-sm ${isDarkMode ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400' : 'bg-white border-gray-300 text-gray-700'}`}
          />
          <button
            onClick={handleSearch}
            className="px-6 py-3 bg-[#fe7f2d] text-white font-semibold rounded-lg shadow-md hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-[#fe7f2d] focus:ring-opacity-50 transition duration-200 ease-in-out transform hover:scale-105 active:scale-95"
            disabled={loading}
          >
            {loading ? (
              <svg className="animate-spin h-5 w-5 text-white mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              'Check Volume'
            )}
          </button>
        </div>

        {loading && currentProcessingChain && (
          <p className={`text-center text-sm mt-2 mb-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            {currentProcessingChain.startsWith('Summing up') || currentProcessingChain.startsWith('ENS Name') ? currentProcessingChain : `Getting your transactions on ${currentProcessingChain} chain...`}
          </p>
        )}

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative mb-6" role="alert">
            <strong className="font-bold">Error!</strong>
            <span className="block sm:inline ml-2">{error}</span>
          </div>
        )}

        {totalVolume !== null && (
          <div className={`mt-8 p-6 rounded-lg shadow-inner border ${isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
            <h2 className={`text-2xl font-bold ${isDarkMode ? 'text-gray-100' : 'text-[#233d4d]'} mb-4 flex items-center`}>
              <span className="mr-2 text-[#fe7f2d]">📊</span> Total Transaction Volume (in USD)
            </h2>
            <p className="text-4xl font-extrabold text-[#fe7f2d] mb-6">
              ${parseFloat(totalVolume).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>

            <h3 className={`text-xl font-bold ${isDarkMode ? 'text-gray-100' : 'text-[#233d4d]'} mb-3 flex items-center`}>
              <span className="mr-2 text-[#fe7f2d]">🔗</span> Volume Distribution by Chain (in USD)
            </h3>
            {volumeDistribution.length > 0 ? (
              <ul className="space-y-3">
                {volumeDistribution.map((item, index) => (
                  <li key={index} className={`flex justify-between items-center p-3 rounded-md shadow-sm border ${isDarkMode ? 'bg-gray-600 border-gray-500 text-gray-100' : 'bg-white border-gray-100 text-gray-700'}`}>
                    <span className="font-medium">{item.chain}:</span>
                    <span className="font-semibold text-[#fe7f2d]">
                      ${parseFloat(item.volume).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={`${isDarkMode ? 'text-gray-400' : 'text-gray-600'} italic`}>No distribution data available for this address.</p>
            )}
          </div>
        )}
        {/* Added the new note here */}
        <p className={`text-center text-xs mt-6 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
          <span className="font-semibold">Note:</span> Token prices are based on a periodically updated average and are not real-time.
        </p>
        <p className={`text-center text-xs mt-2 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
          Made by <a href="https://x.com/adedir2" target="_blank" rel="noopener noreferrer" className="text-[#fe7f2d] hover:underline">@adedir2</a>
        </p>
      </div>

      {showModal && (
        <Modal message={modalMessage} onClose={() => setShowModal(false)} />
      )}
    </div>
  );
};

export default App;
