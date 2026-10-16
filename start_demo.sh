#!/usr/bin/env bash
set -e

# ==============================================================================
# Active Engineering Memory Layer - Demo Launcher Script
# ==============================================================================

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="${PROJECT_ROOT}/backend"
FRONTEND_DIR="${PROJECT_ROOT}/frontend"
PYTHON_BIN="${BACKEND_DIR}/.venv/bin/python"
export PYTHONPATH="${BACKEND_DIR}:${PYTHONPATH}"

echo "=============================================================================="
echo "⚡ Starting Active Engineering Memory Layer Demo Platform"
echo "=============================================================================="

# 1. Check FalkorDB Port 6379
echo -n "🔍 Checking FalkorDB on localhost:6379... "
if nc -z localhost 6379 2>/dev/null || (echo > /dev/tcp/localhost/6379) 2>/dev/null; then
    echo "CONNECTED ✅"
else
    echo "NOT REACHABLE ❌"
    echo "⚠️  FalkorDB is not running on localhost:6379."
    echo "   Start it with Docker/Podman:"
    echo "   docker run -p 6379:6379 -p 3000:3000 -d --name falkordb falkordb/falkordb:latest"
    exit 1
fi

# 2. Seed Default Tenant Graphs
echo "🌱 Pre-seeding FalkorDB tenant_project_alpha & tenant_project_beta..."
"${PYTHON_BIN}" -c "
from app.db.graph_client import FalkorDBClient
from app.db.seed_enterprise_graph import seed_tenant_graph
client = FalkorDBClient()
res_a = seed_tenant_graph(client, 'tenant_project_alpha')
print(f'   Successfully seeded tenant_project_alpha: {res_a[\"node_count\"]} nodes, {res_a[\"edge_count\"]} relationships.')
res_b = seed_tenant_graph(client, 'tenant_project_beta')
print(f'   Successfully seeded tenant_project_beta: {res_b[\"node_count\"]} nodes, {res_b[\"edge_count\"]} relationships.')
"

# 3. Trap for Clean Process Shutdown
cleanup() {
    echo ""
    echo "🛑 Shutting down demo servers..."
    if [ -n "${BACKEND_PID}" ]; then
        kill "${BACKEND_PID}" 2>/dev/null || true
    fi
    if [ -n "${FRONTEND_PID}" ]; then
        kill "${FRONTEND_PID}" 2>/dev/null || true
    fi
    echo "👋 Demo shutdown cleanly."
    exit 0
}
trap cleanup SIGINT SIGTERM EXIT

# 4. Launch FastAPI Backend on Port 8000
echo "🚀 Starting FastAPI (SSE) Backend on http://localhost:8000..."
cd "${BACKEND_DIR}"
"${PYTHON_BIN}" -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --log-level warning &
BACKEND_PID=$!

# Wait for backend health
sleep 1.5
curl -s http://localhost:8000/api/health >/dev/null || true

# 5. Launch Next.js Frontend on Port 3001
echo "🌐 Starting Next.js UI on http://localhost:3001..."
cd "${FRONTEND_DIR}"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "=============================================================================="
echo "✨ Active Engineering Memory Layer is LIVE!"
echo "   - Next.js Web Application: http://localhost:3001"
echo "   - FastAPI REST & SSE Docs:  http://localhost:8000/docs"
echo "   - FalkorDB Browser UI:     http://localhost:3000"
echo "=============================================================================="
echo "Press Ctrl+C to stop both servers."

wait
