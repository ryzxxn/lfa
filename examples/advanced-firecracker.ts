import { FunctionController } from "@firecracker-lambda/controller";
import { FirecrackerVM } from "@firecracker-lambda/controller";
import * as path from "path";

/**
 * Example: Using Firecracker for secure multi-tenant execution
 *
 * This example demonstrates how to:
 * 1. Deploy a function
 * 2. Execute it in a Firecracker VM with hardware isolation
 * 3. Handle VM lifecycle
 *
 * Prerequisites:
 * - Linux host with KVM support
 * - Firecracker binary installed
 * - Linux kernel image
 *
 * Run with:
 * FIRECRACKER_BIN=/usr/local/bin/firecracker npm run -w examples dev advanced-firecracker.ts
 */

async function main() {
  const controller = new FunctionController();

  console.log("📦 Deploying function...");
  await controller.deploy({
    name: "secure-compute",
    sourceFile: path.join(__dirname, "compute.ts"),
  });

  console.log("🔒 Creating Firecracker VM for secure execution...");

  const vm = new FirecrackerVM({
    useFirecracker: process.env.FIRECRACKER_BIN ? true : false,
    kernelImage: process.env.FIRECRACKER_KERNEL || "./kernels/vmlinux-5.10",
    vcpuCount: 2,
    memMB: 256,
  });

  try {
    console.log("⚙️  Executing in isolated VM...");

    const bundlePath = "./deployments/secure-compute-bundle.js"; // Path where bundle would be stored

    const result = await vm.execute(bundlePath, {
      n: 15,
    });

    console.log("\n✅ Execution complete!");
    console.log("Exit code:", result.exitCode);
    console.log("Output:", result.stdout);

    if (result.stderr) {
      console.error("Errors:", result.stderr);
    }
  } finally {
    console.log("\n🧹 Cleaning up VM resources...");
    vm.cleanup();
  }
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
