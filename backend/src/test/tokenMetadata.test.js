const axios = require('axios');
const {
  fetchTokenDecimals,
  enrichFiltersWithTokenDecimals,
  clearDecimalsCache,
} = require('../services/tokenMetadata');

jest.mock('axios');

describe('tokenMetadata', () => {
  beforeEach(() => {
    clearDecimalsCache();
    jest.resetAllMocks();
  });

  it('fetchTokenDecimals returns chain decimals for REWARD-cf6eac (8)', async () => {
    axios.get.mockResolvedValue({ data: { decimals: 8 } });
    const decimals = await fetchTokenDecimals('REWARD-cf6eac', 'mainnet');
    expect(decimals).toBe(8);
    expect(axios.get).toHaveBeenCalledWith(
      'https://api.multiversx.com/tokens/REWARD-cf6eac',
      expect.objectContaining({ timeout: 10000 })
    );
  });

  it('enrichFiltersWithTokenDecimals stores decimals on save', async () => {
    axios.get.mockResolvedValue({ data: { decimals: 8 } });
    const enriched = await enrichFiltersWithTokenDecimals(
      {
        tokenIdentifier: 'REWARD-cf6eac',
        amountMin: '100',
      },
      'mainnet'
    );
    expect(enriched.tokenDecimals).toBe(8);
  });
});
