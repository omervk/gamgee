import { mermaidToScaffold } from '../src/scaffold'
import { expect } from '@jest/globals'

describe('test failures to generate scaffolds', () => {
    it.concurrent(`empty file`, () => {
        expect(() => mermaidToScaffold('', `./test.ts`, '.')).toThrow(
            new Error('Unable to parse Mermaid diagram - please check that you have both a header and a diagram.'),
        )
    })

    it.concurrent(`title only`, () => {
        expect(() =>
            mermaidToScaffold(
                `
---
title: Workflow
---
                `.trim(),
                `./test.ts`,
                '.',
            ),
        ).toThrow(
            new Error('Unable to parse Mermaid diagram - please check that you have both a header and a diagram.'),
        )
    })

    it.concurrent(`no title`, () => {
        expect(() =>
            mermaidToScaffold(
                `
stateDiagram-v2
    [*] --> test
    test --> [*]
                `.trim(),
                `./test.ts`,
                '.',
            ),
        ).toThrow(
            new Error('Unable to parse Mermaid diagram - please check that you have both a header and a diagram.'),
        )
    })

    it.concurrent(`header but no title`, () => {
        expect(() =>
            mermaidToScaffold(
                `
---
little: Workflow
---

stateDiagram-v2
    test --> [*]
                `.trim(),
                `./test.ts`,
                '.',
            ),
        ).toThrow(new Error('Mermaid diagram must have a title. Please specify one in the header.'))
    })

    it.concurrent(`no start`, () => {
        expect(() =>
            mermaidToScaffold(
                `
---
title: Workflow
---

stateDiagram-v2
    test --> [*]
                `.trim(),
                `./test.ts`,
                '.',
            ),
        ).toThrow(
            new Error(
                'Found errors while validating the diagram:\n' +
                    '* Unable to determine any step being the first, with a relation coming from [*].',
            ),
        )
    })

    it.concurrent(`no end`, () => {
        expect(() =>
            mermaidToScaffold(
                `
---
title: Workflow
---

stateDiagram-v2
    [*] --> test
                `.trim(),
                `./test.ts`,
                '.',
            ),
        ).toThrow(
            new Error(
                'Found errors while validating the diagram:\n' +
                    '* The state test has no outgoing connection and must be connected to the end state [*] explicitly.',
            ),
        )
    })

    it.concurrent(`start connects to end`, () => {
        expect(() =>
            mermaidToScaffold(
                `
---
title: Workflow
---

stateDiagram-v2
    [*] --> [*]
                `.trim(),
                `./test.ts`,
                '.',
            ),
        ).toThrow(
            new Error(
                "Found errors while parsing the diagram's relations:\n" +
                    '* The start and end states may not have self-arrows or be linked directly to each other.',
            ),
        )
    })

    it.concurrent(`two states from start`, () => {
        expect(() =>
            mermaidToScaffold(
                `
---
title: Workflow
---

stateDiagram-v2
    [*] --> a
    [*] --> b
    a --> [*]
    b --> [*]
                `.trim(),
                `./test.ts`,
                '.',
            ),
        ).toThrow(
            new Error(
                'Found errors while validating the diagram:\n' +
                    '* Only one relation may leave a non-decision step. The step [*] has outgoing arrows to the steps a, b.',
            ),
        )
    })

    it.concurrent(`two states from one state`, () => {
        expect(() =>
            mermaidToScaffold(
                `
---
title: Workflow
---

stateDiagram-v2
    [*] --> a
    a --> b
    a --> c
    b --> [*]
    c --> [*]
                `.trim(),
                `./test.ts`,
                '.',
            ),
        ).toThrow(
            new Error(
                'Found errors while validating the diagram:\n' +
                    '* Only one relation may leave a non-decision step. The step a has outgoing arrows to the steps b, c.',
            ),
        )
    })

    it.concurrent(`decision self-arrow`, () => {
        expect(() =>
            mermaidToScaffold(
                `
---
title: Workflow
---

stateDiagram-v2
    state choice <<choice>>

    [*] --> decide
    decide --> choice
    choice --> choice: attempts=2
    choice --> left: chooseLeft
    choice --> right: chooseRight
    left --> [*]
    right --> [*]
`.trim(),
                `./test.ts`,
                '.',
            ),
        ).toThrow(
            new Error(
                "Found errors while parsing the diagram's relations:\n" +
                    '* Decisions may not have self-arrows. The decision choice connects to itself.',
            ),
        )
    })

    it.concurrent(`decision to decision`, () => {
        expect(() =>
            mermaidToScaffold(
                `
---
title: Workflow
---

stateDiagram-v2
    state choice1 <<choice>>
    state choice2 <<choice>>

    [*] --> decide
    decide --> choice1
    choice1 --> left: chooseLeft
    choice1 --> choice2: chooseChoice
    choice2 --> right: chooseRight
    left --> [*]
    right --> [*]
`.trim(),
                `./test.ts`,
                '.',
            ),
        ).toThrow(
            new Error(
                "Found errors while parsing the diagram's relations:\n" +
                    '* A decision can not be directly connected to another decision. There is a connection between choice1 and choice2.',
            ),
        )
    })

    it.concurrent(`unnamed decision`, () => {})
    expect(() =>
        mermaidToScaffold(
            `
---
title: Workflow
---

stateDiagram-v2
    state choice <<choice>>

    direction LR
    [*] --> decide
    decide --> choice
    choice --> left: chooseLeft
    choice --> right
    left --> [*]
    right --> [*]
`.trim(),
            `./test.ts`,
            '.',
        ),
    ).toThrow(
        new Error(
            "Found errors while parsing the diagram's relations:\n" +
                '* All relations coming out of decisions must be named. The relation from choice to right is unnamed.',
        ),
    )

    it.concurrent(`undescribed self-arrow`, () => {
        expect(() =>
            mermaidToScaffold(
                `
---
title: Workflow
---

stateDiagram-v2
    [*] --> a
    a --> a
    a --> [*]
                `.trim(),
                `./test.ts`,
                '.',
            ),
        ).toThrow(
            new Error(
                "Found errors while parsing the diagram's relations:\n" +
                    '* Self-arrows must include information about retries. The self-arrow on a provides no information.',
            ),
        )
    })

    it.concurrent(`attempts are text`, () => {
        expect(() =>
            mermaidToScaffold(
                `
---
title: Workflow
---

stateDiagram-v2
    [*] --> a
    a --> a: attempts=a
    a --> [*]
                `.trim(),
                `./test.ts`,
                '.',
            ),
        ).toThrow(
            new Error(
                'Found errors while validating the diagram:\n' +
                    "* Number of attempts for a is 'a', which is not a number. Only whole positive numbers are allowed.",
            ),
        )
    })

    it.concurrent(`attempts are negative`, () => {
        expect(() =>
            mermaidToScaffold(
                `
---
title: Workflow
---

stateDiagram-v2
    [*] --> a
    a --> a: attempts=-2
    a --> [*]
                `.trim(),
                `./test.ts`,
                '.',
            ),
        ).toThrow(
            new Error(
                'Found errors while validating the diagram:\n' +
                    '* Number of attempts for a is -2. Only whole positive numbers are allowed.',
            ),
        )
    })

    it.concurrent(`attempts are 0`, () => {
        expect(() =>
            mermaidToScaffold(
                `
---
title: Workflow
---

stateDiagram-v2
    [*] --> a
    a --> a: attempts=0
    a --> [*]
                `.trim(),
                `./test.ts`,
                '.',
            ),
        ).toThrow(
            new Error(
                'Found errors while validating the diagram:\n' +
                    '* Number of attempts for a is 0. Only whole positive numbers are allowed.',
            ),
        )
    })

    it.concurrent(`attempts are not whole number`, () => {
        expect(() =>
            mermaidToScaffold(
                `
---
title: Workflow
---

stateDiagram-v2
    [*] --> a
    a --> a: attempts=1.23
    a --> [*]
                `.trim(),
                `./test.ts`,
                '.',
            ),
        ).toThrow(
            new Error(
                'Found errors while validating the diagram:\n' +
                    '* Number of attempts for a is 1.23. Only whole positive numbers are allowed.',
            ),
        )
    })

    it.concurrent(`backoffMs is text`, () => {
        expect(() =>
            mermaidToScaffold(
                `
---
title: Workflow
---

stateDiagram-v2
    [*] --> a
    a --> a: backoffMs=a
    a --> [*]
                `.trim(),
                `./test.ts`,
                '.',
            ),
        ).toThrow(
            new Error(
                'Found errors while validating the diagram:\n' +
                    "* backoffMs for a is 'a', which is not a number. Only whole positive numbers are allowed.",
            ),
        )
    })

    it.concurrent(`backoffMs is negative`, () => {
        expect(() =>
            mermaidToScaffold(
                `
---
title: Workflow
---

stateDiagram-v2
    [*] --> a
    a --> a: backoffMs=-2
    a --> [*]
                `.trim(),
                `./test.ts`,
                '.',
            ),
        ).toThrow(
            new Error(
                'Found errors while validating the diagram:\n' +
                    '* backoffMs for a is -2. Only whole positive numbers are allowed.',
            ),
        )
    })

    it.concurrent(`backoffMs is 0`, () => {
        expect(() =>
            mermaidToScaffold(
                `
---
title: Workflow
---

stateDiagram-v2
    [*] --> a
    a --> a: backoffMs=0
    a --> [*]
                `.trim(),
                `./test.ts`,
                '.',
            ),
        ).toThrow(
            new Error(
                'Found errors while validating the diagram:\n' +
                    '* backoffMs for a is 0. Only whole positive numbers are allowed.',
            ),
        )
    })

    it.concurrent(`backoffMs is not whole number`, () => {
        expect(() =>
            mermaidToScaffold(
                `
---
title: Workflow
---

stateDiagram-v2
    [*] --> a
    a --> a: backoffMs=1.23
    a --> [*]
                `.trim(),
                `./test.ts`,
                '.',
            ),
        ).toThrow(
            new Error(
                'Found errors while validating the diagram:\n' +
                    '* backoffMs for a is 1.23. Only whole positive numbers are allowed.',
            ),
        )
    })

    it.concurrent(`floating end states`, () => {
        expect(() =>
            mermaidToScaffold(
                `
---
title: Workflow
---

stateDiagram-v2
    state choice <<choice>>

    [*] --> decide
    decide --> choice
    choice --> left: chooseLeft
    choice --> right: chooseRight
                `.trim(),
                `./test.ts`,
                '.',
            ),
        ).toThrow(
            new Error(
                'Found errors while validating the diagram:\n' +
                    '* The state left has no outgoing connection and must be connected to the end state [*] explicitly.\n' +
                    '* The state right has no outgoing connection and must be connected to the end state [*] explicitly.',
            ),
        )
    })

    it.concurrent(`non-unique choices`, () => {
        expect(() =>
            mermaidToScaffold(
                `
---
title: Workflow
---

stateDiagram-v2
    state choice1 <<choice>>
    state choice2 <<choice>>

    [*] --> decide
    decide --> choice1
    choice1 --> left: makeTheChoice
    choice1 --> right: makeTheChoice
    left --> choice2
    choice2 --> right: makeTheChoice
    right --> [*]
                `.trim(),
                `./test.ts`,
                '.',
            ),
        ).toThrow(
            new Error(
                "Found errors while parsing the diagram's relations:\n" +
                    '* More than one relation coming out of choice1 is named makeTheChoice. Relation names must be unique for each source.',
            ),
        )
    })

    it.concurrent(`no cycles in DAG`, () => {
        expect(() =>
            mermaidToScaffold(
                `
---
title: RecursionWorkflow
---

stateDiagram-v2
    state decision <<choice>>

    direction LR
    [*] --> countDown
    countDown --> decision
    decision --> [*]: zero
    decision --> countDown: nonZero
                `.trim(),
                `./test.ts`,
                '.',
            ),
        ).toThrow(
            new Error(
                'The state diagram must be a directed acyclic graph (DAG), but found a cycle: countDown --> decision --> countDown.',
            ),
        )
    })
})
