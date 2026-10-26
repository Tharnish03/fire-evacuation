"""
Breadth-First Search (BFS) algorithm for Fire Evacuation Route Planning.
BFS guarantees the shortest path (minimum number of hallway hops)
from any given room to the nearest accessible emergency exit.
"""
from collections import deque
from typing import Dict, List, Optional, Tuple, Any
from models.building_graph import BuildingGraph


class BFSPlanner:
    """Finds fastest evacuation paths using Breadth-First Search."""

    @staticmethod
    def find_shortest_path_to_nearest_exit(
        graph: BuildingGraph,
        start_node_id: str,
    ) -> Dict[str, Any]:
        """
        Runs BFS starting from start_node_id to find the nearest reachable exit.
        Accounts for dynamic hazards (skips nodes marked as FIRE or BLOCKED).

        Returns:
            Dict containing:
                - success: bool
                - path: List of node IDs from start to exit
                - target_exit: ID of the reached exit
                - hops: Number of transitions
                - total_distance: Approximate cumulative distance
                - explored_order: Sequence of nodes visited (for visualization)
                - message: Status description
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
                "message": f"Start node '{start_node.name}' is currently blocked or on fire!",
                "explored_order": [],
            }

        # If start node is already an exit
        if start_node.is_exit:
            return {
                "success": True,
                "path": [start_node_id],
                "target_exit": start_node_id,
                "hops": 0,
                "total_distance": 0.0,
                "explored_order": [start_node_id],
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

        if reached_exit_id is None:
            return {
                "success": False,
                "path": [],
                "target_exit": None,
                "message": "NO SAFE EVACUATION ROUTE FOUND! All paths to exits are blocked by fire or hazards.",
                "explored_order": explored_order,
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

        exit_node = graph.nodes[reached_exit_id]
        return {
            "success": True,
            "path": path,
            "target_exit": reached_exit_id,
            "exit_name": exit_node.name,
            "hops": len(path) - 1,
            "total_distance": round(total_distance, 2),
            "explored_order": explored_order,
            "message": f"Optimal evacuation route calculated to {exit_node.name} ({len(path)-1} hops).",
        }
