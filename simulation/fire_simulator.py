"""
Fire & Smoke propagation simulation over building graph nodes.
Models dynamic hazard states, spreading smoke, and route blockage over time steps.
"""
from typing import Dict, List, Set, Any
import random
from models.building_graph import BuildingGraph
from models.node import NodeState, NodeType, HazardZone


class FireSimulator:
    """Simulates dynamic spread of fire and toxic smoke across rooms and hallways."""

    def __init__(self, graph: BuildingGraph, spread_rate: float = 0.5):
        self.graph = graph
        self.spread_rate = spread_rate  # Probability of adjacent flame ignition
        self.step_count = 0
        self.history: List[Dict[str, Any]] = []

    def ignite(self, node_id: str) -> bool:
        """Manually sets a node on fire."""
        if node_id in self.graph.nodes:
            node = self.graph.nodes[node_id]
            node.set_hazard(NodeState.FIRE, smoke_level=1.0)
            return True
        return False

    def step(self) -> Dict[str, Any]:
        """
        Advances the fire simulation by one discrete time tick.
        - Smoke spreads into adjacent safe nodes.
        - High smoke (or hazard zone) catches fire.
        - Returns a summary of newly affected areas.
        """
        self.step_count += 1
        new_fires = []
        new_smokes = []

        # Find current fire and smoke nodes
        current_fire_nodes = [
            nid for nid, node in self.graph.nodes.items()
            if node.state == NodeState.FIRE
        ]
        current_smoke_nodes = [
            nid for nid, node in self.graph.nodes.items()
            if node.state == NodeState.SMOKE
        ]

        # 1. Fire spreads smoke and flames to neighboring nodes
        for fire_nid in current_fire_nodes:
            for neighbor_id in self.graph.get_neighbors(fire_nid, passable_only=False):
                neighbor = self.graph.nodes[neighbor_id]
                if neighbor.state == NodeState.SAFE:
                    # Adjacent to fire -> becomes heavy smoke
                    neighbor.set_hazard(NodeState.SMOKE, smoke_level=0.7)
                    new_smokes.append(neighbor_id)
                elif neighbor.state == NodeState.SMOKE:
                    # Smoke area catches fire
                    # Hazard zones (chemical labs/boiler rooms) ignite immediately!
                    is_flammable = isinstance(neighbor, HazardZone) or getattr(neighbor, "flammable", False)
                    if is_flammable or random.random() < self.spread_rate:
                        neighbor.set_hazard(NodeState.FIRE, smoke_level=1.0)
                        new_fires.append(neighbor_id)

        # 2. Existing smoke intensifies
        for smoke_nid in current_smoke_nodes:
            node = self.graph.nodes[smoke_nid]
            if node.state == NodeState.SMOKE:
                node.smoke_level = min(1.0, node.smoke_level + 0.2)
                if node.smoke_level >= 0.9:
                    node.set_hazard(NodeState.FIRE, smoke_level=1.0)
                    new_fires.append(smoke_nid)

        step_summary = {
            "step": self.step_count,
            "new_fires": new_fires,
            "new_smokes": new_smokes,
            "total_fires": len([n for n in self.graph.nodes.values() if n.state == NodeState.FIRE]),
            "total_smokes": len([n for n in self.graph.nodes.values() if n.state == NodeState.SMOKE]),
            "intact_exits": len(self.graph.get_exits(passable_only=True)),
        }
        self.history.append(step_summary)
        return step_summary

    def reset(self):
        """Resets the simulation and clears all active fires."""
        self.step_count = 0
        self.history.clear()
        self.graph.reset_all_hazards()
