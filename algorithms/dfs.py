"""
Depth-First Search (DFS) algorithm for Fire Evacuation Planning.
Explores available evacuation paths and alternative escape routes.
"""
import time
from typing import Dict, List, Optional, Set, Any
from models.building_graph import BuildingGraph


class DFSPlanner:
    """Explores alternative evacuation routes using Depth-First Search."""

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
                directions.append(f"Step {i+1}: Proceed through '{curr_node.name}' into exit: '{next_node.name}' (~{dist}m).")
            else:
                directions.append(f"Step {i+1}: Traversal waypoint: '{curr_node.name}' towards '{next_node.name}' (~{dist}m).")

        directions.append(f"Final: Evacuate building immediately and gather at the designated assembly area.")
        return directions

    @staticmethod
    def find_evacuation_path(
        graph: BuildingGraph,
        start_node_id: str,
        target_exit_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Runs DFS from start_node_id to find an escape path to an exit.
        If target_exit_id is specified, attempts to reach that specific exit.
        Otherwise, stops at the first reachable exit encountered.
        """
        start_time_ns = time.perf_counter_ns()

        if start_node_id not in graph.nodes:
            elapsed_us = round((time.perf_counter_ns() - start_time_ns) / 1000, 2)
            return {
                "algorithm": "DFS",
                "success": False,
                "path": [],
                "target_exit": None,
                "message": f"Start node '{start_node_id}' does not exist.",
                "explored_order": [],
                "nodes_visited_count": 0,
                "execution_time_us": elapsed_us,
            }

        start_node = graph.nodes[start_node_id]
        if not start_node.is_passable:
            elapsed_us = round((time.perf_counter_ns() - start_time_ns) / 1000, 2)
            return {
                "algorithm": "DFS",
                "success": False,
                "path": [],
                "target_exit": None,
                "message": f"Start room '{start_node.name}' is blocked or on fire!",
                "explored_order": [],
                "nodes_visited_count": 0,
                "execution_time_us": elapsed_us,
            }

        visited: Set[str] = set()
        explored_order: List[str] = []
        path: List[str] = []

        def dfs_visit(current_id: str) -> Optional[str]:
            visited.add(current_id)
            explored_order.append(current_id)
            path.append(current_id)

            curr_node = graph.nodes[current_id]

            # Check exit condition
            if target_exit_id:
                if current_id == target_exit_id and curr_node.is_passable:
                    return current_id
            else:
                if curr_node.is_exit and curr_node.is_passable:
                    return current_id

            # Recurse on passable neighbors
            for neighbor_id in graph.get_neighbors(current_id, passable_only=True):
                if neighbor_id not in visited:
                    found = dfs_visit(neighbor_id)
                    if found:
                        return found

            path.pop()  # Backtrack
            return None

        reached_exit = dfs_visit(start_node_id)
        elapsed_us = round((time.perf_counter_ns() - start_time_ns) / 1000, 2)

        if not reached_exit:
            return {
                "algorithm": "DFS",
                "success": False,
                "path": [],
                "target_exit": None,
                "message": "DFS: No viable evacuation path found.",
                "explored_order": explored_order,
                "nodes_visited_count": len(explored_order),
                "execution_time_us": elapsed_us,
                "turn_directions": ["CRITICAL: Shelter in place. All explored DFS routes are blocked."],
            }

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
        estimated_time_sec = max(5, round(total_distance / 1.2))

        exit_node = graph.nodes[reached_exit]
        directions = DFSPlanner.generate_turn_directions(graph, path)

        return {
            "algorithm": "DFS",
            "success": True,
            "path": path,
            "target_exit": reached_exit,
            "exit_name": exit_node.name,
            "hops": len(path) - 1,
            "total_distance": total_distance,
            "estimated_time_sec": estimated_time_sec,
            "explored_order": explored_order,
            "nodes_visited_count": len(explored_order),
            "execution_time_us": elapsed_us,
            "turn_directions": directions,
            "message": f"DFS Route identified to {exit_node.name} ({len(path)-1} hops, ~{total_distance}m).",
        }

    @staticmethod
    def find_all_paths_to_exits(
        graph: BuildingGraph,
        start_node_id: str,
        max_depth: int = 15,
        max_paths: int = 5,
    ) -> List[List[str]]:
        """
        Finds multiple alternate evacuation paths from start to any safe exit using DFS.
        """
        all_paths = []
        if start_node_id not in graph.nodes or not graph.nodes[start_node_id].is_passable:
            return all_paths

        def dfs(curr_id: str, current_path: List[str], visited: Set[str]):
            if len(all_paths) >= max_paths or len(current_path) > max_depth:
                return

            curr_node = graph.nodes[curr_id]
            if curr_node.is_exit and len(current_path) > 1:
                all_paths.append(list(current_path))
                return

            for neighbor_id in graph.get_neighbors(curr_id, passable_only=True):
                if neighbor_id not in visited:
                    visited.add(neighbor_id)
                    current_path.append(neighbor_id)
                    dfs(neighbor_id, current_path, visited)
                    current_path.pop()
                    visited.remove(neighbor_id)

        dfs(start_node_id, [start_node_id], {start_node_id})
        return all_paths
