import { Redis } from "@upstash/redis";

console.log("Redis URL:", process.env.NEXT_PUBLIC_UPSTASH_REDIS_REST_URL);
console.log("Redis Token:", process.env.NEXT_PUBLIC_UPSTASH_REDIS_REST_TOKEN);

export const redis = new Redis({
  url: process.env.NEXT_PUBLIC_UPSTASH_REDIS_REST_URL,
  token: process.env.NEXT_PUBLIC_UPSTASH_REDIS_REST_TOKEN,
});