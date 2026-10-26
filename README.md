# 🔥 Building Fire Evacuation Route Planner

**Regd No:** 25091A32P0, 25091A3272  
**Problem Statement No:** 44  

> **Problem Statement:** Build an evacuation route planning tool using BFS/DFS on a graph representation of a building's floor plan to compute the fastest evacuation paths from any room to the nearest exit, accounting for blocked routes during simulated fire scenarios. Use OOP to model rooms, exits, and hazard zones as graph nodes with dynamic states. This tool can be integrated into building safety systems for schools, hospitals, and public buildings.

---

## 🌟 Key Features
- **Object-Oriented Graph Representation**: Models rooms, exits, hallways, and hazard zones with dynamic state management (`SAFE`, `SMOKE`, `FIRE`, `BLOCKED`).
- **Shortest Safe Path (BFS)**: Computes the minimum-hop route to the nearest accessible exit in unweighted graph topology.
- **Alternative Path Exploration (DFS)**: Discovers secondary or escape routes when preferred exits are compromised.
- **Dynamic Fire & Smoke Spread Simulation**: Real-time propagation of smoke and flames across adjacent corridors with automatic path recalculation.
- **Multiple Realistic Presets**: Preloaded with high-school complex and hospital emergency wings.
- **Interactive Visual Floor Plan**: HTML5 Canvas visualizer with glowing route animations, live status indicators, and click-to-ignite tools.

---

## 🏛️ OOP Architecture

```
                  ┌───────────────┐
                  │     Node      │ (Base Class: id, name, x, y, state, smoke)
                  └───────┬───────┘
          ┌───────────────┼───────────────┬────────────────┐
          ▼               ▼               ▼                ▼
     ┌─────────┐    ┌───────────┐    ┌─────────┐    ┌──────────────┐
     │  Room   │    │ Corridor  │    │  Exit   │    │  HazardZone  │
     │(Classr.)│    │ (Hallway) │    │(Primary)│    │(Lab/Chemical)│
     └─────────┘    └───────────┘    └─────────┘    └──────────────┘
```

- **`Node`**: Base class encapsulating coordinates, capacity, `NodeState` (`SAFE`, `SMOKE`, `FIRE`, `BLOCKED`), and `is_passable` logic.
- **`Room`**: Extends `Node` with room category and occupancy tracking.
- **`Corridor`**: Connective hallway waypoints.
- **`Exit`**: Designates safe muster/assembly point egress.
- **`HazardZone`**: High-risk flammable sectors (e.g., Chemistry labs, boiler rooms) that ignite rapidly during fire spread.
- **`BuildingGraph`**: Manages adjacency topology, edge distances, dynamic hazard toggles, and state serialization.
- **`FireSimulator`**: Discrete-time step simulator modeling smoke dispersion and ignition of adjacent rooms.
- **`BFSPlanner` & `DFSPlanner`**: Graph traversal engines for safety routing.

---

## 🧮 Algorithm Complexity

| Algorithm | Primary Purpose | Time Complexity | Space Complexity |
|---|---|---|---|
| **BFS (Breadth-First Search)** | Fastest / Shortest path to nearest exit | $\mathcal{O}(V + E)$ | $\mathcal{O}(V)$ |
| **DFS (Depth-First Search)** | Alternate route / Full depth exploration | $\mathcal{O}(V + E)$ | $\mathcal{O}(V)$ |

*$V$ = number of rooms/corridors (nodes), $E$ = number of doors/hallways (edges).*

---

## 🚀 Running Locally

1. **Clone or Open this folder**:
   ```bash
   cd "c:\Users\dell\Desktop\fire evacuation"
   ```

2. **Run tests**:
   ```bash
   python -m pytest tests/test_planner.py -v
   ```

3. **Start the Web Application**:
   ```bash
   python app.py
   ```

4. **Open in your browser**:
   Navigate to [http://127.0.0.1:5000](http://127.0.0.1:5000)

---

## 🌐 How to Deploy for Free (1-Click on Render)

1. **Initialize Git & Push to GitHub**:
   ```bash
   git init
   git add .
   git commit -m "Initial commit of Building Fire Evacuation Route Planner"
   # Create a new repository on https://github.com/new and link it:
   git remote add origin https://github.com/<YOUR_USERNAME>/fire-evacuation-planner.git
   git branch -M main
   git push -u origin main
   ```

2. **Deploy on Render ([render.com](https://render.com))**:
   - Sign up / Log in to Render.
   - Click **New +** > **Web Service**.
   - Select your GitHub repository.
   - **Environment**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `gunicorn app:app`
   - Select the **Free** instance type and click **Deploy Web Service**.
   - Your live public URL will be ready in under 2 minutes!
