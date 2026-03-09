#!/usr/bin/env bash
set -euo pipefail

# build_all_visuals.sh
# Sequentially runs `npm install` then `pbiviz package` for an explicit allow-list of visual folders.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Explicit allow-list (only these will be built).
VISUAL_DIRS=(
  "GanttChart"
  "advancedGauge"
  "advancedPieDonutChart"
  "advancedTrellis"
  "bubbleScatterChart"
  "bulletChart"
  "hierarchicalVarianceTree"
  "hierarchyFilterSlicer"
  "linearGauge"
  "marimekkoChart"
  "multiAxesChart"
  "packedBubble"
  "performanceFlow"
  "radarPolarChart"
  "tagCloud"
  "varianceChart"
  "waterfallChart"
)

echo "================================================================================"
echo "Power BI Visuals: npm install + pbiviz package (sequential)"
echo "Root: ${ROOT_DIR}"
echo "Directories (${#VISUAL_DIRS[@]}): ${VISUAL_DIRS[*]}"
echo "================================================================================"

# Sanity checks: ensure required CLIs exist before starting.
command -v npm >/dev/null 2>&1 || { echo "ERROR: npm not found on PATH."; exit 1; }
command -v pbiviz >/dev/null 2>&1 || { echo "ERROR: pbiviz not found on PATH."; exit 1; }

FAILURES=0

for dir in "${VISUAL_DIRS[@]}"; do
  TARGET="${ROOT_DIR}/${dir}"

  echo
  echo "--------------------------------------------------------------------------------"
  echo "Building: ${dir}"
  echo "Path    : ${TARGET}"
  echo "--------------------------------------------------------------------------------"

  if [[ ! -d "${TARGET}" ]]; then
    echo "ERROR: Directory not found: ${dir}"
    exit 1
  fi

  if [[ ! -f "${TARGET}/package.json" ]]; then
    echo "ERROR: Missing package.json in: ${dir}"
    exit 1
  fi

  if [[ ! -f "${TARGET}/pbiviz.json" ]]; then
    echo "ERROR: Missing pbiviz.json in: ${dir}"
    exit 1
  fi

  pushd "${TARGET}" >/dev/null

  echo "[${dir}] npm install"
  npm install

  echo "[${dir}] pbiviz package --verbose"
  pbiviz package --verbose

  popd >/dev/null

  echo "[${dir}] OK"
done

echo
echo "================================================================================"
echo "All builds completed successfully."
echo "================================================================================"
