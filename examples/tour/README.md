# A Tour of GRAIL at the Command Line

GRAIL is a runtime for pursuing a goal within a bounded environment of available capabilities.

The easiest way to understand GRAIL is to use it. This tour starts with a small working GRAIL world and changes one thing at a time. You will change inputs, invoke the world from different locations, pursue a different goal, ask for a goal the world cannot resolve, and finally use the shell to repeat pursuits.

The important thing to watch is what does not change: the world continues to define the available possibilities while each invocation supplies the context for a particular pursuit.

## Before you begin

This directory is a complete GRAIL world prepared for the tour:

```text
grail-cli-tour/
├── capabilities/
│   ├── farewell.js
│   └── hello.js
├── config/
│   ├── goal.json
│   ├── inputs.json
│   ├── registry.json
│   └── worldstate.json
└── inputs/
    ├── jane.json
    ├── mike.json
    └── ruth.json
```

The examples assume that the `grail` command is installed or linked and that your shell is initially in this `grail-cli-tour` directory.

## 1. Validate and run the world

Start by validating the environment:

```bash
grail validate
```

GRAIL uses `./config` as the default configuration directory, so no `--config` option is needed when `config` is a subdirectory of the current directory.

Now run it:

```bash
grail run
```

The configured goal is `greetingCreated`. The registry contains an affordance that can establish that effect, so GRAIL can select it, invoke the bound `hello.js` capability, and reach the goal.

You have just pursued a GRAIL goal.

## 2. Change the input

The default input is stored in `config/inputs.json`:

```json
{
  "name": "World"
}
```

You do not need to edit that file to use a different value. Try:

```bash
grail run --inputs '{"name":"Mike"}'
```

Then try another:

```bash
grail run --inputs '{"name":"Jane"}'
```

The same world is being used each time. Only the invocation input changes.

For a `run` invocation, an `--inputs` value replaces the value loaded from `inputs.json`. It does not modify `inputs.json` itself.

## 3. Supply inputs from a file

The `inputs/` directory contains several input documents. For example, `inputs/ruth.json` contains:

```json
{
  "name": "Ruth"
}
```

Use it with:

```bash
grail run --inputs-file ./inputs/ruth.json
```

An `--inputs-file` path is resolved relative to the caller's current working directory. This is different from capability binding paths, which belong to the GRAIL world.

`--inputs` and `--inputs-file` are alternative ways to supply invocation inputs and cannot be used together.

## 4. Leave the world

So far the shell has been inside `grail-cli-tour`. Move to its parent directory:

```bash
cd ..
```

Now run the same world explicitly:

```bash
grail run --config ./grail-cli-tour/config
```

The world still works.

The selected configuration directory tells GRAIL where the world lives. Relative capability binding paths are resolved from the **world root**, which is the parent of the configuration directory, rather than from the shell's current working directory.

That means the caller and the world do not need to occupy the same place.

For the remaining examples, stay in this parent directory and use `--config ./grail-cli-tour/config`.

## 5. Explore the possibilities in the world

This tour world contains two capabilities:

```text
hello.js     -> greetingCreated
farewell.js  -> farewellCreated
```

The default `config/goal.json` contains:

```json
{
  "goal": "greetingCreated"
}
```

But the registry describes both possibilities. It is not a workflow saying that greeting must happen before farewell or that both must happen. It describes capabilities that are available in this world and the effects they can establish.

## 6. Change the goal

Ask the same world to pursue its other available effect:

```bash
grail run \
  --config ./grail-cli-tour/config \
  --goal farewellCreated \
  --inputs '{"name":"Mike"}'
```

GRAIL now pursues `farewellCreated` instead of the goal stored in `goal.json`.

For a `run` invocation, `--goal` takes precedence over `goal.json`. The file itself is not changed.

You can therefore make different requests of the same world:

```bash
grail run \
  --config ./grail-cli-tour/config \
  --goal greetingCreated \
  --inputs '{"name":"Mike"}'

grail run \
  --config ./grail-cli-tour/config \
  --goal farewellCreated \
  --inputs '{"name":"Mike"}'
```

The world defines the possibilities. The invocation identifies which possibility GRAIL should pursue.

## 7. Ask for something the world cannot do

Now request a goal for which the world has no producer:

```bash
grail run \
  --config ./grail-cli-tour/config \
  --goal makeCoffee
```

GRAIL should report that `makeCoffee` cannot be resolved with the available capabilities.

Check the process exit code immediately afterward:

```bash
echo $?
```

The result should be:

```text
1
```

The command was valid and GRAIL was able to examine the world. The pursuit failed because the requested goal could not be reached using the capabilities available in that world.

This is different from an invalid command or invalid configuration, which exits with code `2`.

## 8. Let the shell provide the loop

The `inputs/` directory contains three cases:

```text
inputs/
├── jane.json
├── mike.json
└── ruth.json
```

Use the shell to invoke GRAIL once for each input document:

```bash
for input in ./grail-cli-tour/inputs/*.json
do
  grail run \
    --config ./grail-cli-tour/config \
    --inputs-file "$input"
done
```

The shell owns the loop. Each iteration starts a separate GRAIL pursuit with a different invocation context.

GRAIL itself does not need looping semantics to participate in a repetitive or larger process.

The exit-code contract also makes it possible for the caller to decide what to do when a pursuit fails:

```bash
for input in ./grail-cli-tour/inputs/*.json
do
  grail run \
    --config ./grail-cli-tour/config \
    --inputs-file "$input" || break
done
```

Here the shell stops the loop if GRAIL returns a nonzero exit code.

## What changed?

During this tour, you changed:

- the inputs supplied to a pursuit;
- the location from which GRAIL was invoked;
- the goal GRAIL was asked to pursue; and
- the number of times the caller invoked GRAIL.

You did not create a new workflow for each variation. The same world continued to describe its conditions, affordances, effects, and bound capabilities.

A useful way to think about the separation is:

```text
World
  defines what is possible

Invocation
  supplies the goal and inputs

GRAIL
  pursues the goal within the world

Capabilities
  perform the domain work

Caller
  decides when and how often to invoke GRAIL
```

This is the central idea behind working with GRAIL from the command line.

> Define the environment, not the path.

## Where to go next

This tour focused on using an existing GRAIL world rather than authoring one. The next step is to inspect `config/registry.json`, `config/worldstate.json`, and the two files in `capabilities/` and see how the world's possibilities are declared and bound to executable behavior.
