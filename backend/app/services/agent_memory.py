"""Tenant-scoped persistent memory and source-grounded company graph operations."""

from __future__ import annotations

from datetime import datetime, timezone
import json
import os
import re
import urllib.error
import urllib.request
import uuid
from typing import Any, Dict, List, Optional

from app.db.graph_client import FalkorDBClient


def _now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _entity_key(entity_type: str, name: str) -> str:
    return f"{entity_type.strip().lower()}:{name.strip().lower()}"


class AgentMemoryService:
    """Idempotent graph writes and tenant-scoped retrieval for agents."""

    def __init__(self, client: FalkorDBClient):
        self.client = client

    def write_memory(self, *, tenant_id: str, user_id: str, memory_type: str,
                     content: str, agent_id: str, idempotency_key: str,
                     summary: Optional[str] = None, session_id: Optional[str] = None,
                     conversation_id: Optional[str] = None, source_id: Optional[str] = None,
                     confidence: float = 1.0, metadata: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        now = _now()
        record_key = f"{user_id}:{idempotency_key}"
        query = """
        MERGE (m:AgentMemory {record_key: $record_key})
        ON CREATE SET m.id = $id, m.created_at = $now
        SET m.tenant_id = $tenant_id, m.user_id = $user_id,
            m.memory_type = $memory_type, m.content = $content,
            m.summary = $summary, m.agent_id = $agent_id,
            m.session_id = $session_id, m.conversation_id = $conversation_id,
            m.source_id = $source_id, m.confidence = $confidence,
            m.metadata_json = $metadata_json, m.updated_at = $now
        RETURN m.id AS id, m.created_at AS created_at, m.updated_at AS updated_at
        """
        result = self.client.query(query, {
            "record_key": record_key, "id": f"mem_{uuid.uuid4().hex}", "now": now,
            "tenant_id": tenant_id, "user_id": user_id, "memory_type": memory_type,
            "content": content, "summary": summary, "agent_id": agent_id,
            "session_id": session_id, "conversation_id": conversation_id,
            "source_id": source_id, "confidence": confidence,
            "metadata_json": json.dumps(metadata or {}, ensure_ascii=False),
        }, tenant_id=tenant_id)
        row = result.records[0] if result.records else {}
        return {"id": row.get("id"), "tenant_id": tenant_id, "user_id": user_id,
                "memory_type": memory_type, "created_at": row.get("created_at"),
                "updated_at": row.get("updated_at"), "idempotent": True}

    def recall(self, *, tenant_id: str, user_id: str, memory_type: Optional[str] = None,
               session_id: Optional[str] = None, conversation_id: Optional[str] = None,
               limit: int = 50) -> List[Dict[str, Any]]:
        query = """
        MATCH (m:AgentMemory {user_id: $user_id})
        WHERE ($memory_type IS NULL OR m.memory_type = $memory_type)
          AND ($session_id IS NULL OR m.session_id = $session_id)
          AND ($conversation_id IS NULL OR m.conversation_id = $conversation_id)
        RETURN m ORDER BY m.created_at DESC LIMIT $limit
        """
        result = self.client.query(query, {"user_id": user_id, "memory_type": memory_type,
                                           "session_id": session_id, "conversation_id": conversation_id,
                                           "limit": limit}, tenant_id=tenant_id)
        memories = []
        for row in result.records:
            node = row.get("m") or {}
            props = node.get("properties", {}) if isinstance(node, dict) else {}
            try:
                metadata = json.loads(props.get("metadata_json", "{}"))
            except (TypeError, json.JSONDecodeError):
                metadata = {}
            memories.append({**props, "metadata": metadata})
        return memories

    def create_handoff(self, *, tenant_id: str, user_id: str, from_agent: str,
                       to_agent: str, task: str, payload: Dict[str, Any],
                       idempotency_key: str) -> Dict[str, Any]:
        now = _now()
        result = self.client.query("""
        MERGE (h:AgentHandoff {handoff_key: $handoff_key})
        ON CREATE SET h.id = $id, h.version = 1, h.status = 'OPEN', h.created_at = $now,
                      h.updated_at = $now, h.from_agent = $from_agent, h.to_agent = $to_agent,
                      h.task = $task, h.payload_json = $payload_json,
                      h.user_id = $user_id, h.tenant_id = $tenant_id
        RETURN h
        """, {"handoff_key": f"{user_id}:{idempotency_key}", "id": f"handoff_{uuid.uuid4().hex}",
              "now": now, "from_agent": from_agent, "to_agent": to_agent, "task": task,
              "payload_json": json.dumps(payload, ensure_ascii=False), "user_id": user_id,
              "tenant_id": tenant_id}, tenant_id=tenant_id)
        return self._handoff_from_result(result.records[0].get("h") if result.records else None)

    def list_handoffs(self, *, tenant_id: str, user_id: str,
                      status: Optional[str] = None, limit: int = 50) -> List[Dict[str, Any]]:
        result = self.client.query("""
        MATCH (h:AgentHandoff {user_id: $user_id})
        WHERE ($status IS NULL OR h.status = $status)
        RETURN h ORDER BY h.updated_at DESC, h.created_at DESC LIMIT $limit
        """, {"user_id": user_id, "status": status, "limit": limit}, tenant_id=tenant_id)
        return [self._handoff_from_result(row.get("h")) for row in result.records]

    def update_handoff(self, *, tenant_id: str, user_id: str, handoff_id: str,
                       expected_version: int, status: str,
                       payload: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
        query = """
        MATCH (h:AgentHandoff {id: $id, user_id: $user_id})
        WHERE h.version = $expected_version
        SET h.version = h.version + 1, h.status = $status, h.updated_at = $now,
            h.payload_json = coalesce($payload_json, h.payload_json)
        RETURN h
        """
        result = self.client.query(query, {"id": handoff_id, "user_id": user_id,
                                           "expected_version": expected_version, "status": status,
                                           "now": _now(), "payload_json": json.dumps(payload, ensure_ascii=False)
                                           if payload is not None else None}, tenant_id=tenant_id)
        return self._handoff_from_result(result.records[0].get("h")) if result.records else None

    @staticmethod
    def _handoff_from_result(node: Any) -> Dict[str, Any]:
        props = node.get("properties", {}) if isinstance(node, dict) else {}
        try:
            payload = json.loads(props.get("payload_json", "{}"))
        except (TypeError, json.JSONDecodeError):
            payload = {}
        return {**props, "payload": payload}

    def ingest_source(self, *, tenant_id: str, user_id: str,
                      source_type: str, source_id: str, title: str, content: str,
                      source_url: Optional[str], modified_at: Optional[str],
                      entities: List[Dict[str, str]], relationships: List[Dict[str, str]]) -> Dict[str, Any]:
        source_key = f"{source_type}:{source_id}"
        now = _now()
        source_result = self.client.query("""
        MERGE (s:KnowledgeSource {source_key: $source_key})
        ON CREATE SET s.created_at = $now, s.version = 0
        SET s.id = $source_id, s.source_type = $source_type, s.title = $title,
            s.content = $content, s.source_url = $source_url, s.modified_at = $modified_at,
            s.updated_at = $now, s.version = s.version + 1, s.tenant_id = $tenant_id,
            s.created_by = $user_id
        RETURN s.id AS id, s.version AS version
        """, {"source_key": source_key, "source_id": source_id, "source_type": source_type,
              "title": title, "content": content, "source_url": source_url,
              "modified_at": modified_at or now, "now": now, "tenant_id": tenant_id,
              "user_id": user_id}, tenant_id=tenant_id)

        self.client.query("""
        MATCH (s:KnowledgeSource {source_key: $source_key})-[old:MENTIONS]->()
        DELETE old
        """, {"source_key": source_key}, tenant_id=tenant_id)
        self.client.query("""
        MATCH ()-[old:RELATED_TO {source_key: $source_key}]->()
        DELETE old
        """, {"source_key": source_key}, tenant_id=tenant_id)

        normalized = []
        for entity in entities:
            etype = entity["entity_type"].strip().lower()
            name = entity["name"].strip()
            normalized.append({"key": _entity_key(etype, name), "name": name,
                               "entity_type": etype, "description": entity.get("description", ""),
                               "relation": entity.get("relation", "mentions")})
        self.client.query("""
        MATCH (s:KnowledgeSource {source_key: $source_key})
        UNWIND $entities AS item
        MERGE (e:CompanyEntity {entity_key: item.key})
        ON CREATE SET e.created_at = $now
        SET e.name = item.name, e.entity_type = item.entity_type,
            e.description = CASE WHEN item.description <> '' THEN item.description ELSE coalesce(e.description, '') END,
            e.updated_at = $now,
            e.tenant_id = $tenant_id
        MERGE (s)-[m:MENTIONS]->(e)
        SET m.relation = item.relation
        RETURN count(e) AS linked_entities
        """, {"source_key": source_key, "entities": normalized, "now": now,
              "tenant_id": tenant_id}, tenant_id=tenant_id)

        normalized_links = []
        for link in relationships:
            source_type = link["source_type"].strip().lower()
            target_type = link["target_type"].strip().lower()
            source_name = link["source_name"].strip()
            target_name = link["target_name"].strip()
            normalized_links.append({"source_key": _entity_key(source_type, source_name),
                                     "source_name": source_name, "source_type": source_type,
                                     "target_key": _entity_key(target_type, target_name),
                                     "target_name": target_name, "target_type": target_type,
                                     "relation": link["relation"].strip()})
        if normalized_links:
            self.client.query("""
            UNWIND $links AS item
            MERGE (a:CompanyEntity {entity_key: item.source_key})
            ON CREATE SET a.name = item.source_name, a.entity_type = item.source_type, a.created_at = $now
            MERGE (b:CompanyEntity {entity_key: item.target_key})
            ON CREATE SET b.name = item.target_name, b.entity_type = item.target_type, b.created_at = $now
            MERGE (a)-[r:RELATED_TO {relation: item.relation, source_key: $source_key}]->(b)
            SET a.tenant_id = $tenant_id, b.tenant_id = $tenant_id, r.updated_at = $now
            RETURN count(r) AS relationships
            """, {"links": normalized_links, "now": now, "tenant_id": tenant_id,
                  "source_key": source_key},
                           tenant_id=tenant_id)
        source_version = source_result.records[0].get("version") if source_result.records else None
        return {"tenant_id": tenant_id, "source_id": source_id, "source_type": source_type,
                "version": source_version, "entities_linked": len(normalized),
                "relationships_upserted": len(normalized_links)}

    def ask_company(self, *, tenant_id: str, question: str, limit: int = 8) -> Dict[str, Any]:
        topology = self.client.get_full_topology(tenant_id=tenant_id)
        tokens = [token for token in re.findall(r"[a-zA-Z0-9_-]+", question.lower()) if len(token) >= 3]
        stop_words = {"the", "and", "why", "what", "who", "how", "does", "with", "from", "that", "this", "for", "are", "was", "were", "must", "not", "about", "which", "when"}
        tokens = list(dict.fromkeys(token for token in tokens if token not in stop_words))
        scored = []
        for node in topology["nodes"]:
            props = node.get("properties", {})
            searchable = " ".join(str(props.get(key, "")) for key in
                                   ("name", "title", "summary", "rationale", "text", "content", "description", "role", "id")).lower()
            matched = [token for token in tokens if token in searchable]
            if matched:
                score = len(matched) / max(1, len(tokens))
                if node.get("label") in {"KnowledgeSource", "Decision", "JiraTicket", "VCSComment", "Incident"}:
                    score += 0.15
                score += self._freshness_boost(props)
                scored.append((score, node, matched))
        scored.sort(key=lambda item: (item[0], str(item[1].get("id"))), reverse=True)

        node_by_id = {str(node["id"]): node for node in topology["nodes"]}
        adjacency: Dict[str, List[Dict[str, Any]]] = {}
        for edge in topology["links"]:
            adjacency.setdefault(str(edge["source"]), []).append(edge)
            adjacency.setdefault(str(edge["target"]), []).append(edge)
        frontier = [(str(node["id"]), [str(node["id"])]) for _, node, _ in scored[:3]]
        seen = {path[0] for _, path in frontier}
        evidence_nodes: Dict[str, Dict[str, Any]] = {node_id: node_by_id[node_id] for node_id in seen if node_id in node_by_id}
        evidence_depth: Dict[str, int] = {node_id: 0 for node_id in evidence_nodes}
        evidence_paths = []
        for depth in range(4):
            next_frontier = []
            for current, path in frontier:
                for edge in adjacency.get(current, []):
                    neighbor = str(edge["target"] if str(edge["source"]) == current else edge["source"])
                    if neighbor in path or neighbor not in node_by_id:
                        continue
                    next_path = path + [neighbor]
                    evidence_nodes[neighbor] = node_by_id[neighbor]
                    evidence_depth.setdefault(neighbor, depth + 1)
                    evidence_paths.append({"node_ids": next_path,
                                           "relation": edge.get("type"),
                                           "from": node_by_id[current].get("properties", {}).get("name") or current,
                                           "to": node_by_id[neighbor].get("properties", {}).get("name") or neighbor})
                    if neighbor not in seen and len(seen) < 100:
                        seen.add(neighbor)
                        next_frontier.append((neighbor, next_path))
            frontier = next_frontier

        relevant = list(evidence_nodes.values())
        relevant.sort(key=lambda node: (
            self._node_relevance(node, tokens) * 2
            + (0.5 if node.get("label") in {"KnowledgeSource", "Decision", "JiraTicket", "VCSComment", "Incident", "Engineer"} else 0)
            - evidence_depth.get(str(node.get("id")), 4) * 0.05
        ), reverse=True)
        relevant = [node for node in relevant if self._node_relevance(node, tokens) > 0
                    or str(node.get("id")) in evidence_depth][:max(limit, 1)]
        citations = []
        ordered_for_claims = relevant
        if any(word in question.lower() for word in ("who owns", "who knows", "owner", "expert")):
            ordered_for_claims = sorted(relevant, key=lambda node: (
                0 if node.get("label") in {"Engineer", "CompanyEntity"} and
                     str(node.get("properties", {}).get("entity_type", "")).lower() in {"person", "engineer"} else
                1 if node.get("label") in {"Decision", "VCSComment", "JiraTicket", "KnowledgeSource"} else 2,
                -self._node_relevance(node, tokens)))
        for node in ordered_for_claims:
            if node.get("label") not in {"KnowledgeSource", "Decision", "JiraTicket", "VCSComment", "Incident"}:
                continue
            props = node.get("properties", {})
            citations.append({"source_id": props.get("id") or node.get("id"),
                              "source_type": props.get("source_type") or node.get("label"),
                              "title": props.get("title") or props.get("summary") or props.get("name") or props.get("id"),
                              "url": props.get("source_url") or props.get("url"),
                              "excerpt": props.get("content") or props.get("text") or props.get("rationale") or props.get("summary"),
                              "updated_at": props.get("modified_at") or props.get("updated_at")})
        cited_ids = {str(citation["source_id"]) for citation in citations}
        source_nodes = {str(node.get("properties", {}).get("source_key")): node
                        for node in topology["nodes"]
                        if node.get("label") == "KnowledgeSource" and node.get("properties", {}).get("source_key")}
        related_source_keys = {str(edge.get("properties", {}).get("source_key"))
                               for edge in topology["links"] if edge.get("type") == "RELATED_TO"
                               and str(edge.get("source")) in evidence_nodes
                               and str(edge.get("target")) in evidence_nodes
                               and edge.get("properties", {}).get("source_key")}
        for source_key in related_source_keys:
            source_node = source_nodes.get(source_key)
            if not source_node:
                continue
            props = source_node.get("properties", {})
            source_id = str(props.get("id") or source_node.get("id"))
            if source_id not in cited_ids:
                citations.append({"source_id": source_id, "source_type": props.get("source_type", "DOCUMENT"),
                                  "title": props.get("title") or source_id,
                                  "url": props.get("source_url"), "excerpt": props.get("content"),
                                  "updated_at": props.get("modified_at") or props.get("updated_at")})
                cited_ids.add(source_id)
        claims = []
        for node in relevant:
            props = node.get("properties", {})
            label = node.get("label", "CompanyEntity")
            name = props.get("name") or props.get("title") or props.get("id") or node.get("id")
            fact = props.get("rationale") or props.get("summary") or props.get("text") or props.get("content") or props.get("description")
            if label == "Engineer" and (props.get("role") or props.get("name")):
                fact = f"{props.get('name')} is {props.get('role', 'a company contributor')}"
            if fact:
                claim = f"{label} {name}: {str(fact).strip()}"
                if claim not in claims:
                    claims.append(claim)
            if len(claims) >= 4:
                break
        answer = "\n".join(claims) if claims else "I couldn't find matching evidence in this tenant's graph. Add a source or try a more specific name, project, ticket, or decision."
        answer_mode = "graph"
        llm_note = None
        if os.getenv("GEMINI_API_KEY") and citations:
            try:
                answer = self._answer_with_gemini(question=question, citations=citations[:limit], fallback=answer)
                answer_mode = "gemini"
            except (urllib.error.URLError, TimeoutError, ValueError, KeyError, IndexError) as exc:
                # Keep graph-grounded answers available when Gemini is unavailable.
                llm_note = f"Gemini unavailable; showing graph retrieval results ({type(exc).__name__})."
        elif os.getenv("GEMINI_API_KEY") and not citations:
            llm_note = "Gemini was not called because no source citations matched this question."
        return {"tenant_id": tenant_id, "question": question, "answer": answer,
                "matched_terms": tokens, "evidence_paths": evidence_paths[:20],
                "entities": [{"id": node.get("id"), "label": node.get("label"),
                              "name": node.get("properties", {}).get("name") or node.get("properties", {}).get("title") or node.get("properties", {}).get("id"),
                              "properties": node.get("properties", {})} for node in relevant],
                "citations": citations[:limit], "grounded": bool(citations or claims),
                "answer_mode": answer_mode, "llm_note": llm_note}

    @staticmethod
    def _answer_with_gemini(*, question: str, citations: List[Dict[str, Any]], fallback: str) -> str:
        """Generate a concise answer using only retrieved graph evidence."""
        api_key = os.getenv("GEMINI_API_KEY", "").strip()
        model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash").strip()
        evidence = [{"source_id": item.get("source_id"), "title": item.get("title"),
                     "type": item.get("source_type"), "excerpt": str(item.get("excerpt") or "")[:1800]}
                    for item in citations]
        prompt = (
            "Answer the user's company question using only the supplied graph evidence. "
            "Cite every factual claim inline using [source_id]. If the evidence does not answer something, "
            "say what is missing. Do not invent people, ownership, dates, or decisions. Keep the response concise.\n\n"
            f"Question: {question}\n\nEvidence JSON:\n{json.dumps(evidence, ensure_ascii=False)}\n\n"
            f"Graph retrieval summary (use only if supported by the evidence):\n{fallback}"
        )
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
        request = urllib.request.Request(
            url,
            data=json.dumps({
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {"temperature": 0.2, "maxOutputTokens": 700},
            }).encode("utf-8"),
            headers={"Content-Type": "application/json", "x-goog-api-key": api_key},
            method="POST",
        )
        with urllib.request.urlopen(request, timeout=20) as response:
            result = json.loads(response.read().decode("utf-8"))
        text = result["candidates"][0]["content"]["parts"][0]["text"].strip()
        if not text:
            raise ValueError("Gemini returned an empty answer")
        return text

    @staticmethod
    def _node_relevance(node: Dict[str, Any], tokens: List[str]) -> int:
        props = node.get("properties", {})
        searchable = " ".join(str(props.get(key, "")) for key in
                               ("name", "title", "summary", "rationale", "text", "content", "description", "role", "id")).lower()
        return sum(1 for token in tokens if token in searchable)

    @staticmethod
    def _freshness_boost(properties: Dict[str, Any]) -> float:
        """Favor current ingested evidence modestly without hiding older decisions."""
        value = properties.get("modified_at") or properties.get("updated_at")
        if not value:
            return 0.0
        try:
            parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=timezone.utc)
            age_days = max(0.0, (datetime.now(timezone.utc) - parsed).total_seconds() / 86400)
            return 0.2 * (0.5 ** (age_days / 180))
        except (TypeError, ValueError):
            return 0.0
