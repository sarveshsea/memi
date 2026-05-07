import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  ProductSimulationScenarioSchema,
  SimulationRunSchema,
  type ProductSimulationScenario,
  type SimulationRun,
} from "./types.js";

export class FileSimulationStore {
  readonly root: string;

  constructor(projectRoot: string) {
    this.root = join(projectRoot, ".memoire", "simulations");
  }

  async saveScenario(scenario: ProductSimulationScenario): Promise<void> {
    await this.writeJson(join("scenarios", `${scenario.id}.json`), ProductSimulationScenarioSchema.parse(scenario));
  }

  async loadScenario(id: string): Promise<ProductSimulationScenario | null> {
    try {
      const raw = await readFile(join(this.root, "scenarios", `${id}.json`), "utf-8");
      return ProductSimulationScenarioSchema.parse(JSON.parse(raw));
    } catch {
      return null;
    }
  }

  async saveRun(run: SimulationRun): Promise<void> {
    await this.writeJson(join("runs", `${run.id}.json`), SimulationRunSchema.parse(run));
  }

  async loadRun(id: string): Promise<SimulationRun | null> {
    try {
      const raw = await readFile(join(this.root, "runs", `${id}.json`), "utf-8");
      return SimulationRunSchema.parse(JSON.parse(raw));
    } catch {
      return null;
    }
  }

  async listRuns(): Promise<SimulationRun[]> {
    try {
      const files = await readdir(join(this.root, "runs"));
      const runs = await Promise.all(files
        .filter((file) => file.endsWith(".json"))
        .map((file) => this.loadRun(file.replace(/\.json$/, ""))));
      return runs.filter((run): run is SimulationRun => Boolean(run));
    } catch {
      return [];
    }
  }

  private async writeJson(relativePath: string, value: unknown): Promise<void> {
    const target = join(this.root, relativePath);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, `${JSON.stringify(value, null, 2)}\n`, "utf-8");
  }
}
