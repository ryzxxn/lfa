#!/bin/bash

set -e

echo "🔧 Firecracker Lambda Setup Script"
echo "=================================="
echo ""

# Check if running on Linux
if [[ "$OSTYPE" != "linux-gnu"* ]]; then
    echo "❌ Firecracker requires Linux with KVM support"
    echo "   Current OS: $OSTYPE"
    exit 1
fi

# Check KVM support
if ! grep -q kvm /proc/cpuinfo; then
    echo "❌ Your CPU does not support KVM virtualization"
    echo "   Check BIOS settings or use a different machine"
    exit 1
fi

echo "✅ System supports KVM"
echo ""

# Check if firecracker is installed
if command -v firecracker &> /dev/null; then
    echo "✅ Firecracker is already installed"
    firecracker --version
else
    echo "📥 Installing Firecracker..."

    # Detect architecture
    ARCH=$(uname -m)
    if [ "$ARCH" != "x86_64" ]; then
        echo "⚠️  Only x86_64 is officially tested, but continuing..."
    fi

    # Download latest release
    LATEST=$(curl -s https://api.github.com/repos/firecracker-microvm/firecracker/releases/latest | grep tag_name | cut -d'"' -f4)

    echo "   Latest Firecracker version: $LATEST"

    DOWNLOAD_URL="https://github.com/firecracker-microvm/firecracker/releases/download/${LATEST}/firecracker-${LATEST}-${ARCH}"

    echo "   Downloading from: $DOWNLOAD_URL"

    if ! wget -O /tmp/firecracker "$DOWNLOAD_URL"; then
        echo "❌ Failed to download Firecracker"
        exit 1
    fi

    chmod +x /tmp/firecracker

    echo ""
    echo "📍 Firecracker downloaded to /tmp/firecracker"
    echo "   To install system-wide (requires sudo):"
    echo "   sudo mv /tmp/firecracker /usr/local/bin/"
    echo ""
    echo "   Or use: export FIRECRACKER_BIN=/tmp/firecracker"
fi

echo ""
echo "📥 Downloading minimal Linux kernel..."

# Download kernel
KERNEL_URL="https://s3.amazonaws.com/firecracker-downloads/linux/5.10/x86_64/vmlinux-5.10"
KERNEL_PATH="./kernels/vmlinux-5.10"

mkdir -p kernels

if [ ! -f "$KERNEL_PATH" ]; then
    echo "   Downloading kernel..."
    if ! wget -O "$KERNEL_PATH" "$KERNEL_URL"; then
        echo "⚠️  Could not download kernel automatically"
        echo "   Download manually from: $KERNEL_URL"
        echo "   Save to: $KERNEL_PATH"
    else
        echo "✅ Kernel downloaded to $KERNEL_PATH"
    fi
else
    echo "✅ Kernel already present at $KERNEL_PATH"
fi

echo ""
echo "🔐 Setting up KVM permissions..."

# Add current user to kvm group
if ! groups "$USER" | grep -q kvm; then
    echo "   Adding $USER to kvm group (requires sudo)..."
    sudo usermod -aG kvm "$USER"
    echo "   ⚠️  Please log out and log back in for group changes to take effect"
else
    echo "✅ User already in kvm group"
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. If prompted above, log out and back in"
echo "2. Try deploying a function:"
echo "   npm run -w controller dev deploy hello examples/hello.ts"
echo "3. Export kernel path when running with Firecracker:"
echo "   export FIRECRACKER_KERNEL=./kernels/vmlinux-5.10"
