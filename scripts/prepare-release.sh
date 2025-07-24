#!/bin/bash

# Prepare CCP for release
set -e

echo "🚀 Preparing Claude Coordination Protocol for release..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Run this script from the project root."
    exit 1
fi

# Get current version
VERSION=$(node -p "require('./package.json').version")
echo "📦 Current version: $VERSION"

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf dist/

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Run tests
echo "🧪 Running tests..."
npm test

# Build the project
echo "🔨 Building project..."
npm run build

# Check build output
if [ ! -d "dist" ]; then
    echo "❌ Error: Build failed - dist directory not found"
    exit 1
fi

# Create release directory
RELEASE_DIR="release-$VERSION"
echo "📁 Creating release directory: $RELEASE_DIR"
rm -rf "$RELEASE_DIR"
mkdir -p "$RELEASE_DIR"

# Copy necessary files
echo "📄 Copying distribution files..."
cp -r dist "$RELEASE_DIR/"
cp -r templates "$RELEASE_DIR/" 2>/dev/null || echo "No templates directory"
cp -r examples "$RELEASE_DIR/" 2>/dev/null || echo "No examples directory"
cp package.json "$RELEASE_DIR/"
cp package-lock.json "$RELEASE_DIR/" 2>/dev/null || echo "No package-lock.json"
cp README.md "$RELEASE_DIR/"
cp CHANGELOG.md "$RELEASE_DIR/"
cp UPDATE-GUIDE.md "$RELEASE_DIR/"
cp LICENSE "$RELEASE_DIR/" 2>/dev/null || echo "No LICENSE file"

# Create tarball
echo "📦 Creating distribution tarball..."
tar -czf "claude-coordination-protocol-$VERSION.tar.gz" "$RELEASE_DIR"

echo "✅ Release preparation complete!"
echo ""
echo "📋 Next steps:"
echo "1. Test the package locally:"
echo "   npm pack"
echo "   npm install -g claude-coordination-protocol-$VERSION.tgz"
echo ""
echo "2. Publish to npm (if you have access):"
echo "   npm publish"
echo ""
echo "3. Or distribute the tarball:"
echo "   $PWD/claude-coordination-protocol-$VERSION.tar.gz"
echo ""
echo "4. For beetoken projects, install from local file:"
echo "   npm install file:$PWD"