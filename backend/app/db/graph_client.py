"""
Active Engineering Memory Layer - FalkorDB Multigraph Client
============================================================
This module encapsulates client communication with FalkorDB (Cypher 9 graph database)
with first-class support for:
1. Multigraph Tenant Isolation: Dynamic tenant namespaces (e.g. project_alpha, project_beta, test_tenant)
   so multiple projects, repositories, or test runs never collide in memory.
2. Latency-Tracked Cypher Executions: High-resolution execution timing in milliseconds for SSE streaming.
3. Safe Graph Lifecycle Management: Resilient resets without erroring on uninitialized keys.
4. UI Topology Extraction: Node & Link serialization tailored for React visualizers (@xyflow/react, force-graph).
"""

from dataclasses import dataclass, field
import os
import time
from typing import Any, Dict, Iterator, List, Optional, Tuple, Union

from falkordb import FalkorDB
from falkordb.node import Node
from falkordb.edge import Edge
from redis.exceptions import ResponseError


@dataclass
class QueryResult:
    """
    Standardized container for Cypher query results.
    Provides structured dictionary records, latency measurements, and
    backward-compatible access patterns (dict indexing, iteration, tuple unpacking).
    """
    records: List[Dict[str, Any]] = field(default_factory=list)
    latency_ms: float = 0.0
    columns: List[str] = field(default_factory=list)
    raw_result: Any = None

    def __iter__(self) -> Iterator[Dict[str, Any]]:
        """Allow iterating directly over records: `for row in result:`"""
        return iter(self.records)

    def __getitem__(self, item: Union[str, int]) -> Any:
        """Allow dict access `result['records']` or int index `result[0]`."""
        if isinstance(item, str):
            if item == "records":
                return self.records
            elif item == "latency_ms":
                return self.latency_ms
            elif item == "columns":
                return self.columns
            raise KeyError(f"Invalid key '{item}' on QueryResult")
        return self.records[item]

    def __len__(self) -> int:
        return len(self.records)

    def __iter_tuple__(self) -> Tuple[List[Dict[str, Any]], float]:
        """Support unpacking: `records, latency = result`."""
        return (self.records, self.latency_ms)


class FalkorDBClient:
    """
    Multigraph client wrapper for FalkorDB graph database.

    Attributes:
        host: Hostname or IP of the FalkorDB instance (default: localhost).
        port: Listening port (default: 6379).
        password: Optional authentication password.
    """

    def __init__(
        self,
        host: Optional[str] = None,
        port: Optional[int] = None,
        password: Optional[str] = None,
        username: Optional[str] = None,
        ssl: Optional[bool] = None,
        url: Optional[str] = None,
        default_tenant: str = "active_memory_default",
    ):
        self.url = url or os.getenv("FALKORDB_URL", None)
        self.host = host or os.getenv("FALKORDB_HOST", "localhost")
        self.port = port or int(os.getenv("FALKORDB_PORT", "6379"))
        self.password = password or os.getenv("FALKORDB_PASSWORD", None)
        self.username = username or os.getenv("FALKORDB_USERNAME", None)
        if ssl is not None:
            self.ssl = ssl
        else:
            self.ssl = os.getenv("FALKORDB_SSL", "false").lower() in ("true", "1", "yes")
        self.default_tenant = default_tenant

        # Initialize underlying FalkorDB client
        if self.url:
            self.db = FalkorDB.from_url(self.url)
        else:
            self.db = FalkorDB(
                host=self.host,
                port=self.port,
                password=self.password,
                username=self.username,
                ssl=self.ssl,
            )
        self._graph_cache: Dict[str, Any] = {}

    def select_graph(self, tenant_id: Optional[str] = None) -> Any:
        """
        Retrieve or cache the FalkorDB Graph handle for a specific tenant namespace.

        Args:
            tenant_id: Graph tenant key (e.g. 'tenant_project_alpha').

        Returns:
            FalkorDB Graph instance.
        """
        tenant = tenant_id or self.default_tenant
        if tenant not in self._graph_cache:
            self._graph_cache[tenant] = self.db.select_graph(tenant)
        return self._graph_cache[tenant]

    def query(
        self,
        cypher: str,
        params: Optional[Dict[str, Any]] = None,
        tenant_id: Optional[str] = None,
    ) -> QueryResult:
        """
        Execute an OpenCypher query against the specified tenant graph.
        Returns formatted records and execution latency in milliseconds.

        Args:
            cypher: Cypher query statement string.
            params: Optional parameter dictionary for parameterized Cypher.
            tenant_id: Target tenant graph namespace.

        Returns:
            QueryResult containing list of record dictionaries and latency_ms.
        """
        graph = self.select_graph(tenant_id)
        start_time = time.perf_counter()

        # FalkorDB query execution
        raw_result = graph.query(cypher, params)
        wall_latency_ms = (time.perf_counter() - start_time) * 1000.0

        # FalkorDB reports internal execution time via run_time_ms
        db_latency_ms = getattr(raw_result, "run_time_ms", None)
        latency_ms = db_latency_ms if (db_latency_ms is not None and db_latency_ms > 0) else wall_latency_ms

        columns: List[str] = []
        if hasattr(raw_result, "header") and raw_result.header:
            columns = [col[1] for col in raw_result.header]

        records: List[Dict[str, Any]] = []
        if hasattr(raw_result, "result_set") and raw_result.result_set:
            for row in raw_result.result_set:
                record: Dict[str, Any] = {}
                for idx, col_name in enumerate(columns):
                    val = row[idx]
                    record[col_name] = self._serialize_value(val)
                records.append(record)

        return QueryResult(
            records=records,
            latency_ms=round(latency_ms, 3),
            columns=columns,
            raw_result=raw_result,
        )

    def _serialize_value(self, val: Any) -> Any:
        """Helper to cleanly extract Python-native dictionaries from FalkorDB Node/Edge instances."""
        if isinstance(val, Node):
            return {
                "_type": "node",
                "id": val.id,
                "labels": getattr(val, "labels", []),
                "properties": getattr(val, "properties", {}),
            }
        elif isinstance(val, Edge):
            return {
                "_type": "edge",
                "id": val.id,
                "relation": getattr(val, "relation", ""),
                "src_node": getattr(val, "src_node", None),
                "dest_node": getattr(val, "dest_node", None),
                "properties": getattr(val, "properties", {}),
            }
        elif isinstance(val, list):
            return [self._serialize_value(item) for item in val]
        elif isinstance(val, dict):
            return {k: self._serialize_value(v) for k, v in val.items()}
        return val

    def reset_graph(self, tenant_id: Optional[str] = None) -> bool:
        """
        Safely wipe all nodes, edges, and schema indices for a tenant graph namespace.
        Silently succeeds if the graph key does not exist yet.

        Args:
            tenant_id: Graph tenant key.

        Returns:
            True if graph was successfully deleted or was already empty.
        """
        tenant = tenant_id or self.default_tenant
        graph = self.select_graph(tenant)
        try:
            graph.delete()
        except (ResponseError, Exception) as exc:
            # Handle cases where graph does not exist in Redis yet
            err_str = str(exc).lower()
            if "empty key" in err_str or "does not exist" in err_str:
                pass
            else:
                raise
        # Evict from graph cache so a fresh handle is created upon next access
        self._graph_cache.pop(tenant, None)
        return True

    def get_full_topology(self, tenant_id: Optional[str] = None) -> Dict[str, List[Dict[str, Any]]]:
        """
        Extract the complete graph topology formatted specifically for UI graph visualizers
        (such as @xyflow/react, React Force Graph, or Cytoscape).

        Output structure:
        {
            "nodes": [
                {
                    "id": "svc_billing",
                    "label": "Service",
                    "labels": ["Service"],
                    "properties": {...}
                }, ...
            ],
            "links": [
                {
                    "id": "link_0",
                    "source": "svc_billing",
                    "target": "svc_auth",
                    "type": "DEPENDS_ON",
                    "properties": {...}
                }, ...
            ]
        }
        """
        graph = self.select_graph(tenant_id)

        # 1. Fetch all nodes
        nodes_res = graph.query("MATCH (n) RETURN n")
        raw_nodes = [row[0] for row in (nodes_res.result_set or [])]

        internal_id_to_key: Dict[int, str] = {}
        nodes: List[Dict[str, Any]] = []

        for node in raw_nodes:
            props = getattr(node, "properties", {})
            labels = getattr(node, "labels", [])
            primary_label = labels[0] if labels else "Node"
            
            # Prefer business identity (e.g. id, name) or fallback to internal integer ID
            node_key = str(props.get("id") or props.get("name") or node.id)
            internal_id_to_key[node.id] = node_key

            nodes.append({
                "id": node_key,
                "internal_id": node.id,
                "label": primary_label,
                "labels": labels,
                "properties": props,
            })

        # 2. Fetch all edges with connected nodes
        edges_res = graph.query("MATCH (s)-[r]->(t) RETURN id(s) AS src_id, r, id(t) AS dst_id")
        links: List[Dict[str, Any]] = []

        for row in (edges_res.result_set or []):
            src_internal_id = row[0]
            edge = row[1]
            dst_internal_id = row[2]

            src_key = internal_id_to_key.get(src_internal_id, str(src_internal_id))
            dst_key = internal_id_to_key.get(dst_internal_id, str(dst_internal_id))
            rel_type = getattr(edge, "relation", "RELATED_TO")
            edge_props = getattr(edge, "properties", {})
            edge_id = f"link_{edge.id}_{src_key}_{dst_key}"

            links.append({
                "id": edge_id,
                "source": src_key,
                "target": dst_key,
                "type": rel_type,
                "properties": edge_props,
            })

        return {
            "nodes": nodes,
            "links": links,
        }
