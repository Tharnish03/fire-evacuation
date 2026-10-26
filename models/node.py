"""
Data models representing rooms, corridors, exits, and hazard zones.
Uses Object-Oriented Programming (OOP) with dynamic states as required.
"""
from enum import Enum
from typing import Optional, List, Dict, Any


class NodeState(Enum):
    SAFE = "SAFE"
    SMOKE = "SMOKE"
    FIRE = "FIRE"
    BLOCKED = "BLOCKED"


class NodeType(Enum):
    ROOM = "ROOM"
    CORRIDOR = "CORRIDOR"
    EXIT = "EXIT"
    STAIRS = "STAIRS"


class Node:
    """Base class for all floor plan waypoints / rooms."""

    def __init__(
        self,
        node_id: str,
        name: str,
        node_type: NodeType,
        x: float,
        y: float,
        floor: int = 1,
        capacity: int = 10,
    ):
        self.node_id = node_id
        self.name = name
        self.node_type = node_type
        self.x = x
        self.y = y
        self.floor = floor
        self.capacity = capacity
        self.state = NodeState.SAFE
        self.smoke_level = 0.0  # 0.0 (clean) to 1.0 (toxic)
        self.occupants = 0

    @property
    def is_passable(self) -> bool:
        """Determines if evacuees can safely traverse through this node."""
        return self.state not in (NodeState.FIRE, NodeState.BLOCKED) and self.smoke_level < 0.8

    @property
    def is_exit(self) -> bool:
        return self.node_type == NodeType.EXIT

    def set_hazard(self, state: NodeState, smoke_level: float = 0.0):
        self.state = state
        self.smoke_level = smoke_level

    def reset_state(self):
        self.state = NodeState.SAFE
        self.smoke_level = 0.0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.node_id,
            "name": self.name,
            "type": self.node_type.value,
            "x": self.x,
            "y": self.y,
            "floor": self.floor,
            "capacity": self.capacity,
            "state": self.state.value,
            "smoke_level": round(self.smoke_level, 2),
            "is_passable": self.is_passable,
            "is_exit": self.is_exit,
            "occupants": self.occupants,
        }


class Room(Node):
    """Represents an occupiable room (classroom, office, hospital ward)."""

    def __init__(
        self,
        node_id: str,
        name: str,
        x: float,
        y: float,
        floor: int = 1,
        capacity: int = 30,
        room_category: str = "General",
    ):
        super().__init__(node_id, name, NodeType.ROOM, x, y, floor, capacity)
        self.room_category = room_category

    def to_dict(self) -> Dict[str, Any]:
        data = super().to_dict()
        data["category"] = self.room_category
        return data


class Corridor(Node):
    """Represents a hallway or corridor intersection."""

    def __init__(self, node_id: str, name: str, x: float, y: float, floor: int = 1):
        super().__init__(node_id, name, NodeType.CORRIDOR, x, y, floor, capacity=100)


class Exit(Node):
    """Represents a safe emergency exit point leading out of the building."""

    def __init__(
        self,
        node_id: str,
        name: str,
        x: float,
        y: float,
        floor: int = 1,
        is_primary: bool = True,
    ):
        super().__init__(node_id, name, NodeType.EXIT, x, y, floor, capacity=500)
        self.is_primary = is_primary

    def to_dict(self) -> Dict[str, Any]:
        data = super().to_dict()
        data["is_primary"] = self.is_primary
        return data


class HazardZone(Node):
    """Represents an intrinsically high-risk area (e.g., chemical lab, boiler room)."""

    def __init__(
        self,
        node_id: str,
        name: str,
        x: float,
        y: float,
        floor: int = 1,
        risk_level: str = "High",
    ):
        super().__init__(node_id, name, NodeType.ROOM, x, y, floor, capacity=10)
        self.risk_level = risk_level
        self.flammable = True

    def to_dict(self) -> Dict[str, Any]:
        data = super().to_dict()
        data["risk_level"] = self.risk_level
        return data
