import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import CypherPlaygroundModal from "../components/CypherPlaygroundModal";

describe("CypherPlaygroundModal Unit Tests", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string, options?: RequestInit) => {
        if (url.includes("/api/graph/query")) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                status: "SUCCESS",
                tenant_id: "tenant_project_alpha",
                columns: ["endpoint", "status"],
                records: [{ endpoint: "/v3/oauth/token", status: "ACTIVE" }],
                latency_ms: 1.45,
                count: 1,
              }),
          });
        }
        return Promise.reject(new Error(`Unhandled fetch url: ${url}`));
      })
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not render when isOpen is false", () => {
    render(<CypherPlaygroundModal isOpen={false} onClose={() => {}} tenantId="tenant_test" />);
    expect(screen.queryByText(/FalkorDB Cypher Playground/i)).not.toBeInTheDocument();
  });

  it("renders preset queries and executes query successfully", async () => {
    const handleClose = vi.fn();
    render(<CypherPlaygroundModal isOpen={true} onClose={handleClose} tenantId="tenant_project_alpha" />);

    expect(screen.getByText(/FalkorDB Cypher Playground/i)).toBeInTheDocument();
    expect(screen.getByText(/tenant_project_alpha/i)).toBeInTheDocument();

    // Click preset query
    const preset = screen.getByText(/API Endpoints & Status/i);
    await act(async () => {
      fireEvent.click(preset);
    });

    await waitFor(() => {
      expect(screen.getByText(/\/v3\/oauth\/token/i)).toBeInTheDocument();
      expect(screen.getByText(/1.45ms/i)).toBeInTheDocument();
    });

    // Toggle JSON view
    const jsonBtn = screen.getByText("JSON");
    await act(async () => {
      fireEvent.click(jsonBtn);
    });

    await waitFor(() => {
      expect(screen.getByText(/"status": "ACTIVE"/i)).toBeInTheDocument();
    });
  });

  it("displays error message on query failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            status: "ERROR",
            error: "Syntax error at position 5",
            columns: [],
            records: [],
            latency_ms: 0,
            count: 0,
          }),
      })
    );

    render(<CypherPlaygroundModal isOpen={true} onClose={() => {}} tenantId="tenant_project_alpha" />);

    const execBtn = screen.getByRole("button", { name: /Execute Cypher/i });
    await act(async () => {
      fireEvent.click(execBtn);
    });

    await waitFor(() => {
      expect(screen.getByText(/Cypher Execution Error/i)).toBeInTheDocument();
      expect(screen.getByText(/Syntax error at position 5/i)).toBeInTheDocument();
    });
  });
});
