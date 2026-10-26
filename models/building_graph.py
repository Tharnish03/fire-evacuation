"""
Graph representation of a building's floor plan.
Maintains nodes, edges, adjacency list, and dynamic states.
"""
from typing import Dict, List, Optional, Set, Any
import math
from models.node import Node, Room, Corridor, Exit, HazardZone, NodeState
from models.edge import Edge


class BuildingGraph:
    """Manages the full floor plan topology, nodes, edges, and active hazards."""

    def __init__(self, building_name: str = "Main Building"):
        self.building_name = building_name
        self.nodes: Dict[str, Node] = {}
        self.edges: Dict[str, Edge] = {}
        # Adjacency list: node_id -> list of (neighbor_id, edge)
        self.adjacency: Dict[str, List[tuple[str, Edge]]] = {}

    def add_node(self, node: Node):
        self.nodes[node.node_id] = node
        if node.node_id not in self.adjacency:
            self.adjacency[node.node_id] = []

    def add_edge(
        self,
        from_node: str,
        to_node: str,
        distance: Optional[float] = None,
        is_bidirectional: bool = True,
    ) -> Edge:
        if from_node not in self.nodes or to_node not in self.nodes:
            raise ValueError(f"Both nodes ({from_node}, {to_node}) must exist in the building graph.")

        if distance is None:
            # Calculate Euclidean distance between coordinates
            n1 = self.nodes[from_node]
            n2 = self.nodes[to_node]
            distance = round(math.hypot(n1.x - n2.x, n1.y - n2.y), 2)

        edge_id = f"{from_node}_{to_node}"
        edge = Edge(edge_id, from_node, to_node, distance, is_bidirectional)
        self.edges[edge_id] = edge

        self.adjacency[from_node].append((to_node, edge))
        if is_bidirectional:
            rev_edge_id = f"{to_node}_{from_node}"
            rev_edge = Edge(rev_edge_id, to_node, from_node, distance, is_bidirectional)
            self.edges[rev_edge_id] = rev_edge
            self.adjacency[to_node].append((from_node, rev_edge))

        return edge

    def get_neighbors(self, node_id: str, passable_only: bool = True) -> List[str]:
        """Returns list of neighbor node IDs, optionally filtering for passable nodes/edges."""
        neighbors = []
        if node_id not in self.adjacency:
            return neighbors

        for neighbor_id, edge in self.adjacency[node_id]:
            if edge.is_blocked and passable_only:
                continue
            neighbor_node = self.nodes.get(neighbor_id)
            if neighbor_node:
                if passable_only and not neighbor_node.is_passable:
                    continue
                neighbors.append(neighbor_id)
        return neighbors

    def get_exits(self, passable_only: bool = True) -> List[Exit]:
        """Returns all exit nodes."""
        exits = [
            node for node in self.nodes.values()
            if isinstance(node, Exit) or node.is_exit
        ]
        if passable_only:
            exits = [e for e in exits if e.is_passable]
        return exits

    def set_hazard(self, node_id: str, state: NodeState, smoke_level: float = 0.0):
        """Sets a hazard (Fire/Smoke/Blocked) on a node."""
        if node_id in self.nodes:
            self.nodes[node_id].set_hazard(state, smoke_level)

    def toggle_fire(self, node_id: str) -> str:
        """Toggles a node between FIRE and SAFE."""
        if node_id not in self.nodes:
            return "UNKNOWN"
        node = self.nodes[node_id]
        if node.state == NodeState.FIRE:
            node.reset_state()
        else:
            node.set_hazard(NodeState.FIRE, smoke_level=1.0)
        return node.state.value

    def toggle_block(self, node_id: str) -> str:
        """Toggles a node between BLOCKED and SAFE."""
        if node_id not in self.nodes:
            return "UNKNOWN"
        node = self.nodes[node_id]
        if node.state == NodeState.BLOCKED:
            node.reset_state()
        else:
            node.set_hazard(NodeState.BLOCKED, smoke_level=0.0)
        return node.state.value

    def reset_all_hazards(self):
        """Clears all fires, smoke, and blockages."""
        for node in self.nodes.values():
            node.reset_state()
        for edge in self.edges.values():
            edge.unblock()

    def to_dict(self) -> Dict[str, Any]:
        """Serializes building topology and dynamic status for API/UI."""
        unique_edges = []
        seen = set()
        for edge in self.edges.values():
            pair = tuple(sorted([edge.from_node, edge.to_node]))
            if pair not in seen:
                seen.add(pair)
                unique_edges.append(edge.to_dict())

        return {
            "building_name": self.building_name,
            "nodes": [n.to_dict() for n in self.nodes.values()],
            "edges": unique_edges,
        }
