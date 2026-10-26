/**
 * Building Fire Evacuation Route Planner - Advanced Frontend Engine
 * Includes Architectural CAD Canvas Visualizer, Particle Flow Animation,
 * Web Audio FX Synthesizer, Dynamic Building Integrity Meter, and Auto-Simulation.
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
    lastResult: null,
    zoomScale: 1.0,
    autoSimInterval: null,
    soundEnabled: true,
    particles: [], // Animated particles moving along the safe egress route
};

// Canvas Setup
const canvas = document.getElementById("floor-canvas");
const ctx = canvas.getContext("2d");

// DOM Elements
const toolHint = document.getElementById("tool-hint");
const presetSelector = document.getElementById("preset-selector");
const statFires = document.getElementById("stat-fires");
const statSmokes = document.getElementById("stat-smokes");
const statExits = document.getElementById("stat-exits");
const integrityPercent = document.getElementById("integrity-percent");
const integrityBar = document.getElementById("integrity-bar");
const routeOutput = document.getElementById("route-output");
const traversalLog = document.getElementById("traversal-log");
const logStepCount = document.getElementById("log-step-count");
const btnVoice = document.getElementById("btn-voice");
const btnStopVoice = document.getElementById("btn-stop-voice");
const directionsPanel = document.getElementById("directions-panel");
const directionsList = document.getElementById("directions-list");
const benchmarkCard = document.getElementById("benchmark-card");
const benchmarkBody = document.getElementById("benchmark-body");
const btnAutoSim = document.getElementById("btn-auto-sim");
const btnSoundToggle = document.getElementById("btn-sound-toggle");
const soundIcon = document.getElementById("sound-icon");
const soundStatus = document.getElementById("sound-status");

const toolHints = {
    start: "Click any room or corridor on the floor plan to set your starting evacuation point.",
    fire: "Click any room or hallway to ignite or extinguish a fire hazard.",
    block: "Click any node to toggle physical structural blockage (debris / locked door).",
};

// -------------------------------------------------------------
// Web Audio FX Synthesizer (Native Web Audio API)
// -------------------------------------------------------------
const AudioEngine = {
    ctx: null,
    init() {
        if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioCtx();
        }
    },
    playTone(freq, type, duration, gainVal = 0.1) {
        if (!state.soundEnabled) return;
        try {
            this.init();
            if (!this.ctx) return;
            if (this.ctx.state === 'suspended') this.ctx.resume();

            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = type;
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

            gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start();
            osc.stop(this.ctx.currentTime + duration);
        } catch (e) {
            // Audio policy fallback
        }
    },
    click() {
        this.playTone(600, 'sine', 0.08, 0.05);
    },
    fireAlert() {
        this.playTone(280, 'sawtooth', 0.25, 0.12);
        setTimeout(() => this.playTone(220, 'sawtooth', 0.35, 0.15), 120);
    },
    routeFound() {
        this.playTone(523.25, 'triangle', 0.15, 0.08); // C5
        setTimeout(() => this.playTone(659.25, 'triangle', 0.15, 0.08), 80); // E5
        setTimeout(() => this.playTone(783.99, 'triangle', 0.25, 0.1), 160); // G5
    },
    routeBlocked() {
        this.playTone(180, 'square', 0.3, 0.1);
        setTimeout(() => this.playTone(140, 'square', 0.4, 0.12), 150);
    }
};

// -------------------------------------------------------------
// API Services & State Handlers
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
        stopAutoSimulation();
        const res = await fetch("/api/building/select", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ preset }),
        });
        const data = await res.json();
        state.graph = data.graph;
        state.currentRoute = [];
        state.traversalOrder = [];
        state.lastResult = null;
        state.particles = [];

        if (preset === "school") state.startNodeId = "R101";
        else if (preset === "hospital") state.startNodeId = "ICU";
        else if (preset === "apartment") state.startNodeId = "FLAT_401";

        routeOutput.innerHTML = `<div class="empty-state">Select a room and click <b>Run BFS</b> to compute the fastest safe route.</div>`;
        if (directionsPanel) directionsPanel.style.display = "none";
        if (btnVoice) btnVoice.style.display = "none";
        if (btnStopVoice) btnStopVoice.style.display = "none";
        if (benchmarkCard) benchmarkCard.style.display = "none";
        if ('speechSynthesis' in window) window.speechSynthesis.cancel();

        traversalLog.textContent = `Loaded ${state.graph.building_name}`;
        logStepCount.textContent = "Preset Loaded";
        AudioEngine.click();
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
        AudioEngine.fireAlert();
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

async function toggleNodeBlock(nodeId) {
    try {
        const res = await fetch("/api/node/toggle-block", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ node_id: nodeId }),
        });
        const data = await res.json();
        state.graph = data.graph;
        AudioEngine.click();
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
        AudioEngine.fireAlert();
        updateStats();
        const s = data.summary;
        traversalLog.textContent = `Fire Step #${s.step}: +${s.new_fires.length} fires, +${s.new_smokes.length} smokes. Total fires: ${s.total_fires}. Intact exits: ${s.intact_exits}.`;
        logStepCount.textContent = `Step #${s.step}`;
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
        stopAutoSimulation();
        const res = await fetch("/api/simulation/reset", { method: "POST" });
        const data = await res.json();
        state.graph = data.graph;
        state.currentRoute = [];
        state.traversalOrder = [];
        state.lastResult = null;
        state.particles = [];
        updateStats();

        routeOutput.innerHTML = `<div class="empty-state">All hazards cleared. Floor plan restored.</div>`;
        if (directionsPanel) directionsPanel.style.display = "none";
        if (btnVoice) btnVoice.style.display = "none";
        if (btnStopVoice) btnStopVoice.style.display = "none";
        if (benchmarkCard) benchmarkCard.style.display = "none";
        if ('speechSynthesis' in window) window.speechSynthesis.cancel();
        traversalLog.textContent = "Hazards cleared. Floor plan restored to safe baseline.";
        logStepCount.textContent = "Safe Baseline";
        AudioEngine.click();
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

async function runBenchmarkComparison() {
    if (!state.startNodeId) {
        alert("Please select a starting room first!");
        return;
    }
    try {
        const res = await fetch("/api/plan/compare", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ start_node_id: state.startNodeId }),
        });
        const data = await res.json();
        AudioEngine.click();
        renderBenchmarkTable(data);
    } catch (err) {
        console.error(err);
    }
}

// -------------------------------------------------------------
// Auto-Simulation Engine
// -------------------------------------------------------------
function toggleAutoSimulation() {
    if (state.autoSimInterval) {
        stopAutoSimulation();
    } else {
        startAutoSimulation();
    }
}

function startAutoSimulation() {
    // If no fires yet, ignite a random room to get the fire moving
    const activeFires = state.graph.nodes.filter(n => n.state === "FIRE");
    if (activeFires.length === 0) {
        const nonExits = state.graph.nodes.filter(n => n.type !== "EXIT" && n.id !== state.startNodeId);
        if (nonExits.length > 0) {
            const pick = nonExits[Math.floor(Math.random() * nonExits.length)];
            toggleNodeFire(pick.id);
        }
    }

    state.autoSimInterval = setInterval(() => {
        stepFireSimulation();
    }, 1600);

    btnAutoSim.innerHTML = "⏸️ Pause Auto-Spread";
    btnAutoSim.classList.add("running");
}

function stopAutoSimulation() {
    if (state.autoSimInterval) {
        clearInterval(state.autoSimInterval);
        state.autoSimInterval = null;
    }
    btnAutoSim.innerHTML = "▶️ Start Auto-Fire Spread";
    btnAutoSim.classList.remove("running");
}

// -------------------------------------------------------------
// UI Updates & Statistics
// -------------------------------------------------------------
function updateStats() {
    if (!state.graph) return;
    const totalNodes = state.graph.nodes.length;
    const fires = state.graph.nodes.filter(n => n.state === "FIRE").length;
    const smokes = state.graph.nodes.filter(n => n.state === "SMOKE").length;
    const blocked = state.graph.nodes.filter(n => n.state === "BLOCKED").length;
    const exits = state.graph.nodes.filter(n => n.type === "EXIT" && n.is_passable).length;

    statFires.textContent = fires;
    statSmokes.textContent = smokes;
    statExits.textContent = exits;

    // Calculate Building Safety Integrity Score
    const hazardScore = (fires * 2.5) + (smokes * 1.0) + (blocked * 1.5);
    const integrity = Math.max(0, Math.min(100, Math.round(100 - (hazardScore / (totalNodes * 1.5)) * 100)));

    integrityPercent.textContent = `${integrity}%`;
    integrityBar.style.width = `${integrity}%`;

    if (integrity > 70) {
        integrityPercent.style.color = "#34d399";
        integrityBar.style.background = "linear-gradient(90deg, #10b981, #34d399)";
    } else if (integrity > 35) {
        integrityPercent.style.color = "#fbbf24";
        integrityBar.style.background = "linear-gradient(90deg, #f59e0b, #fbbf24)";
    } else {
        integrityPercent.style.color = "#f87171";
        integrityBar.style.background = "linear-gradient(90deg, #ef4444, #dc2626)";
    }
}

function displayRouteResult(result, algoName) {
    state.currentRoute = result.path || [];
    state.traversalOrder = result.explored_order || [];
    state.lastResult = result;
    initRouteParticles();

    if (result.success) {
        AudioEngine.routeFound();
        routeOutput.innerHTML = `
            <div class="route-success">
                <h4>🟢 Optimal Egress Path Computed</h4>
                <div class="route-stats">
                    <div class="route-stat-box">
                        <div class="val">${result.hops}</div>
                        <div class="lbl">Hops (Doors)</div>
                    </div>
                    <div class="route-stat-box">
                        <div class="val">${result.total_distance ?? "~"} m</div>
                        <div class="lbl">Total Distance</div>
                    </div>
                    <div class="route-stat-box">
                        <div class="val">~${result.estimated_time_sec ?? "~"}s</div>
                        <div class="lbl">Est. Egress Time</div>
                    </div>
                    <div class="route-stat-box">
                        <div class="val">${result.execution_time_us ?? 0} &mu;s</div>
                        <div class="lbl">Compute Speed</div>
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
        traversalLog.textContent = `[${algoName}] Visited (${result.nodes_visited_count || result.explored_order.length} nodes): ${result.explored_order.join(" ➔ ")}`;
        logStepCount.textContent = `${result.hops} Hops`;

        if (result.turn_directions && result.turn_directions.length > 0) {
            directionsPanel.style.display = "block";
            directionsList.innerHTML = result.turn_directions
                .map(step => `<li>${step}</li>`)
                .join("");
            if (btnVoice) btnVoice.style.display = "inline-block";
            if (btnStopVoice) btnStopVoice.style.display = "inline-block";
        }
    } else {
        AudioEngine.routeBlocked();
        routeOutput.innerHTML = `
            <div class="route-danger">
                <h4>⚠️ EVACUATION BLOCKED</h4>
                <p style="font-size:0.82rem; margin-top:0.4rem;">${result.message}</p>
            </div>
        `;
        traversalLog.textContent = `[${algoName}] Traversal stopped. Visited: ${result.explored_order.join(" ➔ ")}. No exit reachable!`;
        logStepCount.textContent = "Path Blocked";
        if (directionsPanel) directionsPanel.style.display = "none";
        if (btnVoice) btnVoice.style.display = "none";
        if (btnStopVoice) btnStopVoice.style.display = "none";
        if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    }

    draw();
}

function renderBenchmarkTable(data) {
    const bfs = data.bfs;
    const dfs = data.dfs;

    const bfsHops = bfs.success ? `${bfs.hops} hops` : "Blocked";
    const dfsHops = dfs.success ? `${dfs.hops} hops` : "Blocked";

    const bfsDist = bfs.success ? `${bfs.total_distance} m` : "N/A";
    const dfsDist = dfs.success ? `${dfs.total_distance} m` : "N/A";

    const bfsTime = `${bfs.execution_time_us} μs`;
    const dfsTime = `${dfs.execution_time_us} μs`;

    const bfsVisited = bfs.nodes_visited_count ?? bfs.explored_order.length;
    const dfsVisited = dfs.nodes_visited_count ?? dfs.explored_order.length;

    benchmarkBody.innerHTML = `
        <tr>
            <td><b>Shortest Route (Hops)</b></td>
            <td><b>${bfsHops}</b></td>
            <td>${dfsHops}</td>
            <td><span class="badge-win">BFS Guarantees Minimal Hops</span></td>
        </tr>
        <tr>
            <td><b>Total Egress Distance</b></td>
            <td><b>${bfsDist}</b></td>
            <td>${dfsDist}</td>
            <td>${bfs.total_distance <= dfs.total_distance ? '<span class="badge-win">BFS Shorter / Equal</span>' : '<span class="badge-sub">DFS Alternate</span>'}</td>
        </tr>
        <tr>
            <td><b>Execution Latency</b></td>
            <td>${bfsTime}</td>
            <td>${dfsTime}</td>
            <td><span class="badge-win">Sub-millisecond Real-Time</span></td>
        </tr>
        <tr>
            <td><b>Search Space Explored</b></td>
            <td>${bfsVisited} nodes</td>
            <td>${dfsVisited} nodes</td>
            <td>${bfsVisited <= dfsVisited ? 'BFS Level-wise' : 'DFS Branch Depth'}</td>
        </tr>
        <tr>
            <td><b>Algorithm Strategy</b></td>
            <td>Queue (FIFO) Level-by-level search</td>
            <td>Stack / Recursion Branch-deep search</td>
            <td><span class="badge-win">BFS Optimal for Building Evacuation</span></td>
        </tr>
    `;

    benchmarkCard.style.display = "block";
    traversalLog.textContent = `[Benchmark Complete] Analyzed path from ${data.start_room_name}: BFS (${bfsHops}) vs DFS (${dfsHops}).`;
}

// -------------------------------------------------------------
// Voice Speech Synthesis
// -------------------------------------------------------------
function speakEvacuationAlert() {
    if (!state.lastResult || !state.lastResult.turn_directions) return;
    if (!('speechSynthesis' in window)) {
        alert("Text-to-speech is not supported in this browser.");
        return;
    }
    window.speechSynthesis.cancel();

    const speechText = `Emergency Evacuation Alert. Proceed immediately. ` +
        state.lastResult.turn_directions.slice(0, 3).join(". ");

    const utterance = new SpeechSynthesisUtterance(speechText);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
}

function stopEvacuationAlert() {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
    }
}

// -------------------------------------------------------------
// Particle Animation System for Egress Route
// -------------------------------------------------------------
function initRouteParticles() {
    state.particles = [];
    if (!state.currentRoute || state.currentRoute.length < 2) return;

    for (let i = 0; i < 18; i++) {
        state.particles.push({
            progress: i / 18, // 0 to 1 along the path
            speed: 0.006 + Math.random() * 0.004,
            size: 3 + Math.random() * 2,
        });
    }
}

function getPointOnRoute(progress, nodeMap) {
    if (!state.currentRoute || state.currentRoute.length < 2) return null;
    const numSegments = state.currentRoute.length - 1;
    const scaledProg = progress * numSegments;
    const segIdx = Math.min(numSegments - 1, Math.floor(scaledProg));
    const segT = scaledProg - segIdx;

    const u = nodeMap[state.currentRoute[segIdx]];
    const v = nodeMap[state.currentRoute[segIdx + 1]];
    if (!u || !v) return null;

    return {
        x: u.x + (v.x - u.x) * segT,
        y: u.y + (v.y - u.y) * segT,
    };
}

// -------------------------------------------------------------
// Architectural CAD Canvas Visualizer
// -------------------------------------------------------------
function getNodeColor(node) {
    if (node.id === state.startNodeId) return "#8b5cf6"; // Purple Start
    if (node.state === "FIRE") return "#ef4444";        // Red Fire
    if (node.state === "SMOKE") return "#f59e0b";       // Amber Smoke
    if (node.state === "BLOCKED") return "#475569";     // Slate Blocked
    if (node.type === "EXIT") return "#10b981";         // Green Exit
    if (node.category === "Hazard" || node.risk_level) return "#ec4899"; // Pink Hazard Lab
    return "#38bdf8";                                   // Cyan Safe Room
}

function draw() {
    if (!state.graph) return;

    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Apply Zoom & Center Scale
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(state.zoomScale, state.zoomScale);
    ctx.translate(-canvas.width / 2 + 50, -canvas.height / 2 + 25);

    const timeSec = Date.now() / 1000;

    // 1. Draw Architectural Grid & CAD Crosshairs
    ctx.strokeStyle = "#131e33";
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width + 100; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height + 50);
        ctx.stroke();
    }
    for (let y = 0; y < canvas.height + 100; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width + 100, y);
        ctx.stroke();
    }

    const nodeMap = {};
    state.graph.nodes.forEach(n => { nodeMap[n.id] = n; });

    // 2. Draw Architectural Corridors (Double-lined walls with corridor floor)
    state.graph.edges.forEach(edge => {
        const u = nodeMap[edge.from];
        const v = nodeMap[edge.to];
        if (!u || !v) return;

        // Base Hallway Floor
        ctx.beginPath();
        ctx.moveTo(u.x, u.y);
        ctx.lineTo(v.x, v.y);

        if (edge.is_blocked) {
            ctx.strokeStyle = "rgba(239, 68, 68, 0.4)";
            ctx.lineWidth = 6;
            ctx.setLineDash([6, 6]);
            ctx.stroke();
            ctx.setLineDash([]);
        } else {
            // Thick Hallway casing
            ctx.strokeStyle = "#1c2a46";
            ctx.lineWidth = 14;
            ctx.stroke();

            // Inner walking aisle
            ctx.strokeStyle = "#0e182a";
            ctx.lineWidth = 8;
            ctx.stroke();
        }
    });

    // 3. Highlight Computed Evacuation Route with Glowing Wave
    if (state.currentRoute && state.currentRoute.length > 1) {
        ctx.save();
        ctx.strokeStyle = "#22c55e";
        ctx.lineWidth = 5;
        ctx.shadowColor = "#22c55e";
        ctx.shadowBlur = 14;
        ctx.setLineDash([10, 8]);
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

        // Draw Animated Egress Particles Flowing Along Path
        state.particles.forEach(p => {
            p.progress = (p.progress + p.speed) % 1.0;
            const pt = getPointOnRoute(p.progress, nodeMap);
            if (pt) {
                ctx.save();
                ctx.beginPath();
                ctx.arc(pt.x, pt.y, p.size, 0, Math.PI * 2);
                ctx.fillStyle = "#86efac";
                ctx.shadowColor = "#4ade80";
                ctx.shadowBlur = 10;
                ctx.fill();
                ctx.restore();
            }
        });
    }

    // 4. Draw Floor Plan Nodes (Rooms, Corridors, Exits)
    state.graph.nodes.forEach(node => {
        const isStart = node.id === state.startNodeId;
        const radius = node.type === "CORRIDOR" ? 15 : 23;

        // Dynamic Glow / Flame Pulse
        if (node.state === "FIRE") {
            const flamePulse = 14 + Math.sin(timeSec * 8 + node.x) * 6;
            ctx.shadowColor = "#ef4444";
            ctx.shadowBlur = flamePulse;

            // Outer heat dispersion wave
            ctx.beginPath();
            ctx.arc(node.x, node.y, radius + 8 + Math.sin(timeSec * 4) * 4, 0, Math.PI * 2);
            ctx.strokeStyle = "rgba(239, 68, 68, 0.25)";
            ctx.lineWidth = 2;
            ctx.stroke();
        } else if (node.state === "SMOKE") {
            ctx.shadowColor = "#f59e0b";
            ctx.shadowBlur = 12;
            // Smoke cloud ring
            ctx.beginPath();
            ctx.arc(node.x, node.y, radius + 5, 0, Math.PI * 2);
            ctx.strokeStyle = "rgba(245, 158, 11, 0.3)";
            ctx.lineWidth = 2;
            ctx.stroke();
        } else if (node.type === "EXIT") {
            const exitPulse = 10 + Math.sin(timeSec * 3) * 4;
            ctx.shadowColor = "#10b981";
            ctx.shadowBlur = exitPulse;

            // Beacon rings around exits
            ctx.beginPath();
            ctx.arc(node.x, node.y, radius + 6, 0, Math.PI * 2);
            ctx.strokeStyle = "rgba(16, 185, 129, 0.4)";
            ctx.lineWidth = 1.5;
            ctx.stroke();
        } else if (isStart) {
            ctx.shadowColor = "#8b5cf6";
            ctx.shadowBlur = 16;
            // Animated beacon ring on start
            ctx.beginPath();
            ctx.arc(node.x, node.y, radius + 7 + Math.sin(timeSec * 5) * 3, 0, Math.PI * 2);
            ctx.strokeStyle = "#c084fc";
            ctx.lineWidth = 2;
            ctx.stroke();
        } else {
            ctx.shadowBlur = 0;
        }

        // Base circle / Hub
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = getNodeColor(node);
        ctx.fill();

        ctx.lineWidth = isStart ? 3 : 2;
        ctx.strokeStyle = isStart ? "#ffffff" : "#0d1527";
        ctx.stroke();
        ctx.shadowBlur = 0; // Reset blur

        // Interior Label / Icon
        ctx.fillStyle = "#ffffff";
        ctx.font = node.type === "CORRIDOR" ? "bold 10px Plus Jakarta Sans" : "bold 11px Plus Jakarta Sans";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        let label = node.id;
        if (node.state === "FIRE") label = "🔥";
        else if (node.state === "SMOKE") label = "💨";
        else if (node.state === "BLOCKED") label = "⛔";
        else if (node.type === "EXIT") label = "🚪";
        else if (isStart) label = "🏃";

        ctx.fillText(label, node.x, node.y);

        // Room Name Caption
        ctx.fillStyle = "#cbd5e1";
        ctx.font = "600 10px Plus Jakarta Sans";
        ctx.fillText(node.name, node.x, node.y + radius + 13);
    });

    // 5. Draw Glassmorphism Hover Tooltip
    if (state.hoveredNode) {
        const n = state.hoveredNode;
        const text = `${n.name} • ${n.state} ${n.smoke_level > 0 ? `(${Math.round(n.smoke_level*100)}% Smoke)` : ""}`;
        ctx.font = "600 11px Plus Jakarta Sans";
        const metrics = ctx.measureText(text);
        const padX = 10;
        const padY = 5;
        const bx = Math.min(n.x - 20, canvas.width - metrics.width - 40);
        const by = n.y - 42;

        ctx.fillStyle = "rgba(7, 13, 27, 0.92)";
        ctx.strokeStyle = "#38bdf8";
        ctx.lineWidth = 1;

        ctx.fillRect(bx, by, metrics.width + padX * 2, 24);
        ctx.strokeRect(bx, by, metrics.width + padX * 2, 24);

        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(text, bx + padX, by + 12);
    }

    ctx.restore();
}

function animate() {
    state.animationOffset = (state.animationOffset + 0.6) % 36;
    draw();
    state.animFrameId = requestAnimationFrame(animate);
}

// -------------------------------------------------------------
// Interactive Coordinate Mapping & Canvas Events
// -------------------------------------------------------------
function getCanvasCoords(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const rawX = clientX - rect.left;
    const rawY = clientY - rect.top;

    // Transform raw client coordinates back through canvas translation & zoom scale
    const worldX = (rawX - canvas.width / 2) / state.zoomScale + canvas.width / 2 - 50;
    const worldY = (rawY - canvas.height / 2) / state.zoomScale + canvas.height / 2 - 25;

    return { x: worldX, y: worldY };
}

function findNodeAt(x, y) {
    if (!state.graph) return null;
    return state.graph.nodes.find(n => {
        const radius = n.type === "CORRIDOR" ? 20 : 28;
        return Math.hypot(n.x - x, n.y - y) <= radius;
    });
}

canvas.addEventListener("click", e => {
    const coords = getCanvasCoords(e.clientX, e.clientY);
    const clickedNode = findNodeAt(coords.x, coords.y);

    if (!clickedNode) return;

    if (state.activeTool === "start") {
        state.startNodeId = clickedNode.id;
        traversalLog.textContent = `Selected evacuation starting location: ${clickedNode.name} (${clickedNode.id})`;
        logStepCount.textContent = "Start Point Set";
        AudioEngine.click();
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
    const coords = getCanvasCoords(e.clientX, e.clientY);
    const node = findNodeAt(coords.x, coords.y);

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

// -------------------------------------------------------------
// Toolbar, Zoom & Audio Controls
// -------------------------------------------------------------
document.querySelectorAll(".tool-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        document.querySelectorAll(".tool-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        state.activeTool = btn.dataset.tool;
        toolHint.textContent = toolHints[state.activeTool];
        AudioEngine.click();
    });
});

presetSelector.addEventListener("change", e => {
    switchPreset(e.target.value);
});

// Canvas Zoom Controls
document.getElementById("btn-zoom-in").addEventListener("click", () => {
    state.zoomScale = Math.min(1.6, state.zoomScale + 0.15);
    AudioEngine.click();
});
document.getElementById("btn-zoom-out").addEventListener("click", () => {
    state.zoomScale = Math.max(0.7, state.zoomScale - 0.15);
    AudioEngine.click();
});
document.getElementById("btn-zoom-reset").addEventListener("click", () => {
    state.zoomScale = 1.0;
    AudioEngine.click();
});

// Sound FX Toggle
btnSoundToggle.addEventListener("click", () => {
    state.soundEnabled = !state.soundEnabled;
    soundIcon.textContent = state.soundEnabled ? "🔊" : "🔇";
    soundStatus.textContent = state.soundEnabled ? "ON" : "OFF";
    if (state.soundEnabled) AudioEngine.click();
});

document.getElementById("btn-bfs").addEventListener("click", runBFS);
document.getElementById("btn-dfs").addEventListener("click", runDFS);
document.getElementById("btn-step-fire").addEventListener("click", stepFireSimulation);
document.getElementById("btn-reset").addEventListener("click", resetSimulation);
document.getElementById("btn-compare").addEventListener("click", runBenchmarkComparison);
btnAutoSim.addEventListener("click", toggleAutoSimulation);

btnVoice.addEventListener("click", speakEvacuationAlert);
if (btnStopVoice) btnStopVoice.addEventListener("click", stopEvacuationAlert);
document.getElementById("btn-close-benchmark").addEventListener("click", () => {
    benchmarkCard.style.display = "none";
});

// Start app
fetchBuilding().then(() => {
    animate();
});
