"""
Predefined building floor plans for schools, hospitals, and residential apartments.
"""
from models.node import Room, Corridor, Exit, HazardZone
from models.building_graph import BuildingGraph


def create_school_building() -> BuildingGraph:
    """Creates a realistic school building layout with multiple exits and labs."""
    g = BuildingGraph("High School Academic Block")

    # Rooms
    g.add_node(Room("R101", "Classroom 101", x=100, y=100, capacity=30, room_category="Classroom"))
    g.add_node(Room("R102", "Classroom 102", x=250, y=100, capacity=30, room_category="Classroom"))
    g.add_node(Room("R103", "Classroom 103", x=400, y=100, capacity=30, room_category="Classroom"))
    g.add_node(HazardZone("LAB", "Chemistry Lab (Hazard)", x=550, y=100, risk_level="Chemicals"))

    g.add_node(Room("LIB", "Library", x=100, y=340, capacity=50, room_category="Library"))
    g.add_node(Room("STAFF", "Staff Room", x=250, y=340, capacity=20, room_category="Office"))
    g.add_node(Room("R104", "Classroom 104", x=400, y=340, capacity=30, room_category="Classroom"))
    g.add_node(HazardZone("SRV", "Server / Electrical (Hazard)", x=550, y=340, risk_level="Electrical"))

    # Central Corridors
    g.add_node(Corridor("C1", "West Hallway", x=100, y=220))
    g.add_node(Corridor("C2", "Mid-West Intersection", x=250, y=220))
    g.add_node(Corridor("C3", "Mid-East Intersection", x=400, y=220))
    g.add_node(Corridor("C4", "East Hallway", x=550, y=220))

    # Exits
    g.add_node(Exit("EXIT_WEST", "West Main Gate (Exit A)", x=20, y=220, is_primary=True))
    g.add_node(Exit("EXIT_EAST", "East Field Gate (Exit B)", x=640, y=220, is_primary=True))
    g.add_node(Exit("EXIT_NORTH", "North Staircase Exit (Exit C)", x=250, y=20, is_primary=False))

    # Connect Rooms to Corridors
    g.add_edge("R101", "C1", distance=10)
    g.add_edge("R102", "C2", distance=10)
    g.add_edge("R103", "C3", distance=10)
    g.add_edge("LAB", "C4", distance=10)

    g.add_edge("LIB", "C1", distance=10)
    g.add_edge("STAFF", "C2", distance=10)
    g.add_edge("R104", "C3", distance=10)
    g.add_edge("SRV", "C4", distance=10)

    # Connect Corridors together
    g.add_edge("C1", "C2", distance=15)
    g.add_edge("C2", "C3", distance=15)
    g.add_edge("C3", "C4", distance=15)

    # Connect Corridors to Exits
    g.add_edge("C1", "EXIT_WEST", distance=8)
    g.add_edge("C4", "EXIT_EAST", distance=8)
    g.add_edge("R102", "EXIT_NORTH", distance=8)

    return g


def create_hospital_wing() -> BuildingGraph:
    """Creates a hospital floor plan with ICU, surgery, and emergency exits."""
    g = BuildingGraph("City Hospital Emergency & Inpatient Wing")

    # Wards & Units
    g.add_node(Room("ICU", "ICU Ward", x=120, y=100, capacity=12, room_category="Critical Care"))
    g.add_node(Room("SURG", "Surgery / OT", x=300, y=100, capacity=8, room_category="Surgery"))
    g.add_node(HazardZone("O2_BAY", "Oxygen Cylinder Bay (Hazard)", x=480, y=100, risk_level="Pressurized Gas"))

    g.add_node(Room("GEN_W1", "General Ward A", x=120, y=320, capacity=25, room_category="General Ward"))
    g.add_node(Room("GEN_W2", "General Ward B", x=300, y=320, capacity=25, room_category="General Ward"))
    g.add_node(HazardZone("PHARM", "Pharmacy & Chemical Store", x=480, y=320, risk_level="Chemicals"))

    # Hallways
    g.add_node(Corridor("H1", "West Corridor", x=120, y=210))
    g.add_node(Corridor("H2", "Central Nurses Station", x=300, y=210))
    g.add_node(Corridor("H3", "East Corridor", x=480, y=210))

    # Exits
    g.add_node(Exit("EXIT_AMBULANCE", "Ambulance Bay Exit", x=30, y=210, is_primary=True))
    g.add_node(Exit("EXIT_HELIPAD", "Roof Stair/Helipad Exit", x=300, y=30, is_primary=False))
    g.add_node(Exit("EXIT_SOUTH", "South Parking Exit", x=300, y=410, is_primary=True))
    g.add_node(Exit("EXIT_FIRE_EAST", "East Fire Escape Ramp", x=570, y=210, is_primary=True))

    # Connections
    g.add_edge("ICU", "H1", distance=9)
    g.add_edge("GEN_W1", "H1", distance=9)
    g.add_edge("SURG", "H2", distance=9)
    g.add_edge("GEN_W2", "H2", distance=9)
    g.add_edge("O2_BAY", "H3", distance=9)
    g.add_edge("PHARM", "H3", distance=9)

    g.add_edge("H1", "H2", distance=18)
    g.add_edge("H2", "H3", distance=18)

    g.add_edge("H1", "EXIT_AMBULANCE", distance=8)
    g.add_edge("H2", "EXIT_HELIPAD", distance=12)
    g.add_edge("H2", "EXIT_SOUTH", distance=12)
    g.add_edge("H3", "EXIT_FIRE_EAST", distance=8)

    return g


def create_apartment_building() -> BuildingGraph:
    """Creates a multi-story residential apartment floor plan with flats, gas duct, and fire escapes."""
    g = BuildingGraph("Skyline Heights Residential Apartments (Floor 4)")

    # North Flats & Gas Duct
    g.add_node(Room("FLAT_401", "Flat 401 (3BHK)", x=110, y=90, capacity=5, room_category="Residential"))
    g.add_node(Room("FLAT_402", "Flat 402 (2BHK)", x=250, y=90, capacity=4, room_category="Residential"))
    g.add_node(HazardZone("GAS_DUCT", "LPG Pipeline & Gas Duct (Hazard)", x=390, y=90, risk_level="LPG Gas"))
    g.add_node(Room("FLAT_403", "Flat 403 (3BHK)", x=530, y=90, capacity=6, room_category="Residential"))

    # South Flats & Electrical Shaft
    g.add_node(Room("FLAT_404", "Flat 404 (2BHK)", x=110, y=330, capacity=4, room_category="Residential"))
    g.add_node(Room("FLAT_405", "Flat 405 (Studio)", x=250, y=330, capacity=2, room_category="Residential"))
    g.add_node(HazardZone("ELEC_SHAFT", "Main Electrical Shaft (Hazard)", x=390, y=330, risk_level="High Voltage"))
    g.add_node(Room("FLAT_406", "Flat 406 (3BHK)", x=530, y=330, capacity=5, room_category="Residential"))

    # Central Passages & Elevator Lobby
    g.add_node(Corridor("CORR_W", "West Resident Corridor", x=110, y=210))
    g.add_node(Corridor("LOBBY_W", "Elevator Landing West", x=250, y=210))
    g.add_node(Corridor("LOBBY_E", "Central Atrium Lobby", x=390, y=210))
    g.add_node(Corridor("CORR_E", "East Resident Corridor", x=530, y=210))

    # Exits
    g.add_node(Exit("EXIT_FIRE_STAIR_W", "West Fire Escape Stairwell", x=20, y=210, is_primary=True))
    g.add_node(Exit("EXIT_MAIN_STAIRS", "Central Main Stairwell Egress", x=390, y=410, is_primary=True))
    g.add_node(Exit("EXIT_FIRE_STAIR_E", "East Emergency Stairwell", x=630, y=210, is_primary=True))

    # Connect Flats to Corridors
    g.add_edge("FLAT_401", "CORR_W", distance=8)
    g.add_edge("FLAT_404", "CORR_W", distance=8)
    g.add_edge("FLAT_402", "LOBBY_W", distance=8)
    g.add_edge("FLAT_405", "LOBBY_W", distance=8)
    g.add_edge("GAS_DUCT", "LOBBY_E", distance=8)
    g.add_edge("ELEC_SHAFT", "LOBBY_E", distance=8)
    g.add_edge("FLAT_403", "CORR_E", distance=8)
    g.add_edge("FLAT_406", "CORR_E", distance=8)

    # Connect Corridors together
    g.add_edge("CORR_W", "LOBBY_W", distance=14)
    g.add_edge("LOBBY_W", "LOBBY_E", distance=14)
    g.add_edge("LOBBY_E", "CORR_E", distance=14)

    # Connect Corridors to Exits
    g.add_edge("CORR_W", "EXIT_FIRE_STAIR_W", distance=9)
    g.add_edge("LOBBY_E", "EXIT_MAIN_STAIRS", distance=12)
    g.add_edge("CORR_E", "EXIT_FIRE_STAIR_E", distance=9)

    return g


PRESET_BUILDERS = {
    "school": create_school_building,
    "hospital": create_hospital_wing,
    "apartment": create_apartment_building,
}
