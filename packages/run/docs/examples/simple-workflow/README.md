```mermaid
---
title: SimpleWorkflow
---

stateDiagram-v2
    direction LR
    [*] --> myTask
    myTask --> [*]
```

A simple workflow with one step.

[[Diagram Source](./simple-workflow.mermaid)] [[Generated Scaffold](./simple-workflow.generated.ts)] [[Implementation](./simple-workflow.ts)]