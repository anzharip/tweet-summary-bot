import axios, { AxiosInstance } from "axios";
import axiosRetry from "axios-retry";
import { logger } from "./logger";

axiosRetry(axios, {
  retries: Infinity,
  shouldResetTimeout: true,
  retryDelay: (retryNumber = 0) => {
    return 60000 * Math.pow(2, retryNumber);
  },
  retryCondition: (error): boolean => {
    logger.error(error);
    return true;
  },
});

export function axiosClient(): AxiosInstance {
  return axios;
}
