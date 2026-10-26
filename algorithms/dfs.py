"""
Depth-First Search (DFS) algorithm for Fire Evacuation Planning.
Explores available evacuation paths and alternative escape routes.
"""
from typing import Dict, List, Optional, Set, Any
from models.building_graph import BuildingGraph


class DFSPlanner:
    """Explores alternative evacuation routes using Depth-First Search."""

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
        if start_node_id not in graph.nodes:
            return {
                "success": False,
                "path": [],
                "target_exit": None,
                "message": f"Start node '{start_node_id}' does not exist.",
                "explored_order": [],
            }

        start_node = graph.nodes[start_node_id]
        if not start_node.is_passable:
            return {
                "success": False,
                "path": [],
                "target_exit": None,
                "message": f"Start room '{start_node.name}' is blocked or on fire!",
                "explored_order": [],
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

        if not reached_exit:
            return {
                "success": False,
                "path": [],
                "target_exit": None,
                "message": "DFS: No viable evacuation path found.",
                "explored_order": explored_order,
            }

        exit_node = graph.nodes[reached_exit]
        return {
            "success": True,
            "path": path,
            "target_exit": reached_exit,
            "exit_name": exit_node.name,
            "hops": len(path) - 1,
            "explored_order": explored_order,
            "message": f"DFS Route identified to {exit_node.name} ({len(path)-1} hops).",
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
