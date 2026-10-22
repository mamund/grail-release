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
    this.server.onProgress = this.onProgress;
    this.server.goal = goal;
    console.log(`\n[CLIENT] Starting pursuit: ${goal}`);
    this.reportProgress({ type: "pursuit.started", goal });

    while (true) {

      // If there is no current work, resolve the goal.
      if (this.stack.length === 0) {
        const response = this.server.resolveGoal(goal);

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
      const response = await this.server.attempt(current, this.inputs);

      if (response.result === "SUCCESS") {
        console.log(`[CLIENT] Affordance succeeded: ${current.action}`);

        this.stack.pop();
        this.reportStackEvent("stack.pop", current.action, "SUCCESS");

      } else if (
        response.result === "BLOCKED" &&
        response.offeredAffordances.length > 0
      ) {
        const next = response.offeredAffordances[0];

        console.log(`[CLIENT] Pushing next affordance: ${next.action}`);
        this.reportProgress({ type: "affordance.blocked", goal, affordance: current.action, condition: response.condition ?? null, nextAffordance: next.action });
        this.stack.push(next);
        this.reportStackEvent("stack.push", next.action);

      } else if (response.result === "FAIL") {
        console.log(`[CLIENT] Affordance failed: ${current.action}`);
        
        this.stack.pop();
        this.reportStackEvent("stack.pop", current.action, "FAIL");

      } else if (
        response.result === "BLOCKED" &&
        response.condition
      ) {
        console.log(
          `[CLIENT] Cannot proceed: condition is unresolvable - ${response.condition}`
        );
        this.unresolvable = true;
        this.reportProgress({ type: "condition.unresolvable", goal, condition: response.condition });
        break;

      } else {
        console.log(`[CLIENT] Cannot proceed: ${response.result}`);
        this.reportProgress({ type: "pursuit.stopped", goal, result: response.result });
        break;
      }
    }
  }
}
