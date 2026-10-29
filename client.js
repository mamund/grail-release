// client.js
export class Client {
  constructor(server, inputs, onProgress = null) {
    this.server = server;
    this.inputs = inputs;
    this.stack = [];
    this.onProgress = onProgress;
    this.onStackEvent = null; // Optional diagnostic callback; independent of progress reporting.
  }

  reportProgress(event) {
    if (this.onProgress) this.onProgress(event);
  }

  reportStackEvent(type, affordance, result = null) {
    if (typeof this.onStackEvent !== 'function') return;
    // The callback is observational: exceptions must not affect a pursuit.
    try {
      this.onStackEvent({
        type,
        affordance,
        result,
        stack: this.stack.map(item => item.action)
      });
    } catch {
      // Ignore diagnostic callback errors.
    }
  }

  async pursue(goal) {
    // Each pursuit has its own traversal stack. Worldstate and observations persist.
    this.stack = [];
    this.unresolvable = false;
    // Rejections apply only to the active resolution path of this pursuit.
    const exclusions = new Map();
    const rootExclusions = new Set();
    const activeActions = () => new Set(this.stack.map(item => item.action));
    const exclusionsFor = (parent, condition) => {
      let byCondition = exclusions.get(parent);
      if (!byCondition) {
        byCondition = new Map();
        exclusions.set(parent, byCondition);
      }
      if (!byCondition.has(condition)) byCondition.set(condition, new Set());
      return byCondition.get(condition);
    };
    // Track which parent condition led to each stack entry.
    const dependencies = [];
    this.server.onProgress = this.onProgress;
    this.server.goal = goal;
    console.log(`\n[CLIENT] Starting pursuit: ${goal}`);
    this.reportProgress({ type: "pursuit.started", goal });

    while (true) {

      // If there is no current work, resolve the goal.
      if (this.stack.length === 0) {
        const response = this.server.resolveGoal(goal, { excludedAffordances: rootExclusions });

        if (response.result === "SUCCESS") {
          console.log(`[CLIENT] Goal reached: ${goal}`);
          this.reportProgress({ type: "pursuit.completed", goal, reached: true });
          break;
        }

        if (response.offeredAffordances.length > 0) {
          const next = response.offeredAffordances[0];

          console.log(
            `[CLIENT] Pushing goal affordance: ${next.action}`
          );

          this.stack.push(next);
          dependencies.push(goal);
          this.reportStackEvent("stack.push", next.action);
          continue;
        }

        console.log(
          `[CLIENT] Cannot proceed: goal is unresolvable - ${goal}`
        );
        this.unresolvable = true;
        this.reportProgress({ type: "pursuit.unresolvable", goal });
        break;
      }

      const current = this.stack[this.stack.length - 1];
      const active = activeActions();
      const rejected = exclusions.get(current);
      // A parent may have different rejected producers for different conditions.
      // The server selects a condition first; pass the condition-specific exclusions.
      const response = await this.server.attempt(current, this.inputs, {
        activeAffordances: active,
        excludedByCondition: rejected ?? new Map()
      });

      if (response.result === "SUCCESS") {
        console.log(`[CLIENT] Affordance succeeded: ${current.action}`);

        this.stack.pop();
        dependencies.pop();
        exclusions.delete(current);
        this.reportStackEvent("stack.pop", current.action, "SUCCESS");

      } else if (
        response.result === "BLOCKED" &&
        response.offeredAffordances.length > 0
      ) {
        const next = response.offeredAffordances[0];

        console.log(`[CLIENT] Pushing next affordance: ${next.action}`);
        this.reportProgress({ type: "affordance.blocked", goal, affordance: current.action, condition: response.condition ?? null, nextAffordance: next.action });
        this.stack.push(next);
        dependencies.push(response.condition);
        this.reportStackEvent("stack.push", next.action);

      } else if (response.result === "FAIL") {
        console.log(`[CLIENT] Affordance failed: ${current.action}`);
        
        this.stack.pop();
        dependencies.pop();
        exclusions.delete(current);
        this.reportStackEvent("stack.pop", current.action, "FAIL");

      } else if (
        response.result === "BLOCKED" &&
        response.condition
      ) {
        console.log(
          `[CLIENT] Cannot proceed: condition is unresolvable - ${response.condition}`
        );
        if (response.reason !== "EXHAUSTED_ALTERNATIVES") {
          this.unresolvable = true;
          this.reportProgress({ type: "condition.unresolvable", goal, condition: response.condition });
          break;
        }
        // This producer cannot satisfy its dependencies on the current path.
        // Reject it at its parent decision point and try another producer.
        this.stack.pop();
        const requiredCondition = dependencies.pop();
        exclusions.delete(current);
        const parent = this.stack[this.stack.length - 1];
        if (parent && requiredCondition) {
          exclusionsFor(parent, requiredCondition).add(current.action);
        } else {
          rootExclusions.add(current.action);
        }
        this.reportStackEvent("stack.pop", current.action, "BLOCKED");
        continue;

      } else {
        console.log(`[CLIENT] Cannot proceed: ${response.result}`);
        this.reportProgress({ type: "pursuit.stopped", goal, result: response.result });
        break;
      }
    }
  }
}
