import { executeBinding } from "./bindings/binding.js";

// server.js (generic broker)
export class Server {
  constructor(worldState, affordanceRegistry, observationStore, baseDir = process.cwd()) {
    this.worldState = worldState;
    this.affordanceRegistry = affordanceRegistry;
    this.observationStore = observationStore;
    this.baseDir = baseDir;
    this.onProgress = null;
    this.goal = null;
    this.recoveryEnabled = false;
    this.recoveryStack = [];
    this.onSelectionEvent = null; // Optional diagnostic callback, separate from progress.
  }

  async attempt(affordance, inputs) {
    console.log(`\n[SERVER] Attempting affordance: ${affordance.action}`);

    const unmetPreconditions = affordance.preconditions.filter(
      pre => !this.worldState.isPreconditionMet(pre)
    );

    if (unmetPreconditions.length > 0) {
      const pre = this.selectUnmetCondition(unmetPreconditions);

      console.log(`[SERVER] Blocked: selected unmet precondition: ${pre}`);

      const candidates = this.findAffordancesForCondition(pre);
      const nextAffordance = this.selectAffordance(candidates);

      if (nextAffordance) {
        return {
          result: "BLOCKED",
          condition: pre,
          offeredAffordances: [nextAffordance]
        };
      }

      return {
        result: "BLOCKED",
        condition: pre,
        offeredAffordances: []
      };
    }

    const resolvedInputs = {};

    for (const [inputName, source] of Object.entries(affordance.inputs)) {
      const resolution = this.resolveInput(source, inputs);

      if (!resolution.resolved) {
        console.log(`[SERVER] Blocked: missing input: ${inputName}`);

        return {
          result: "BLOCKED",
          offeredAffordances: []
        };
      }

      resolvedInputs[inputName] = resolution.value;
    }

    if (
      affordance.binding &&
      affordance.binding.enabled !== false
    ) {
      // Measure only the actual binding invocation, not precondition resolution.
      const invocationId = this.observationStore.nextInvocationId();
      const startedAt = new Date().toISOString();
      const startNs = process.hrtime.bigint();
      this.onProgress?.({ type: "capability.started", goal: this.goal, affordance: affordance.action });
      const interaction = await executeBinding(
        affordance.binding,
        resolvedInputs,
        this.baseDir,
        { pursuitId: this.pursuitId, invocationId }
      );
      const durationMs = Number(process.hrtime.bigint() - startNs) / 1e6;

      console.log(`[SERVER] Executing binding: ${interaction.description}`);

      const result = interaction.ok ? "SUCCESS" : "FAIL";
      this.observationStore.append({
        pursuitId: this.pursuitId,
        invocation: {
          id: invocationId,
          affordance: affordance.action,
          timestamp: startedAt,
          ...interaction.invocation
        },
        timing: { durationMs },
        response: interaction.response,
        outputs: interaction.outputs,
        result
      });

      this.onProgress?.({ type: "capability.completed", goal: this.goal, affordance: affordance.action, result, durationMs });

      if (!interaction.ok) {
        console.log(`[SERVER] Binding failed: ${interaction.summary}`);

        return {
          result: "FAIL",
          offeredAffordances: []
        };
      }

      // Record successful forward invocations for possible LIFO compensation.
      // No handler is invoked here; entries remain internal to this pursuit.
      if (this.recoveryEnabled) {
        this.recoveryStack.push({
          pursuitId: this.pursuitId,
          invocationId,
          affordance: affordance.action,
          binding: affordance.binding
        });
      }

      console.log(`[SERVER] Binding succeeded: ${interaction.summary}`);
    }

    console.log(
      `[SERVER] Success: applying effects - ${affordance.effects}`
    );

    this.worldState.applyEffects(affordance.effects);

    return {
      result: "SUCCESS",
      offeredAffordances: []
    };
  }

  resolveGoal(goal) {
    if (this.worldState.isPreconditionMet(goal)) {
      return {
        result: "SUCCESS",
        offeredAffordances: []
      };
    }

    const candidates = this.findAffordancesForCondition(goal);
    const nextAffordance = this.selectAffordance(candidates);

    if (nextAffordance) {
      return {
        result: "BLOCKED",
        condition: goal,
        offeredAffordances: [nextAffordance]
      };
    }

    return {
      result: "BLOCKED",
      condition: goal,
      offeredAffordances: []
    };
  }

  resolveInput(source, inputs) {
    const inputPrefix = "$inputs.";

    if (source.startsWith(inputPrefix)) {
      const inputName = source.slice(inputPrefix.length);

      if (!inputName || !(inputName in inputs)) {
        return { resolved: false };
      }

      return {
        resolved: true,
        value: inputs[inputName]
      };
    }

    if (source.startsWith("$outputs.")) {
      return this.observationStore.resolve(source);
    }

    return { resolved: false };
  }

  reportSelectionEvent(event) {
    if (typeof this.onSelectionEvent !== "function") return;
    try {
      this.onSelectionEvent(event);
    } catch {
      // Diagnostic callbacks must not affect pursuit behavior.
    }
  }

  selectUnmetCondition(conditions) {
    if (conditions.length === 0) {
      return null;
    }

    const selected = conditions[
      Math.floor(Math.random() * conditions.length)
    ];
    this.reportSelectionEvent({
      type: "condition.selected",
      condition: selected,
      candidates: [...conditions]
    });
    return selected;
  }

  selectAffordance(affordances) {
    const eligible = affordances.filter(affordance => {
      const observations =
        this.observationStore.getByAffordance(affordance.action);

      return !observations.some(
        observation => observation.result === "FAIL"
      );
    });

    if (eligible.length === 0) {
      return null;
    }

    const selected = eligible[
      Math.floor(Math.random() * eligible.length)
    ];
    this.reportSelectionEvent({
      type: "affordance.selected",
      affordance: selected.action,
      candidates: eligible.map(item => item.action)
    });
    return selected;
  }

  findAffordancesForCondition(condition) {
    const candidates = [];

    for (let key in this.affordanceRegistry) {
      const candidate = this.affordanceRegistry[key];

      if (
        candidate.enabled !== false &&
        candidate.effects.includes(condition)
      ) {
        candidates.push(candidate);
      }
    }

    return candidates;
  }
}
