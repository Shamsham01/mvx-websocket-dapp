import axios from 'axios';
import { MVX_API_BASE, MAKEX_USAGE_FEE_ADDRESS, REWARD_TOKEN_ID } from '../constants/mvx';

const mvxPublic = axios.create({
  baseURL: MVX_API_BASE,
  timeout: 45_000,
});

/**
 * @param {string} userBech32
 * @param {{ from?: number, size?: number }} params
 * @returns {Promise<Array>}
 */
export async function fetchUsageFeeTransfersPage(userBech32, { from = 0, size = 100 } = {}) {
  const path = `/accounts/${encodeURIComponent(userBech32)}/transfers`;
  const { data } = await mvxPublic.get(path, {
    params: {
      sender: userBech32,
      receiver: MAKEX_USAGE_FEE_ADDRESS,
      token: REWARD_TOKEN_ID,
      status: 'success',
      order: 'asc',
      from,
      size,
    },
  });
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

export async function fetchRewardTokenDenominated() {
  const { data } = await mvxPublic.get(`/tokens/${encodeURIComponent(REWARD_TOKEN_ID)}`, {
    params: { denominated: true },
  });
  return data;
}
