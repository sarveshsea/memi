import {
  ProductSimulationScenarioSchema,
  SimulationEventSchema,
  SimulationInterviewResultSchema,
  SimulationReportSchema,
  SimulationRunSchema,
  type ProductSimulationScenario,
  type SimulationAdapter,
  type SimulationEvent,
  type SimulationInterviewRequest,
  type SimulationInterviewResult,
  type SimulationPrepareResult,
  type SimulationReport,
  type SimulationRun,
} from "./types.js";

export interface ForkBridgeAdapterOptions {
  baseUrl: string;
  fetchImpl?: typeof fetch;
}

export class ForkBridgeAdapter implements SimulationAdapter {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private importedRuns = new Map<string, string>();

  constructor(options: ForkBridgeAdapterOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async capabilities(): Promise<unknown> {
    return this.request("/api/memoire/capabilities");
  }

  async prepare(scenario: ProductSimulationScenario): Promise<SimulationPrepareResult> {
    const parsed = ProductSimulationScenarioSchema.parse({ ...scenario, adapter: "mirofish" });
    const response = await this.request("/api/memoire/import", {
      method: "POST",
      body: JSON.stringify({ scenario: parsed }),
    }) as { runId?: string; warnings?: string[]; scenario?: ProductSimulationScenario };
    if (response.runId) this.importedRuns.set(parsed.id, response.runId);
    return {
      adapter: "mirofish",
      scenario: response.scenario ? ProductSimulationScenarioSchema.parse(response.scenario) : parsed,
      warnings: response.warnings ?? [],
    };
  }

  async start(scenarioId: string): Promise<SimulationRun> {
    const runId = this.importedRuns.get(scenarioId) ?? scenarioId;
    const payload = await this.request(`/api/memoire/runs/${encodeURIComponent(runId)}/events`) as { run?: unknown; events?: unknown[] };
    const events = (payload.events ?? []).map((event) => SimulationEventSchema.parse(event));
    return SimulationRunSchema.parse(payload.run ?? {
      id: runId,
      scenarioId,
      adapter: "mirofish",
      status: "completed",
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      eventCount: events.length,
      events,
      interviews: [],
      error: null,
    });
  }

  async *stream(runId: string): AsyncIterable<SimulationEvent> {
    const payload = await this.request(`/api/memoire/runs/${encodeURIComponent(runId)}/events`) as { events?: unknown[] };
    for (const event of payload.events ?? []) yield SimulationEventSchema.parse(event);
  }

  async interview(runId: string, request: SimulationInterviewRequest): Promise<SimulationInterviewResult> {
    const payload = await this.request(`/api/memoire/runs/${encodeURIComponent(runId)}/interview`, {
      method: "POST",
      body: JSON.stringify(request),
    });
    return SimulationInterviewResultSchema.parse(payload);
  }

  async stop(runId: string): Promise<SimulationRun> {
    const run = await this.start(runId);
    return SimulationRunSchema.parse({ ...run, status: "stopped", completedAt: new Date().toISOString() });
  }

  async exportReport(runId: string): Promise<SimulationReport> {
    const payload = await this.request(`/api/memoire/runs/${encodeURIComponent(runId)}/export`);
    return SimulationReportSchema.parse(payload);
  }

  private async request(path: string, init?: RequestInit): Promise<unknown> {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
    if (!response.ok) {
      throw new Error(`Simulation fork bridge request failed (${response.status}): ${await response.text()}`);
    }
    return response.json() as Promise<unknown>;
  }
}
