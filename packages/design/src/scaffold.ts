import { parser, Statement, StateStatement } from './diagram/parser'
import _ from 'lodash'
import * as path from 'path'

const pascalCase = (identifier: string) => _.camelCase(identifier).replace(/^(\w)/, s => s.toUpperCase())

parser.yy = {
    setDirection: () => {
        // Intentionally left empty
    },
    trimColon: (text: string) => {
        return (/^\s*:\s*(.+)/.exec(text) ?? ['', ''])[1].trim()
    },
    setRootDoc: () => {
        // Intentionally left empty
    },
    getDividerId: () => {
        // Currently unused
        throw new Error('Unexpected usage of getDividerId')
    },
    setAccDescription: () => {
        // Currently unused
        throw new Error('Unexpected usage of setAccDescription')
    },
    setAccTitle: () => {
        // Currently unused
        throw new Error('Unexpected usage of setAccTitle')
    },
}

const NoOutgoingConnection = '???'

const EndState = { type: 'end-state', name: '[*]' }

type Step = {
    name: string
    attempts: number
    backoffMs: number
    whatsNext:
        | { type: 'step'; name: string }
        | {
              type: 'decision'
              name: string
          }
        | typeof NoOutgoingConnection
        | typeof EndState
}

type Decision = {
    name: string
    outcomes: { name: string; target: string }[]
}

function splitFile(mermaidContents: string): { header: string; diagramBody: string } {
    const split = /---(.+)---(.+)/s.exec(mermaidContents)

    if (split === null) {
        throw new Error('Unable to parse Mermaid diagram - please check that you have both a header and a diagram.')
    }

    return {
        header: split[1].trim(),
        diagramBody: split[2].trim(),
    }
}

function titleNameFromHeader(header: string): string {
    const titleExec = /^title\s*:\s*(.+)$/m.exec(header)

    if (titleExec === null) {
        throw new Error('Mermaid diagram must have a title. Please specify one in the header.')
    }

    return pascalCase(titleExec[1])
}

function inferStepsAndDecisions(diagramStatements: Statement[]): {
    firstStep: string
    decisions: Decision[]
    steps: Step[]
} {
    const steps: { [name: string]: Step } = {}
    const decisions: { [name: string]: Decision } = {}
    let firstStep: string | null = null

    const validDecisionNames = diagramStatements
        .filter(s => s.stmt === 'state' && s.type === 'choice')
        .map(s => (s as StateStatement).id)

    for (const statement of diagramStatements) {
        if (statement.stmt === 'state') {
            if (statement.type === 'choice') {
                // Already covered before
                continue
            }

            console.log(`Ignoring unsupported statement: ${JSON.stringify(statement)}`)
        } else if (statement.stmt === 'relation') {
            const from = statement.state1.id
            const to = statement.state2.id

            const fromDecision = validDecisionNames.includes(from)
            const toDecision = validDecisionNames.includes(to)

            // TODO: Split to validation and walking
            // TODO: Validate names are valid identifiers, too
            if (from === '[*]') {
                // First step
                if (firstStep !== null) {
                    throw new Error(
                        `Unable to have multiple first steps. Only one step may arrive from [*]. Found both ${firstStep} and ${statement.state2.id}.`,
                    )
                }

                if (to === '[*]') {
                    throw new Error('The initial state [*] may not be directly connected to the end state [*].')
                }

                firstStep = to
            } else {
                if (!fromDecision) {
                    steps[from] = steps[from] ?? {
                        name: from,
                        attempts: 1,
                        backoffMs: 1000,
                        whatsNext: NoOutgoingConnection,
                    }

                    const whatsNext = steps[from].whatsNext

                    if (whatsNext !== NoOutgoingConnection && from !== to) {
                        throw new Error(
                            `Only one relation may leave a non-decision step. The step ${from} is related to both of the steps ${whatsNext.name} and ${to}.`,
                        )
                    }
                }

                if (to === '[*]') {
                    steps[from].whatsNext = EndState
                } else {
                    if (!toDecision) {
                        steps[to] = steps[to] ?? {
                            name: to,
                            attempts: 1,
                            backoffMs: 1000,
                            whatsNext: NoOutgoingConnection,
                        }
                    }

                    if (!fromDecision && from !== to) {
                        steps[from].whatsNext = { name: to, type: toDecision ? 'decision' : 'step' }
                    }
                }
            }

            if (fromDecision) {
                if (from === to) {
                    throw new Error(
                        `Decisions may not have self-arrows. The decision ${statement.state1.id} connects to itself.`,
                    )
                }

                if (toDecision) {
                    throw new Error(
                        `A decision can not be directly connected to another decision. There is a connection between ${from} and ${to}.`,
                    )
                }

                if (statement.description === undefined) {
                    throw new Error(
                        `All relations coming out of decisions must be named. The relation from ${from} to ${statement.state2.id} is unnamed.`,
                    )
                }

                decisions[from] = decisions[from] ?? { name: from, outcomes: [] }
                decisions[from].outcomes.push({ name: statement.description, target: to })
            }

            if (from === to) {
                // This is a self-arrow
                if (statement.description === undefined) {
                    throw new Error(
                        `Self-arrows must include information about retries. The self-arrow on ${from} provides no information.`,
                    )
                }

                // Note: The parser escapes backslashes
                const parsedPairs: [string, string][] = statement.description
                    .replace('\\n', '\n')
                    .split('\n')
                    .map(s => s.split('='))
                    .filter(arr => arr.length === 2)
                    .map(([k, v]) => [k, v])

                const parameters: { [name: string]: string } = Object.fromEntries<string>(parsedPairs)

                if (parameters.attempts) {
                    const attempts = Number.parseFloat(parameters.attempts)

                    if (Number.isNaN(attempts)) {
                        throw new Error(
                            `Number of attempts for ${from} is not a number. Only whole positive numbers are allowed.`,
                        )
                    }

                    if (attempts <= 0 || Math.floor(attempts) !== attempts) {
                        throw new Error(
                            `Number of attempts for ${from} is ${attempts}. Only whole positive numbers are allowed.`,
                        )
                    }

                    steps[from].attempts = attempts
                }

                if (parameters.backoffMs) {
                    const backoffMs = Number.parseFloat(parameters.backoffMs)

                    if (Number.isNaN(backoffMs)) {
                        throw new Error(
                            `backoffMs for ${from} is not a number. Only whole positive numbers are allowed.`,
                        )
                    }

                    if (backoffMs <= 0 || Math.floor(backoffMs) !== backoffMs) {
                        throw new Error(
                            `backoffMs for ${from} is ${backoffMs}. Only whole positive numbers are allowed.`,
                        )
                    }

                    steps[from].backoffMs = backoffMs
                }
            }
        } else {
            console.log('Ignoring unsupported statement: ' + JSON.stringify(statement))
        }
    }

    if (firstStep === null) {
        throw new Error('Unable to determine any step being the first, with a relation coming from [*].')
    }

    const stepsWithoutOutgoingConnections = Object.values(steps)
        .filter(s => s.whatsNext === NoOutgoingConnection)
        .map(s => s.name)

    if (stepsWithoutOutgoingConnections.length > 0) {
        throw new Error(
            `The following steps have no outgoing connections and must be connected to the end state [*] explicitly: ${stepsWithoutOutgoingConnections.join(', ')}.`,
        )
    }

    return { firstStep, steps: Object.values(steps), decisions: Object.values(decisions) }
}

function fillScaffoldTemplate(
    implementationRef: string,
    decisionTypes: string[],
    registerStepCalls: string[],
    functionDeclarationsCode: string[],
    firstTaskName: string,
    firstPayloadName: string,
    payloadNames: string[],
    workflowName: string,
): string {
    return `/* This file is automatically generated. It gets overwritten on build */
import {CompleteWorkflow, WrongTimingError, WorkflowBase} from "@gamgee/run";
import {StateStore} from "@gamgee/interfaces/store";
import {WorkflowTask} from "@gamgee/interfaces/task";

import {${payloadNames.join(', ')}} from "${implementationRef}";

${decisionTypes.join('\n\n')}

export abstract class ${workflowName}Base extends WorkflowBase {
    protected constructor() {
        super('${workflowName}');
        
        ${registerStepCalls.join('\n        ')}
    }
    
    async submit(payload: ${firstPayloadName}, store: StateStore, uniqueInstanceId?: string): Promise<string> {
        const task = await super._enqueue('${escapeString(firstTaskName)}', payload, store, uniqueInstanceId);
        return task.instanceId;
    }

    ${functionDeclarationsCode.join('\n\n    ')}    

    protected _registerStep() {
        throw new WrongTimingError();
    }
    
    protected _enqueue(): Promise<WorkflowTask> {
        throw new WrongTimingError();
    }
}`
}

function stepNameToPayloadName(stepName: string) {
    return `${pascalCase(stepName)}Payload`
}

function decisionNameToTypeName(decisionName: string) {
    return `${pascalCase(decisionName)}Decision`
}

function escapeString(str: string) {
    return str.replace("'", "\\'")
}

function typeCodeFromDecision(decision: Decision) {
    const outcomes = decision.outcomes.map(
        o => `{
    decision: '${escapeString(o.name)}',
    targetTaskName: '${escapeString(o.target)}',
    payload: ${stepNameToPayloadName(o.target)},
}`,
    )

    return `export type ${decisionNameToTypeName(decision.name)} = ${outcomes.join(' | ')};`
}

function registerStepCallCodeFromStep(step: Step) {
    return `super._registerStep({ name: '${escapeString(step.name)}', run: this.${stepToFunctionName(step)}, attempts: ${step.attempts}, backoffMs: ${step.backoffMs} });`
}

function stepToFunctionName(step: Step) {
    return _.camelCase(step.name)
}

function functionDeclarationCodeFromStep(step: Step) {
    let returnType: string

    switch (step.whatsNext) {
        case NoOutgoingConnection:
            throw new Error(`Step ${step.name} has no outgoing connections.`)

        case EndState:
            returnType = 'CompleteWorkflow'
            break

        default:
            switch (step.whatsNext.type) {
                case 'step':
                    returnType = `{ targetTaskName: '${_.camelCase(step.whatsNext.name)}', payload: ${stepNameToPayloadName(step.whatsNext.name)} }`
                    break

                case 'decision':
                    returnType = decisionNameToTypeName(step.whatsNext.name)
                    break

                default:
                    throw new Error(`Internal error: Unknown next step type ${JSON.stringify(step.whatsNext)}`)
            }
    }

    return `abstract ${stepToFunctionName(step)}(payload: ${stepNameToPayloadName(step.name)}): Promise<${returnType}>;`
}

// TODO: implementationRelativePath is currently useless
export function mermaidToScaffold(
    mermaidContents: string,
    diagramFilePath: string,
    implementationRelativePath: string,
) {
    const { header, diagramBody } = splitFile(mermaidContents)

    const titleName = titleNameFromHeader(header)

    const output = parser.parse(diagramBody)

    const { firstStep, steps, decisions } = inferStepsAndDecisions(output)

    if (steps.length === 0) {
        throw new Error('Diagram has no steps that end in the end state [*].')
    }

    const decisionTypesCode: string[] = decisions.map(d => typeCodeFromDecision(d))
    const registerStepCalls: string[] = steps.map(s => registerStepCallCodeFromStep(s))
    const functionDeclarationsCode: string[] = steps.map(s => functionDeclarationCodeFromStep(s))

    const baseName = path.basename(diagramFilePath, path.extname(diagramFilePath))
    const generatedFilePath = path.join(path.dirname(diagramFilePath), baseName + '.generated.ts')
    const implementationRef = `${implementationRelativePath}/${baseName}`.replace('//', '/')

    return {
        generatedFilePath,
        contents: fillScaffoldTemplate(
            implementationRef,
            decisionTypesCode,
            registerStepCalls,
            functionDeclarationsCode,
            firstStep,
            stepNameToPayloadName(firstStep),
            steps.map(s => stepNameToPayloadName(s.name)),
            pascalCase(titleName),
        ),
    }
}
