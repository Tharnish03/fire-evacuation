"""
Unit tests for Building Fire Evacuation Route Planner.
Verifies OOP graph models, BFS shortest path, DFS exploration,
dynamic fire blockages, apartment layouts, and re-routing.
"""
import pytest
from models.node import Room, Exit, Corridor, HazardZone, NodeState
from models.building_graph import BuildingGraph
from algorithms.bfs import BFSPlanner
from algorithms.dfs import DFSPlanner
from simulation.fire_simulator import FireSimulator
from data.presets import create_school_building, create_hospital_wing, create_apartment_building


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
    result = BFSPlanner.find_shortest_path_to_nearest_exit(g, "R101")

    assert result["success"] is True
    assert result["target_exit"] == "EXIT_WEST"
    assert result["path"] == ["R101", "C1", "EXIT_WEST"]
    assert result["hops"] == 2
    assert "execution_time_us" in result
    assert len(result["turn_directions"]) > 0


def test_bfs_dynamic_rerouting_on_fire():
    """Verify that when the nearest exit is blocked by fire, BFS re-routes to an alternate exit."""
    g = create_school_building()

    # Block West Hallway C1 with fire
    g.toggle_fire("C1")

    result = BFSPlanner.find_shortest_path_to_nearest_exit(g, "R102")

    assert result["success"] is True
    assert "C1" not in result["path"]
    assert result["target_exit"] in ["EXIT_NORTH", "EXIT_EAST"]


def test_bfs_all_exits_blocked():
    """Verify behavior when all paths are blocked by hazards."""
    g = create_school_building()
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

    sim.ignite("LAB")
    assert g.nodes["LAB"].state == NodeState.FIRE

    step1 = sim.step()
    assert step1["step"] == 1
    assert g.nodes["C4"].state in [NodeState.SMOKE, NodeState.FIRE]


def test_apartment_building_evacuation():
    """Verify the multi-story residential apartment complex layout and fire routing."""
    g = create_apartment_building()
    assert "FLAT_401" in g.nodes
    assert "GAS_DUCT" in g.nodes
    assert isinstance(g.nodes["GAS_DUCT"], HazardZone)

    # Evacuate from Flat 401
    res = BFSPlanner.find_shortest_path_to_nearest_exit(g, "FLAT_401")
    assert res["success"] is True
    assert res["target_exit"] == "EXIT_FIRE_STAIR_W"
    assert res["path"] == ["FLAT_401", "CORR_W", "EXIT_FIRE_STAIR_W"]

    # Block West Corridor with fire
    g.toggle_fire("CORR_W")
    res_rerouted = BFSPlanner.find_shortest_path_to_nearest_exit(g, "FLAT_402")
    assert res_rerouted["success"] is True
    assert "CORR_W" not in res_rerouted["path"]
    assert res_rerouted["target_exit"] in ["EXIT_MAIN_STAIRS", "EXIT_FIRE_STAIR_E"]
