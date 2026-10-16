"""
Active Engineering Memory Layer - Database Package
===================================================
Provides multigraph client connectivity to FalkorDB and synthetic enterprise seed data.
"""

from app.db.graph_client import FalkorDBClient, QueryResult

__all__ = ["FalkorDBClient", "QueryResult"]
