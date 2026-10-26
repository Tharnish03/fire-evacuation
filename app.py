"""
Building Fire Evacuation Route Planner - Web Application Server
Flask REST API + Interactive Floor Plan Dashboard.
"""
from flask import Flask, render_template, jsonify, request
from models.building_graph import BuildingGraph
from models.node import NodeState
from algorithms.bfs import BFSPlanner
from algorithms.dfs import DFSPlanner
from simulation.fire_simulator import FireSimulator
from data.presets import PRESET_BUILDERS

app = Flask(__name__)

# Active global building state
current_building_key = "school"
current_graph: BuildingGraph = PRESET_BUILDERS[current_building_key]()
current_simulator = FireSimulator(current_graph)


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/building", methods=["GET"])
def get_building():
    """Returns the current floor plan graph, node states, and statistics."""
    return jsonify({
        "preset": current_building_key,
        "building_name": current_graph.building_name,
        "graph": current_graph.to_dict(),
        "step_count": current_simulator.step_count,
        "exits": [e.to_dict() for e in current_graph.get_exits(passable_only=False)],
    })


@app.route("/api/building/select", methods=["POST"])
def select_building():
    """Switches building preset ('school', 'hospital', or 'apartment')."""
    global current_building_key, current_graph, current_simulator
    data = request.get_json() or {}
    preset = data.get("preset", "school")

    if preset not in PRESET_BUILDERS:
        return jsonify({"error": f"Unknown preset: {preset}"}), 400

    current_building_key = preset
    current_graph = PRESET_BUILDERS[preset]()
    current_simulator = FireSimulator(current_graph)

    return jsonify({
        "message": f"Loaded {current_graph.building_name}",
        "preset": current_building_key,
        "graph": current_graph.to_dict(),
    })


@app.route("/api/node/toggle-fire", methods=["POST"])
def toggle_fire():
    """Toggles a room or hallway into FIRE or SAFE state."""
    data = request.get_json() or {}
    node_id = data.get("node_id")
    if not node_id or node_id not in current_graph.nodes:
        return jsonify({"error": "Invalid node_id"}), 400

    new_state = current_graph.toggle_fire(node_id)
    return jsonify({
        "node_id": node_id,
        "new_state": new_state,
        "graph": current_graph.to_dict(),
    })


@app.route("/api/node/toggle-block", methods=["POST"])
def toggle_block():
    """Toggles a room or hallway into BLOCKED or SAFE state."""
    data = request.get_json() or {}
    node_id = data.get("node_id")
    if not node_id or node_id not in current_graph.nodes:
        return jsonify({"error": "Invalid node_id"}), 400

    new_state = current_graph.toggle_block(node_id)
    return jsonify({
        "node_id": node_id,
        "new_state": new_state,
        "graph": current_graph.to_dict(),
    })


@app.route("/api/simulation/step", methods=["POST"])
def simulation_step():
    """Advances fire and smoke spread by one time tick."""
    summary = current_simulator.step()
    return jsonify({
        "summary": summary,
        "graph": current_graph.to_dict(),
    })


@app.route("/api/simulation/reset", methods=["POST"])
def simulation_reset():
    """Resets all fires and restores the floor plan to initial safe state."""
    current_simulator.reset()
    return jsonify({
        "message": "All hazards cleared. Floor plan reset.",
        "graph": current_graph.to_dict(),
    })


@app.route("/api/plan/bfs", methods=["POST"])
def plan_bfs():
    """Computes fastest evacuation path using Breadth-First Search."""
    data = request.get_json() or {}
    start_node_id = data.get("start_node_id")

    if not start_node_id:
        return jsonify({"error": "Missing start_node_id"}), 400

    result = BFSPlanner.find_shortest_path_to_nearest_exit(current_graph, start_node_id)
    return jsonify(result)


@app.route("/api/plan/dfs", methods=["POST"])
def plan_dfs():
    """Computes an alternate evacuation path using Depth-First Search."""
    data = request.get_json() or {}
    start_node_id = data.get("start_node_id")
    target_exit_id = data.get("target_exit_id")

    if not start_node_id:
        return jsonify({"error": "Missing start_node_id"}), 400

    result = DFSPlanner.find_evacuation_path(
        current_graph,
        start_node_id,
        target_exit_id=target_exit_id,
    )
    return jsonify(result)


@app.route("/api/plan/compare", methods=["POST"])
def plan_compare():
    """
    Executes BFS and DFS simultaneously on the same start room.
    Returns side-by-side performance metrics (hops, distance, time_us, nodes_visited).
    """
    data = request.get_json() or {}
    start_node_id = data.get("start_node_id")

    if not start_node_id:
        return jsonify({"error": "Missing start_node_id"}), 400

    bfs_res = BFSPlanner.find_shortest_path_to_nearest_exit(current_graph, start_node_id)
    dfs_res = DFSPlanner.find_evacuation_path(current_graph, start_node_id)

    return jsonify({
        "start_node_id": start_node_id,
        "start_room_name": current_graph.nodes[start_node_id].name if start_node_id in current_graph.nodes else start_node_id,
        "bfs": bfs_res,
        "dfs": dfs_res,
    })


@app.route("/api/plan/all-paths", methods=["POST"])
def plan_all_paths():
    """Finds multiple viable escape paths using DFS traversal."""
    data = request.get_json() or {}
    start_node_id = data.get("start_node_id")

    if not start_node_id:
        return jsonify({"error": "Missing start_node_id"}), 400

    paths = DFSPlanner.find_all_paths_to_exits(current_graph, start_node_id)
    return jsonify({"start": start_node_id, "paths": paths, "count": len(paths)})


if __name__ == "__main__":
    import os
    port = int(os.environ.get("PORT", 5000))
    print(f"🔥 Building Fire Evacuation Route Planner running on http://127.0.0.1:{port}")
    app.run(host="0.0.0.0", port=port, debug=True)
