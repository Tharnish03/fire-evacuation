"""
Breadth-First Search (BFS) algorithm for Fire Evacuation Route Planning.
BFS guarantees the shortest path (minimum number of hallway hops)
from any given room to the nearest accessible emergency exit.
"""
from collections import deque
import time
from typing import Dict, List, Optional, Tuple, Any
from models.building_graph import BuildingGraph


class BFSPlanner:
    """Finds fastest evacuation paths using Breadth-First Search."""

    @staticmethod
    def generate_turn_directions(graph: BuildingGraph, path: List[str]) -> List[str]:
        """Generates clear, human-readable turn-by-turn instructions for evacuees."""
        if not path or len(path) < 2:
            return ["You are already at a safe emergency exit point."]

        directions = []
        for i in range(len(path) - 1):
            curr_id = path[i]
            next_id = path[i + 1]
            curr_node = graph.nodes[curr_id]
            next_node = graph.nodes[next_id]

            edge_id = f"{curr_id}_{next_id}"
            dist = graph.edges[edge_id].distance if edge_id in graph.edges else 10.0

            if i == 0:
                directions.append(f"Step 1: Exit '{curr_node.name}' and move into '{next_node.name}' (~{dist}m).")
            elif i == len(path) - 2:
                directions.append(f"Step {i+1}: Proceed through '{curr_node.name}' directly into safe exit: '{next_node.name}' (~{dist}m).")
            else:
                directions.append(f"Step {i+1}: Continue along '{curr_node.name}' towards '{next_node.name}' (~{dist}m).")

        directions.append(f"Final: Evacuate building immediately and gather at the designated assembly area.")
        return directions

    @staticmethod
    def find_shortest_path_to_nearest_exit(
        graph: BuildingGraph,
        start_node_id: str,
    ) -> Dict[str, Any]:
        """
        Runs BFS starting from start_node_id to find the nearest reachable exit.
        Accounts for dynamic hazards (skips nodes marked as FIRE or BLOCKED).
        """
        start_time_ns = time.perf_counter_ns()

        if start_node_id not in graph.nodes:
            elapsed_us = round((time.perf_counter_ns() - start_time_ns) / 1000, 2)
            return {
                "algorithm": "BFS",
                "success": False,
                "path": [],
                "target_exit": None,
                "message": f"Start node '{start_node_id}' does not exist.",
                "explored_order": [],
                "execution_time_us": elapsed_us,
                "nodes_visited_count": 0,
            }

        start_node = graph.nodes[start_node_id]
        if not start_node.is_passable:
            elapsed_us = round((time.perf_counter_ns() - start_time_ns) / 1000, 2)
            return {
                "algorithm": "BFS",
                "success": False,
                "path": [],
                "target_exit": None,
                "message": f"Start node '{start_node.name}' is currently blocked or on fire!",
                "explored_order": [],
                "execution_time_us": elapsed_us,
                "nodes_visited_count": 0,
            }

        # If start node is already an exit
        if start_node.is_exit:
            elapsed_us = round((time.perf_counter_ns() - start_time_ns) / 1000, 2)
            return {
                "algorithm": "BFS",
                "success": True,
                "path": [start_node_id],
                "target_exit": start_node_id,
                "exit_name": start_node.name,
                "hops": 0,
                "total_distance": 0.0,
                "estimated_time_sec": 0,
                "explored_order": [start_node_id],
                "nodes_visited_count": 1,
                "execution_time_us": elapsed_us,
                "turn_directions": ["You are already at a safe emergency exit."],
                "message": "Starting location is already a safe exit.",
            }

        # BFS Data Structures
        queue = deque([start_node_id])
        visited = {start_node_id}
        parent: Dict[str, Optional[str]] = {start_node_id: None}
        explored_order: List[str] = []

        reached_exit_id: Optional[str] = None

        while queue:
            current_id = queue.popleft()
            explored_order.append(current_id)

            current_node = graph.nodes[current_id]

            # Check if an exit is reached
            if current_node.is_exit and current_node.is_passable:
                reached_exit_id = current_id
                break

            # Explore all safe/passable neighbors
            for neighbor_id in graph.get_neighbors(current_id, passable_only=True):
                if neighbor_id not in visited:
                    visited.add(neighbor_id)
                    parent[neighbor_id] = current_id
                    queue.append(neighbor_id)

        elapsed_us = round((time.perf_counter_ns() - start_time_ns) / 1000, 2)

        if reached_exit_id is None:
            return {
                "algorithm": "BFS",
                "success": False,
                "path": [],
                "target_exit": None,
                "message": "NO SAFE EVACUATION ROUTE FOUND! All paths to exits are blocked by fire or hazards.",
                "explored_order": explored_order,
                "nodes_visited_count": len(explored_order),
                "execution_time_us": elapsed_us,
                "turn_directions": ["CRITICAL: Shelter in place or await rescue. All corridors blocked."],
            }

        # Reconstruct path by backtracking parent pointers
        path = []
        curr = reached_exit_id
        while curr is not None:
            path.append(curr)
            curr = parent[curr]
        path.reverse()

        # Calculate total distance along the path
        total_distance = 0.0
        for i in range(len(path) - 1):
            n1 = graph.nodes[path[i]]
            n2 = graph.nodes[path[i + 1]]
            edge_id = f"{path[i]}_{path[i+1]}"
            if edge_id in graph.edges:
                total_distance += graph.edges[edge_id].distance
            else:
                total_distance += round(((n1.x - n2.x)**2 + (n1.y - n2.y)**2)**0.5, 2)

        total_distance = round(total_distance, 2)
        # Average walking speed under emergency conditions: 1.2 m/s
        estimated_time_sec = max(5, round(total_distance / 1.2))

        exit_node = graph.nodes[reached_exit_id]
        directions = BFSPlanner.generate_turn_directions(graph, path)

        return {
            "algorithm": "BFS",
            "success": True,
            "path": path,
            "target_exit": reached_exit_id,
            "exit_name": exit_node.name,
            "hops": len(path) - 1,
            "total_distance": total_distance,
            "estimated_time_sec": estimated_time_sec,
            "explored_order": explored_order,
            "nodes_visited_count": len(explored_order),
            "execution_time_us": elapsed_us,
            "turn_directions": directions,
            "message": f"Optimal evacuation route calculated to {exit_node.name} ({len(path)-1} hops, ~{total_distance}m).",
        }
