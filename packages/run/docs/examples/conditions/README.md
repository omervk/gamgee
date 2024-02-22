```mermaid
---
title: ConditionsWorkflow
---

stateDiagram-v2
    state choice <<choice>>

    direction LR
    [*] --> decide
    decide --> choice
    choice --> left: chooseLeft
    choice --> right: chooseRight
    left --> [*]
    right --> [*]
```

A workflow with a decision between going with the left or right branches.

[[Diagram Source](./conditions.mermaid)] [[Generated Scaffold](./conditions.generated.ts)] [[Implementation](./conditions.ts)]