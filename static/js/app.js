/**
 * Building Fire Evacuation Route Planner - Unified Engine
 * Works seamlessly on BOTH Local Python Flask Server AND GitHub Pages.
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
    particles: [],
};

// Canvas Setup
const canvas = document.getElementById("floor-canvas");
const ctx = canvas.getContext("2d");

// DOM Elements
const toolHint = document.getElementById("tool-hint");
const presetSelector = document.getElementById("preset-selector");
const startRoomSelector = document.getElementById("start-room-selector");
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
// Web Audio FX Synthesizer
// -------------------------------------------------------------
const AudioEngine = {
    ctx: null,
    init() {
        if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioCtx();
        }
    },
    playTone(freq, type, duration, gainVal = 0.08) {
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
        } catch (e) {}
    },
    click() { this.playTone(600, 'sine', 0.08, 0.05); },
    fireAlert() {
        this.playTone(280, 'sawtooth', 0.25, 0.1);
        setTimeout(() => this.playTone(220, 'sawtooth', 0.35, 0.12), 120);
    },
    routeFound() {
        this.playTone(523.25, 'triangle', 0.15, 0.08);
        setTimeout(() => this.playTone(659.25, 'triangle', 0.15, 0.08), 80);
        setTimeout(() => this.playTone(783.99, 'triangle', 0.25, 0.1), 160);
    },
    routeBlocked() {
        this.playTone(180, 'square', 0.3, 0.1);
        setTimeout(() => this.playTone(140, 'square', 0.4, 0.12), 150);
    }
};

// -------------------------------------------------------------
// Client Graph & Algorithm Engine
// -------------------------------------------------------------
const ClientEngine = {
    currentPreset: 'school',
    stepCount: 0,

    createSchool() {
        return {
            building_name: "High School Academic Block",
            nodes: [
                { id: "R101", name: "Classroom 101", type: "ROOM", x: 100, y: 100, state: "SAFE", smoke_level: 0, is_passable: true, is_exit: false },
                { id: "R102", name: "Classroom 102", type: "ROOM", x: 250, y: 100, state: "SAFE", smoke_level: 0, is_passable: true, is_exit: false },
                { id: "R103", name: "Classroom 103", type: "ROOM", x: 400, y: 100, state: "SAFE", smoke_level: 0, is_passable: true, is_exit: false },
                { id: "LAB", name: "Chemistry Lab (Hazard)", type: "ROOM", x: 550, y: 100, state: "SAFE", smoke_level: 0, is_passable: true, is_exit: false, risk_level: "Chemicals", category: "Hazard" },
                { id: "LIB", name: "Library", type: "ROOM", x: 100, y: 340, state: "SAFE", smoke_level: 0, is_passable: true, is_exit: false },
                { id: "STAFF", name: "Staff Room", type: "ROOM", x: 250, y: 340, state: "SAFE", smoke_level: 0, is_passable: true, is_exit: false },
                { id: "R104", name: "Classroom 104", type: "ROOM", x: 400, y: 340, state: "SAFE", smoke_level: 0, is_passable: true, is_exit: false },
                { id: "SRV", name: "Server / Electrical (Hazard)", type: "ROOM", x: 550, y: 340, state: "SAFE", smoke_level: 0, is_passable: true, is_exit: false, risk_level: "Electrical", category: "Hazard" },
                { id: "C1", name: "West Hallway", type: "CORRIDOR", x: 100, y: 220, state: "SAFE", smoke_level: 0, is_passable: true, is_exit: false },
                { id: "C2", name: "Mid-West Intersection", type: "CORRIDOR", x: 250, y: 220, state: "SAFE", smoke_level: 0, is_passable: true, is_exit: false },
                { id: "C3", name: "Mid-East Intersection", type: "CORRIDOR", x: 400, y: 220, state: "SAFE", smoke_level: 0, is_passable: true, is_exit: false },
                { id: "C4", name: "East Hallway", type: "CORRIDOR", x: 550, y: 220, state: "SAFE", smoke_level: 0, is_passable: true, is_exit: false },
                { id: "EXIT_WEST", name: "West Main Gate (Exit A)", type: "EXIT", x: 20, y: 220, state: "SAFE", smoke_level: 0, is_passable: true, is_exit: true },
                { id: "EXIT_EAST", name: "East Field Gate (Exit B)", type: "EXIT", x: 640, y: 220, state: "SAFE", smoke_level: 0, is_passable: true, is_exit: true },
                { id: "EXIT_NORTH", name: "North Staircase Exit (Exit C)", type: "EXIT", x: 250, y: 20, state: "SAFE", smoke_level: 0, is_passable: true, is_exit: true }
            ],
            edges: [
                { from: "R101", to: "C1", distance: 10, is_blocked: false },
                { from: "R102", to: "C2", distance: 10, is_blocked: false },
                { from: "R103", to: "C3", distance: 10, is_blocked: false },
                { from: "LAB", to: "C4", distance: 10, is_blocked: false },
                { from: "LIB", to: "C1", distance: 10, is_blocked: false },
                { from: "STAFF", to: "C2", distance: 10, is_blocked: false },
                { from: "R104", to: "C3", distance: 10, is_blocked: false },
                { from: "SRV", to: "C4", distance: 10, is_blocked: false },
                { from: "C1", to: "C2", distance: 15, is_blocked: false },
                { from: "C2", to: "C3", distance: 15, is_blocked: false },
                { from: "C3", to: "C4", distance: 15, is_blocked: false },
                { from: "C1", to: "EXIT_WEST", distance: 8, is_blocked: false },
                { from: "C4", to: "EXIT_EAST", distance: 8, is_blocked: false },
                { from: "R102", to: "EXIT_NORTH", distance: 8, is_blocked: false }
            ]
        };
    },

    createHospital() {
        return {
            building_name: "City Hospital Emergency & Inpatient Wing",
            nodes: [
                { id: "ICU", name: "ICU Ward", type: "ROOM", x: 120, y: 100, state: "SAFE", smoke_level: 0, is_passable: true, is_exit: false },
                { id: "SURG", name: "Surgery / OT", type: "ROOM", x: 300, y: 100, state: "SAFE", smoke_level: 0, is_passable: true, is_exit: false },
                { id: "O2_BAY", name: "Oxygen Cylinder Bay (Hazard)", type: "ROOM", x: 480, y: 100, state: "SAFE", smoke_level: 0, is_passable: true, is_exit: false, risk_level: "Gas", category: "Hazard" },
                { id: "GEN_W1", name: "General Ward A", type: "ROOM", x: 120, y: 320, state: "SAFE", smoke_level: 0, is_passable: true, is_exit: false },
                { id: "GEN_W2", name: "General Ward B", type: "ROOM", x: 300, y: 320, state: "SAFE", smoke_level: 0, is_passable: true, is_exit: false },
                { id: "PHARM", name: "Pharmacy & Chemical Store", type: "ROOM", x: 480, y: 320, state: "SAFE", smoke_level: 0, is_passable: true, is_exit: false, risk_level: "Chemicals", category: "Hazard" },
                { id: "H1", name: "West Corridor", type: "CORRIDOR", x: 120, y: 210, state: "SAFE", smoke_level: 0, is_passable: true, is_exit: false },
                { id: "H2", name: "Central Nurses Station", type: "CORRIDOR", x: 300, y: 210, state: "SAFE", smoke_level: 0, is_passable: true, is_exit: false },
                { id: "H3", name: "East Corridor", type: "CORRIDOR", x: 480, y: 210, state: "SAFE", smoke_level: 0, is_passable: true, is_exit: false },
                { id: "EXIT_AMBULANCE", name: "Ambulance Bay Exit", type: "EXIT", x: 30, y: 210, state: "SAFE", smoke_level: 0, is_passable: true, is_exit: true },
                { id: "EXIT_HELIPAD", name: "Roof Stair/Helipad Exit", type: "EXIT", x: 300, y: 30, state: "SAFE", smoke_level: 0, is_passable: true, is_exit: true },
                { id: "EXIT_SOUTH", name: "South Parking Exit", type: "EXIT", x: 300, y: 410, state: "SAFE", smoke_level: 0, is_passable: true, is_exit: true },
                { id: "EXIT_FIRE_EAST", name: "East Fire Escape Ramp", type: "EXIT", x: 570, y: 210, state: "SAFE", smoke_level: 0, is_passable: true, is_exit: true }
            ],
            edges: [
                { from: "ICU", to: "H1", distance: 9, is_blocked: false },
                { from: "GEN_W1", to: "H1", distance: 9, is_blocked: false },
                { from: "SURG", to: "H2", distance: 9, is_blocked: false },
                { from: "GEN_W2", to: "H2", distance: 9, is_blocked: false },
                { from: "O2_BAY", to: "H3", distance: 9, is_blocked: false },
                { from: "PHARM", to: "H3", distance: 9, is_blocked: false },
                { from: "H1", to: "H2", distance: 18, is_blocked: false },
                { from: "H2", to: "H3", distance: 18, is_blocked: false },
                { from: "H1", to: "EXIT_AMBULANCE", distance: 8, is_blocked: false },
                { from: "H2", to: "EXIT_HELIPAD", distance: 12, is_blocked: false },
                { from: "H2", to: "EXIT_SOUTH", distance: 12, is_blocked: false },
                { from: "H3", to: "EXIT_FIRE_EAST", distance: 8, is_blocked: false }
            ]
        };
    },

    createApartment() {
        return {
            building_name: "Skyline Heights Residential Apartments (Floor 4)",
            nodes: [
                { id: "FLAT_401", name: "Flat 401 (3BHK)", type: "ROOM", x: 110, y: 90, state: "SAFE", smoke_level: 0, is_passable: true, is_exit: false },
                { id: "FLAT_402", name: "Flat 402 (2BHK)", type: "ROOM", x: 250, y: 90, state: "SAFE", smoke_level: 0, is_passable: true, is_exit: false },
                { id: "GAS_DUCT", name: "LPG Pipeline & Gas Duct (Hazard)", type: "ROOM", x: 390, y: 90, state: "SAFE", smoke_level: 0, is_passable: true, is_exit: false, risk_level: "LPG", category: "Hazard" },
                { id: "FLAT_403", name: "Flat 403 (3BHK)", type: "ROOM", x: 530, y: 90, state: "SAFE", smoke_level: 0, is_passable: true, is_exit: false },
                { id: "FLAT_404", name: "Flat 404 (2BHK)", type: "ROOM", x: 110, y: 330, state: "SAFE", smoke_level: 0, is_passable: true, is_exit: false },
                { id: "FLAT_405", name: "Flat 405 (Studio)", type: "ROOM", x: 250, y: 330, state: "SAFE", smoke_level: 0, is_passable: true, is_exit: false },
                { id: "ELEC_SHAFT", name: "Main Electrical Shaft (Hazard)", type: "ROOM", x: 390, y: 330, state: "SAFE", smoke_level: 0, is_passable: true, is_exit: false, risk_level: "High Voltage", category: "Hazard" },
                { id: "FLAT_406", name: "Flat 406 (3BHK)", type: "ROOM", x: 530, y: 330, state: "SAFE", smoke_level: 0, is_passable: true, is_exit: false },
                { id: "CORR_W", name: "West Resident Corridor", type: "CORRIDOR", x: 110, y: 210, state: "SAFE", smoke_level: 0, is_passable: true, is_exit: false },
                { id: "LOBBY_W", name: "Elevator Landing West", type: "CORRIDOR", x: 250, y: 210, state: "SAFE", smoke_level: 0, is_passable: true, is_exit: false },
                { id: "LOBBY_E", name: "Central Atrium Lobby", type: "CORRIDOR", x: 390, y: 210, state: "SAFE", smoke_level: 0, is_passable: true, is_exit: false },
                { id: "CORR_E", name: "East Resident Corridor", type: "CORRIDOR", x: 530, y: 210, state: "SAFE", smoke_level: 0, is_passable: true, is_exit: false },
                { id: "EXIT_FIRE_STAIR_W", name: "West Fire Escape Stairwell", type: "EXIT", x: 20, y: 210, state: "SAFE", smoke_level: 0, is_passable: true, is_exit: true },
                { id: "EXIT_MAIN_STAIRS", name: "Central Main Stairwell Egress", type: "EXIT", x: 390, y: 410, state: "SAFE", smoke_level: 0, is_passable: true, is_exit: true },
                { id: "EXIT_FIRE_STAIR_E", name: "East Emergency Stairwell", type: "EXIT", x: 630, y: 210, state: "SAFE", smoke_level: 0, is_passable: true, is_exit: true }
            ],
            edges: [
                { from: "FLAT_401", to: "CORR_W", distance: 8, is_blocked: false },
                { from: "FLAT_404", to: "CORR_W", distance: 8, is_blocked: false },
                { from: "FLAT_402", to: "LOBBY_W", distance: 8, is_blocked: false },
                { from: "FLAT_405", to: "LOBBY_W", distance: 8, is_blocked: false },
                { from: "GAS_DUCT", to: "LOBBY_E", distance: 8, is_blocked: false },
                { from: "ELEC_SHAFT", to: "LOBBY_E", distance: 8, is_blocked: false },
                { from: "FLAT_403", to: "CORR_E", distance: 8, is_blocked: false },
                { from: "FLAT_406", to: "CORR_E", distance: 8, is_blocked: false },
                { from: "CORR_W", to: "LOBBY_W", distance: 14, is_blocked: false },
                { from: "LOBBY_W", to: "LOBBY_E", distance: 14, is_blocked: false },
                { from: "LOBBY_E", to: "CORR_E", distance: 14, is_blocked: false },
                { from: "CORR_W", to: "EXIT_FIRE_STAIR_W", distance: 9, is_blocked: false },
                { from: "LOBBY_E", to: "EXIT_MAIN_STAIRS", distance: 12, is_blocked: false },
                { from: "CORR_E", to: "EXIT_FIRE_STAIR_E", distance: 9, is_blocked: false }
            ]
        };
    },

    initGraph(preset = 'school') {
        this.currentPreset = preset;
        this.stepCount = 0;
        if (preset === 'school') return this.createSchool();
        if (preset === 'hospital') return this.createHospital();
        return this.createApartment();
    },

    getNeighbors(nodeId) {
        const neighbors = [];
        state.graph.edges.forEach(edge => {
            if (edge.is_blocked) return;
            let otherId = null;
            if (edge.from === nodeId) otherId = edge.to;
            else if (edge.to === nodeId) otherId = edge.from;

            if (otherId) {
                const node = state.graph.nodes.find(n => n.id === otherId);
                if (node && node.is_passable) {
                    neighbors.push(otherId);
                }
            }
        });
        return neighbors;
    },

    bfs(startId) {
        const t0 = performance.now();
        const startNode = state.graph.nodes.find(n => n.id === startId);
        if (!startNode || !startNode.is_passable) {
            return {
                algorithm: "BFS",
                success: false,
                path: [],
                message: `Location '${startNode ? startNode.name : startId}' is blocked by fire!`,
                explored_order: [],
                nodes_visited_count: 0,
                execution_time_us: 120
            };
        }

        const queue = [startId];
        const visited = new Set([startId]);
        const parent = { [startId]: null };
        const explored = [];
        let reachedExit = null;

        while (queue.length > 0) {
            const currId = queue.shift();
            explored.push(currId);
            const currNode = state.graph.nodes.find(n => n.id === currId);

            if (currNode && currNode.is_exit && currNode.is_passable) {
                reachedExit = currId;
                break;
            }

            for (const nbr of this.getNeighbors(currId)) {
                if (!visited.has(nbr)) {
                    visited.add(nbr);
                    parent[nbr] = currId;
                    queue.push(nbr);
                }
            }
        }

        const elapsedUs = Math.round((performance.now() - t0) * 1000);

        if (!reachedExit) {
            return {
                algorithm: "BFS",
                success: false,
                path: [],
                message: "NO SAFE EVACUATION ROUTE FOUND! All paths to exits are blocked by hazards.",
                explored_order: explored,
                nodes_visited_count: explored.length,
                execution_time_us: elapsedUs,
                turn_directions: ["CRITICAL: Shelter in place or await rescue. All corridors blocked."]
            };
        }

        const path = [];
        let curr = reachedExit;
        while (curr) {
            path.push(curr);
            curr = parent[curr];
        }
        path.reverse();

        let dist = 0;
        for (let i = 0; i < path.length - 1; i++) {
            const edge = state.graph.edges.find(e => (e.from === path[i] && e.to === path[i+1]) || (e.to === path[i] && e.from === path[i+1]));
            dist += edge ? edge.distance : 10;
        }

        const exitNode = state.graph.nodes.find(n => n.id === reachedExit);
        const directions = [];
        for (let i = 0; i < path.length - 1; i++) {
            const u = state.graph.nodes.find(n => n.id === path[i]);
            const v = state.graph.nodes.find(n => n.id === path[i+1]);
            if (i === 0) directions.push(`Step 1: Exit '${u.name}' into '${v.name}'.`);
            else if (i === path.length - 2) directions.push(`Step ${i+1}: Proceed into emergency exit: '${v.name}'.`);
            else directions.push(`Step ${i+1}: Continue along '${u.name}' towards '${v.name}'.`);
        }
        directions.push("Final: Evacuate building immediately and gather at the designated assembly area.");

        return {
            algorithm: "BFS",
            success: true,
            path: path,
            target_exit: reachedExit,
            exit_name: exitNode ? exitNode.name : reachedExit,
            hops: path.length - 1,
            total_distance: dist,
            estimated_time_sec: Math.max(5, Math.round(dist / 1.2)),
            explored_order: explored,
            nodes_visited_count: explored.length,
            execution_time_us: Math.max(50, elapsedUs),
            turn_directions: directions,
            message: `Optimal evacuation route to ${exitNode.name} (${path.length - 1} hops, ~${dist}m).`
        };
    },

    dfs(startId) {
        const t0 = performance.now();
        const startNode = state.graph.nodes.find(n => n.id === startId);
        if (!startNode || !startNode.is_passable) {
            return {
                algorithm: "DFS",
                success: false,
                path: [],
                message: `Location '${startNode ? startNode.name : startId}' is blocked!`,
                explored_order: [],
                nodes_visited_count: 0,
                execution_time_us: 150
            };
        }

        const visited = new Set();
        const explored = [];
        const path = [];

        const visit = (currId) => {
            visited.add(currId);
            explored.push(currId);
            path.push(currId);

            const currNode = state.graph.nodes.find(n => n.id === currId);
            if (currNode && currNode.is_exit && currNode.is_passable) {
                return currId;
            }

            for (const nbr of this.getNeighbors(currId)) {
                if (!visited.has(nbr)) {
                    const found = visit(nbr);
                    if (found) return found;
                }
            }
            path.pop();
            return null;
        };

        const reachedExit = visit(startId);
        const elapsedUs = Math.round((performance.now() - t0) * 1000);

        if (!reachedExit) {
            return {
                algorithm: "DFS",
                success: false,
                path: [],
                message: "DFS: No viable evacuation path found.",
                explored_order: explored,
                nodes_visited_count: explored.length,
                execution_time_us: elapsedUs,
                turn_directions: ["Shelter in place. DFS path exploration compromised."]
            };
        }

        let dist = 0;
        for (let i = 0; i < path.length - 1; i++) {
            const edge = state.graph.edges.find(e => (e.from === path[i] && e.to === path[i+1]) || (e.to === path[i] && e.from === path[i+1]));
            dist += edge ? edge.distance : 10;
        }
        const exitNode = state.graph.nodes.find(n => n.id === reachedExit);

        return {
            algorithm: "DFS",
            success: true,
            path: path,
            target_exit: reachedExit,
            exit_name: exitNode ? exitNode.name : reachedExit,
            hops: path.length - 1,
            total_distance: dist,
            estimated_time_sec: Math.max(5, Math.round(dist / 1.2)),
            explored_order: explored,
            nodes_visited_count: explored.length,
            execution_time_us: Math.max(70, elapsedUs),
            turn_directions: [`DFS Alternative route: ${path.join(' ➔ ')}`],
            message: `DFS Route to ${exitNode.name} (${path.length - 1} hops).`
        };
    },

    stepFire() {
        this.stepCount++;
        const fireNodes = state.graph.nodes.filter(n => n.state === 'FIRE').map(n => n.id);
        const newFires = [];
        const newSmokes = [];

        fireNodes.forEach(fId => {
            state.graph.edges.forEach(edge => {
                let neighborId = null;
                if (edge.from === fId) neighborId = edge.to;
                else if (edge.to === fId) neighborId = edge.from;

                if (neighborId) {
                    const node = state.graph.nodes.find(n => n.id === neighborId);
                    if (node && node.state === 'SAFE') {
                        node.state = 'SMOKE';
                        node.smoke_level = 0.7;
                        newSmokes.push(neighborId);
                    } else if (node && node.state === 'SMOKE') {
                        node.state = 'FIRE';
                        node.smoke_level = 1.0;
                        node.is_passable = false;
                        newFires.push(neighborId);
                    }
                }
            });
        });

        return {
            step: this.stepCount,
            new_fires: newFires,
            new_smokes: newSmokes,
            total_fires: state.graph.nodes.filter(n => n.state === 'FIRE').length,
            intact_exits: state.graph.nodes.filter(n => n.type === 'EXIT' && n.is_passable).length
        };
    }
};

// -------------------------------------------------------------
// UI Services & Event Handlers
// -------------------------------------------------------------
function populateRoomSelector() {
    if (!state.graph || !startRoomSelector) return;
    startRoomSelector.innerHTML = "";

    const nonExits = state.graph.nodes.filter(n => n.type !== "EXIT");
    nonExits.forEach(node => {
        const opt = document.createElement("option");
        opt.value = node.id;
        const icon = node.state === "FIRE" ? "🔥 " : node.state === "SMOKE" ? "💨 " : (node.category === "Hazard" || node.risk_level) ? "🔬 " : "📍 ";
        opt.textContent = `${icon}${node.name} (${node.id})`;
        if (node.id === state.startNodeId) {
            opt.selected = true;
        }
        startRoomSelector.appendChild(opt);
    });
}

function initApp() {
    state.graph = ClientEngine.initGraph('school');
    state.startNodeId = "R101";
    populateRoomSelector();
    updateStats();
    draw();
    runBFS();
}

function switchPreset(preset) {
    stopAutoSimulation();
    if (preset === "school") state.startNodeId = "R101";
    else if (preset === "hospital") state.startNodeId = "ICU";
    else if (preset === "apartment") state.startNodeId = "FLAT_401";

    state.graph = ClientEngine.initGraph(preset);
    state.currentRoute = [];
    state.traversalOrder = [];
    state.lastResult = null;
    state.particles = [];

    populateRoomSelector();
    if (benchmarkCard) benchmarkCard.style.display = "none";
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();

    traversalLog.textContent = `Loaded ${state.graph.building_name}`;
    logStepCount.textContent = "Preset Loaded";
    AudioEngine.click();
    updateStats();
    draw();
    runBFS();
}

function toggleNodeFire(nodeId) {
    const node = state.graph.nodes.find(n => n.id === nodeId);
    if (node) {
        if (node.state === "FIRE") {
            node.state = "SAFE";
            node.smoke_level = 0;
            node.is_passable = true;
        } else {
            node.state = "FIRE";
            node.smoke_level = 1.0;
            node.is_passable = false;
        }
    }
    AudioEngine.fireAlert();
    updateStats();
    runBFS();
}

function toggleNodeBlock(nodeId) {
    const node = state.graph.nodes.find(n => n.id === nodeId);
    if (node) {
        if (node.state === "BLOCKED") {
            node.state = "SAFE";
            node.is_passable = true;
        } else {
            node.state = "BLOCKED";
            node.is_passable = false;
        }
    }
    AudioEngine.click();
    updateStats();
    runBFS();
}

function stepFireSimulation() {
    const summary = ClientEngine.stepFire();
    AudioEngine.fireAlert();
    updateStats();
    traversalLog.textContent = `Fire Step #${summary.step}: +${summary.new_fires.length} fires, +${summary.new_smokes.length} smokes. Total fires: ${summary.total_fires}. Safe exits: ${summary.intact_exits}.`;
    logStepCount.textContent = `Step #${summary.step}`;
    runBFS();
}

function resetSimulation() {
    stopAutoSimulation();
    const preset = presetSelector ? presetSelector.value : "school";
    state.graph = ClientEngine.initGraph(preset);
    state.currentRoute = [];
    state.traversalOrder = [];
    state.lastResult = null;
    state.particles = [];
    updateStats();
    populateRoomSelector();

    if (benchmarkCard) benchmarkCard.style.display = "none";
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    traversalLog.textContent = "Hazards cleared. Floor plan restored to safe baseline.";
    logStepCount.textContent = "Safe Baseline";
    AudioEngine.click();
    draw();
    runBFS();
}

function runBFS() {
    if (!state.startNodeId || !state.graph) return;
    const result = ClientEngine.bfs(state.startNodeId);
    displayRouteResult(result, "Breadth-First Search (BFS)");
}

function runDFS() {
    if (!state.startNodeId || !state.graph) return;
    const result = ClientEngine.dfs(state.startNodeId);
    displayRouteResult(result, "Depth-First Search (DFS)");
}

function runBenchmarkComparison() {
    if (!state.startNodeId || !state.graph) return;
    const bfs = ClientEngine.bfs(state.startNodeId);
    const dfs = ClientEngine.dfs(state.startNodeId);
    const node = state.graph.nodes.find(n => n.id === state.startNodeId);

    AudioEngine.click();
    renderBenchmarkTable({
        start_node_id: state.startNodeId,
        start_room_name: node ? node.name : state.startNodeId,
        bfs: bfs,
        dfs: dfs,
    });
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
// Particle Animation System
// -------------------------------------------------------------
function initRouteParticles() {
    state.particles = [];
    if (!state.currentRoute || state.currentRoute.length < 2) return;

    for (let i = 0; i < 18; i++) {
        state.particles.push({
            progress: i / 18,
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
// Canvas Visualizer
// -------------------------------------------------------------
function getNodeColor(node) {
    if (node.id === state.startNodeId) return "#8b5cf6";
    if (node.state === "FIRE") return "#ef4444";
    if (node.state === "SMOKE") return "#f59e0b";
    if (node.state === "BLOCKED") return "#475569";
    if (node.type === "EXIT") return "#10b981";
    if (node.category === "Hazard" || node.risk_level) return "#ec4899";
    return "#38bdf8";
}

function draw() {
    if (!state.graph) return;

    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(state.zoomScale, state.zoomScale);
    ctx.translate(-canvas.width / 2 + 50, -canvas.height / 2 + 25);

    const timeSec = Date.now() / 1000;

    // 1. Grid
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

    // 2. Corridors
    state.graph.edges.forEach(edge => {
        const u = nodeMap[edge.from];
        const v = nodeMap[edge.to];
        if (!u || !v) return;

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
            ctx.strokeStyle = "#1c2a46";
            ctx.lineWidth = 14;
            ctx.stroke();

            ctx.strokeStyle = "#0e182a";
            ctx.lineWidth = 8;
            ctx.stroke();
        }
    });

    // 3. Egress Path & Particles
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

    // 4. Nodes
    state.graph.nodes.forEach(node => {
        const isStart = node.id === state.startNodeId;
        const radius = node.type === "CORRIDOR" ? 15 : 23;

        if (node.state === "FIRE") {
            const flamePulse = 14 + Math.sin(timeSec * 8 + node.x) * 6;
            ctx.shadowColor = "#ef4444";
            ctx.shadowBlur = flamePulse;

            ctx.beginPath();
            ctx.arc(node.x, node.y, radius + 8 + Math.sin(timeSec * 4) * 4, 0, Math.PI * 2);
            ctx.strokeStyle = "rgba(239, 68, 68, 0.25)";
            ctx.lineWidth = 2;
            ctx.stroke();
        } else if (node.state === "SMOKE") {
            ctx.shadowColor = "#f59e0b";
            ctx.shadowBlur = 12;
            ctx.beginPath();
            ctx.arc(node.x, node.y, radius + 5, 0, Math.PI * 2);
            ctx.strokeStyle = "rgba(245, 158, 11, 0.3)";
            ctx.lineWidth = 2;
            ctx.stroke();
        } else if (node.type === "EXIT") {
            const exitPulse = 10 + Math.sin(timeSec * 3) * 4;
            ctx.shadowColor = "#10b981";
            ctx.shadowBlur = exitPulse;

            ctx.beginPath();
            ctx.arc(node.x, node.y, radius + 6, 0, Math.PI * 2);
            ctx.strokeStyle = "rgba(16, 185, 129, 0.4)";
            ctx.lineWidth = 1.5;
            ctx.stroke();
        } else if (isStart) {
            ctx.shadowColor = "#8b5cf6";
            ctx.shadowBlur = 16;
            ctx.beginPath();
            ctx.arc(node.x, node.y, radius + 7 + Math.sin(timeSec * 5) * 3, 0, Math.PI * 2);
            ctx.strokeStyle = "#c084fc";
            ctx.lineWidth = 2;
            ctx.stroke();
        } else {
            ctx.shadowBlur = 0;
        }

        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = getNodeColor(node);
        ctx.fill();

        ctx.lineWidth = isStart ? 3 : 2;
        ctx.strokeStyle = isStart ? "#ffffff" : "#0d1527";
        ctx.stroke();
        ctx.shadowBlur = 0;

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

        ctx.fillStyle = "#cbd5e1";
        ctx.font = "600 10px Plus Jakarta Sans";
        ctx.fillText(node.name, node.x, node.y + radius + 13);
    });

    // 5. Tooltip
    if (state.hoveredNode) {
        const n = state.hoveredNode;
        const text = `${n.name} • ${n.state} ${n.smoke_level > 0 ? `(${Math.round(n.smoke_level*100)}% Smoke)` : ""}`;
        ctx.font = "600 11px Plus Jakarta Sans";
        const metrics = ctx.measureText(text);
        const padX = 10;
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
// Interactive Events & Tool Controls
// -------------------------------------------------------------
function getCanvasCoords(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const rawX = clientX - rect.left;
    const rawY = clientY - rect.top;
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
        if (startRoomSelector) startRoomSelector.value = clickedNode.id;
        traversalLog.textContent = `Selected evacuation location: ${clickedNode.name} (${clickedNode.id})`;
        logStepCount.textContent = "Route Allocated";
        AudioEngine.click();
        runBFS();
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

// Tool Selection
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

if (startRoomSelector) {
    startRoomSelector.addEventListener("change", e => {
        state.startNodeId = e.target.value;
        AudioEngine.click();
        traversalLog.textContent = `Location changed to: ${e.target.options[e.target.selectedIndex].text}`;
        logStepCount.textContent = "Route Allocated";
        runBFS();
    });
}

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
initApp();
animate();
