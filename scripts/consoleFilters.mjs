export function isExpectedNetworkConsoleError(text) {
  return (
    text.includes('Failed to load resource: the server responded with a status of 404') ||
    text.includes('Failed to load resource: the server responded with a status of 451') ||
    text.includes('has been blocked by CORS policy') ||
    text.includes('Failed to load resource: net::ERR_FAILED') ||
    text.includes('https://fapi.binance.com/') ||
    text.includes('wss://fstream.binance.com/')
  );
}

