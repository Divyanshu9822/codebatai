const RATE_LIMIT = 30;
const RATE_LIMIT_INTERVAL = 60 * 1000;

let requestTimestamps = [];

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const ensureRateLimit = async () => {
  const now = Date.now();

  requestTimestamps = requestTimestamps.filter((timestamp) => now - timestamp < RATE_LIMIT_INTERVAL);

  if (requestTimestamps.length >= RATE_LIMIT) {
    const oldestRequest = requestTimestamps[0];
    const timeToWait = RATE_LIMIT_INTERVAL - (now - oldestRequest);
    console.log(`Rate limit reached. Waiting for ${timeToWait / 1000} seconds.`);
    await delay(timeToWait);
  }

  requestTimestamps.push(now);
};
