/**
 * Building Fire Evacuation Route Planner - Interactive Frontend Engine
 * Handles Canvas rendering, dynamic user interactions, and REST API calls.
 */

// Application State
const state = {
    graph: null,
    startNodeId: "R101",
    activeTool: "start", // 'start', 'fire', 'block'
    currentRoute: [],
    traversalOrder: [],
    animationOffset: 0,
    animFrameId: null,
    hoveredNode: null,
};

const canvas = document.getElementById("floor-canvas");
const ctx = canvas.getContext("2d");

// DOM Elements
const toolHint = document.getElementById("tool-hint");
const presetSelector = document.getElementById("preset-selector");
const statFires = document.getElementById("stat-fires");
const statSmokes = document.getElementById("stat-smokes");
const statExits = document.getElementById("stat-exits");
const routeOutput = document.getElementById("route-output");
const traversalLog = document.getElementById("traversal-log");

const toolHints = {
    start: "Click any room or corridor on the floor plan to set your starting evacuation point.",
    fire: "Click any room or hallway to ignite or extinguish a fire.",
    block: "Click any node to toggle physical blockage (debris / locked door).",
};

// -------------------------------------------------------------
// API Services
// -------------------------------------------------------------
async function fetchBuilding() {
    try {
        const res = await fetch("/api/building");
        const data = await res.json();
        state.graph = data.graph;
        updateStats();
        draw();
    } catch (err) {
        console.error("Error loading building data:", err);
    }
}

async function switchPreset(preset) {
    try {
        const res = await fetch("/api/building/select", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ preset }),
        });
        const data = await res.json();
        state.graph = data.graph;
        state.currentRoute = [];
        state.traversalOrder = [];
        // Set default start node based on preset
        state.startNodeId = preset === "school" ? "R101" : "ICU";
        routeOutput.innerHTML = `<div class="empty-state">Select a room and click <b>Run BFS</b> to compute route.</div>`;
        traversalLog.textContent = `Loaded ${state.graph.building_name}`;
        updateStats();
        draw();
    } catch (err) {
        console.error("Error selecting preset:", err);
    }
}

async function toggleNodeFire(nodeId) {
    try {
        const res = await fetch("/api/node/toggle-fire", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ node_id: nodeId }),
        });
        const data = await res.json();
        state.graph = data.graph;
        updateStats();
        // If route is active, auto-recalculate to showcase dynamic re-routing!
        if (state.currentRoute.length > 0) {
            runBFS();
        } else {
            draw();
        }
    } catch (err) {
        console.error(err);
    }
}

async function toggleNodeBlock(nodeId) {
    try {
        const res = await fetch("/api/node/toggle-block", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ node_id: nodeId }),
        });
        const data = await res.json();
        state.graph = data.graph;
        updateStats();
        if (state.currentRoute.length > 0) {
            runBFS();
        } else {
            draw();
        }
    } catch (err) {
        console.error(err);
    }
}

async function stepFireSimulation() {
    try {
        const res = await fetch("/api/simulation/step", { method: "POST" });
        const data = await res.json();
        state.graph = data.graph;
        updateStats();
        const s = data.summary;
        traversalLog.textContent = `Fire Step #${s.step}: +${s.new_fires.length} fires, +${s.new_smokes.length} smokes. Total fires: ${s.total_fires}. Safe exits: ${s.intact_exits}.`;
        if (state.currentRoute.length > 0) {
            runBFS();
        } else {
            draw();
        }
    } catch (err) {
        console.error(err);
    }
}

async function resetSimulation() {
    try {
        const res = await fetch("/api/simulation/reset", { method: "POST" });
        const data = await res.json();
        state.graph = data.graph;
        state.currentRoute = [];
        state.traversalOrder = [];
        updateStats();
        routeOutput.innerHTML = `<div class="empty-state">All hazards cleared. Floor plan restored.</div>`;
        traversalLog.textContent = "Hazards cleared. Graph reset to safe baseline.";
        draw();
    } catch (err) {
        console.error(err);
    }
}

async function runBFS() {
    if (!state.startNodeId) {
        alert("Please select a starting room first!");
        return;
    }
    try {
        const res = await fetch("/api/plan/bfs", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ start_node_id: state.startNodeId }),
        });
        const result = await res.json();
        displayRouteResult(result, "Breadth-First Search (BFS)");
    } catch (err) {
        console.error(err);
    }
}

async function runDFS() {
    if (!state.startNodeId) {
        alert("Please select a starting room first!");
        return;
    }
    try {
        const res = await fetch("/api/plan/dfs", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ start_node_id: state.startNodeId }),
        });
        const result = await res.json();
        displayRouteResult(result, "Depth-First Search (DFS)");
    } catch (err) {
        console.error(err);
    }
}

// -------------------------------------------------------------
// UI Updates & Results Display
// -------------------------------------------------------------
function updateStats() {
    if (!state.graph) return;
    const fires = state.graph.nodes.filter(n => n.state === "FIRE").length;
    const smokes = state.graph.nodes.filter(n => n.state === "SMOKE").length;
    const exits = state.graph.nodes.filter(n => n.type === "EXIT" && n.is_passable).length;

    statFires.textContent = fires;
    statSmokes.textContent = smokes;
    statExits.textContent = exits;
}

function displayRouteResult(result, algoName) {
    state.currentRoute = result.path || [];
    state.traversalOrder = result.explored_order || [];

    if (result.success) {
        routeOutput.innerHTML = `
            <div class="route-success">
                <h4>🟢 Optimal Evacuation Path Found</h4>
                <div class="route-stats">
                    <div class="route-stat-box">
                        <div class="val">${result.hops}</div>
                        <div class="lbl">Transitions / Hops</div>
                    </div>
                    <div class="route-stat-box">
                        <div class="val">${result.total_distance ?? "~"} m</div>
                        <div class="lbl">Approx Distance</div>
                    </div>
                </div>
                <p style="font-size:0.8rem; margin-bottom:0.4rem;">
                    Target: <b>${result.exit_name || result.target_exit}</b>
                </p>
                <div class="path-chain">
                    ${result.path.join(" ➔ ")}
                </div>
            </div>
        `;
        traversalLog.textContent = `[${algoName}] Visited order: ${result.explored_order.join(" ➔ ")}`;
    } else {
        routeOutput.innerHTML = `
            <div class="route-danger">
                <h4>⚠️ EVACUATION BLOCKED</h4>
                <p style="font-size:0.82rem; margin-top:0.4rem;">${result.message}</p>
            </div>
        `;
        traversalLog.textContent = `[${algoName}] Traversal stopped. Visited: ${result.explored_order.join(" ➔ ")}. No exit reached.`;
    }

    draw();
}

// -------------------------------------------------------------
// Canvas Graphics & Visualizer
// -------------------------------------------------------------
function getNodeColor(node) {
    if (node.id === state.startNodeId) return "#a855f7"; // Purple start
    if (node.state === "FIRE") return "#ef4444";        // Red Fire
    if (node.state === "SMOKE") return "#f59e0b";       // Amber Smoke
    if (node.state === "BLOCKED") return "#475569";     // Slate Blocked
    if (node.type === "EXIT") return "#10b981";         // Green Exit
    if (node.category === "Hazard" || node.risk_level) return "#ec4899"; // Pink hazard zone
    return "#38bdf8";                                   // Cyan Safe Room
}

function draw() {
    if (!state.graph) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. Draw Floor Plan Grid / Background Lines
    ctx.strokeStyle = "#162035";
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }

    const nodeMap = {};
    state.graph.nodes.forEach(n => { nodeMap[n.id] = n; });

    // 2. Draw Edges / Hallways
    state.graph.edges.forEach(edge => {
        const u = nodeMap[edge.from];
        const v = nodeMap[edge.to];
        if (!u || !v) return;

        ctx.beginPath();
        ctx.moveTo(u.x, u.y);
        ctx.lineTo(v.x, v.y);

        if (edge.is_blocked) {
            ctx.strokeStyle = "rgba(239, 68, 68, 0.4)";
            ctx.lineWidth = 4;
            ctx.setLineDash([5, 5]);
        } else {
            ctx.strokeStyle = "#253456";
            ctx.lineWidth = 6;
            ctx.setLineDash([]);
        }
        ctx.stroke();
        ctx.setLineDash([]);
    });

    // 3. Highlight Computed Evacuation Route
    if (state.currentRoute && state.currentRoute.length > 1) {
        ctx.save();
        ctx.strokeStyle = "#22c55e";
        ctx.lineWidth = 5;
        ctx.shadowColor = "#22c55e";
        ctx.shadowBlur = 12;
        ctx.setLineDash([8, 6]);
        ctx.lineDashOffset = -state.animationOffset;

        ctx.beginPath();
        for (let i = 0; i < state.currentRoute.length; i++) {
            const pt = nodeMap[state.currentRoute[i]];
            if (pt) {
                if (i === 0) ctx.moveTo(pt.x, pt.y);
                else ctx.lineTo(pt.x, pt.y);
            }
        }
        ctx.stroke();
        ctx.restore();
    }

    // 4. Draw Nodes
    state.graph.nodes.forEach(node => {
        const isStart = node.id === state.startNodeId;
        const radius = node.type === "CORRIDOR" ? 14 : 22;

        // Glow effect for hazard / exit / start
        if (node.state === "FIRE") {
            ctx.shadowColor = "#ef4444";
            ctx.shadowBlur = 16;
        } else if (node.type === "EXIT") {
            ctx.shadowColor = "#10b981";
            ctx.shadowBlur = 12;
        } else if (isStart) {
            ctx.shadowColor = "#a855f7";
            ctx.shadowBlur = 16;
        } else {
            ctx.shadowBlur = 0;
        }

        // Base circle
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = getNodeColor(node);
        ctx.fill();

        ctx.lineWidth = 2.5;
        ctx.strokeStyle = isStart ? "#ffffff" : "#0d1527";
        ctx.stroke();
        ctx.shadowBlur = 0; // reset

        // Label / Icon inside node
        ctx.fillStyle = "#ffffff";
        ctx.font = node.type === "CORRIDOR" ? "bold 10px Inter" : "bold 11px Inter";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        let label = node.id;
        if (node.state === "FIRE") label = "🔥";
        else if (node.state === "SMOKE") label = "💨";
        else if (node.state === "BLOCKED") label = "⛔";
        else if (node.type === "EXIT") label = "🚪";
        else if (isStart) label = "🏃";

        ctx.fillText(label, node.x, node.y);

        // Name underneath node
        ctx.fillStyle = "#cbd5e1";
        ctx.font = "10px Inter";
        ctx.fillText(node.name, node.x, node.y + radius + 13);
    });

    // 5. Draw Hover Tooltip if hovering a node
    if (state.hoveredNode) {
        const n = state.hoveredNode;
        const text = `${n.name} [${n.state}] ${n.smoke_level > 0 ? `Smoke: ${(n.smoke_level*100).toFixed(0)}%` : ""}`;
        ctx.fillStyle = "rgba(10, 15, 29, 0.9)";
        ctx.strokeStyle = "#38bdf8";
        ctx.lineWidth = 1;
        const metrics = ctx.measureText(text);
        const pad = 6;
        const bx = Math.min(n.x - 20, canvas.width - metrics.width - 25);
        const by = n.y - 38;

        ctx.fillRect(bx, by, metrics.width + pad * 2, 22);
        ctx.strokeRect(bx, by, metrics.width + pad * 2, 22);
        ctx.fillStyle = "#ffffff";
        ctx.fillText(text, bx + metrics.width / 2 + pad, by + 12);
    }
}

function animate() {
    state.animationOffset = (state.animationOffset + 0.5) % 32;
    draw();
    state.animFrameId = requestAnimationFrame(animate);
}

// -------------------------------------------------------------
// Event Listeners
// -------------------------------------------------------------
function findNodeAt(x, y) {
    if (!state.graph) return null;
    return state.graph.nodes.find(n => {
        const radius = n.type === "CORRIDOR" ? 18 : 26;
        const dist = Math.hypot(n.x - x, n.y - y);
        return dist <= radius;
    });
}

canvas.addEventListener("click", e => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const clickedNode = findNodeAt(x, y);

    if (!clickedNode) return;

    if (state.activeTool === "start") {
        state.startNodeId = clickedNode.id;
        traversalLog.textContent = `Selected evacuation starting location: ${clickedNode.name} (${clickedNode.id})`;
        if (state.currentRoute.length > 0) {
            runBFS();
        } else {
            draw();
        }
    } else if (state.activeTool === "fire") {
        toggleNodeFire(clickedNode.id);
    } else if (state.activeTool === "block") {
        toggleNodeBlock(clickedNode.id);
    }
});

canvas.addEventListener("mousemove", e => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const node = findNodeAt(x, y);

    if (node !== state.hoveredNode) {
        state.hoveredNode = node;
        draw();
    }
});

canvas.addEventListener("mouseleave", () => {
    if (state.hoveredNode) {
        state.hoveredNode = null;
        draw();
    }
});

// Tool selector buttons
document.querySelectorAll(".tool-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        document.querySelectorAll(".tool-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        state.activeTool = btn.dataset.tool;
        toolHint.textContent = toolHints[state.activeTool];
    });
});

presetSelector.addEventListener("change", e => {
    switchPreset(e.target.value);
});

document.getElementById("btn-bfs").addEventListener("click", runBFS);
document.getElementById("btn-dfs").addEventListener("click", runDFS);
document.getElementById("btn-step-fire").addEventListener("click", stepFireSimulation);
document.getElementById("btn-reset").addEventListener("click", resetSimulation);

// Start app
fetchBuilding().then(() => {
    animate();
});
