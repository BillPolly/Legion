#!/bin/bash

# Batch migration script for all packages using module-loader
# Migrates all packages from @legion/module-loader to @legion/tool-system

set -e  # Exit on any error

echo "🚀 Starting batch migration of all packages to tool-system"
echo "=================================================="

# List of all packages that use module-loader (excluding module-loader itself)
PACKAGES=(
  "agent"
  "apps/web-backend"
  "cli"
  "code-gen/code-analysis"
  "code-gen/js-generator"
  "code-gen"
  "conan-the-deployer"
  "general-tools"
  "llm-planner"
  "log-manager"
  "node-runner"
  "planning/plan-executor-tools"
  "planning/plan-executor"
  "planning/profile-planner"
  "playwright"
  "railway"
  "resource-manager"
  "storage"
  "testing/umbilical-testing"
  "voice"
)

TOTAL_PACKAGES=${#PACKAGES[@]}
MIGRATED_COUNT=0
FAILED_PACKAGES=()

echo "📦 Found $TOTAL_PACKAGES packages to migrate"
echo ""

# Function to migrate a single package
migrate_package() {
  local pkg="$1"
  local pkg_path="packages/$pkg"
  
  echo "[$((MIGRATED_COUNT + 1))/$TOTAL_PACKAGES] 📝 Migrating $pkg..."
  
  if [ ! -d "$pkg_path" ]; then
    echo "   ⚠️  Warning: Package directory not found: $pkg_path"
    return 1
  fi
  
  # Run the migration script
  if node scripts/migrate-to-tool-system.js "$pkg_path" > /tmp/migrate-$pkg.log 2>&1; then
    echo "   ✅ Successfully migrated $pkg"
    MIGRATED_COUNT=$((MIGRATED_COUNT + 1))
    return 0
  else
    echo "   ❌ Failed to migrate $pkg (check /tmp/migrate-$pkg.log)"
    FAILED_PACKAGES+=("$pkg")
    return 1
  fi
}

# Migrate all packages
echo "Starting migration process..."
echo ""

for pkg in "${PACKAGES[@]}"; do
  migrate_package "$pkg" || true  # Continue even if one package fails
done

echo ""
echo "📊 Migration Summary"
echo "===================="
echo "Total packages: $TOTAL_PACKAGES"
echo "Successfully migrated: $MIGRATED_COUNT"
echo "Failed: ${#FAILED_PACKAGES[@]}"

if [ ${#FAILED_PACKAGES[@]} -gt 0 ]; then
  echo ""
  echo "❌ Failed packages:"
  for failed in "${FAILED_PACKAGES[@]}"; do
    echo "  - $failed (log: /tmp/migrate-$failed.log)"
  done
fi

echo ""
echo "🔄 Next Steps:"
echo "1. Review migration logs for any failed packages"
echo "2. Run tests: npm test"
echo "3. Fix any remaining issues manually"
echo "4. If all tests pass, remove backup files:"
echo "   find packages -name \"*.backup\" -delete"

# Create summary report
cat > migration-report.md << EOF
# Migration Report

## Summary
- **Total packages**: $TOTAL_PACKAGES
- **Successfully migrated**: $MIGRATED_COUNT
- **Failed**: ${#FAILED_PACKAGES[@]}

## Successfully Migrated Packages
$(for i in "${!PACKAGES[@]}"; do
  pkg="${PACKAGES[$i]}"
  if [[ ! " ${FAILED_PACKAGES[*]} " =~ " $pkg " ]]; then
    echo "- ✅ $pkg"
  fi
done)

## Failed Packages
$(for failed in "${FAILED_PACKAGES[@]}"; do
  echo "- ❌ $failed (log: /tmp/migrate-$failed.log)"
done)

## Files Changed
- package.json dependencies updated
- Import statements converted from @legion/module-loader to @legion/tool-system
- ResourceManager.get() calls converted to direct property access
- Backup files created for all modified files

## Testing
Run \`npm test\` to validate all migrations are working correctly.

## Cleanup
When satisfied with migration, remove backup files:
\`\`\`bash
find packages -name "*.backup" -delete
\`\`\`
EOF

echo "📋 Migration report saved to migration-report.md"

if [ $MIGRATED_COUNT -eq $TOTAL_PACKAGES ]; then
  echo ""
  echo "🎉 All packages migrated successfully!"
  exit 0
else
  echo ""
  echo "⚠️  Some packages failed to migrate. Please review the logs and fix manually."
  exit 1
fi