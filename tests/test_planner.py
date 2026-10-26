"""
Unit tests for Building Fire Evacuation Route Planner.
Verifies OOP graph models, BFS shortest path, DFS exploration,
dynamic fire blockages, and re-routing.
"""
import pytest
from models.node import Room, Exit, Corridor, HazardZone, NodeState
from models.building_graph import BuildingGraph
from algorithms.bfs import BFSPlanner
from algorithms.dfs import DFSPlanner
from simulation.fire_simulator import FireSimulator
from data.presets import create_school_building, create_hospital_wing


def test_oop_node_instantiation_and_states():
    """Verify OOP properties and dynamic state changes."""
    room = Room("R1", "Classroom A", x=10, y=20)
    assert room.is_passable is True
    assert room.is_exit is False
    assert room.state == NodeState.SAFE

    # Set fire hazard
    room.set_hazard(NodeState.FIRE, smoke_level=1.0)
    assert room.is_passable is False
    assert room.state == NodeState.FIRE

    # Reset
    room.reset_state()
    assert room.is_passable is True
    assert room.state == NodeState.SAFE


def test_bfs_shortest_path_unblocked():
    """Verify BFS finds the shortest path to the nearest safe exit."""
    g = create_school_building()
    # Path from R101 should go R101 -> C1 -> EXIT_WEST (closest exit)
    result = BFSPlanner.find_shortest_path_to_nearest_exit(g, "R101")

    assert result["success"] is True
    assert result["target_exit"] == "EXIT_WEST"
    assert result["path"] == ["R101", "C1", "EXIT_WEST"]
    assert result["hops"] == 2


def test_bfs_dynamic_rerouting_on_fire():
    """Verify that when the nearest exit is blocked by fire, BFS re-routes to an alternate exit."""
    g = create_school_building()

    # Block West Hallway C1 with fire
    g.toggle_fire("C1")

    # From R102, C1 is blocked. It should route east towards EXIT_EAST or north to EXIT_NORTH!
    result = BFSPlanner.find_shortest_path_to_nearest_exit(g, "R102")

    assert result["success"] is True
    # The route should avoid C1 completely
    assert "C1" not in result["path"]
    assert result["target_exit"] in ["EXIT_NORTH", "EXIT_EAST"]


def test_bfs_all_exits_blocked():
    """Verify behavior when all paths are blocked by hazards."""
    g = create_school_building()
    # Set all corridors on fire
    g.toggle_fire("C1")
    g.toggle_fire("C2")
    g.toggle_fire("C3")
    g.toggle_fire("C4")
    g.toggle_fire("EXIT_NORTH")

    result = BFSPlanner.find_shortest_path_to_nearest_exit(g, "LIB")
    assert result["success"] is False
    assert "NO SAFE EVACUATION ROUTE" in result["message"]


def test_dfs_finds_valid_route():
    """Verify DFS finds an evacuation path."""
    g = create_hospital_wing()
    result = DFSPlanner.find_evacuation_path(g, "ICU")
    assert result["success"] is True
    assert result["path"][0] == "ICU"
    assert result["path"][-1] in ["EXIT_AMBULANCE", "EXIT_HELIPAD", "EXIT_SOUTH", "EXIT_FIRE_EAST"]


def test_fire_simulator_spread():
    """Verify fire simulator advances steps and spreads smoke/fire."""
    g = create_school_building()
    sim = FireSimulator(g, spread_rate=1.0)

    # Ignite LAB
    sim.ignite("LAB")
    assert g.nodes["LAB"].state == NodeState.FIRE

    # Step simulation
    step1 = sim.step()
    assert step1["step"] == 1
    # Neighbor C4 should now be smoky
    assert g.nodes["C4"].state in [NodeState.SMOKE, NodeState.FIRE]
