"""
Represents connections (doors, hallways, stairs) between nodes in a building.
"""
from typing import Dict, Any


class Edge:
    """Represents a navigable path connecting two nodes."""

    def __init__(
        self,
        edge_id: str,
        from_node: str,
        to_node: str,
        distance: float = 1.0,
        is_bidirectional: bool = True,
        width_meters: float = 2.0,
    ):
        self.edge_id = edge_id
        self.from_node = from_node
        self.to_node = to_node
        self.distance = distance
        self.is_bidirectional = is_bidirectional
        self.width_meters = width_meters
        self.is_blocked = False

    def block(self):
        self.is_blocked = True

    def unblock(self):
        self.is_blocked = False

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.edge_id,
            "from": self.from_node,
            "to": self.to_node,
            "distance": self.distance,
            "is_blocked": self.is_blocked,
            "width": self.width_meters,
        }
