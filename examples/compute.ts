import { defineHandler } from "@firecracker-lambda/framework";

function fibonacci(n: number): number {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

export default defineHandler(async (payload) => {
  const { n } = payload as { n: number };

  if (!n || n < 0) {
    throw new Error("n must be a non-negative number");
  }

  const result = fibonacci(n);

  return {
    input: n,
    result,
  };
});
